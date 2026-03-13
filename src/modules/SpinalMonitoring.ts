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
import { SpinalDevice } from "./SpinalDevice";
import * as lodash from "lodash";
import { SpinalNode } from "spinal-model-graph";
import { IDataMonitor, ICovData } from "../Interfaces";
import { SpinalCov } from "./SpinalCov";
import { SpinalQueue } from "spinal-connector-service";
import { SpinalNetworkServiceUtilities } from "../utilities/SpinalNetworkServiceUtilities";


type priorityQueueElementType = { id: string; interval: number; priority: number; }
type resolveCallback = (value: { id: string; intervals: { interval: number; func: Function; }[] } | undefined) => void;

class SpinalMonitoring {

   private queue: SpinalQueue<SpinalListenerModel> = new SpinalQueue();
   private priorityQueue: MinPriorityQueue<priorityQueueElementType> = new MinPriorityQueue();
   private initIsProcessing: boolean = false;
   private intervalTimesMap: Map<number, any> = new Map();
   private binded: Map<string, BindProcess> = new Map();
   private devices: { [key: string]: SpinalListenerModel } = {};
   private _itemToAddToMap: SpinalQueue<{ id: string; interval: number; func: Function }> = new SpinalQueue();
   private _endpointsCreationQueue: SpinalQueue<{ spinalDevice: SpinalDevice, children: Array<any>, networkService: NetworkService }> = new SpinalQueue();
   private _covList: ICovData[] = [];

   private static instance: SpinalMonitoring;

   private constructor() { }

   public static getInstance(): SpinalMonitoring {
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
      this._itemToAddToMap.on("start", async () => this._processToAddItemToMap());

      // process the endpoints creation queue
      this._endpointsCreationQueue.on("start", async () => this.processToEndpointsCreation());
   }

   private async processToEndpointsCreation() {
      while (!this._endpointsCreationQueue.isEmpty()) {
         try {
            // console.log("begin");
            const item = this._endpointsCreationQueue.dequeue();
            if (!item) continue;

            const { spinalDevice, children, networkService } = item;
            await spinalDevice.checkAndCreateIfNotExist(networkService, children);
            // console.log("end")
         } catch (error) {
            console.error(error);
         }
      }
   }

   private _processToAddItemToMap() {
      while (!this._itemToAddToMap.isEmpty()) {
         const item = this._itemToAddToMap.dequeue();
         if (item) this._addToMonitoringMap(item.id, item.interval, item.func);
      }
   }


   public async startDeviceInitialisation() {
      const monitoringData = await this._initNetworkUtilities();

      const promises = this._createMaps(monitoringData);
      const monitoringDataFormatted = await Promise.all(promises);

      if (this.initIsProcessing) return;

      // if monitoring is not already initialized
      this.initIsProcessing = true;

      for (const iterator of monitoringDataFormatted.flat()) {
         if (iterator && iterator.id && iterator.intervals) {
            iterator.intervals.forEach(({ interval, func }) => this._addToMonitoringMap(iterator.id, interval, func)); // add to monitoring map}
         }
      }

      console.log("waiting endpoints creation");
      await this._waitEndpointCreation();
      console.log("end of endpoints creation");

      this.startMonitoring()
      SpinalCov.getInstance().startCovProcessing(); // start cov processing
   }

   public async startMonitoring() {
      console.log("start monitoring...");

      let p = true;
      while (p) {
         // if the priority queue is empty, wait for 500ms, it prevents the loop from being too CPU intensive
         if (this.priorityQueue.isEmpty()) {
            await this.waitFct(500);
            continue;
         }

         //@ts-ignore
         const { priority, element } = this.priorityQueue.dequeue();

         if (priority && priority <= Date.now()) {
            let data = this.intervalTimesMap.get(priority);

            if (data) {
               data = !Array.isArray(data) ? [data] : data;
               await this.launchUpdating(data, element.interval, priority);
            }

            this.intervalTimesMap.delete(element.priority);

         } else {
            const deviceIsAlreadyMonitored = this.devices[element.id]?.listen?.get();
            if (deviceIsAlreadyMonitored) {
               this.priorityQueue.enqueue(element, priority);
               await this.waitFct(100); // wait for 100ms before checking again, it prevents the loop from being too CPU intensive
            }
         }

      }
   }

