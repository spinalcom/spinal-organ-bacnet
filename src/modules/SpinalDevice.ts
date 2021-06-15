import * as lodash from "lodash";
import * as bacnet from "bacstack";

import { SpinalBmsEndpointGroup, NetworkService, SpinalBmsEndpoint } from "spinal-model-bmsnetwork";
import { ObjectTypes, PropertyIds, SENSOR_TYPES, PropertyNames, ObjectTypesCode, UNITS_TYPES } from "../utilities/GlobalVariables";
import { EventEmitter } from "events";
import { SpinalEndpoint } from "./SpinalEndpoint";
import { SpinalGraphService, SpinalNodeRef } from "spinal-env-viewer-graph-service";

// import { store } from "../store";

import { BacnetUtilities } from "../utilities/BacnetUtilities";
import { SpinalBacnetValueModel } from "spinal-model-bacnet";

export interface IDevice {
   address?: string;
   deviceId: number;
   maxApdu?: number;
   segmentation?: number;
   vendorId?: number;
}

export class SpinalDevice extends EventEmitter {
   private device: IDevice;
   private info;
   private client;
   private chunkLength: number = 60;
   private children: Array<{ type: string, instance: number }[]> = [];
   private node: SpinalNodeRef;
   private networkService: NetworkService;


   constructor(device: IDevice, client?: any) {
      super();
      this.device = device;
      this.client = client || new bacnet();
   }


   public init() {
      return this._getDeviceInfo(this.device).then(async (deviceInfo) => {
         this.info = deviceInfo;
         this.emit("initialized", this);
      }).catch((err) => this.emit("error", err));
   }

   public createStructureNodes(networkService: NetworkService, node: SpinalNodeRef, parentId: string): Promise<any> {
      this.networkService = networkService;

      if (node) {
         return;
      };

      return this._createDevice(networkService, parentId);
   }

   public async createDeviceItemList(networkService: NetworkService, node: SpinalNodeRef, spinalBacnetValueModel: SpinalBacnetValueModel): Promise<any> {

      const deviceId = node.getId().get();
      let sensors;

      if (spinalBacnetValueModel) {
         sensors = spinalBacnetValueModel.sensor.get();
         spinalBacnetValueModel.setRecoverState();
      } else {
         sensors = SENSOR_TYPES;
      }

      const objectLists = await this._getDeviceObjectList(this.device, sensors, this.client);
      const objectListDetails = await this._getAllObjectDetails(objectLists, this.client);

      const children = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type });
      const listes = Array.from(Object.keys(children)).map((el: string) => [el, children[el]]);
      const maxLength = listes.length;
      let isError = false;

      if (spinalBacnetValueModel) {
         console.log("set progress mode")
         spinalBacnetValueModel.setProgressState();
      }

      while (!isError && listes.length > 0) {
         const item = listes.shift();
         if (item) {
            const [key, value] = item;

            try {
               await BacnetUtilities.createEndpointsInGroup(networkService, deviceId, key, value);
               if (spinalBacnetValueModel) {
                  const percent = Math.floor((100 * (maxLength - listes.length)) / maxLength);
                  spinalBacnetValueModel.progress.set(percent)
               }
            } catch (error) {
               isError = true;
            }
         }
      }

      if (spinalBacnetValueModel) {
         if (isError) {
            spinalBacnetValueModel.setErrorState();
            return;
         }

         spinalBacnetValueModel.setSuccessState();
      }
   }

   //////////////////////////////////////////////////////////////////////////////
   ////                      PRIVATES                                        ////
   //////////////////////////////////////////////////////////////////////////////

   private _createDevice(networkService: NetworkService, parentId: string): Promise<any> {
      return networkService.createNewBmsDevice(parentId, this.info);
   }

   private _getDeviceObjectList(device: any, SENSOR_TYPES: Array<number>, argClient?: any): Promise<Array<Array<{ type: string, instance: number }>>> {
      console.log("getting object list");
      return new Promise((resolve, reject) => {
         try {
            const client = argClient || new bacnet();

            const sensor = [];

            const requestArray = [
               {
                  objectId: { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId },
                  properties: [
                     { id: PropertyIds.PROP_OBJECT_LIST },
                  ]
               }
            ]


            client.readPropertyMultiple(device.address, requestArray, (err, data) => {
               if (err) {
                  reject(err);
                  return;
               }

               const values = this._formatMultipleProperty(data.values)

               for (const item of values) {
                  if (SENSOR_TYPES.indexOf(item.value.type) !== -1) {
                     sensor.push(item.value);
                  }
               }
               this.children = lodash.chunk(sensor, this.chunkLength)
               resolve(this.children);
            });
         } catch (error) {
            reject(error);
         }
      });
   }

   private _getDeviceInfo(device: IDevice): Promise<any> {

      const client = this.client || new bacnet();

      const requestArray = [
         {
            objectId: { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId },
            properties: [
               { id: PropertyIds.PROP_OBJECT_NAME },
               // { id: PropertyIds.PROP_OBJECT_IDENTIFIER }
            ]
         }
      ]

      return new Promise((resolve, reject) => {
         client.readPropertyMultiple(device.address, requestArray, (err, data) => {
            if (err) {
               reject(err);
               return;
            }

            const dataFormated = data.values.map(el => BacnetUtilities._formatProperty(device.deviceId, el))

            const obj = {
               id: device.deviceId,
               deviceId: device.deviceId,
               address: device.address,
               name: dataFormated[0][BacnetUtilities._getPropertyNameByCode(PropertyIds.PROP_OBJECT_NAME)],
               type: dataFormated[0].type
            }

            resolve(obj)
         })
      });
   }

   private _formatMultipleProperty(data: any) {
      return lodash.flattenDeep(data.map(object => {
         const { objectId, values } = object;

         return values.map(({ id, value }) => {
            return value
         })
      }))
   }

   private async _getAllObjectDetails(objectLists: any, client: any) {
      console.log("getting object details");

      try {
         const objectListDetails = [];

         while (objectLists.length > 0) {
            const object = objectLists.shift();
            if (object) {
               const res = await BacnetUtilities._getObjectDetail(this.device, object, client);
               objectListDetails.push(res);
            }
         }

         return objectListDetails;
      } catch (error) {
         return []
      }
   }

}
