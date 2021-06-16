import { SpinalListenerModel } from "spinal-model-bacnet";
import NetworkService from "spinal-model-bmsnetwork";
import { SpinalNode } from "spinal-env-viewer-graph-service";


import { SpinalNetworkServiceUtilities } from "../utilities/SpinalNetworkServiceUtilities";
import { SpinalQueuing } from "../utilities/Queuing";
import { Monitor } from "../utilities/Monitor";
import { SpinalDevice } from "./SpinalDevice";


class SpinalMonitoring {

   private queue: SpinalQueuing = new SpinalQueuing();
   private devices: Array<{
      networkService: NetworkService,
      spinalDevice: SpinalDevice,
      spinalModel: SpinalListenerModel,
      network: SpinalNode<any>,
      monitors?: Monitor[]
   }> = [];

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
      let isFinish = false
      while (!isFinish) {
         const spinalListenerModel = this.queue.dequeue();
         try {
            if (typeof spinalListenerModel !== "undefined") {
               const objectIds = this._getItemLists(spinalListenerModel)
               const data = await SpinalNetworkServiceUtilities.initSpinalListenerModel(spinalListenerModel);
               await data.spinalDevice.checkAndCreateIfNotExist(data.networkService, objectIds);

               this.devices.push(data);
            } else {
               isFinish = true;
            }
         } catch (error) {
            console.error(error);
         }
      }

      this.startMonitoring();

   }

   public async startMonitoring() {
      for (const data of this.devices) {
         this.monitDevice(data);
      }
   }


   private monitDevice(data) {
      let monitorBind;

      data.spinalModel.listen.bind(() => {
         if (data.spinalModel.listen.get() && data.spinalModel.monitor) {
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

}

const spinalMonitoring = new SpinalMonitoring();
spinalMonitoring.init();

export default spinalMonitoring;
export {
   spinalMonitoring
}