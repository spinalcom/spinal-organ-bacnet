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
import { SpinalQueue } from 'spinal-connector-service';
import { SpinalGraphService, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { SpinalBmsDevice } from "spinal-model-bmsnetwork";
import { SpinalDevice } from './SpinalDevice';
import { IDevice } from "../Interfaces/IDevice";
import { SpinalDiscoverModel } from 'spinal-model-bacnet';
import { STATES } from 'spinal-connector-service';
import { SpinalNetworkServiceUtilities } from '../utilities/SpinalNetworkServiceUtilities';
import { PropertyIds } from '../utilities/GlobalVariables';
import BacnetUtilities from '../utilities/BacnetUtilities';
const config = require("../../config.js");


class SpinalDiscover {

   private bindSateProcess: any;
   private client: bacnet;
   private CONNECTION_TIME_OUT: number;
   private devices: Map<number, SpinalDevice> = new Map();
   private discoverModel: SpinalDiscoverModel;

   constructor(model: SpinalDiscoverModel) {
      this.discoverModel = model;
      this.CONNECTION_TIME_OUT = model.network?.timeout?.get() || 15000;

      // this.init(model)
   }

   public async init(): Promise<void> {
      this.client = await BacnetUtilities.getClient();
      this._bindState();
   }

   private _bindState(): void {
      this.bindSateProcess = this.discoverModel.state.bind(() => {
         switch (this.discoverModel.state.get()) {
            case STATES.discovering:
               this._discover();
               break;

            case STATES.creating:
               this._createNodes();

            default:
               break;
         }
      })
   }

   private async _discover(): Promise<void> {
      try {
         const queue = await this._getDevicesQueue();
         let isFinished = false;
         const devices: IDevice[] = [];

         while (!isFinished) {
            const item = queue.dequeue();

            if (typeof item !== "undefined") {
               const info = await this._initSpinalDevice(item);
               if (info) devices.push(info);
               // if (info) this._addDeviceFound(info);
            } else {
               console.log("discovery finished");
               isFinished = true;
            }
         }

         // if no device found, set timeout mode
         if (devices.length === 0) {
            console.log("No device found, timeout !");
            this.discoverModel.changeState(STATES.timeout);
            return;
         }

         this.discoverModel.setTreeDiscovered(devices);
         this.discoverModel.changeState(STATES.discovered);
         console.log("discovered !", devices.length, "device(s) found");

      } catch (error) {
         console.log("No device found, timeout !");
         this.discoverModel.changeState(STATES.timeout);
      }
   }

   private async _getDevicesQueue(): Promise<SpinalQueue<IDevice>> {
      const queue: SpinalQueue<IDevice> = new SpinalQueue();
      const useBroadcast = this.discoverModel.network?.useBroadcast?.get();
      const deviceDiscovered: { [key: string]: IDevice } = {};

      return new Promise((resolve, reject) => {
         let timeoutCleared = false;

         // Create a single handler for 'iAm' events to avoid multiple listeners and potential memory leaks
         const iAmHandler = this._createIAmHandler(deviceDiscovered, queue, () => {
            if (!timeoutCleared) {
               timeoutCleared = true;
               clearTimeout(timeOutId);
            }
         });

         const cleanup = () => this.client.removeListener('iAm', iAmHandler);

         // Register start event BEFORE sending whoIs to avoid race condition
         queue.once("start", () => {
            if (!useBroadcast) this._addMissingIpsToQueue(queue, deviceDiscovered);
            cleanup();

            resolve(queue);
         });

         const timeOutId = setTimeout(() => {
            if (!useBroadcast) {
               queue.setQueue([]);
               return;
            }
            cleanup();
            reject("[TIMEOUT] - Cannot establish connection with BACnet server.");
         }, this.CONNECTION_TIME_OUT);

         this.client.on('iAm', iAmHandler);
         this._sendWhoIsRequests(useBroadcast);
      });
   }

   private _createIAmHandler(deviceDiscovered: { [key: string]: IDevice }, queue: SpinalQueue<IDevice>, onFirstDevice: () => void): (device: IDevice) => void {
      let firstDeviceReceived = false;

      return (device: IDevice) => {
         console.log("device found", device);

         if (!firstDeviceReceived) {
            firstDeviceReceived = true;
            onFirstDevice();
         }

         const { address, deviceId } = device;
         const key = `${address}-${deviceId}`;

         if (!deviceDiscovered[key]) {
            deviceDiscovered[key] = device;
            queue.addToQueue(device);
         }
      };
   }

   private _sendWhoIsRequests(useBroadcast: boolean): void {
      if (useBroadcast) {
         console.log("discover using broadcast");
         this.client.whoIs({ dest: { net: '65535', adr: [''] } });
      } else {
         console.log("discover using unicast");
         const ips = this.discoverModel.network?.ips?.get() || [];
         for (const { address } of ips) {
            this.client.whoIs({
               address,
               dest: { net: '65535', adr: [''] }
            });
         }
      }
   }

   private _addMissingIpsToQueue(queue: SpinalQueue<IDevice>, deviceDiscovered: { [key: string]: IDevice }): void {
      // console.log("queue.once unicast");
      const missingDevices: IDevice[] = [];
      const ips = this.discoverModel.network?.ips?.get() || [];
      const ipsFound = Object.values(deviceDiscovered).map((device) => device.address);

      for (const { address, deviceId } of ips) {
         const key = `${address}-${deviceId}`;
         if (!deviceDiscovered[key] && !ipsFound.includes(address)) {
            missingDevices.push({
               address,
               deviceId: deviceId || PropertyIds.MAX_BACNET_PROPERTY_ID
            } as IDevice);
         }
      }

      // console.log("ips not found", missingDevices);
      queue.addToQueue(missingDevices);
   }

   private _initSpinalDevice(device: IDevice): Promise<IDevice | void> {

      return new Promise((resolve, reject) => {
         const spinalDevice = new SpinalDevice(device);

         spinalDevice.on("initialized", (res) => {
            const info = res.device;
            if (!info) return resolve();

            this.devices.set(info.deviceId, res);
            resolve(info);
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

      console.log("creating nodes in graph...");

      try {

         const queue = await this._getDevicesSelected(this.discoverModel);
         const { networkService, network } = await SpinalNetworkServiceUtilities.initSpinalDiscoverNetwork(this.discoverModel);
         const devices = await this._getDevicesNodes(network.id.get());

         let isFinished = false;

         while (!isFinished) {
            const device = queue.dequeue();

            if (typeof device !== "undefined") {
               const deviceId = device.deviceId
               const nodeAlreadyExist = devices[deviceId];
               if (nodeAlreadyExist) continue;

               const spinalDevice = this.devices.get(deviceId);
               if (spinalDevice) await spinalDevice.createDeviceNodeInGraph(networkService, network.id.get());

            } else {
               isFinished = true;
            }
         }

         this.discoverModel.changeState(STATES.created);
         console.log("nodes created with success!");
      } catch (error) {
         this.discoverModel.changeState(STATES.error);
         console.error("Error creating nodes:", error.message || error);
      } finally {
         const state = this.discoverModel.state.get();
         if (state === STATES.created) {
            this.discoverModel.state.unbind(this.bindSateProcess);
            this.discoverModel.removeFromGraph();
         }

      }

   }

   private _getDevicesNodes(id: string): Promise<{ [key: number]: SpinalNodeRef }> {
      const obj: { [key: number]: SpinalNodeRef } = {};

      return SpinalGraphService.getChildren(id, [SpinalBmsDevice.relationName]).then((devices) => {
         for (const device of devices) {
            const networkId = device.idNetwork?.get();
            obj[networkId] = device;
         }

         return obj;
      }).catch((err) => {
         return obj;
      });
   }

   private async _getDevicesSelected(discoverModel: SpinalDiscoverModel): Promise<SpinalQueue<spinal.Model>> {
      const queue: SpinalQueue<spinal.Model> = new SpinalQueue();
      const { protocol, host, port } = config.spinalConnector;
      const url = `${protocol}://${host}:${port}`;

      const list = await discoverModel.getTreeToCreate(url);
      queue.addToQueue(list);

      return queue;
      // for (let i = 0; i < this.discoverModel.devices.length; i++) {
      //    const element = this.discoverModel.devices[i];
      //    queue.addToQueue(element);
      // }

      // return queue;
   }
}

class Discover extends EventEmitter {
   private _discoverQueue: SpinalQueue<SpinalDiscoverModel> = new SpinalQueue();
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

   public addToQueue(model: SpinalDiscoverModel) {
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
      if (this._discoverQueue.isEmpty()) {
         this._isProcess = false;
         return;
      }

      const model = this._discoverQueue.dequeue();
      const spinalDiscover = new SpinalDiscover(model);
      spinalDiscover.init();
      let timeout = false;

      let bindSateProcess = model.state.bind(() => {
         const state = model.state.get()

         switch (state) {
            case STATES.discovered:
               model.state.unbind(bindSateProcess);
               if (!timeout) this.emit("next");
               break;

            case STATES.timeout:
               if (!timeout) this.emit("next");
               timeout = true;

            default:
               break;
         }
      })

   }

}

export const spinalDiscover = Discover.getInstance();
export default spinalDiscover;