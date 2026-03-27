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
import { InputDataDevice, NetworkService, SpinalBmsDevice } from "spinal-model-bmsnetwork";
import { EventEmitter } from "events";
import { SPINAL_RELATION_PTR_LST_TYPE, SpinalContext, SpinalGraph, SpinalNode } from "spinal-model-graph";

// import { store } from "../store";
import { ObjectTypes, PropertyIds, SENSOR_TYPES } from "../utilities/GlobalVariables";
import { BacnetUtilities } from "../utilities/BacnetUtilities";
import { SpinalBacnetValueModel, SpinalListenerModel, BACNET_VALUES_STATE } from "spinal-model-bacnet";

import { ICovData, IDevice, IObjectId } from "../Interfaces";
import { SpinalQueue } from "spinal-connector-service";
import { loadPtrValue } from "../utilities/Functions";
import ProfileManager, { IProfileData } from "../utilities/profileManager";
import { SpinalNetworkUtilities } from "../utilities/SpinalNetworkUtilities";


export class SpinalDevice extends EventEmitter {
   public device: IDevice | undefined;
   private info: any;
   public covData: IObjectId[] = [];

   // for existing device in graph
   private _listenerModel: SpinalListenerModel;
   private _graph: SpinalGraph | undefined;
   private _context: SpinalContext | undefined;
   private _network: SpinalNode | undefined;
   private _organ: SpinalNode | undefined;
   private _bmsDevice: SpinalNode | undefined;
   private _profile: SpinalNode | undefined;

   // private _networkService: NetworkService;
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

         this._graph = graph;
         this._context = context;
         this._network = network;
         this._organ = organ;
         this._bmsDevice = bmsDevice;
         this._profile = profile;

         if (this._bmsDevice) this.device = this._bmsDevice.info.get(); // set the device info from the graph

         // const saveTimeSeries = listenerModel.saveTimeSeries?.get() || false;
         // this._networkService = new NetworkService(saveTimeSeries);
         // await this._initNetworkService(graph, context, organ);
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

   getBmsDeviceNode() {
      return this._bmsDevice;
   }

   // public getNetworkService() {
   //    const saveTimeSeries = this._listenerModel.saveTimeSeries?.get() || false;
   //    this._networkService.useTimeseries = saveTimeSeries;
   //    return this._networkService;
   // }

   public getListenerModel() {
      return this._listenerModel;
   }

   public async getProfileData(): Promise<IProfileData[]> {
      if (!this._profile) return [];

      const intervals = await ProfileManager.getInstance().getProfileData(this._profile);
      this._profileData = this._classifyChildrenByInterval(intervals);
      return intervals;
   }

   public getAllIntervals(): string[] {
      return Object.keys(this._profileData);
   }

   public getProfileDataByInterval(interval: number): IObjectId[] {
      const data = this._profileData[interval] || [];

      return data.map(el => el.children).flat().filter((el: any): el is IObjectId => typeof el !== "undefined");
   }




   /**  add item to covList */
   public pushToCovList(children: IObjectId[] | IObjectId): IObjectId[] {
      if (!Array.isArray(children)) children = [children];
      // const networkService = this.getNetworkService();

      // const covData: ICovData = { spinalModel: this._listenerModel, spinalDevice: this, children, network: this._network };
      // const covData: ICovData = { spinalDevice: this };
      this.covData.push(...children);

      return this.covData;
   }

   /** clear covList */
   public clearCovList(): void {
      this.covData = [];
   }

   public async createDeviceNodeInGraph(context: SpinalContext, network: SpinalNode, deviceNode?: SpinalNode): Promise<SpinalNode> {

      if (!deviceNode) {
         deviceNode = await SpinalNetworkUtilities.createNetworkElementNode(this.device as any, SpinalBmsDevice.nodeTypeName);
         return network.addChildInContext(deviceNode, SpinalBmsDevice.relationName, SPINAL_RELATION_PTR_LST_TYPE, context);
      }

      return SpinalNetworkUtilities.updateNetworkElementNode(deviceNode, this.device as any);
   }

