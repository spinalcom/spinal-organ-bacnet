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
import { IDataMonitor, ICovData } from "../Interfaces";
import { SpinalCov } from "./SpinalCov";


type priorityQueueElementType = { id: string; interval: number; priority: number; }
class SpinalMonitoring {

   private queue: SpinalQueuing<SpinalListenerModel> = new SpinalQueuing();
   private priorityQueue: MinPriorityQueue<priorityQueueElementType> = new MinPriorityQueue();
   private initilizationIsProcessing: boolean = false;
   private intervalTimesMap: Map<number, any> = new Map();
   private binded: Map<string, BindProcess> = new Map();
   private devices: { [key: string]: SpinalListenerModel } = {};
   private _itemToAddToMap: SpinalQueuing<{ id: string; interval: number; func: Function }> = new SpinalQueuing();
   private _endpointsCreationQueue: SpinalQueuing<{ spinalDevice: SpinalDevice, children: Array<any>, networkService: NetworkService }> = new SpinalQueuing();
   private _covList: ICovData[] = [];

   private static instance: SpinalMonitoring;

   private constructor() { }

   public static getInstance(): SpinalListenerModel {
      if (!this.instance) {
         this.instance = new SpinalMonitoring();
         this.instance.init();
      }
      return this.instance;
   }

   // this function is used to add a spinal listener model to the monitoring Queue
   public async addToMonitoringList(spinalListenerModel: SpinalListenerModel): Promise<void> {
      this.queue.addToQueue(spinalListenerModel);
   }

   // initialize the monitoring system
   private init() {

      // process the monitoring queue
      this.queue.on("start", () => {
         console.log("start initialisation...");
         this.startDeviceInitialisation();
      })

      // process the item to add to map queue
      this._itemToAddToMap.on("start", async () => {

         // add all items to the monitoring map
         while (!this._itemToAddToMap.isEmpty()) {
            //@ts-ignore
            const item = this._itemToAddToMap.dequeue();
            if (item) {
               this._addToMonitoringMap(item.id, item.interval, item.func);
            }
         }
      })

      this._endpointsCreationQueue.on("start", async () => {
         while (!this._endpointsCreationQueue.isEmpty()) {
            try {
               // console.log("begin");
               const { spinalDevice, children, networkService } = this._endpointsCreationQueue.dequeue();
               await spinalDevice.checkAndCreateIfNotExist(networkService, children);
               // console.log("end")

            } catch (error) {
               console.error(error)
            }
         }
      })
   }

   public async startDeviceInitialisation() {
      const monitoringData = await this._initNetworkUtilities();

      const promises = this._createMaps(monitoringData);
      const data = await Promise.all(promises);

      // if monitoring is not already initialized
      if (!this.initilizationIsProcessing) {
         this.initilizationIsProcessing = true;

         for (const iterator of data.flat()) {
            if (iterator && iterator.id && iterator.intervals) {
               for (const { interval, func } of iterator.intervals) {
                  this._addToMonitoringMap(iterator.id, interval, func);
               }
            }
         }

         console.log("waiting endpoints creation");
         await this._waitEndpointCreation();
         console.log("end of endpoints creation");


         this.startMonitoring()
         SpinalCov.getInstance().startCovProcessing(); // start cov processing
      }

   }

