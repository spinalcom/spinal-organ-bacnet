import { SpinalListenerModel } from "spinal-model-bacnet";
import NetworkService from "spinal-model-bmsnetwork";
import { MinPriorityQueue } from "@datastructures-js/priority-queue";

import { SpinalNetworkServiceUtilities } from "../utilities/SpinalNetworkServiceUtilities";
import { SpinalQueuing } from "../utilities/SpinalQueuing";
import { SpinalDevice } from "./SpinalDevice";
import * as lodash from "lodash";
import { SpinalNode } from "spinal-model-graph";

class SpinalMonitoring {

   private queue: SpinalQueuing = new SpinalQueuing();
   private priorityQueue: MinPriorityQueue<{ interval: number; functions: { id: string; func: Function }[] }> = new MinPriorityQueue();
   private isProcessing: boolean = false;
   private intervalTimesMap: Map<number, any> = new Map();
   private initializedMap: Map<string, boolean> = new Map();

   private devices: Array<string> = [];


   constructor() { }

   init() {
      this.queue.on("start", () => {
         console.log("start monitoring...");

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

      await this._addToMaps(devices);

      if (!this.isProcessing) {
         this.isProcessing = true;
         this.startMonitoring()
      }
   }

   private async _addToMaps(
      devices: Array<{
         interval: number; id: string; children: Array<any>; spinalModel: SpinalListenerModel;
         spinalDevice: SpinalDevice; networkService: NetworkService; network: SpinalNode<any>;
      }>) {
      for (const { interval, id, children, spinalModel, spinalDevice, networkService, network } of devices) {
         if (this.devices.indexOf(id) === -1) {
            //    await this.removeToMaps(id);
            // } else {
            this.devices.push(id);
         }

         // console.log(interval, children);

         if (isNaN(interval) || interval <= 0 || children.length <= 0) continue;

         await this.createDataIfNotExist(spinalModel, spinalDevice, children, networkService, network, interval)
         const func = async () => this.funcToExecute(spinalModel, spinalDevice, children, networkService, network);

         let value = this.intervalTimesMap.get(interval);

         if (typeof value === "undefined") {
            value = [];
         }

         value.push({ id, func })
         this.intervalTimesMap.set(interval, value)

      }
      await this.addToQueue();
   }

   private addToQueue() {
      this.intervalTimesMap.forEach((value, interval) => {
         this.priorityQueue.enqueue({ interval, functions: value }, Date.now() + interval)
      })
   }

   private removeToMaps(deviceId: string) {
      this.intervalTimesMap.forEach((value, key) => {
         this.intervalTimesMap.set(key, value.filter(el => el.id !== deviceId));
      })
   }

   public async startMonitoring() {
      let p = true;
      while (p) {
         if (this.priorityQueue.isEmpty()) {
            await this.waitFct(100);
            continue;
         }

         const { priority, element } = this.priorityQueue.dequeue();

         if (element.functions.length > 0) {
            await this.execFunc(element.functions, element.interval, priority);
         }


      }

      // for (const data of this.devices) {
      //    await this.monitDevice(data);
      // }
   }

   private async execFunc(functions: { id: string; func: Function }[], interval: number, date?: number) {
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
         this.priorityQueue.enqueue({ interval, functions: this.intervalTimesMap.get(interval) }, Date.now() + interval);
      } catch (error) {
         console.error(error);

         this.priorityQueue.enqueue({ interval, functions: this.intervalTimesMap.get(interval) }, Date.now() + interval);
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


   private async createDataIfNotExist(spinalModel: SpinalListenerModel, spinalDevice: SpinalDevice, children: Array<any>, networkService: NetworkService, network: SpinalNode<any>, interval: number) {
      // console.log("inside funcToExecute");
      const id = `${spinalDevice.device.deviceId}_${interval}`;
      let init = this.initializedMap.get(id);

      if (!init) {
         console.log("initialisation");
         this.initializedMap.set(id, true);
         await spinalDevice.checkAndCreateIfNotExist(networkService, children);
      }
   }

   private async funcToExecute(spinalModel: SpinalListenerModel, spinalDevice: SpinalDevice, children: Array<any>, networkService: NetworkService, network: SpinalNode<any>) {
      // console.log("children", children);

      if (spinalModel.listen.get() && children?.length > 0) {

         await spinalDevice.updateEndpoints(networkService, network, children);
      }

      // if (typeof callback === "function") callback(networkService, spinalDevice, spinalModel, children);
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
