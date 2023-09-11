/*
 * Copyright 2022 SpinalCom - www.spinalcom.com
 * 
 * This file is part of SpinalCore.
 * 
 * Please read all of the following terms and conditions
 * of the Free Software license Agreement ("Agreement")
 * carefully.
 * 
 * This Agreement is a legally binding contract between
 * the Licensee (as defined below) and SpinalCom that
 * sets forth the terms and conditions that govern your
 * use of the Program. By installing and/or using the
 * Program, you agree to abide by all the terms and
 * conditions stated or referenced herein.
 * 
 * If you do not agree to abide by these terms and
 * conditions, do not demonstrate your acceptance and do
 * not install or use the Program.
 * You should have received a copy of the license along
 * with this file. If not, see
 * <http://resources.spinalcom.com/licenses.pdf>.
 */

import { SpinalListenerModel } from "spinal-model-bacnet";
import NetworkService from "spinal-model-bmsnetwork";
import { MinPriorityQueue } from "@datastructures-js/priority-queue";
import { BindProcess } from "spinal-core-connectorjs_type";
import { SpinalNetworkServiceUtilities } from "../utilities/SpinalNetworkServiceUtilities";
import { SpinalQueuing } from "../utilities/SpinalQueuing";
import { SpinalDevice } from "./SpinalDevice";
import * as lodash from "lodash";
import { SpinalNode } from "spinal-model-graph";
import { IDataMonitor } from "../Interfaces/IDataMonitor";


type priorityQueueElementType = { id: string; interval: number; priority: number; }
class SpinalMonitoring {
   
   private queue: SpinalQueuing<SpinalListenerModel> = new SpinalQueuing();
   // private priorityQueue: MinPriorityQueue<{ interval: number; functions: { id: string; func: Function }[] }> = new MinPriorityQueue();
   private priorityQueue: MinPriorityQueue<priorityQueueElementType> = new MinPriorityQueue();
   private isProcessing: boolean = false;
   private intervalTimesMap: Map<number, any> = new Map();
   private initializedMap: Map<string, boolean> = new Map();
   private binded: Map<string, BindProcess> = new Map();
   private devices: {[key:string] : SpinalListenerModel} = {};
   private _itemToAddToMap : SpinalQueuing<{ id: string; interval: number; func: Function}> = new SpinalQueuing()
   
   private static instance: SpinalMonitoring;

   private constructor() { }

   public static getInstance(): SpinalListenerModel {
      if (!this.instance) {
         this.instance = new SpinalMonitoring();
         this.instance.init();
      }
      return this.instance;
   }

   public async addToMonitoringList(spinalListenerModel: SpinalListenerModel): Promise<void> {
      this.queue.addToQueue(spinalListenerModel);
   }

   private init() {
      this.queue.on("start", () => {
         console.log("start initialisation...");
         this.startDeviceInitialisation();
      })

      this._itemToAddToMap.on("start", async () => {
         while (!this._itemToAddToMap.isEmpty()) {
            //@ts-ignore
            const item = this._itemToAddToMap.dequeue();
            if (item) {
               this._addToMap(item.id, item.interval, item.func);
            }
         }
      })
   }

   public async startDeviceInitialisation() {
      const monitoringData = await this._initNetworkUtilities();

      const promises = this._createMaps(monitoringData);
      const data = await Promise.all(promises);

      

      if (!this.isProcessing) {
         this.isProcessing = true;

         for (const iterator of data.flat()) {
            if (iterator && iterator.id && iterator.intervals) {
               for (const {interval, func } of iterator.intervals) {
                  this._addToMap(iterator.id, interval, func);
               }
            }
         }

         this.startMonitoring()
      }
   }

   public async startMonitoring() {
      console.log("start monitoring...");

      let p = true;
      while (p) {
         if (this.priorityQueue.isEmpty()) {
            await this.waitFct(100);
            continue;
         }

         //@ts-ignore
         const { priority, element } = this.priorityQueue.dequeue();
         
         // Si c'est pas le moment de la mise à jour le remettre dans la queue uniquement s'il est toujours monitoré
         if (priority && Date.now() < priority) {
            const listen = this.devices[element.id]?.listen?.get();
            if (listen) {
               this.priorityQueue.enqueue(element, priority);
               await this.waitFct(100);
            }
            continue;
         }

         // this.execFunc(element, priority);
         

         let data = this.intervalTimesMap.get(element.priority);
         if (!data) continue; // l'element à été supprimer de la liste des devices à monitorer

         if (!Array.isArray(data)) data = [data];

         if (data && data.length > 0) {
            await this.execFunc(data, element.interval, priority);
         }

         this.intervalTimesMap.delete(element.priority);
      }
   }

   private async _initNetworkUtilities(): Promise<IDataMonitor[]> {
      const queueList = this.queue.getQueue();
      this.queue.refresh();

      const promises = await queueList.reduce(async (prom, el) => {
         const liste = await prom;
         const res = await SpinalNetworkServiceUtilities.initSpinalListenerModel(el)
         liste.push(res);
         return liste;
      }, Promise.resolve([]));

      return lodash.flattenDeep(await Promise.all(promises)).filter(el => typeof el !== "undefined");
   }