   /** create device item list in graph */
   public async createDeviceItemList(context: SpinalContext, deviceNode: SpinalNode, spinalBacnetValueModel: SpinalBacnetValueModel): Promise<void> {

      const deviceName = this.device?.name;

      try {
         console.log(`[${deviceName}] - getting object list`);
         const listes = await this.fetchAndFormatAllBacnetObjectList(spinalBacnetValueModel, deviceName);
         console.log(`[${deviceName}] - object list retrieved`);

         spinalBacnetValueModel.changeState(BACNET_VALUES_STATE.progress);

         // create items in graph
         console.log(`[${deviceName}] - creating items in graph`);
         await this._createEndpointGroupWithChildren(context, deviceNode, listes, spinalBacnetValueModel);
         console.log(`[${deviceName}] - items created in graph`);

         await spinalBacnetValueModel.changeState(BACNET_VALUES_STATE.success);
      } catch (error) {
         console.log(`[${deviceName}] - items creation failed`);
         await spinalBacnetValueModel.changeState(BACNET_VALUES_STATE.error);
         return;
      }

   }


   private async fetchAndFormatAllBacnetObjectList(spinalBacnetValueModel: SpinalBacnetValueModel, deviceName: string | undefined) {
      let sensors = this._getSensors(spinalBacnetValueModel);

      // FRAGMENTATION is used when bacnet device has a loop object
      let useFragment = true; // TODO: remove this line when useFragment is implemented in the UI

      const objectListDetails = await this._getObjectListDetails(sensors, useFragment);

      // group and format items by type to optimize the creation in the graph
      return this._groupAndFormatItems(objectListDetails);
   }

   /** Check and create endpoints if they do not exist */
   public async checkAndCreateEndpointsIfNotExist(endpointsToCreate: IObjectId[]): Promise<SpinalNode[]> {
      // const networkService = this.getNetworkService();
      const deviceName = this.device?.name;
      console.log(`[${deviceName}] - check and create endpoints, if not exist`);

      if (!this.device) {
         console.log(`[${deviceName}] - device is not found, cannot create endpoints`);
         return [];
      }

      const client = await BacnetUtilities.getClient();

      const objectListDetails = await BacnetUtilities._getObjectDetail(this.device, endpointsToCreate);
      const childrenGroups = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (item: any) { return item.type });

      if (!this._context || !this._bmsDevice) {
         console.log(`[${deviceName}] - context or bmsDevice is not initialized, cannot create endpoints`);
         return [];
      }

      const promises = Array.from(Object.keys(childrenGroups)).map((childKey: string) => {
         return SpinalNetworkUtilities.createEndpointsInGroup(this._context as SpinalContext, this._bmsDevice as SpinalNode, childKey, childrenGroups[childKey]);
      })

