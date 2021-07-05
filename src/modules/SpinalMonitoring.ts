import { SpinalListenerModel } from "spinal-model-bacnet";
import NetworkService from "spinal-model-bmsnetwork";
import { SpinalNode } from "spinal-env-viewer-graph-service";
import { MinPriorityQueue } from "@datastructures-js/priority-queue";

import { SpinalNetworkServiceUtilities } from "../utilities/SpinalNetworkServiceUtilities";
import { SpinalQueuing } from "../utilities/SpinalQueuing";
import { Monitor } from "../utilities/Monitor";
import { SpinalDevice } from "./SpinalDevice";
import * as lodash from "lodash";

class SpinalMonitoring {

   private queue: SpinalQueuing = new SpinalQueuing();
   private priorityQueue: MinPriorityQueue<{ interval: number; functions: Function[] }> = new MinPriorityQueue();
   private isProcessing: boolean = false;
   private intervalTimesMap: Map<string | number, any> = new Map();

   // private devices: Array<{
   //    networkService: NetworkService,
   //    spinalDevice: SpinalDevice,
   //    spinalModel: SpinalListenerModel,
   //    network: SpinalNode<any>,
   //    monitors?: Monitor[]
   // }> = [];


   constructor() { }

   init() {
      this.queue.on("start", () => {
         console.log("start");

         this.startDeviceInitialisation();
      })
   }

   public async addToMonitoringList(spinalListenerModel: SpinalListenerModel): Promise<void> {
      this.queue.addToQueue(spinalListenerModel);
   }


   public async startDeviceInitialisation() {
      const list = this.queue.getQueue();
      this.queue.refresh();

      const promises = list.map(el => SpinalNetworkServiceUtilities.initSpinalListenerModel(el));
      const devices = lodash.flattenDeep(await Promise.all(promises));
      this._addToMaps(devices);

      if (!this.isProcessing) {
         this.isProcessing = true;
         this.startMonitoring()
      }
   }

   public async startMonitoring() {
      let p = true;
      while (p) {
         const { priority, element } = this.priorityQueue.dequeue();
         await this.execFunc(element.functions, element.interval, priority);
      }

      // for (const data of this.devices) {
      //    await this.monitDevice(data);
      // }
   }




   private async execFunc(functions: Function[], interval: number, date?: number) {

      if (date && Date.now() < date) {
         await this.waitFct(date - Date.now());
      }
      try {
         const deep_functions = [...functions]
         console.log("deep_functions", deep_functions);

         while (deep_functions.length > 0) {
            try {
               const func = deep_functions.shift();
               if (typeof func === "function") await func();
            } catch (error) { }
         }
         this.priorityQueue.enqueue({ interval, functions }, Date.now() + interval);
      } catch (error) {
         this.priorityQueue.enqueue({ interval, functions }, Date.now() + interval);
      }

   }

   private _addToMaps(devices: Array<{ interval: number; func: Function }>) {

      for (const { interval, func } of devices) {
         if (isNaN(interval)) continue;

         const value = this.intervalTimesMap.get(interval);
         if (typeof value !== "undefined") {
            value.push(func);
         } else {
            this.intervalTimesMap.set(interval, [func])
            this.priorityQueue.enqueue({ interval, functions: this.intervalTimesMap.get(interval) }, Date.now() + interval)
         }
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