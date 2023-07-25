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


class SpinalMonitoring {
   
   private queue: SpinalQueuing<SpinalListenerModel> = new SpinalQueuing();
   // private priorityQueue: MinPriorityQueue<{ interval: number; functions: { id: string; func: Function }[] }> = new MinPriorityQueue();
   private priorityQueue: MinPriorityQueue<{ interval: number; }> = new MinPriorityQueue();
   private isProcessing: boolean = false;
   private intervalTimesMap: Map<number, any> = new Map();
   private initializedMap: Map<string, boolean> = new Map();
   private binded: Map<string, BindProcess> = new Map();
   private devices: Array<string> = [];

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
   }

   public async startDeviceInitialisation() {
      const monitoringData = await this._initNetworkUtilities();

      await this._createMaps(monitoringData);

      if (!this.isProcessing) {
         this.isProcessing = true;
         this.startMonitoring()
      }
   }

   public async startMonitoring() {
      console.log("start monitoring...");

      let p = true;
      while (p) {
         if (this.priorityQueue.isEmpty()) {
            // console.log("priority queue is empty");

            await this.waitFct(100);
            continue;
         }

         const { priority, element } = this.priorityQueue.dequeue();
         const functions = this.intervalTimesMap.get(element.interval);

         if (functions && functions.length > 0) {
            await this.execFunc(functions, element.interval, priority);
         }


      }
   }

   private async _initNetworkUtilities(): Promise<IDataMonitor[]> {
      const list = this.queue.getQueue();
      this.queue.refresh();

      const promises = await list.reduce(async (prom, el) => {
         const liste = await prom;
         const res = await SpinalNetworkServiceUtilities.initSpinalListenerModel(el)
         list.push(res);
         return liste;
      }, Promise.resolve([]));

      return lodash.flattenDeep(await Promise.all(promises)).filter(el => typeof el !== "undefined");
   }

   private async _createMaps(devices: Array<IDataMonitor>) {
      const devices_copy = Object.assign([], devices);

      while (devices_copy.length > 0) {
         const { id, spinalModel, spinalDevice, networkService, network } = devices_copy.shift();
         let process = this.binded.get(id);

         if (process) spinalModel.listen.unbind(process);

         process = spinalModel.listen.bind(async () => {
            const listen = spinalModel.listen.get();
            if (!listen) {
               this.removeToMaps(id);
               console.log(spinalDevice.device.name, "is stopped");
               return;
            }
           
            const monitors = spinalModel.monitor.getMonitoringData();
            const intervals = await this.getValidIntervals(spinalDevice, networkService, spinalModel, network, monitors);
            for (const { interval, func } of intervals) {
               this._addToMap(id, interval, func);
            }

            console.log("listen changed");
            this.addToMonitoringList(spinalModel);
         }, true)

         this.binded.set(id, process);
      }



      // const promises = devices.map(async ({ id, spinalModel, spinalDevice, networkService, network }) => {
      //    const listen = spinalModel.listen.get();
      //    console.log("listen", listen);

      //    if (!listen) {
      //       this.removeToMaps(id);
      //       return;
      //    }
      //    const monitors = spinalModel.monitor.getMonitoringData();
      //    const intervals = await this.getValidIntervals(spinalDevice, networkService, spinalModel, network, monitors);
      //    // console.log(intervals);
      // })
   }


   private _addToMap(id: string, interval: number, func: Function) {
      let value = this.intervalTimesMap.get(interval);
      if (typeof value === "undefined") {
         value = [];
      }

      value.push({ id, func })
      this.intervalTimesMap.set(interval, value);
      this._addIntervalToPriorityQueue(interval);
   }

   private removeToMaps(deviceId: string) {
      this.intervalTimesMap.forEach((value, key) => {
         this.intervalTimesMap.set(key, value.filter(el => el.id !== deviceId));
      })
   }

   private _addIntervalToPriorityQueue(interval: number) {
      const arr = this.priorityQueue.toArray();
      const found = arr.find(({ element }) => {
         return element.interval === interval;
      })

      if (typeof found === "undefined") {
         this.priorityQueue.enqueue({ interval }, Date.now() + interval);
      }
   }

   private async execFunc(functions: { id: string; func: Function }[], interval: number, date?: number) {

      if (date && Date.now() < date) {
         console.log("wait");
         await this.waitFct(date - Date.now());
      }
      try {
         const deep_functions = [...functions]

         while (deep_functions.length > 0) {
            try {
               const { func } = deep_functions.shift();

               if (typeof func === "function") {
                  await func();
               }
            } catch (error) {
               console.error(error);

            }
         }
         this.priorityQueue.enqueue({ interval }, Date.now() + interval);
      } catch (error) {
         console.error(error);

         this.priorityQueue.enqueue({ interval }, Date.now() + interval);
      }

   }

   private async createDataIfNotExist(spinalDevice: SpinalDevice, children: Array<any>, networkService: NetworkService, interval: number) {
      try {
         const id = `${spinalDevice.device.deviceId}_${interval}`;
         let init = this.initializedMap.get(id);

         if (!init) {
            // console.log("initialisation");
            this.initializedMap.set(id, true);
            await spinalDevice.checkAndCreateIfNotExist(networkService, children);
         }
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
         res.push({
            interval,
            children,
            func
         })
      }
      return res;
      // const promises = monitors.map(async ({ interval, children }) => {
      //    if (isNaN(interval) || interval <= 0 || children.length <= 0) return;

      //    await this.createDataIfNotExist(spinalDevice, children, networkService, interval);
      //    const func = async () => this.funcToExecute(spinalModel, spinalDevice, children, networkService, network);

      //    return {
      //       interval,
      //       children,
      //       func
      //    }
      // })

      // return Promise.all(promises).then((result) => {
      //    return result.filter(el => !!el);
      // }).catch((err) => {
      //    return []
      // });
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
}

const spinalMonitoring = SpinalMonitoring.getInstance();
// spinalMonitoring.init();

export default spinalMonitoring;
export {
   spinalMonitoring
}