      return Promise.all(promises)
         .then((result) => {
            console.log(`[${deviceName}] - endpoints creation completed`);
            return result.flat();
         }).catch((err) => {
            console.error(`[${deviceName}] - check and create endpoints failed due to "${err.message}"`);
            return [];
         });
   }


   public async updateEndpoints(interval: number): Promise<void | boolean[]> {
      if (!this.device) {
         console.log("device is not defined, cannot update endpoints");
         return;
      }


      const children = this.getProfileDataByInterval(interval);
      // const networkService = this.getNetworkService();
      const deviceName = this.device.name;

      try {

         console.log(`[${deviceName}] ===> updating endpoints for interval ${interval}`);
         const objectListDetails = await BacnetUtilities._getChildrenNewValue(this.device, children);
         if (!objectListDetails || objectListDetails.length === 0) throw new Error("Failed to retreive endpoints on device");

         // const obj: any = { id: (this.device as any).idNetwork, children: this._groupByType(lodash.flattenDeep(objectListDetails)) }
         if (!this._bmsDevice || !this._network) throw new Error("BMS Device or network is not defined, cannot update endpoints");

         const saveTimeSeries = this.shoulSaveTimeSeries();
         return SpinalNetworkUtilities.updateEndpointInGraph(this._bmsDevice, objectListDetails, saveTimeSeries);

      } catch (error) {
         console.error(`[${deviceName}] - Error updating endpoints for device due to "${(error as Error).message}"`);
      }

   }

   public shoulSaveTimeSeries(): boolean {
      return this._listenerModel.saveTimeSeries?.get() || false;
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

   // private _groupByType(itemList: any) {
   //    const res = []
   //    const obj = lodash.groupBy(itemList, (a: any) => a.type);

   //    for (const [key, value] of Object.entries(obj)) {
   //       res.push({ id: parseInt(key), children: obj[key] })
   //    }

   //    return res;
   // }

   private async _getDataValue(address: string, sadr: any, objectId: { type: any; instance: any }, PropertyId: number) {
      const formated: any = await BacnetUtilities._getPropertyValue(address, sadr, objectId, PropertyId);
      const propertyName = BacnetUtilities._getPropertyNameByCode(PropertyId);
      if (formated && propertyName) return formated[propertyName];

   }

   private _getSensors(spinalBacnetValueModel: SpinalBacnetValueModel): number[] {
      if (spinalBacnetValueModel) {
         spinalBacnetValueModel.changeState(BACNET_VALUES_STATE.recover);
         return spinalBacnetValueModel.sensor.get();
      }

      return SENSOR_TYPES;
   }

   private async _getObjectListDetails(sensors: number[], useFragment: boolean = false) {
      if (!this.device) throw new Error("Device is not defined");

      const objectLists = await BacnetUtilities._getDeviceObjectList(this.device, sensors, useFragment);
      const objectListDetails = await BacnetUtilities._getObjectDetail(this.device, objectLists.map((el: any) => el.value));
      return objectListDetails;
   }

   private async _getDeviceId(deviceAdress: string, sadr: any, deviceId?: number): Promise<number> {
      if (deviceId && deviceId !== PropertyIds.MAX_BACNET_PROPERTY_ID) return deviceId;

      return BacnetUtilities.getDeviceId(deviceAdress, sadr);
   }

   private async _createEndpointGroupWithChildren(context: SpinalContext, deviceNode: SpinalNode, listes: any[][], spinalBacnetValueModel: SpinalBacnetValueModel) {
      const maxLength = listes.length;

      while (listes.length > 0) {
         const item = listes.pop();
         if (!item) continue;

         const [key, value] = item;

         await SpinalNetworkUtilities.createEndpointsInGroup(context, deviceNode, key, value);
         const percent = Math.floor((100 * (maxLength - listes.length)) / maxLength);
         spinalBacnetValueModel.progress.set(percent);
      }
   }

   private async _getDeviceStructureFromGraph(listenerModel: SpinalListenerModel) {
      const treeList = [listenerModel.graph, listenerModel.context, listenerModel.network, listenerModel.organ, listenerModel.bmsDevice, listenerModel.profile];
      const promises = treeList.map(ptr => loadPtrValue(ptr));

      return Promise.all(promises).then(([graph, context, network, organ, bmsDevice, profile]) => {
         return { graph, context, network, organ, bmsDevice, profile };
      })
   }

   // private async _initNetworkService(graph: SpinalGraph, context: SpinalContext, organ: SpinalNode) {
   //    const networkInfo = {
   //       contextName: context.getName().get(),
   //       contextType: context.getType().get(),
   //       networkType: organ.getType().get(),
   //       networkName: organ.getName().get()
   //    };

   //    await this._networkService.init(graph, networkInfo);
   // }

   private _classifyChildrenByInterval(intervals: IProfileData[]): { [key: number]: IProfileData[] } {
      const res: { [key: number]: IProfileData[] } = {};

      for (const intervalData of intervals) {
         const interval = intervalData.interval;
         if (typeof interval === "undefined") continue;

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

const allBacnetValueQueue: SpinalQueue<{ device: IDevice, node: SpinalNode, context: SpinalContext, spinalBacnetValueModel: SpinalBacnetValueModel }> = new SpinalQueue();

allBacnetValueQueue.on("start", async () => {
   while (!allBacnetValueQueue.isEmpty()) {
      const queueItem = allBacnetValueQueue.dequeue();
      if (!queueItem) continue;

      const { device, node, context, spinalBacnetValueModel } = queueItem;
      let spinalDevice = new SpinalDevice(device);
      await spinalDevice.createDeviceItemList(context, node, spinalBacnetValueModel);
   }
})

export function addToGetAllBacnetValuesQueue(device: IDevice, node: SpinalNode, context: SpinalContext, spinalBacnetValueModel: SpinalBacnetValueModel) {
   allBacnetValueQueue.addToQueue({ device, node, context, spinalBacnetValueModel });
}
