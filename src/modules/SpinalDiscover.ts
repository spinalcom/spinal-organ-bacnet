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


class SpinalDiscover {

   private bindSateProcess: any;
   private client: bacnet;
   private CONNECTION_TIME_OUT: number;
   private devices: Map<number, SpinalDevice> = new Map();
   private discoverModel: any;

   constructor(model: SpinalDisoverModel) {
      this.discoverModel = model;
      this.CONNECTION_TIME_OUT = model.network?.timeout?.get() || 45000;

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
               console.log("discovering");
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
               const info = await this._createSpinalDevice(item);
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

         // if (this.discoverModel.network?.useBroadcast?.get()) {
         //    console.log("use broadcast");
         let timeOutId;

         if (this.discoverModel.network?.useBroadcast?.get()) {
            console.log("use broadcast");

            timeOutId = setTimeout(() => {
               reject("[TIMEOUT] - Cannot establish connection with BACnet server.");
            }, this.CONNECTION_TIME_OUT);

            this.client.whoIs();
         } else {
            // ips.forEach(({ address, deviceId }) => {
            //    this.client.whoIs({ address })
            // });
            console.log("use unicast");
            const ips = this.discoverModel.network?.ips?.get() || [];            
            const devices = ips.reduce((liste, { address, deviceId }) => {
               try {
                  if (address && deviceId) liste.push({ address, deviceId: parseInt(deviceId) });
               } catch (error) { }
               return liste;
            }, [])

            queue.setQueue(devices);
         }

         const res = []

         this.client.on('iAm', (device) => {
            if (typeof timeOutId !== "undefined") {
               clearTimeout(timeOutId);
            }

            const { address, deviceId } = device;
            const found = res.find(el => el.address === address && el.deviceId === deviceId);
            if (!found) {
               res.push(device);
               queue.addToQueue(device);
            }
         })

         queue.on("start", () => {
            resolve(queue)
         });

      });

   }

   private _createSpinalDevice(device: IDevice): Promise<IDevice | void> {

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
      console.log("device found", device.address);
      this.discoverModel.devices.push(device);
   }

   private async _createNodes(): Promise<void> {

      try {
         // const queue = new SpinalQueuing();
         // queue.setQueue(this.discoverModel.devices);
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





