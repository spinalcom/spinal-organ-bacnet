import { SpinalListenerModel } from "spinal-model-bacnet";
import NetworkService from "spinal-model-bmsnetwork";
import { MinPriorityQueue } from "@datastructures-js/priority-queue";

import { SpinalNetworkServiceUtilities } from "../utilities/SpinalNetworkServiceUtilities";
import { SpinalQueuing } from "../utilities/SpinalQueuing";
import { SpinalDevice } from "./SpinalDevice";
import * as lodash from "lodash";
import { SpinalNode } from "spinal-model-graph";

import { IDataMonitor } from "../Interfaces/IDataMonitor";

class SpinalMonitoring {

   private queue: SpinalQueuing = new SpinalQueuing();
   // private priorityQueue: MinPriorityQueue<{ interval: number; functions: { id: string; func: Function }[] }> = new MinPriorityQueue();
   private priorityQueue: MinPriorityQueue<{ interval: number; }> = new MinPriorityQueue();
   private isProcessing: boolean = false;
   private intervalTimesMap: Map<number, any> = new Map();
   private initializedMap: Map<string, boolean> = new Map();

   private devices: Array<string> = [];


   constructor() { }

   public async addToMonitoringList(spinalListenerModel: SpinalListenerModel): Promise<void> {
      this.queue.addToQueue(spinalListenerModel);
   }

   init() {
      this.queue.on("start", () => {
         console.log("start monitoring...");

         this.startDeviceInitialisation();
      })
   }


   public async startDeviceInitialisation() {
      const list = this.queue.getQueue();
      this.queue.refresh();

      const promises = list.map(el => SpinalNetworkServiceUtilities.initSpinalListenerModel(el));

      const devices = lodash.flattenDeep(await Promise.all(promises));
      const filtered = devices.filter(el => typeof el !== "undefined");

      await this._addToMaps(filtered);
      // await this.addToQueue(filtered);

      if (!this.isProcessing) {
         this.isProcessing = true;
         this.startMonitoring()
      }
   }

   public async startMonitoring() {
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

   private async _addToMaps(devices: Array<IDataMonitor>) {
      for (const { id, spinalModel, spinalDevice, networkService, network } of devices) {
         spinalModel.listen.bind(async () => {
            const value = spinalModel.listen.get();
            if (!value) {
               console.log("stopped", value);
               this.removeToMaps(id);
               return;
            }
            const monitors = spinalModel.monitor.getMonitoringData();
            const promises = monitors.map(async ({ interval, children }) => {
               if (isNaN(interval) || interval <= 0 || children.length <= 0) return;

               await this.createDataIfNotExist(spinalDevice, children, networkService, network, interval);
               const func = async () => this.funcToExecute(spinalModel, spinalDevice, children, networkService, network);

               let value = this.intervalTimesMap.get(interval);
               if (typeof value === "undefined") {
                  value = [];
               }

               value.push({ id, func })
               this.intervalTimesMap.set(interval, value);
               const arr = this.priorityQueue.toArray();

               const found = arr.find(({ element }) => {
                  return element.interval === interval;
               })

               if (typeof found === "undefined") {
                  this.priorityQueue.enqueue({ interval }, Date.now() + interval);
               }

               return;
            })

            return Promise.all(promises);
         })
      }

   }

   private removeToMaps(deviceId: string) {
      this.intervalTimesMap.forEach((value, key) => {
         this.intervalTimesMap.set(key, value.filter(el => el.id !== deviceId));
      })
   }

   private async execFunc(functions: { id: string; func: Function }[], interval: number, date?: number) {
      // console.log(this.intervalTimesMap);

      // console.log("functions !!",functions);
      if (date && Date.now() < date) {
         console.log("wait ");
         await this.waitFct(date - Date.now());
      }
      try {
         const deep_functions = [...functions]
         // console.log("deep_functions", deep_functions);

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

   private async createDataIfNotExist(spinalDevice: SpinalDevice, children: Array<any>, networkService: NetworkService, network: SpinalNode<any>, interval: number) {
      try {
         const id = `${spinalDevice.device.deviceId}_${interval}`;
         let init = this.initializedMap.get(id);

         if (!init) {
            console.log("initialisation");
            this.initializedMap.set(id, true);
            await spinalDevice.checkAndCreateIfNotExist(networkService, children);
         }
      } catch (error) { }

   }

   private async funcToExecute(spinalModel: SpinalListenerModel, spinalDevice: SpinalDevice, children: Array<any>, networkService: NetworkService, network: SpinalNode<any>) {
      if (spinalModel.listen.get() && children?.length > 0) {
         await spinalDevice.updateEndpoints(networkService, network, children);
      }
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

   /*


      private addToQueue(devices: Array<IDataMonitor>) {
         // this.intervalTimesMap.forEach((value, interval) => {
         //    this.priorityQueue.enqueue({ interval, functions: value }, Date.now() + interval)
         // })
      }

      private async monitDevice(data) {
         let monitorBind;
   
         data.spinalModel.listen.bind(async () => {
            if (data.spinalModel.listen.get() && data.spinalModel.monitor) {
               const objectIds = this._getItemLists(data.spinalModel);
               await data.spinalDevice.checkAndCreateIfNotExist(data.networkService, objectIds);
               monitorBind = data.spinalModel.monitor.bind(() => {
                  this._stopMonitors(data.monitors);
   
                  for (let i = 0; i < data.spinalModel.monitor.length; i++) {
                     const model = data.spinalModel.monitor[i];
                     const monitor = new Monitor(model, data.networkService, data.spinalDevice, data.spinalModel, data.network);
                     monitor.start();
                     if (data.monitors) {
                        data.monitors.push(monitor);
                     } else {
                        data.monitors = [monitor]
                     }
                     // this.monitors.push(monitor);
                  }
               })
            } else if (!data.spinalModel.listen.get()) {
               if (monitorBind) {
                  data.spinalModel.monitor.unbind(monitorBind);
               }
               this._stopMonitors(data.monitors);
            }
         })
      }
   


   private _stopMonitors(monitors = []) {
      for (const spinalMonitoring of monitors) {
         spinalMonitoring.stop()
      }

      monitors = [];
   }

   private _getItemLists(listenerModel: SpinalListenerModel): Array<{ instance: number; type: number }> {
      if (listenerModel.monitor) {
         let objectIds = []

         for (let i = 0; i < listenerModel.monitor.length; i++) {
            objectIds.push(...listenerModel.monitor[i].children.get());
         }

         return objectIds;
      }

      return [];
   }
*/


}

const spinalMonitoring = new SpinalMonitoring();
spinalMonitoring.init();

export default spinalMonitoring;
export {
   spinalMonitoring
}