   public async startMonitoring() {
      console.log("start monitoring...");

      let p = true;
      while (p) {
         if (this.priorityQueue.isEmpty()) {
            await this.waitFct(500);
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
         if (!data) continue; // l'element a été supprimer de la liste des devices à monitorer

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

   private _createMaps(devices: Array<IDataMonitor>): Promise<{ id: string; intervals: { interval: number; func: Function }[] }>[] {
      return devices.map(({ id, spinalModel, spinalDevice, networkService, network }): any => {
         return new Promise((resolve, reject) => {
            let process = this.binded.get(id);
            if (process) return resolve(undefined); // if the device is already binded

            //////////////////
            // if the device is not binded, bind it //
            //////////////////
            process = spinalModel.listen.bind(async () => {
               const isMonitored = spinalModel.listen.get();
               const alreadyInit = this.devices[id];
               const deviceName = spinalDevice.device.name;

               // if the device is monitored
               if (isMonitored) {
                  console.log(`${deviceName} is running`);

                  // get items monitored and their intervals
                  const monitors = spinalModel.monitor.getMonitoringData();

                  // get valid intervals (filter cov and 0)
                  const intervals = await this.getValidIntervals(spinalDevice, networkService, spinalModel, network, monitors);

                  // if the device is not already initialized
                  if (!alreadyInit) {
                     this.devices[id] = spinalModel;
                     console.log(`${deviceName} initialized`);
                     return resolve({ id, intervals });
                  }

                  // else if already initialized, just add the intervals to the monitoring map
                  for (const { interval, func } of intervals) {
                     this._itemToAddToMap.addToQueue({ id, interval, func });
                     resolve(undefined);
                  }

               } else {
                  console.log(`${deviceName} is stopped`);
                  await this.removeFromMonitoringMaps(id); // remove from monitoring maps
                  SpinalCov.getInstance().addToStopCovQueue(spinalDevice.covData); // remove cov data from cov monitoring
                  // call clear cov after stopping cov monitoring;
                  await spinalDevice.clearCovList(); // clear cov list in device, because cov monitoring is stopped

                  if (!alreadyInit) this.devices[id] = spinalModel; // keep the device in the list even if not initialized
                  return resolve(undefined);
               }

            }, true)

            this.binded.set(id, process);
         });

      })
   }

   /**
    *  Add an item to the monitoring map and priority queue
    * @param id 
    * @param interval 
    * @param func 
    */
   private _addToMonitoringMap(id: string, interval: number, func: Function) {
      let priority = Date.now() + interval;
      let value = this.intervalTimesMap.get(priority); // get existing data for this interval time
      if (!value) value = []; // create new array if not exist

      value.push({ id, func });
      this.intervalTimesMap.set(priority, value);

      this.priorityQueue.enqueue({ id, interval, priority }, priority); // add to priority queue
   }

   private removeFromMonitoringMaps(deviceId: string) {
      this.removeFromPriorityQueue(deviceId);

      this.intervalTimesMap.forEach((value, key) => {
         const copy = !Array.isArray(value) ? [value] : value;
         const filtered = copy.filter(el => el.id !== deviceId);

         if (filtered.length === 0) this.intervalTimesMap.delete(key);
         else this.intervalTimesMap.set(key, filtered);
      })
   }


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

         this.priorityQueue.enqueue({ id, interval, priority }, priority);
      }

      this.intervalTimesMap.set(priority, data);
   }

   private async createDataIfNotExist(spinalDevice: SpinalDevice, children: Array<any>, networkService: NetworkService, interval: number) {
      try {
         // // const id = `${spinalDevice.device.deviceId}_${interval}`;
         // // let init = this.initializedMap.get(id);

         // // if (!init) {
         // //    // console.log("initialisation");
         // //    this.initializedMap.set(id, true);
         //    await spinalDevice.checkAndCreateIfNotExist(networkService, children);
         // // }



         // Traiter la creation des endpoinrs dans une Queue, 
         // pour eviter l'envoie de plusieurs requête bacnet
         this._endpointsCreationQueue.addToQueue({ spinalDevice, children, networkService });

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
         if (children.length <= 0 || interval == 0) continue;

         // if cov or 0
         if (interval.toString().toLowerCase() === "cov") {
            const covData: ICovData = { spinalModel, spinalDevice, children, networkService, network };
            // this._covList.push(covData);
            SpinalCov.getInstance().addToCovQueue(covData); // add directly to cov monitoring
            spinalDevice.pushToCovList(covData);
         } else {
            // add interval to pooling list
            const func = async () => this.funcToExecute(spinalModel, spinalDevice, children, networkService, network);
            res.push({ interval, children, func })
         }

         await this.createDataIfNotExist(spinalDevice, children, networkService, interval);
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

   private _waitEndpointCreation() {
      return new Promise((resolve, reject) => {
         const wait = () => {
            setTimeout(() => {
               if (this._endpointsCreationQueue.isEmpty()) resolve(undefined);
               else wait();
            }, 400)
         }

         wait();

      });
   }

   private removeFromPriorityQueue(id: string) {
      const removed = [];
      const dequeued = [];
      while (!this.priorityQueue.isEmpty()) {
         //@ts-ignore
         const { element, priority } = this.priorityQueue.dequeue();
         if (element.id === id) {
            removed.push({ element, priority });
         } else {
            dequeued.push({ element, priority });
         }
      }

      dequeued.forEach((val) => this.priorityQueue.enqueue(val.element, val.priority));
      return removed;
   }
}

const spinalMonitoring = SpinalMonitoring.getInstance();
// spinalMonitoring.init();

export default spinalMonitoring;
export {
   spinalMonitoring
}