   private async _initNetworkUtilities(): Promise<IDataMonitor[]> {
      const queueList = this.queue.getQueue();
      this.queue.clear();
      const promises = [];

      for (const element of queueList) {
         promises.push(SpinalNetworkServiceUtilities.initSpinalListenerModel(element));
      }

      const result = await Promise.all(promises);

      return lodash.flattenDeep(result).filter(((el: any) => !!el));
   }

   private _createMaps(devices: Array<IDataMonitor>): Promise<{ id: string; intervals: { interval: number; func: Function }[] } | undefined>[] {
      return devices.map((device) => this._createDeviceMap(device));
   }

   private _createDeviceMap(device: IDataMonitor): Promise<{ id: string; intervals: { interval: number; func: Function }[] } | undefined> {
      const { id } = device;

      return new Promise((resolve) => {
         const existingProcess = this.binded.get(id);

         // Device already binded
         if (existingProcess) {
            resolve(undefined);
            return;
         }

         const process = this._bindDeviceListener(device, resolve);
         this.binded.set(id, process);
      });
   }

   private _bindDeviceListener(device: IDataMonitor, resolve: resolveCallback): any {
      const { spinalModel } = device;

      return spinalModel.listen.bind(async () => {
         const isMonitored = spinalModel.listen.get();

         if (isMonitored) {
            await this._handleMonitoredDevice(device, resolve);
            return;
         }

         await this._handleStoppedDevice(device, resolve);
      }, true);
   }

   private async _handleMonitoredDevice(device: IDataMonitor, resolve: resolveCallback): Promise<void> {
      const { id, spinalModel, spinalDevice, networkService, network } = device;
      const alreadyInit = this.devices[id];
      const deviceName = spinalDevice?.device?.name;

      if (!spinalDevice || !networkService || !network) return;

      console.log(`${deviceName} is running`);
      const monitors = spinalModel.monitor.getMonitoringData();
      const intervals = await this.getValidIntervals(spinalDevice, networkService, spinalModel, network, monitors);

      if (!alreadyInit) {
         this.devices[id] = spinalModel;
         console.log(`${deviceName} initialized`);
         resolve({ id, intervals });
         return;
      }

      this._queueIntervals(id, intervals);
      resolve(undefined);
   }

   private async _handleStoppedDevice(device: IDataMonitor, resolve: resolveCallback): Promise<void> {
      const { id, spinalModel, spinalDevice } = device;
      const alreadyInit = this.devices[id];
      const deviceName = spinalDevice?.device?.name;

      console.log(`${deviceName} is stopped`);

      await this.removeFromMonitoringMaps(id);
      if (spinalDevice?.covData) SpinalCov.getInstance().addToStopCovQueue(spinalDevice.covData);

      await spinalDevice?.clearCovList();

      // Keep the device in the list even if not initialized
      if (!alreadyInit) {
         this.devices[id] = spinalModel;
      }

      resolve(undefined);
   }

   private _queueIntervals(id: string, intervals: { interval: number; func: Function }[]): void {
      for (const { interval, func } of intervals) {
         this._itemToAddToMap.addToQueue({ id, interval, func });
      }
   }


   /**
    *  Add an item to the monitoring map and priority queue
    * @param id 
    * @param interval 
    * @param func 
    */
   private _addToMonitoringMap(id: string, interval: number, func: Function) {
      if (isNaN(interval)) return; // if the interval is not a number, do not add to monitoring
      interval = Number(interval);

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


   private async launchUpdating(data: { id: string; func: Function }[], interval: number, date?: number) {
      const priority = Date.now() + interval;
      const deep_functions = [...data]

      while (deep_functions.length > 0) {
         const item = deep_functions.shift();
         if (!item) continue;

         const { id, func } = item;

         try {
            if (typeof func === "function") await func();

         } catch (error) {
            console.error(error);
         }

         this.priorityQueue.enqueue({ id, interval, priority }, priority);
      }

      this.intervalTimesMap.set(priority, data);
   }

   private async createDataIfNotExist(spinalDevice: SpinalDevice, children: Array<any>, networkService: NetworkService, interval: number) {
      try {
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
         const item = monitors_copy.shift();
         if (!item) continue;

         const { interval, children }: any = item;
         if (children.length <= 0 || interval == 0) continue;

         // if cov or 0
         if (interval.toString().toLowerCase() === "cov") {
            const covData: ICovData = { spinalModel, spinalDevice, children, networkService, network };
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
         setTimeout(() => resolve(), nb >= 0 ? nb : 0);
      });
   }

   private _waitEndpointCreation() {
      return new Promise((resolve) => {
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
export { spinalMonitoring }
