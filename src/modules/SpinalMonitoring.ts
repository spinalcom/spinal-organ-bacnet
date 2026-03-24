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
import { MinPriorityQueue } from "@datastructures-js/priority-queue";
import { BindProcess } from "spinal-core-connectorjs_type";
import { SpinalDevice } from "./SpinalDevice";
import { IObjectId } from "../Interfaces";
import { SpinalCov } from "./SpinalCov";
import { SpinalQueue } from "spinal-connector-service";
import { SpinalNetworkUtilities } from "../utilities/SpinalNetworkUtilities";
import { IProfileData } from "../utilities/profileManager";


type priorityQueueElementType = { interval: number; priority: number; }
type resolveCallback = (device: SpinalDevice) => void;

class SpinalMonitoring {

   private queue: SpinalQueue<SpinalListenerModel> = new SpinalQueue();
   private priorityQueue: MinPriorityQueue<priorityQueueElementType> = new MinPriorityQueue();
   private initIsProcessing: boolean = false;
   private intervalTimesMap: Map<number, any> = new Map();
   private binded: Map<string | number, BindProcess> = new Map();
   private devices: { [key: string]: SpinalDevice } = {};
   private _itemToAddToMap: SpinalQueue<{ id: string | number; interval: number; }> = new SpinalQueue();
   private _endpointsCreationQueue: SpinalQueue<{ spinalDevice: SpinalDevice, children: IObjectId[] }> = new SpinalQueue();

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
      this.queue.on("start", () => this.startDeviceInitialisation())

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

