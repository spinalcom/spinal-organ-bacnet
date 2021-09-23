import * as lodash from "lodash";
import * as bacnet from "bacstack";
import { NetworkService } from "spinal-model-bmsnetwork";
import { EventEmitter } from "events";
import { SpinalNode, SpinalNodeRef } from "spinal-env-viewer-graph-service";

// import { store } from "../store";
import { ObjectTypes, PropertyIds, SENSOR_TYPES } from "../utilities/GlobalVariables";
import { BacnetUtilities } from "../utilities/BacnetUtilities";
import { SpinalBacnetValueModel } from "spinal-model-bacnet";

import { IDevice, IObjectId } from "../Interfaces";

export class SpinalDevice extends EventEmitter {
   public device: IDevice;
   private info;
   private client;


   constructor(device: IDevice, client?: any, networkService?: NetworkService) {
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
      // this.networkService = networkService;

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

      const objectLists = await BacnetUtilities._getDeviceObjectList(this.device, sensors, this.client);
      const objectListDetails = await BacnetUtilities._getObjectDetail(this.device, objectLists, this.client);

      const children = lodash.groupBy(objectListDetails, function (a) { return a.type });

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
            console.log("set error model");
            spinalBacnetValueModel.setErrorState();
            return;
         }

         console.log("set success model");
         spinalBacnetValueModel.setSuccessState();
      }
   }

   public async checkAndCreateIfNotExist(networkService: NetworkService, objectIds: Array<{ instance: number; type: string }>) {
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

   public async updateEndpoints(networkService: NetworkService, networkNode: SpinalNode<any>, children: Array<{ instance: number; type: number }>) {
      try {
         const client = new bacnet();

         console.log(`${new Date()} ===> update ${(<any>this.device).name}`)
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

   private _createDevice(networkService: NetworkService, parentId: string): Promise<any> {
      return networkService.createNewBmsDevice(parentId, this.info);
   }

   private async _getDeviceInfo(device: IDevice): Promise<any> {
      const objectId = { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId };
      const formated: any = await BacnetUtilities._getPropertyValue(device.address, objectId, PropertyIds.PROP_OBJECT_NAME);
      const tempName = formated[BacnetUtilities._getPropertyNameByCode(PropertyIds.PROP_OBJECT_NAME)];


      return {
         name: tempName,
         address: device.address,
         deviceId: device.deviceId,
         segmentation: device.segmentation,
         // objectId: objectId,
         id: objectId.instance,
         typeId: objectId.type,
         type: BacnetUtilities._getObjectTypeByCode(objectId.type),
         // instance: objectId.instance,
         vendorId: device.vendorId,
         maxApdu: device.maxApdu
      }


      // const client = this.client || new bacnet();

      // return new Promise((resolve, reject) => {
      //    client.readProperty(device.address,{ type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId },PropertyIds.PROP_OBJECT_NAME,(err,data) => {
      //       if(err) {
      //          reject(err);
      //          return;
      //       }

      //       const dataFormated = BacnetUtilities._formatProperty(device.deviceId, data);
      //       const tempName = dataFormated[BacnetUtilities._getPropertyNameByCode(PropertyIds.PROP_OBJECT_NAME)]

      //       const obj = {
      //          id: device.deviceId,
      //          deviceId: device.deviceId,
      //          address: device.address,
      //          name: tempName?.length > 0 ? tempName : `Device_${device.deviceId}`,
      //          type: dataFormated.type,
      //          segmentation: device.segmentation
      //       }

      //       resolve(obj);            
      //    })
      // });
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

   // private _getDeviceObjectList(device: any, SENSOR_TYPES: Array<number>, argClient?: any): Promise<Array<Array<{ type: string, instance: number }>>> {
   //    console.log("getting object list");
   //    return new Promise((resolve, reject) => {
   //       try {
   //          const client = argClient || new bacnet();

   //          const sensor = [];

   //          const requestArray = [
   //             {
   //                objectId: { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId },
   //                properties: [
   //                   { id: PropertyIds.PROP_OBJECT_LIST },
   //                ]
   //             }
   //          ]

   //          client.readPropertyMultiple(device.address, requestArray, (err, data) => {
   //             if (err) {
   //                reject(err);
   //                return;
   //             }

   //             const values = this._formatMultipleProperty(data.values)

   //             for (const item of values) {
   //                if (SENSOR_TYPES.indexOf(item.value.type) !== -1) {
   //                   sensor.push(item.value);
   //                }
   //             }
   //             this.children = lodash.chunk(sensor, this.chunkLength)
   //             resolve(this.children);
   //          });
   //       } catch (error) {
   //          reject(error);
   //       }
   //    });
   // }

   // private _formatMultipleProperty(data: any) {
   //    return lodash.flattenDeep(data.map(object => {
   //       const { objectId, values } = object;

   //       return values.map(({ id, value }) => {
   //          return value
   //       })
   //    }))
   // }

   // private async _getAllObjectDetails(objectLists: any, client: any) {
   //    console.log("getting object details");

   //    try {
   //       const objectListDetails = [];

   //       while (objectLists.length > 0) {
   //          const object = objectLists.shift();
   //          if (object) {
   //             const res = await BacnetUtilities._getObjectDetail(this.device, object, client);
   //             objectListDetails.push(res);
   //          }
   //       }

   //       return objectListDetails;
   //    } catch (error) {
   //       return []
   //    }
   // }


}
