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
import * as bacnet from "bacstack";
import { InputDataDevice, NetworkService } from "spinal-model-bmsnetwork";
import { EventEmitter } from "events";
import { SpinalNode, SpinalNodeRef } from "spinal-env-viewer-graph-service";

// import { store } from "../store";
import { ObjectTypes, PropertyIds, SENSOR_TYPES } from "../utilities/GlobalVariables";
import { BacnetUtilities } from "../utilities/BacnetUtilities";
import { SpinalBacnetValueModel } from "spinal-model-bacnet";

import { IDevice } from "../Interfaces";
import SpinalQueuing from "../utilities/SpinalQueuing";

export class SpinalDevice extends EventEmitter {
   public device: IDevice;
   private info;
   // private client: bacnet;

   constructor(device: IDevice, client?: bacnet) {
      super();
      this.device = device;
      // this.client = client || BacnetUtilities.getClient();
   }

   public init(): Promise<void | boolean> {
      return this._getDeviceInfo(this.device).then(async (deviceInfo) => {
         this.info = deviceInfo;
         this.device = deviceInfo;

         this.emit("initialized", this);
      }).catch((err) => {
         this.emit("error", err)
      });
   }

   public createStructureNodes(networkService: NetworkService, node: SpinalNodeRef, parentId: string): Promise<SpinalNodeRef> {
      // this.networkService = networkService;

      if (node) {
         return Promise.resolve(node);
      };

      return this._createDevice(networkService, parentId);
   }

   public async createDeviceItemList(networkService: NetworkService, node: SpinalNodeRef, spinalBacnetValueModel: SpinalBacnetValueModel): Promise<void> {

      try {
         const deviceId = node.getId().get();
         let sensors = this._getSensors(spinalBacnetValueModel);

         let useFragment = true; // TODO: remove this line when useFragment is implemented in the UI


         console.log(`[${this.device.name}] - getting object list`);

         const objectListDetails = await this._getObjecListDetails(sensors, useFragment);

         console.log(`[${this.device.name}] - ${objectListDetails.length} item(s) found`);

         const itemsGrouped = lodash.groupBy(objectListDetails, function (a) { return a.type });

         const listes = Array.from(Object.keys(itemsGrouped)).map((key: string) => [key, itemsGrouped[key]]);

         const maxLength = listes.length;
         // let isError = false;

         // if (spinalBacnetValueModel) {

         spinalBacnetValueModel.setProgressState();
         // }

         console.log(`[${this.device.name}] - creating items in graph`);

         while (listes.length > 0) {
            const item = listes.pop();
            if (item) {
               const [key, value] = item;

               await BacnetUtilities.createEndpointsInGroup(networkService, deviceId, key, value, this.device.name);
               if (spinalBacnetValueModel) {
                  const percent = Math.floor((100 * (maxLength - listes.length)) / maxLength);
                  spinalBacnetValueModel.progress.set(percent)
               }

            }
         }

         console.log(`[${this.device.name}] - items created in graph`);
         await spinalBacnetValueModel.setSuccessState();
      } catch (error) {
         console.log(`[${this.device.name}] - items creation failed`);
         await spinalBacnetValueModel.setErrorState();
         return;
      }

   }