            const { spinalDevice, children } = item;
            await spinalDevice.checkAndCreateEndpointsIfNotExist(children);
            // console.log("end")
         } catch (error) {
            console.error(error);
         }
      }
   }

   private _processToAddItemToMap() {
      while (!this._itemToAddToMap.isEmpty()) {
         const item = this._itemToAddToMap.dequeue();
         const device = this.devices[item?.id];
         if (device) this._addDeviceIntervalsToMonitoringMap(device);
      }
   }


   public async startDeviceInitialisation() {
      console.log("start device(s) initialization...");
      const devices = await this._initListenerModels();
      console.log(`${devices.length} devices found`);

      const devicesInitialized = await this._initAllDevices(devices);


      if (this.initIsProcessing) return;


      // if monitoring is not already initialized
      this.initIsProcessing = true;

      for (const device of devicesInitialized) {
         this._addDeviceIntervalsToMonitoringMap(device); // add to monitoring map
      }

      await this._waitEndpointCreation();
      console.log(`All devices initialized`);


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

         const itsTimeToExecute = priority && priority <= Date.now();

         if (itsTimeToExecute) {
            await this.triggerIntervalUpdate(priority, element);
         }

         else await this.requeueIfNotReady(element, priority);

      }
   }

   private async requeueIfNotReady(element: priorityQueueElementType, priority: number) {
      // const spinalDevice = this.devices[element.id];
      // const spinalModel = spinalDevice?.getListenerModel();

      // const deviceIsAlreadyMonitored = spinalModel?.monitored?.get();
      // if (deviceIsAlreadyMonitored) {
      this._addToPriorityQueue(element.interval, priority);
      await this.waitFct(500);
      // }
   }

   private async triggerIntervalUpdate(priority: number, element: priorityQueueElementType) {
      let ids = this.intervalTimesMap.get(element.interval);

      if (ids) {
         ids = !Array.isArray(ids) ? [ids] : ids;
         await this.launchUpdating(ids, element.interval, priority);
      }

      // this.intervalTimesMap.delete(element.interval);
   }

   private async _initListenerModels(): Promise<SpinalDevice[]> {
      const queueList = this.queue.toArray();
      this.queue.clear();
      const promises = [];

      for (const listenerModel of queueList) {
         promises.push(SpinalNetworkUtilities.initSpinalListenerModel(listenerModel));
      }

      return Promise.all(promises);
   }

   private _initAllDevices(devices: SpinalDevice[]): Promise<SpinalDevice[]> {
      const promises = devices.map((device) => this._initDevice(device));

      return Promise.all(promises);
   }

   private _initDevice(device: SpinalDevice): Promise<SpinalDevice> {
      const id = device.Id;

      return new Promise((resolve) => {
         const deviceAlreadyBinded = this.binded.get(id);
         // Device already binded
         if (deviceAlreadyBinded) return resolve(device);


         const process = this._bindDeviceListener(device, resolve);
         this.binded.set(id, process);
      });
   }

   private _bindDeviceListener(device: SpinalDevice, resolve: resolveCallback): any {
      const listenerModel = device.getListenerModel();

      return listenerModel.monitored.bind(async () => {
         const isMonitored = listenerModel.monitored.get();

         if (isMonitored) {
            await this._handleMonitoredDevice(device, resolve);
            return;
         }

         await this._handleStoppedDevice(device, resolve);
      }, true);
   }

   private async _handleMonitoredDevice(device: SpinalDevice, resolve: resolveCallback): Promise<SpinalDevice> {
      const id = device.Id;
      const alreadyInit = this.devices[id];
      const deviceName = device.Name;

      console.log(`${deviceName} is monitored, it will be initialized`);

      // get All data monitor inside the profile
      const intervals = await device.getProfileData();
      const children = intervals.map((interval) => interval.children).flat();

      await this._addToEndpointCreationQueue(device, children); // add to endpoint creation queue


      if (!alreadyInit) {
         this.devices[id] = device; // store to device object if not already initialized
         resolve(device);
         return;
      }

      // separate cov items from poll items
      const [covItems, pollItems] = intervals.reduce((acc, interval) => {
         if (interval.interval?.toString().toLowerCase() === 'cov') {
            acc[0].push(interval);
         } else {
            acc[1].push(interval);
         }
         return acc;
      }, [[], []]) // separate cov items from poll items

      await this._addToCovQueue(device, covItems); // add to cov queue
      await this._addToIntervalQueue(id, pollItems); // add to interval queue

      resolve(device);
   }

   private async _handleStoppedDevice(device: SpinalDevice, resolve: resolveCallback): Promise<void> {
      const id = device.Id;
      const alreadyInit = this.devices[id];
      const deviceName = device.Name;

      console.log(`${deviceName} is stopped`);

      await this.removeFromMonitoringMaps(id);

      if (device?.covData) SpinalCov.getInstance().addToStopCovQueue(device.covData);
      await device?.clearCovList();

      // Keep the device in the list even if not initialized
      if (!alreadyInit) {
         this.devices[id] = device;
      }

      resolve(device);
   }

   private async _addToCovQueue(spinalDevice: SpinalDevice, children: IObjectId[]) {
      const covData = spinalDevice.pushToCovList(children);
      SpinalCov.getInstance().addToCovQueue(covData);
   }

   private _addToIntervalQueue(id: string | number, intervals: IProfileData[]): void {
      for (const { interval } of intervals) {
         if (typeof interval !== 'undefined' && interval !== null && !isNaN(Number(interval))) {
            this._itemToAddToMap.addToQueue({ id, interval });
         }
      }
   }


   /**
    *  Add an item to the monitoring map and priority queue
    * @param id 
    * @param interval 
    * @param func 
    */
   private _addDeviceIntervalsToMonitoringMap(spinalDevice: SpinalDevice) {

      const intervals = spinalDevice.getAllIntervals();
      const id = spinalDevice.Id;

      for (const interval of intervals) {
         if (isNaN(Number(interval))) return; // if the interval is not a number, do not add to monitoring

         const _interval = Number(interval);
         let priority = Date.now() + _interval;

         let values = this.intervalTimesMap.get(_interval); // get existing data for this interval time
         if (!values) values = []; // create new array if not exist
         values.push({ id });

         this.intervalTimesMap.set(_interval, values);

         this._addToPriorityQueue(_interval, priority);
      }
   }

   private _addToPriorityQueue(interval: number, priority: number): void {
      const priorities = this.priorityQueue.toArray().map(el => el.element);

      // if the same id with the same interval already exist in the priority queue, do not add it again
      if (!priorities.some(el => el.interval === interval))
         this.priorityQueue.enqueue({ interval, priority }, priority);

   }

   private removeFromMonitoringMaps(deviceId: string | number) {
      // this.removeFromPriorityQueue(deviceId);

      const intervals = Array.from(this.intervalTimesMap.keys());

      for (const interval of intervals) {
         const value = this.intervalTimesMap.get(interval);
         if (!value) continue;

         const valueCopy = !Array.isArray(value) ? [value] : value;
         const valueFiltered = valueCopy.filter(el => el.id !== deviceId);

         if (valueFiltered.length === 0) this.intervalTimesMap.delete(interval);
         else this.intervalTimesMap.set(interval, valueFiltered);
      }

   }


   private async launchUpdating(deviceToUpdate: { id: string | number }[], interval: number, date?: number) {
      const deviceCopy = [...deviceToUpdate]

      while (deviceCopy.length > 0) {
         const item = deviceCopy.shift();
         if (!item) continue;

         const { id } = item;

         try {
            const device = this.devices[id];
            if (device) await device?.updateEndpoints(interval);

         } catch (error) {
            console.error(error);

         }

      }

      const new_priority = Date.now() + interval;
      this._addToPriorityQueue(interval, new_priority);
      // this.intervalTimesMap.set(new_priority, deviceToUpdate);

   }

   private async _addToEndpointCreationQueue(spinalDevice: SpinalDevice, children: IObjectId[]) {
      try {
         // Traiter la creation des endpoinrs dans une Queue, 
         // pour eviter l'envoie de plusieurs requête bacnet
         this._endpointsCreationQueue.addToQueue({ spinalDevice, children });

      } catch (error) {
         console.error(error)
      }

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

   // private removeFromPriorityQueue(id: string | number) {
   //    const removed = [];
   //    const dequeued = [];
   //    while (!this.priorityQueue.isEmpty()) {
   //       //@ts-ignore
   //       const itemPoped = this.priorityQueue.dequeue();

   //       if (itemPoped.element.id === id) {
   //          removed.push(itemPoped);
   //       } else {
   //          dequeued.push(itemPoped);
   //       }
   //    }

   //    dequeued.forEach((val) => this.priorityQueue.enqueue(val.element, val.priority));
   //    return removed;
   // }

}

const spinalMonitoring = SpinalMonitoring.getInstance();
// spinalMonitoring.init();

export default spinalMonitoring;
export { spinalMonitoring }
