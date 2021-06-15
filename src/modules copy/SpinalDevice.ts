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
   // private updateInterval: number;

   constructor(device: IDevice, client?: any) {
      super();
      this.device = device;
      this.client = client;
      // this.updateInterval = updateTime || 15000;

      // this.init();
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
      const client = new bacnet();

      const deviceId = node.getId().get();
      let sensors;

      if (spinalBacnetValueModel) {
         // console.log("sensors", spinalBacnetValueModel.sensor.get());
         sensors = spinalBacnetValueModel.sensor.get();
         spinalBacnetValueModel.setRecoverState();
      } else {
         sensors = SENSOR_TYPES;
      }

      const objectLists = await this._getDeviceObjectList(this.device, sensors, client);
      const objectListDetails = await this._getAllObjectDetails(objectLists, client);
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


      // // return spinalBacnetValueModel.remToNode().then(() => {
      // //    console.log("removed");

      // //    resolve(true)
      // // })


      // return this._getDeviceObjectList(this.device, sensors, client).then((objectLists) => {
      //    // const objectListDetails = [];
      //    console.log("object list found", objectLists);

      //    return this._getAllObjectDetails(objectLists, client).then((objectListDetails) => {

      //       console.log("objectDetails Found", objectListDetails);

      //       const children = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type });

      //       const listes = Array.from(Object.keys(children)).map((el: string) => {
      //          return [el, children[el]];
      //       })

      //       return new Promise((resolve, reject) => {
      //          this.createItemRecur(listes, networkService, deviceId, listes.length, spinalBacnetValueModel, resolve);
      //       });

      //    })

      // })



   }

   public convertToString() {
      return JSON.stringify({
         children: this.children,
         id: this.node.id.get(),
         device: this.device
      })
   }

   //////////////////////////////////////////////////////////////////////////////
   ////                      PRIVATES                                        ////
   //////////////////////////////////////////////////////////////////////////////

   private createItemRecur(liste: Array<Array<any>>, networkService: NetworkService, deviceId: string, maxLength: number, spinalBacnetValueModel: SpinalBacnetValueModel, resolve: Function) {
      const item = liste.shift();
      if (item) {
         const [key, value] = item;

         BacnetUtilities._createEndpointsGroup(networkService, deviceId, key).then(async endpointGroup => {
            const groupId = endpointGroup.id.get();
            await BacnetUtilities._createEndpointByArray(networkService, groupId, value);
            return;
         }).then(() => {
            const percent = Math.floor((100 * (maxLength - liste.length)) / maxLength)
            console.log("percent inside success", percent);

            spinalBacnetValueModel.progress.set(percent)
            this.createItemRecur(liste, networkService, deviceId, maxLength, spinalBacnetValueModel, resolve)
         }).catch((err) => {
            console.log(err);

            const percent = Math.floor((100 * (maxLength - liste.length)) / maxLength)
            console.log("percent inside catch", percent);

            spinalBacnetValueModel.progress.set(percent)
            this.createItemRecur(liste, networkService, deviceId, maxLength, spinalBacnetValueModel, resolve)
         });
      } else {
         spinalBacnetValueModel.setSuccessState();
         console.log("success");
         resolve(true);

         // return spinalBacnetValueModel.remToNode().then(() => {
         //    console.log("removed");

         //    resolve(true)
         // })
      }

   }

   private _createDevice(networkService: NetworkService, parentId: string): Promise<any> {
      return networkService.createNewBmsDevice(parentId, this.info);
   }

   private _getDeviceObjectList(device: any, SENSOR_TYPES: Array<number>, argClient?: any): Promise<Array<Array<{ type: string, instance: number }>>> {
      console.log("getting object list");
      return new Promise((resolve, reject) => {

         const client = argClient || new bacnet();

         const sensor = [];

         // client.readProperty(device.address, { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId }, PropertyIds.PROP_OBJECT_LIST, (err, res) => {
         //    if (err) {
         //       reject(err);
         //       return;
         //    }

         //    for (const item of res.values) {
         //       if (SENSOR_TYPES.indexOf(item.value.type) !== -1) {
         //          sensor.push(item.value);
         //       }
         //    }

         //    this.children = lodash.chunk(sensor, this.chunkLength)
         //    client.close();
         //    resolve(this.children);
         // })

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
            // client.close();
            resolve(this.children);


            // const dataFormated = data.values.map(el => BacnetUtilities._formatProperty(device.deviceId, el))

            // const obj = {
            //    id: device.deviceId,
            //    deviceId: device.deviceId,
            //    address: device.address,
            //    name: dataFormated[0][BacnetUtilities._getPropertyNameByCode(PropertyIds.PROP_OBJECT_NAME)],
            //    type: dataFormated[0].type
            // }

         });


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

   private _getAllObjectDetails(objectLists: any, client) {
      console.log("getting object details");

      const objectListDetails = [];

      return new Promise((resolve, reject) => {
         objectLists.map(object => {
            return () => {
               return BacnetUtilities._getObjectDetail(this.device, object, client).then((g) => objectListDetails.push(g))
            }
         }).reduce((previous, current) => { return previous.then(current) }, Promise.resolve()).then(() => {
            resolve(objectListDetails);
         })
      })


   }

}
