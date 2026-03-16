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
import { SpinalNode, SpinalNodeRef } from "spinal-env-viewer-graph-service";

// import { store } from "../store";
import { ObjectTypes, PropertyIds, SENSOR_TYPES } from "../utilities/GlobalVariables";
import { BacnetUtilities } from "../utilities/BacnetUtilities";
import { SpinalBacnetValueModel, BACNET_VALUES_STATE } from "spinal-model-bacnet";

import { ICovData, IDevice } from "../Interfaces";
import { SpinalQueue } from "spinal-connector-service";

export class SpinalDevice extends EventEmitter {
   public device: IDevice | undefined;
   private info: any;
   public covData: ICovData[] = [];
   // private client: bacnet;

   constructor(device: IDevice) {
      super();
      this.device = device;
   }

   /** Initialize the device */
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

   /**  add item to covList */
   public pushToCovList(argCovData: ICovData | ICovData[]) {
      if (!Array.isArray(argCovData)) argCovData = [argCovData];

      this.covData.push(...argCovData);
      return this.covData.length;
   }

   /** clear covList */
   public clearCovList(): void {
      this.covData = [];
   }

   /** create device node in graph if not exist */
   public createStructureNodes(networkService: NetworkService, node: SpinalNodeRef, parentId: string): Promise<SpinalNodeRef | undefined> {
      if (node) return Promise.resolve(node);

      return this._createDevice(networkService, parentId);
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
   public async checkAndCreateIfNotExist(networkService: NetworkService, objectIds: Array<{ instance: number; type: string }>): Promise<SpinalNodeRef[][]> {

      console.log("check and create endpoints, if not exist");
      const client = await BacnetUtilities.getClient();
      if (!this.device) {
         console.log("device is not defined");
         return [];
      }

      const objectListDetails = await BacnetUtilities._getObjectDetail(this.device, objectIds, client)

      const childrenGroups = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (item: any) { return item.type });

      const promises = Array.from(Object.keys(childrenGroups)).map((el: string) => {
         return BacnetUtilities.createEndpointsInGroup(networkService, (<any>this.device).id, el, childrenGroups[el], this.device?.name);
      })

      return Promise.all(promises);
   }


   public async updateEndpoints(networkService: NetworkService, networkNode: SpinalNode<any>, children: Array<{ instance: number; type: number }>): Promise<void> {
      if (!this.device) {
         console.log("device is not defined");
         return;
      }
      const deviceName = this.device.name;
      try {
         const client = await BacnetUtilities.getClient();

         console.log(`${new Date()} ===> update ${deviceName}`);
         const objectListDetails = await BacnetUtilities._getChildrenNewValue(this.device, children, client)
         if (!objectListDetails || objectListDetails.length === 0) throw new Error("Failed to retreive endpoints on device");

         const obj: any = {
            id: (this.device as any).idNetwork,
            children: this._groupByType(lodash.flattenDeep(objectListDetails))
         }

         await this.updateEndpointInGraph(obj, networkService, networkNode);

      } catch (error) {
         console.error(`Error updating endpoints for device ${deviceName}`);
      }

   }

   public updateEndpointInGraph(obj: InputDataDevice, networkService: NetworkService, networkNode: SpinalNode) {
      return networkService.updateData(obj, null, networkNode);
   }


   //////////////////////////////////////////////////////////////////////////////
   ////                      PRIVATES                                        ////
   //////////////////////////////////////////////////////////////////////////////

   private async _createDevice(networkService: NetworkService, parentId: string): Promise<SpinalNodeRef | undefined> {
      if (!this.info) {
         return;
      };

      return networkService.createNewBmsDevice(parentId, this.info);
   }

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

         console.error(`Error getting device info for device at address ${deviceAddress} with ID ${device.deviceId} due to`, error.message);
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
      const spinalDevice = new SpinalDevice(device);
      await spinalDevice.createDeviceItemList(networkService, node, spinalBacnetValueModel);
   }
})

export function addToGetAllBacnetValuesQueue(device: IDevice, node: SpinalNodeRef, networkService: NetworkService, spinalBacnetValueModel: SpinalBacnetValueModel) {
   allBacnetValueQueue.addToQueue({ device, node, networkService, spinalBacnetValueModel });
}