   public async checkAndCreateIfNotExist(networkService: NetworkService, objectIds: Array<{ instance: number; type: string }>): Promise<SpinalNodeRef[][]> {
      console.log("check and create endpoints, if not exist");
      const client = await BacnetUtilities.getClient();


      const objectListDetails = await BacnetUtilities._getObjectDetail(this.device, objectIds, client)

      const childrenGroups = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type });
      const promises = Array.from(Object.keys(childrenGroups)).map((el: string) => {
         return BacnetUtilities.createEndpointsInGroup(networkService, (<any>this.device).id, el, childrenGroups[el], this.device.name);
      })

      return Promise.all(promises);
   }

   public async updateEndpoints(networkService: NetworkService, networkNode: SpinalNode<any>, children: Array<{ instance: number; type: number }>): Promise<void> {
      try {
         const client = await BacnetUtilities.getClient();

         console.log(`${new Date()} ===> update ${this.device.name}`);
         const objectListDetails = await BacnetUtilities._getChildrenNewValue(this.device, children, client)

         const obj: any = {
            id: (<any>this.device).idNetwork,
            children: this._groupByType(lodash.flattenDeep(objectListDetails))
         }

         this.updateEndpointInGraph(obj, networkService, networkNode);
      } catch (error) {

      }

   }

   public updateEndpointInGraph(obj: InputDataDevice, networkService: NetworkService, networkNode: SpinalNode<any>) {
      networkService.updateData(obj, null, networkNode);
   }


   //////////////////////////////////////////////////////////////////////////////
   ////                      PRIVATES                                        ////
   //////////////////////////////////////////////////////////////////////////////

   private _createDevice(networkService: NetworkService, parentId: string): Promise<SpinalNodeRef> {
      return networkService.createNewBmsDevice(parentId, this.info);
   }

   private async _getDeviceInfo(device: IDevice): Promise<IDevice> {

      const objectId = { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId };
      const deviceId = await this._getDeviceId(device.address, device.SADR, device.deviceId);

      return {
         id: deviceId,
         SADR: device.SADR,
         deviceId,
         name: await this._getDataValue(device.address, device.SADR, objectId, PropertyIds.PROP_OBJECT_NAME),
         address: device.address,
         typeId: objectId.type,
         type: BacnetUtilities._getObjectTypeByCode(objectId.type),
         description: await this._getDataValue(device.address, device.SADR, objectId, PropertyIds.PROP_DESCRIPTION),
         segmentation: device.segmentation || await this._getDataValue(device.address, device.SADR, objectId, PropertyIds.PROP_SEGMENTATION_SUPPORTED),
         vendorId: device.vendorId || await this._getDataValue(device.address, device.SADR, objectId, PropertyIds.PROP_VENDOR_IDENTIFIER),
         maxApdu: device.maxApdu || await this._getDataValue(device.address, device.SADR, objectId, PropertyIds.PROP_MAX_APDU_LENGTH_ACCEPTED)
      }

   }

   private _groupByType(itemList) {
      const res = []
      const obj = lodash.groupBy(itemList, (a) => a.type);

      for (const [key, value] of Object.entries(obj)) {
         res.push({
            id: parseInt(key),
            children: obj[key]
         })
      }

      return res;
   }

   private async _getDataValue(address: string, sadr: any, objectId: { type: any; instance: any }, PropertyId: number) {
      const formated: any = await BacnetUtilities._getPropertyValue(address, sadr, objectId, PropertyId);
      return formated[BacnetUtilities._getPropertyNameByCode(PropertyId)];
   }

   private _getSensors(spinalBacnetValueModel: SpinalBacnetValueModel): number[] {
      if (spinalBacnetValueModel) {
         spinalBacnetValueModel.setRecoverState();
         return spinalBacnetValueModel.sensor.get();
      }

      return SENSOR_TYPES;
   }

   private async _getObjecListDetails(sensors: number[], useFragment: boolean = false) {
      const client = await BacnetUtilities.getClient();
      const objectLists = await BacnetUtilities._getDeviceObjectList(this.device, sensors, client, useFragment);
      const objectListDetails = await BacnetUtilities._getObjectDetail(this.device, objectLists.map((el: any) => el.value), client);
      return objectListDetails;
      // console.log("objectListDetails", JSON.stringify(objectListDetails));
   }

   private async _getDeviceId(deviceAdress: string, sadr: any, deviceId?: number): Promise<number> {
      if (deviceId && deviceId !== PropertyIds.MAX_BACNET_PROPERTY_ID) return deviceId;

      return BacnetUtilities.getDeviceId(deviceAdress, sadr);
   }
}


//////////////////////////////////////////////////////////////////////
//             ALL bacnetValues Queue                               //
//////////////////////////////////////////////////////////////////////
const allBacnetValueQueue: SpinalQueuing<{ device: IDevice, node: SpinalNodeRef, networkService: NetworkService, spinalBacnetValueModel: SpinalBacnetValueModel }> = new SpinalQueuing();

allBacnetValueQueue.on("start", async () => {
   while (!allBacnetValueQueue.isEmpty()) {
      const { device, node, networkService, spinalBacnetValueModel } = allBacnetValueQueue.dequeue();
      const spinalDevice = new SpinalDevice(device);
      await spinalDevice.createDeviceItemList(networkService, node, spinalBacnetValueModel);
   }
})

export function addToGetAllBacnetValuesQueue(device: IDevice, node: SpinalNodeRef, networkService: NetworkService, spinalBacnetValueModel: SpinalBacnetValueModel) {
   allBacnetValueQueue.addToQueue({ device, node, networkService, spinalBacnetValueModel });
}
