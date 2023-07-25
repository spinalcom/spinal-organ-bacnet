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
import { NetworkService } from "spinal-model-bmsnetwork";
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
   private client: bacnet;

   constructor(device: IDevice, client?: bacnet) {
      super();
      this.device = device;
      this.client = client || new bacnet();
   }

   public init(): Promise<void | boolean> {
      return this._getDeviceInfo(this.device).then(async (deviceInfo) => {
         this.info = deviceInfo;
         console.log("this.info", this.info);

         this.emit("initialized", this);
      }).catch((err) => this.emit("error", err));
   }

   public createStructureNodes(networkService: NetworkService, node: SpinalNodeRef, parentId: string): Promise<SpinalNodeRef> {
      // this.networkService = networkService;

      if (node) {
         return Promise.resolve(node);
      };

      return this._createDevice(networkService, parentId);
   }

   public async createDeviceItemList(networkService: NetworkService, node: SpinalNodeRef, spinalBacnetValueModel: SpinalBacnetValueModel): Promise<void> {

      const deviceId = node.getId().get();
      let sensors = this._getSensors(spinalBacnetValueModel);

      const listes = await this._getObjecListDetails(sensors);

      const maxLength = listes.length;
      let isError = false;

      if (spinalBacnetValueModel) {
         console.log("set progress mode")
         spinalBacnetValueModel.setProgressState();
      }

      while (!isError && listes.length > 0) {
         const item = listes.pop();
         if (item) {
            const [key, value] = item;

            try {
               await BacnetUtilities.createEndpointsInGroup(networkService, deviceId, key, value);
               if (spinalBacnetValueModel) {
                  const percent = Math.floor((100 * (maxLength - listes.length)) / maxLength);
                  spinalBacnetValueModel.progress.set(percent)
               }
            } catch (error) {
               isError = error;
            }
         }
      }

      if (spinalBacnetValueModel) {
         if (isError) {
            console.log("set error model", isError);
            spinalBacnetValueModel.setErrorState();
            return;
         }

         console.log("set success model");
         spinalBacnetValueModel.setSuccessState();
      }
   }

   public async checkAndCreateIfNotExist(networkService: NetworkService, objectIds: Array<{ instance: number; type: string }>): Promise<SpinalNodeRef[][]> {
      console.log("check and create if not exist");
      const client = new bacnet();
      // const children = lodash.chunk(objectIds, 60);
      // const objectListDetails = await this._getAllObjectDetails(children, client);
      const objectListDetails = await BacnetUtilities._getObjectDetail(this.device, objectIds, client)

      const childrenGroups = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type });
      const promises = Array.from(Object.keys(childrenGroups)).map((el: string) => {
         return BacnetUtilities.createEndpointsInGroup(networkService, (<any>this.device).id, el, childrenGroups[el]);
      })

      return Promise.all(promises);
   }

   public async updateEndpoints(networkService: NetworkService, networkNode: SpinalNode<any>, children: Array<{ instance: number; type: number }>): Promise<void> {
      try {
         const client = new bacnet();

         console.log(`${new Date()} ===> update ${this.device.name}`);
         const objectListDetails = await BacnetUtilities._getChildrenNewValue(this.device, children, client)

         const obj: any = {
            id: (<any>this.device).idNetwork,
            children: this._groupByType(lodash.flattenDeep(objectListDetails))
         }

         networkService.updateData(obj, null, networkNode);
      } catch (error) {
         // console.log(`${new Date()} ===> error ${(<any>this.device).name}`)
         // console.error(error);

      }

   }


   //////////////////////////////////////////////////////////////////////////////
   ////                      PRIVATES                                        ////
   //////////////////////////////////////////////////////////////////////////////

   private _createDevice(networkService: NetworkService, parentId: string): Promise<SpinalNodeRef> {
      return networkService.createNewBmsDevice(parentId, this.info);
   }

   private async _getDeviceInfo(device: IDevice): Promise<IDevice> {

      const objectId = { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId };

      return {
         name: await this._getDataValue(device.address, objectId, PropertyIds.PROP_OBJECT_NAME),
         address: device.address,
         deviceId: device.deviceId,
         segmentation: device.segmentation || await this._getDataValue(device.address, objectId, PropertyIds.PROP_SEGMENTATION_SUPPORTED),
         // objectId: objectId,
         id: objectId.instance,
         typeId: objectId.type,
         type: BacnetUtilities._getObjectTypeByCode(objectId.type),
         // instance: objectId.instance,
         vendorId: device.vendorId || await this._getDataValue(device.address, objectId, PropertyIds.PROP_VENDOR_IDENTIFIER),
         maxApdu: device.maxApdu || await this._getDataValue(device.address, objectId, PropertyIds.PROP_MAX_APDU_LENGTH_ACCEPTED)
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

   private async _getDataValue(address: string, objectId: { type: any; instance: any }, PropertyId: number) {
      const formated: any = await BacnetUtilities._getPropertyValue(address, objectId, PropertyId);
      return formated[BacnetUtilities._getPropertyNameByCode(PropertyId)];
   }

   private _getSensors(spinalBacnetValueModel: SpinalBacnetValueModel): number[] {
      if (spinalBacnetValueModel) {
         spinalBacnetValueModel.setRecoverState();
         return spinalBacnetValueModel.sensor.get();
      }

      return SENSOR_TYPES;
   }

   private async _getObjecListDetails(sensors: number[]) {
      const objectLists = await BacnetUtilities._getDeviceObjectList(this.device, sensors, this.client);
      const objectListDetails = await BacnetUtilities._getObjectDetail(this.device, objectLists.map((el: any) => el.value), this.client);

      const children = lodash.groupBy(objectListDetails, function (a) { return a.type });

      return Array.from(Object.keys(children)).map((el: string) => [el, children[el]]);
   }
}


//////////////////////////////////////////////////////////////////////
//             ALL bacnetValues Queue                               //
//////////////////////////////////////////////////////////////////////
const allBacnetValueQueue: SpinalQueuing<IDevice> = new SpinalQueuing();

allBacnetValueQueue.on("start", async ({device, node, networkService, spinalBacnetValueModel}:{device: IDevice, node: SpinalNodeRef, networkService: NetworkService, spinalBacnetValueModel: SpinalBacnetValueModel}) => {
   while (!allBacnetValueQueue.isEmpty()) {
      const spinalDevice = new SpinalDevice(device);
      await spinalDevice.createDeviceItemList(networkService, node, spinalBacnetValueModel)
   }
})

export function addToGetAllBacnetValuesQueue(device: IDevice, node: SpinalNodeRef, networkService: NetworkService, spinalBacnetValueModel: SpinalBacnetValueModel) {
   allBacnetValueQueue.addToQueue({device, node, networkService, spinalBacnetValueModel});
}