   private _createMaps(devices: Array<IDataMonitor>): Promise<{ id: string;  intervals: {interval: number; func: Function}[]}>[] {
      return devices.map(({ id, spinalModel, spinalDevice, networkService, network }): any => {
         return new Promise((resolve, reject) => {
            let process = this.binded.get(id);
            if (process) return resolve(undefined);

            process = spinalModel.listen.bind(async () => {
               const listen = spinalModel.listen.get();
               const alreadyInit = this.devices[id];
               if (!listen) {
                  this.removeToMaps(id);
                  console.log(spinalDevice.device.name, "is stopped");
                  if (!alreadyInit) {
                     this.devices[id] = spinalModel;
                     return resolve(undefined);
                  }
                  return;
               }
               
               console.log(spinalDevice.device.name, "is running");
               const monitors = spinalModel.monitor.getMonitoringData();
               const intervals = await this.getValidIntervals(spinalDevice, networkService, spinalModel, network, monitors);
               if (!alreadyInit) {
                  this.devices[id] = spinalModel;
                  console.log(spinalDevice.device.name, "initialized");
                  return resolve({ id, intervals });
               }
               
               for (const { interval, func } of intervals) {
                  this._itemToAddToMap.addToQueue({id, interval, func});
               }

               console.log(spinalDevice.device.name, "initialized");               
            }, true)

            this.binded.set(id, process);
         });
         
      })
   }

   private _addToMap(id: string, interval: number, func: Function) {
      // let value = this.intervalTimesMap.get(interval);
      // if (typeof value === "undefined") {
      //    value = [];
      // }

      // value.push({ id, func })
      // this.intervalTimesMap.set(interval, value);
      // this._addIntervalToPriorityQueue(interval);
      let priority = Date.now() + interval;
      let value = this.intervalTimesMap.get(priority);
      if (!value) value = [];

      value.push({ id, func });
      this.intervalTimesMap.set(priority, value);
      this.priorityQueue.enqueue({ id, interval, priority }, priority);
   }

   private removeToMaps(deviceId: string) {
      this.removeFromPriorityQueue(deviceId);

      this.intervalTimesMap.forEach((value, key) => {
         const copy = !Array.isArray(value) ? [value] : value;
         const filtered = copy.filter(el => el.id !== deviceId);

         if (filtered.length === 0) this.intervalTimesMap.delete(key);
         else this.intervalTimesMap.set(key, filtered);
      })
   }

   // private async execFunc(data: priorityQueueElementType, date?: number) {

   //    const priority = Date.now() + data.interval;
   //    // const deep_functions = [...data]

   //    // while (deep_functions.length > 0) {
   //    //    const { id, func } = deep_functions.shift();
   //       try {

   //          if (typeof data.func === "function") {
   //             await data.func();
   //          }
            
   //       } catch (error) { console.error(error); }
         
   //       this.priorityQueue.enqueue(data, priority);
   //    // }

   //    // this.intervalTimesMap.set(priority, data);
   // }

   // private _addIntervalToPriorityQueue(interval: number) {
   //    const arr = this.priorityQueue.toArray();
   //    const found = arr.find(({ element }) => {
   //       return element.interval === interval;
   //    })

   //    if (typeof found === "undefined") {
   //       this.priorityQueue.enqueue({ interval }, Date.now() + interval);
   //    }
   // }

   private async execFunc(data: { id: string; func: Function }[], interval: number, date?: number) {

      const priority = Date.now() + interval;
      const deep_functions = [...data]

      while (deep_functions.length > 0) {
         const { id, func } = deep_functions.shift();
         try {

            if (typeof func === "function") {
               await func();
            }
            
         } catch (error) { console.error(error); }
         
         this.priorityQueue.enqueue({id, interval, priority }, priority);
      }

      this.intervalTimesMap.set(priority, data);
   }

   private async createDataIfNotExist(spinalDevice: SpinalDevice, children: Array<any>, networkService: NetworkService, interval: number) {
      try {
         // const id = `${spinalDevice.device.deviceId}_${interval}`;
         // let init = this.initializedMap.get(id);

         // if (!init) {
         //    // console.log("initialisation");
         //    this.initializedMap.set(id, true);
            await spinalDevice.checkAndCreateIfNotExist(networkService, children);
         // }
      } catch (error) {
         console.error(error)
      }

   }

   private async funcToExecute(spinalModel: SpinalListenerModel, spinalDevice: SpinalDevice, children: Array<any>, networkService: NetworkService, network: SpinalNode<any>) {
      if (spinalModel.listen.get() && children?.length > 0) {
         await spinalDevice.updateEndpoints(networkService, network, children);
      }
   }

   private async getValidIntervals(spinalDevice: SpinalDevice, networkService: NetworkService, spinalModel: SpinalListenerModel, network: SpinalNode<any>, monitors: { interval: number; children: [] }[]) {
      const monitors_copy = Object.assign([], monitors);
      const res = []
      while (monitors_copy.length > 0) {
         const { interval, children } = monitors_copy.shift();
         if (isNaN(interval) || interval <= 0 || children.length <= 0) continue;
         await this.createDataIfNotExist(spinalDevice, children, networkService, interval);
         const func = async () => this.funcToExecute(spinalModel, spinalDevice, children, networkService, network);
         res.push({ interval, children, func})
      }
      return res;
   }

   private waitFct(nb: number): Promise<void> {
      return new Promise((resolve) => {
         setTimeout(
            () => {
               resolve();
            },
            nb >= 0 ? nb : 0);
      });
   }

   private removeFromPriorityQueue(id: string) {
      const removed = [];
      const dequeued = [];
      while (!this.priorityQueue.isEmpty()) {
         //@ts-ignore
         const {element,priority} = this.priorityQueue.dequeue();
         if (element.id === id) {
            removed.push({element, priority});
         } else {
            dequeued.push({element, priority});
         }
      }

      dequeued.forEach((val) => this.priorityQueue.enqueue(val.element,val.priority));
      return removed;
   }
}

const spinalMonitoring = SpinalMonitoring.getInstance();
// spinalMonitoring.init();

export default spinalMonitoring;
export {
   spinalMonitoring
}
