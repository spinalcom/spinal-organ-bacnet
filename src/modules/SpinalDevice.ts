/*
 * Copyright 2021 SpinalCom - www.spinalcom.com
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

import * as lodash from "lodash";
import { InputDataDevice, NetworkService } from "spinal-model-bmsnetwork";
import { EventEmitter } from "events";
import { SpinalContext, SpinalGraph, SpinalGraphService, SpinalNode, SpinalNodeRef } from "spinal-env-viewer-graph-service";

// import { store } from "../store";
import { ObjectTypes, PropertyIds, SENSOR_TYPES } from "../utilities/GlobalVariables";
import { BacnetUtilities } from "../utilities/BacnetUtilities";
import { SpinalBacnetValueModel, SpinalListenerModel, BACNET_VALUES_STATE } from "spinal-model-bacnet";

import { ICovData, IDevice, IObjectId } from "../Interfaces";
import { SpinalQueue } from "spinal-connector-service";
import { loadPtrValue } from "../utilities/Functions";
import { IProfileData } from "../utilities/profileManager";
import { SpinalNetworkUtilities } from "../utilities/SpinalNetworkUtilities";
import { get } from "http";
import { SpinalCov } from "./SpinalCov";

export class SpinalDevice extends EventEmitter {
   public device: IDevice | undefined;
   private info: any;
   public covData: ICovData[] = [];

   // for existing device in graph
   private _listenerModel: SpinalListenerModel;
   private _graph: SpinalGraph;
   private _context: SpinalContext
   private _network: SpinalNode;
   private _organ: SpinalNode;
   private _bmsDevice: SpinalNode;
   private _profile: SpinalNode;
   private _networkService: NetworkService;
   private _profileData: { [key: number]: IProfileData[] } = {};


   // private client: bacnet;
   constructor(device?: IDevice) {
      super();
      this.device = device;
   }

   /** use this function only if device is not created yet */
   public init(): Promise<boolean> {
      if (!this.device) throw new Error("Device info is not defined");

      return this._getDeviceInfo(this.device).then(async (deviceInfo) => {
         // this.info = deviceInfo;
         this.device = deviceInfo;

         this.emit("initialized", this);
         return true;
      }).catch((err) => {
         this.emit("error", err);
         return false;
      });
   }


   public async initExistingDevice(listenerModel: SpinalListenerModel) {
      try {
         this._listenerModel = listenerModel;
         const { graph, context, network, organ, bmsDevice, profile } = await this._getDeviceStructureFromGraph(listenerModel);
         // set the device structure in the class to be used later for update
         [this._graph, this._context, this._network, this._organ, this._bmsDevice, this._profile] = [graph, context, network, organ, bmsDevice, profile];
         this.device = this._bmsDevice.info.get(); // set the device info from the graph

         const saveTimeSeries = listenerModel.saveTimeSeries?.get() || false;
         this._networkService = new NetworkService(saveTimeSeries);
         await this._initNetworkService(graph, context, organ);
         return true;
      } catch (error) {
         console.error("Error initializing existing device", error);
         return false;
      }

   }

   get Id() {
      return this.device?.id;
   }

   get Name() {
      return this.device?.name;
   }

   public getNetworkService() {
      const saveTimeSeries = this._listenerModel.saveTimeSeries?.get() || false;
      this._networkService.useTimeseries = saveTimeSeries;
      return this._networkService;
   }

   public getListenerModel() {
      return this._listenerModel;
   }

   public async getProfileData() {
      const intervals = await SpinalNetworkUtilities.getProfileData(this._profile);
      this._profileData = this._classifyChildrenByInterval(intervals);
      return intervals;
   }

   public getAllIntervals() {
      return Object.keys(this._profileData);
   }

   public getProfileDataByInterval(interval: number | string): IObjectId[] {
      const data = this._profileData[interval] || [];
      return data.map(el => el.children).flat();
   }




   /**  add item to covList */
   public pushToCovList(children: IObjectId[] | IObjectId): ICovData {
      if (!Array.isArray(children)) children = [children];
      const networkService = this.getNetworkService();

      const covData: ICovData = { spinalModel: this._listenerModel, spinalDevice: this, children, networkService, network: this._network };
      this.covData.push(covData);

      return covData;
   }

   /** clear covList */
   public clearCovList(): void {
      this.covData = [];
   }

   public async createDeviceNodeInGraph(networkService: NetworkService, parentId: string): Promise<SpinalNodeRef | undefined> {
      return networkService.createNewBmsDevice(parentId, this.device as any);
   }

   /** create device item list in graph */
   public async createDeviceItemList(networkService: NetworkService, node: SpinalNodeRef, spinalBacnetValueModel: SpinalBacnetValueModel): Promise<void> {

      const deviceName = this.device?.name;

      try {
         const deviceId = node.getId().get();
         let sensors = this._getSensors(spinalBacnetValueModel);
         let useFragment = true; // TODO: remove this line when useFragment is implemented in the UI

         // get object list details
         console.log(`[${deviceName}] - getting object list`);
         const objectListDetails = await this._getObjecListDetails(sensors, useFragment);
         console.log(`[${deviceName}] - ${objectListDetails.length} item(s) found`);


         // group and format items
         const listes = this._groupAndFormatItems(objectListDetails);
         const maxLength = listes.length;

         spinalBacnetValueModel.changeState(BACNET_VALUES_STATE.progress);

         // create items in graph
         console.log(`[${deviceName}] - creating items in graph`);
         await this._createEndpointGroupWithChildren(listes, networkService, deviceId, deviceName, maxLength, spinalBacnetValueModel);
         console.log(`[${deviceName}] - items created in graph`);

         await spinalBacnetValueModel.changeState(BACNET_VALUES_STATE.success);
      } catch (error) {
         console.log(`[${deviceName}] - items creation failed`);
         await spinalBacnetValueModel.changeState(BACNET_VALUES_STATE.error);
         return;
      }

   }


   /** Check and create endpoints if they do not exist */
   public async checkAndCreateEndpointsIfNotExist(endpointsToCreate: IObjectId[]): Promise<SpinalNodeRef[]> {
      const networkService = this.getNetworkService();
      const deviceName = this.device?.name;

      console.log(`[${deviceName}] - check and create endpoints, if not exist`);
      const client = await BacnetUtilities.getClient();
      if (!this.device) {
         console.log(`[${deviceName}] - device is not defined`);
         return [];
      }

      const objectListDetails = await BacnetUtilities._getObjectDetail(this.device, endpointsToCreate, client)

      const childrenGroups = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (item: any) { return item.type });

      const promises = Array.from(Object.keys(childrenGroups)).map((childKey: string) => {
         return BacnetUtilities.createEndpointsInGroup(networkService, this.Id as string, childKey, childrenGroups[childKey], this.device?.name);
      })

      return Promise.all(promises).then((result) => {
         console.log(`[${deviceName}] - endpoints creation completed`);
         return result.flat();
      }).catch((err) => {
         console.error(`[${deviceName}] - check and create endpoints failed due to "${err.message}"`);
         return [];
      });
   }


   public async updateEndpoints(interval: number | string): Promise<void> {
      if (!this.device) {
         console.log("device is not defined");
         return;
      }

      const children = this.getProfileDataByInterval(interval);
      const networkService = this.getNetworkService();
      const networkNode = this._network;
      const deviceName = this.device.name;

      try {
         const client = await BacnetUtilities.getClient();

         console.log(`[${deviceName}] ===> updating endpoints for interval ${interval}`);
         const objectListDetails = await BacnetUtilities._getChildrenNewValue(this.device, children, client)
         if (!objectListDetails || objectListDetails.length === 0) throw new Error("Failed to retreive endpoints on device");

         const obj: any = { id: (this.device as any).idNetwork, children: this._groupByType(lodash.flattenDeep(objectListDetails)) }

         await this.updateEndpointInGraph(obj, networkService, networkNode);

      } catch (error) {
         console.error(`[${deviceName}] - Error updating endpoints for device due to "${error.message}"`);
      }

   }

   public updateEndpointInGraph(obj: InputDataDevice, networkService: NetworkService, networkNode: SpinalNode) {
      return networkService.updateData(obj, null, networkNode);
   }


   //////////////////////////////////////////////////////////////////////////////
   ////                      PRIVATES                                        ////
   //////////////////////////////////////////////////////////////////////////////



   private async _getDeviceInfo(device: IDevice): Promise<IDevice> {
      const deviceAddress = device.address;
      if (!deviceAddress) throw new Error("Device address is not defined");

      try {
         const objectId = { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId };
         const deviceId = await this._getDeviceId(deviceAddress, device.SADR, device.deviceId);

         return {
            id: deviceId,
            SADR: device.SADR,
            deviceId,
            name: await this._getDataValue(deviceAddress, device.SADR, objectId, PropertyIds.PROP_OBJECT_NAME),
            address: deviceAddress,
            typeId: objectId.type,
            type: BacnetUtilities._getObjectTypeByCode(objectId.type),
            description: await this._getDataValue(deviceAddress, device.SADR, objectId, PropertyIds.PROP_DESCRIPTION),
            segmentation: device.segmentation || await this._getDataValue(deviceAddress, device.SADR, objectId, PropertyIds.PROP_SEGMENTATION_SUPPORTED),
            vendorId: device.vendorId || await this._getDataValue(deviceAddress, device.SADR, objectId, PropertyIds.PROP_VENDOR_IDENTIFIER),
            maxApdu: device.maxApdu || await this._getDataValue(deviceAddress, device.SADR, objectId, PropertyIds.PROP_MAX_APDU_LENGTH_ACCEPTED)
         }
      } catch (error: any) {
         if (error.message.includes("ERR_TIMEOUT")) {
            throw error;
         }

         console.error(`Error getting device info for device at address ${deviceAddress} with ID ${device.deviceId} due to "${error.message}"`);
         throw error;
      }

   }

   private _groupAndFormatItems(objectListDetails: { [key: string]: string | number | boolean; }[]) {
      const itemsGrouped = lodash.groupBy(objectListDetails, function (item: any) { return item.type; });
      const listes = Array.from(Object.keys(itemsGrouped)).map((key: string) => [key, itemsGrouped[key]]);
      return listes;
   }

   private _groupByType(itemList: any) {
      const res = []
      const obj = lodash.groupBy(itemList, (a: any) => a.type);

      for (const [key, value] of Object.entries(obj)) {
         res.push({ id: parseInt(key), children: obj[key] })
      }

      return res;
   }

   private async _getDataValue(address: string, sadr: any, objectId: { type: any; instance: any }, PropertyId: number) {
      const formated: any = await BacnetUtilities._getPropertyValue(address, sadr, objectId, PropertyId);
      return formated[BacnetUtilities._getPropertyNameByCode(PropertyId)];
   }

   private _getSensors(spinalBacnetValueModel: SpinalBacnetValueModel): number[] {
      if (spinalBacnetValueModel) {
         spinalBacnetValueModel.changeState(BACNET_VALUES_STATE.recover);
         return spinalBacnetValueModel.sensor.get();
      }

      return SENSOR_TYPES;
   }

   private async _getObjecListDetails(sensors: number[], useFragment: boolean = false) {
      if (!this.device) throw new Error("Device is not defined");

      const client = await BacnetUtilities.getClient();
      const objectLists = await BacnetUtilities._getDeviceObjectList(this.device, sensors, client, useFragment);
      const objectListDetails = await BacnetUtilities._getObjectDetail(this.device, objectLists.map((el: any) => el.value), client);
      return objectListDetails;
   }

   private async _getDeviceId(deviceAdress: string, sadr: any, deviceId?: number): Promise<number> {
      if (deviceId && deviceId !== PropertyIds.MAX_BACNET_PROPERTY_ID) return deviceId;

      return BacnetUtilities.getDeviceId(deviceAdress, sadr);
   }

   private async _createEndpointGroupWithChildren(listes: any[][], networkService: NetworkService, deviceId: any, deviceName: string | undefined, maxLength: number, spinalBacnetValueModel: SpinalBacnetValueModel) {
      while (listes.length > 0) {
         const item = listes.pop();
         if (!item) continue;

         const [key, value] = item;

         await BacnetUtilities.createEndpointsInGroup(networkService, deviceId, key, value, deviceName);
         const percent = Math.floor((100 * (maxLength - listes.length)) / maxLength);
         spinalBacnetValueModel.progress.set(percent);
      }
   }

   private async _getDeviceStructureFromGraph(listenerModel: SpinalListenerModel) {
      const treeList = [listenerModel.graph, listenerModel.context, listenerModel.network, listenerModel.organ, listenerModel.bmsDevice, listenerModel.profile];
      const promises = treeList.map(ptr => loadPtrValue(ptr));
      return Promise.all(promises).then(([graph, context, network, organ, bmsDevice, profile]) => {
         if (graph) SpinalGraphService._addNode(graph);
         if (bmsDevice) SpinalGraphService._addNode(bmsDevice);
         if (network) SpinalGraphService._addNode(network);
         if (context) SpinalGraphService._addNode(context);

         return { graph, context, network, organ, bmsDevice, profile };
      })
   }

   private async _initNetworkService(graph: SpinalGraph, context: SpinalContext, organ: SpinalNode) {
      const networkInfo = {
         contextName: context.getName().get(),
         contextType: context.getType().get(),
         networkType: organ.getType().get(),
         networkName: organ.getName().get()
      };

      await this._networkService.init(graph, networkInfo);
   }

   private _classifyChildrenByInterval(intervals: IProfileData[]): { [key: number]: IProfileData[] } {
      const res: { [key: number]: IProfileData[] } = {};
      for (const intervalData of intervals) {
         const interval = intervalData.interval;
         if (!res[interval]) res[interval] = [];
         res[interval].push(intervalData);
      }
      return res;
   }


}


/////////////////////////////////////////////////////////////////
//  create a queue to get all bacnet values of a device and create items in graph, 
// this is to avoid multiple calls at the same time which can cause performance issues and bacnet timeouts
/////////////////////////////////////////////////////////////////

const allBacnetValueQueue: SpinalQueue<{ device: IDevice, node: SpinalNodeRef, networkService: NetworkService, spinalBacnetValueModel: SpinalBacnetValueModel }> = new SpinalQueue();

allBacnetValueQueue.on("start", async () => {
   while (!allBacnetValueQueue.isEmpty()) {
      const queueItem = allBacnetValueQueue.dequeue();
      if (!queueItem) continue;

      const { device, node, networkService, spinalBacnetValueModel } = queueItem;
      let spinalDevice = new SpinalDevice(device);
      await spinalDevice.createDeviceItemList(networkService, node, spinalBacnetValueModel);
   }
})

export function addToGetAllBacnetValuesQueue(device: IDevice, node: SpinalNodeRef, networkService: NetworkService, spinalBacnetValueModel: SpinalBacnetValueModel) {
   allBacnetValueQueue.addToQueue({ device, node, networkService, spinalBacnetValueModel });
}
