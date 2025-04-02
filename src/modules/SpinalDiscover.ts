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

import * as bacnet from 'bacstack';
import { EventEmitter } from "events";
import { SpinalQueuing } from '../utilities/SpinalQueuing';
import { SpinalGraphService, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { SpinalBmsDevice } from "spinal-model-bmsnetwork";
import { SpinalDevice } from './SpinalDevice';
import { IDevice } from "../Interfaces/IDevice";
import { SpinalDisoverModel, STATES } from 'spinal-model-bacnet';
import { SpinalNetworkServiceUtilities } from '../utilities/SpinalNetworkServiceUtilities';
import { PropertyIds } from '../utilities/GlobalVariables';


class SpinalDiscover {

   private bindSateProcess: any;
   private client: bacnet;
   private CONNECTION_TIME_OUT: number;
   private devices: Map<number, SpinalDevice> = new Map();
   private discoverModel: any;

   constructor(model: SpinalDisoverModel) {
      this.discoverModel = model;
      this.CONNECTION_TIME_OUT = model.network?.timeout?.get() || 10000;

      // this.init(model)
   }

   public init(): void {
      this.client = new bacnet({
         broadcastAddress: this.discoverModel.network?.address?.get(),
         port: this.discoverModel.network?.port?.get() || 47808,
         adpuTimeout: 6000
      })

      this.client.on('error', (err) => {
         console.log('Error occurred: ', err);
         this.client.close();
      });

      this._bindState();
   }

   private _bindState(): void {
      this.bindSateProcess = this.discoverModel.state.bind(() => {
         switch (this.discoverModel.state.get()) {
            case STATES.discovering:
               console.log("discovering...");
               this._discover();
               break;
            case STATES.creating:
               console.log("creating...");
               this._createNodes();
            default:
               break;
         }
      })
   }

   private async _discover(): Promise<void> {
      try {
         const queue = await this._getDevicesQueue();

         let isFinish = false;

         while (!isFinish) {
            const item = queue.dequeue();

            if (typeof item !== "undefined") {
               const info = await this._initSpinalDevice(item);
               if (info) this._addDeviceFound(info);
            } else {
               console.log("isFinish");
               isFinish = true;
            }
         }

         if (this.discoverModel.devices.length !== 0) {
            console.log("discovered");
            this.discoverModel.setDiscoveredMode();
         } else {
            console.log("Timeout !");
            this.discoverModel.setTimeoutMode();
         }

      } catch (error) {
         console.log("Timeout !");
         this.discoverModel.setTimeoutMode();
      }

   }

   private _getDevicesQueue(): Promise<SpinalQueuing<IDevice>> {
      const queue: SpinalQueuing<IDevice> = new SpinalQueuing();
      return new Promise((resolve, reject) => {

         // wait [CONNECTION_TIME_OUT] ms to get all devices, if not found, add ips not found to queue or reject
         let timeOutId = setTimeout(() => {
            if (!useBroadcast) {
               // if use unicast, add ips not found to queue
               // because the whoIs not found the device, but readProperty should found it
               const ips = this.discoverModel.network?.ips?.get() || [];
               queue.setQueue(ips);
               return;
               // return resolve(queue);
            }

            reject("[TIMEOUT] - Cannot establish connection with BACnet server.");
         }, this.CONNECTION_TIME_OUT);


         const useBroadcast = this.discoverModel.network?.useBroadcast?.get();

         // listen iAm event
         const deviceDiscovered: { [key: string]: IDevice } = {};
         this.client.on('iAm', (device) => {
            console.log("device found", device);
            // clear pour que le timeout ne soit pas déclenché, si on a decouvre au moins un device
            if (typeof timeOutId !== "undefined") {
               clearTimeout(timeOutId);
            }

            const { address, deviceId } = device;
            const key = `${address}-${deviceId}`;
            if (!deviceDiscovered[key]) {
               deviceDiscovered[key] = device;
               queue.addToQueue(device);
            }
         });


         // end of listen iAm event

         // send whoIs
         if (useBroadcast) {
            console.log("use broadcast");
            this.client.whoIs();
         } else {
            console.log("use unicast");
            const ips = this.discoverModel.network?.ips?.get() || [];
            for (const { address } of ips) {
               this.client.whoIs({
                  address,
                  dest: { net: '65535', adr: [''] }
               });
            }
         }
         // end of send whoIs




         // listen start event
         queue.once("start", () => {
            if (!useBroadcast) {
               // if use unicast, add ips not found to queue
               // because the whoIs not found the device, but readProperty can found it
               const temp_queueList = queue.getQueue();
               const ips = this.discoverModel.network?.ips?.get() || [];

               const ipsFound = Object.values(deviceDiscovered).map((device) => device.address);

               for (const { address, deviceId } of ips) {
                  if (!deviceDiscovered[`${address}-${deviceId}`] && !ipsFound.includes(address)) {
                     temp_queueList.push({ address, deviceId: deviceId || PropertyIds.MAX_BACNET_PROPERTY_ID } as IDevice);
                  }
               }

               queue.setQueue(temp_queueList);
            }

            resolve(queue)
         });

      });

   }



   private _initSpinalDevice(device: IDevice): Promise<IDevice | void> {

      return new Promise((resolve, reject) => {
         const spinalDevice = new SpinalDevice(device, this.client);

         spinalDevice.on("initialized", (res) => {
            this.devices.set(res.device.deviceId, res);
            resolve(res.info);
         })

         spinalDevice.on("error", () => {
            console.log(device.address, "not found");
            resolve();
         })

         spinalDevice.init();
      });
   }

   private _addDeviceFound(device: IDevice): void {
      this.discoverModel.devices.push(device);
   }

   private async _createNodes(): Promise<void> {

      try {

         const queue = this._getDevicesSelected();
         const { networkService, network } = await SpinalNetworkServiceUtilities.initSpinalDiscoverNetwork(this.discoverModel);
         const devices = await this._getDevicesNodes(network.id.get());

         let isFinish = false;

         while (!isFinish) {
            const device = queue.dequeue();

            if (typeof device !== "undefined") {
               const deviceId = device.deviceId.get()
               const node = devices[deviceId];
               const spinalDevice = this.devices.get(deviceId);
               await spinalDevice.createStructureNodes(networkService, node, network.id.get());
            } else {
               isFinish = true;
            }
         }

         this.discoverModel.setCreatedMode();
         this.discoverModel.state.unbind(this.bindSateProcess);
         this.discoverModel.remove();
         console.log("nodes created!");
      } catch (error) {
         this.discoverModel.setErrorMode();
         this.discoverModel.state.unbind(this.bindSateProcess);
         this.discoverModel.remove();
      }

   }

   private _getDevicesNodes(id: string): Promise<{ [key: number]: SpinalNodeRef }> {
      const obj = {};
      return SpinalGraphService.getChildren(id, [SpinalBmsDevice.relationName]).then((result) => {
         result.forEach(el => {
            obj[el.idNetwork.get()] = el;
         })

         return obj;
      }).catch((err) => {
         return obj;
      });
   }

   private _getDevicesSelected(): SpinalQueuing<spinal.Model> {
      const queue: SpinalQueuing<spinal.Model> = new SpinalQueuing();
      for (let i = 0; i < this.discoverModel.devices.length; i++) {
         const element = this.discoverModel.devices[i];
         queue.addToQueue(element);
      }

      return queue;
   }
}


class Discover extends EventEmitter {
   private _discoverQueue: SpinalQueuing<SpinalDisoverModel> = new SpinalQueuing();
   private _isProcess: boolean = false;
   private static instance: Discover;

   private constructor() {
      super();
      this._listenEvent();
   }

   public static getInstance(): Discover {
      if (!this.instance) this.instance = new Discover();
      return this.instance;
   }



   public addToQueue(model: SpinalDisoverModel) {
      this._discoverQueue.addToQueue(model);
   }

   private _listenEvent() {
      this._discoverQueue.on("start", () => {
         if (!this._isProcess) {
            this._isProcess = true;
            this._discoverNext();
         }
      })

      this.on("next", () => {
         this._discoverNext();
      })
   }

   private _discoverNext() {
      if (!this._discoverQueue.isEmpty()) {
         const model = this._discoverQueue.dequeue();
         const spinalDiscover = new SpinalDiscover(model);
         spinalDiscover.init();
         let timeout = false;

         let bindSateProcess = model.state.bind(() => {
            const state = model.state.get()

            switch (state) {
               case STATES.discovered:
                  model.state.unbind(bindSateProcess);
                  if (!timeout) {
                     this.emit("next");
                  }
                  break;
               case STATES.timeout:
                  if (!timeout) {
                     this.emit("next");
                  }

                  timeout = true;

               default:
                  break;
            }
         })
      } else {
         this._isProcess = false;
      }
   }

}

export const spinalDiscover = Discover.getInstance();
export default spinalDiscover;





