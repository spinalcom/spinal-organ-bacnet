import * as lodash from "lodash";
import NetworkService from "spinal-model-bmsnetwork";
import { ObjectTypes, SENSOR_TYPES, PropertyIds, PropertyNames, ObjectTypesCode, UNITS_TYPES } from "../utilities/globalVariables";
import { EventEmitter } from "events";
import { SpinalEndpoint } from "./SpinalEndpoint";
import { SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { saveAsFile } from "../utilities/Utilities";
// import { store } from "../store";

export interface IDevice {
   address?: string;
   deviceId: number;
   maxApdu?: number;
   segmentation?: number;
   vendorId?: number;
}

// export interface IEndpoint {
//    id: string;
//    objectId: { type: number, instance: number };
//    currentValue: number | boolean | string;
// }

export class SpinalDevice extends EventEmitter {
   private device: IDevice;
   private info;
   private client;
   // private itemListCached: Array<{ type: string, instance: number }> = []
   private chunkLength: number = 60;
   // private nodeId: string;
   private endpointGroups: Map<string, Array<any>> = new Map();
   private children: Array<{ type: string, instance: number }[]> = [];

   private node: SpinalNodeRef;


   private networkService: NetworkService;
   private updateInterval: number;

   constructor(device: IDevice, client: any, updateTime?: number) {
      super();
      this.device = device;
      this.client = client;
      this.updateInterval = updateTime || 15000;

      // this.networkService = networkService;
      // this.node = node;
      this.init();
   }


   public init() {
      // this.on("createNodes", this.createStructureNodes);
      // this.on("nodeCreated", this.updateEndpoints);

      return this._getDeviceInfo(this.device).then(async (deviceInfo) => {

         this.info = deviceInfo;
         const objectLists: any = await this._getDeviceObjectList(this.device);

         // return new Promise((resolve, reject) => {
         const objectListDetails = [];

         objectLists.map(object => {
            return () => {
               return this._getObjectDetail(this.device, object).then((g) => objectListDetails.push(g))
            }
         }).reduce((previous, current) => { return previous.then(current) }, Promise.resolve()).then(() => {
            const children = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type });
            // deviceInfo.children = children;
            for (const key in children) {
               if (Object.prototype.hasOwnProperty.call(children, key)) {
                  this.endpointGroups.set(key, children[key]);
               }
            }
            this.emit("initialized", this);
         })
         // });
      })
   }

   public createStructureNodes(networkService: NetworkService, node: SpinalNodeRef, parentId: string) {
      this.networkService = networkService;

      if (node) {
         this.node = node;
         // emit("nodeCreated")
         return saveAsFile(this);
      };

      return this._createDevice(networkService, parentId).then(device => {
         this.node = device;
         return saveAsFile(this).then((result) => {
            const deviceId = device.id.get();
            const promises = Array.from(this.endpointGroups.keys()).map(el => {
               return this._createEndpointsGroup(networkService, deviceId, el).then(endpointGroup => {
                  const groupId = endpointGroup.id.get();
                  return this._createEndpointByArray(networkService, groupId, this.endpointGroups.get(el));
               })
            })

            return Promise.all(promises).then(() => this.emit("nodeCreated"));
         })
         // const node = device;

      })
   }

   public convertToString() {
      return JSON.stringify({
         children: this.children,
         id: this.node.id.get(),
         device: this.device
      })
   }


   // public updateEndpoints(networkService: NetworkService) {

   //    setInterval(() => {
   //       console.log("update")
   //       const objectListDetails = [];

   //       this.children.map(object => {
   //          return () => {
   //             return this._getChildrenNewValue(object).then((g) => objectListDetails.push(g))
   //          }
   //       }).reduce((previous, current) => { return previous.then(current) }, Promise.resolve()).then(() => {
   //          const obj: any = {
   //             id: this.device.deviceId,
   //             children: this._groupByType(lodash.flattenDeep(objectListDetails))
   //          }

   //          networkService.updateData(obj)
   //       })
   //    }, 5000);



   //    // // const promises = this.children.map(el => {
   //    // //    return .checkAndUpdateCurrentValue();
   //    // // })
   //    // // console.log("updateEndpoints", promises)
   // }






   //////////////////////////////////////////////////////////////////////////////
   ////                      PRIVATES                                        ////
   //////////////////////////////////////////////////////////////////////////////

   // _getChildrenNewValue(children: Array<{ type: string, instance: number }>) {
   //    const requestArray = children.map(el => {
   //       return {
   //          objectId: el,
   //          properties: [{ id: PropertyIds.PROP_PRESENT_VALUE }]
   //       }
   //    })
   //    return new Promise((resolve, reject) => {
   //       this.client.readPropertyMultiple(this.device.address, requestArray, (err, data) => {
   //          if (err) {
   //             console.error(err)
   //             reject(err);
   //             return;
   //          }

   //          const dataFormated = data.values.map(el => {
   //             const value = this._getObjValue(el.values[0].value);
   //             return {
   //                id: el.objectId.instance,
   //                type: el.objectId.type,
   //                currentValue: this._formatCurrentValue(value, el.objectId.type)
   //             }
   //          })
   //          resolve(dataFormated);
   //       })
   //    });
   // }

   private _createDevice(networkService: NetworkService, parentId: string): Promise<any> {
      // const parentId = (<any>networkService).networkId;
      return networkService.createNewBmsDevice(parentId, this.info);
   }

   private _createEndpointsGroup(networkService: NetworkService, deviceId: string, groupName: string) {
      const obj: any = {
         name: groupName,
         id: ObjectTypes[`object_${groupName}`.toUpperCase()],
         type: groupName,
         path: ""
      }

      return networkService.createNewBmsEndpointGroup(deviceId, obj);
   }

   private _createEndpointByArray(networkService: NetworkService, groupId: string, endpointArray) {
      const promises = endpointArray.map(el => this._createEndpoint(networkService, groupId, el))
      return Promise.all(promises);
   }

   private async _createEndpoint(networkService: NetworkService, groupId: string, endpointObj: any) {

      const obj: any = {
         id: endpointObj.id,
         name: endpointObj.object_name,
         path: "",
         currentValue: this._formatCurrentValue(endpointObj.present_value, endpointObj.objectId.type),
         unit: endpointObj.units,
         type: endpointObj.type,
      }

      // const nodeInfo = await this.networkService.createNewBmsEndpoint(groupId, obj);

      // this.children.push({ objectId: endpointObj.objectId, currentValue: endpointObj.present_value });

      // return nodeInfo;

      return networkService.createNewBmsEndpoint(groupId, obj);;
   }

   // private _getChunkObjectDetail(device: IDevice, groupName: string, chunkedObjArray: Array<Array<{ type: string, instance: number }>>) {

   //    return new Promise((resolve, reject) => {
   //       const objectListDetails = [];

   //       chunkedObjArray.map(object => {
   //          return () => {
   //             return this._getObjectDetail(device, object).then((g) => objectListDetails.push(g))
   //          }
   //       }).reduce((previous, current) => { return previous.then(current) }, Promise.resolve()).then(() => {
   //          resolve({ name: groupName, children: [].concat.apply([], objectListDetails) })
   //       })
   //    });

   // }

   private _getDeviceObjectList(device: any): Promise<Array<Array<{ type: string, instance: number }>>> {
      return new Promise((resolve, reject) => {

         // if (this.itemListCached.length > 0) {
         //    return resolve(lodash.chunk(this.itemListCached, this.chunkLength))
         // }

         const sensor = []

         // const response = {};

         this.client.readProperty(device.address, { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId }, PropertyIds.PROP_OBJECT_LIST, (err, res) => {
            if (err) {
               reject(err);
               return;
            }

            for (const item of res.values) {
               if (SENSOR_TYPES.indexOf(item.value.type) !== -1) {
                  // const property = this._getObjectTypeByCode(item.value.type);
                  // if (typeof response[property] === "undefined") response[property] = [];

                  // response[property].push(item.value);


                  // this.itemListCached.push(item.value);
                  sensor.push(item.value);
               }
            }

            // for (const key in response) {
            //    if (Object.prototype.hasOwnProperty.call(response, key)) {
            //       response[key] = lodash.chunk(response[key], this.chunkLength)
            //    }
            // }

            // resolve(response);
            this.children = lodash.chunk(sensor, this.chunkLength)
            resolve(this.children);
         })
      });
   }

   private _getObjectDetail(device: IDevice, objects: Array<{ type: string, instance: number }>) {

      const requestArray = objects.map(el => ({
         objectId: JSON.parse(JSON.stringify(el)),
         properties: [
            // { id: PropertyIds.PROP_ALL }
            { id: PropertyIds.PROP_OBJECT_NAME },
            { id: PropertyIds.PROP_PRESENT_VALUE },
            { id: PropertyIds.PROP_OBJECT_TYPE },
            { id: PropertyIds.PROP_UNITS },
         ]
      }))

      return new Promise((resolve, reject) => {
         this.client.readPropertyMultiple(device.address, requestArray, (err, data) => {
            if (err) {
               console.error(err)
               reject(err);
               return;
            }

            const dataFormated = data.values.map(el => {
               const formated: any = this._formatProperty(device.deviceId, el);
               if (typeof formated.units === "object") formated.units = "";
               else formated.units = this._getUnitsByCode(formated.units);
               return formated;
            })
            resolve(dataFormated);
         })
      });
   }

   private _getDeviceInfo(device: IDevice): Promise<any> {

      const requestArray = [
         {
            objectId: { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId },
            properties: [
               { id: PropertyIds.PROP_ALL },
               // { id: PropertyIds.PROP_OBJECT_NAME },
               // { id: PropertyIds.PROP_OBJECT_TYPE }
            ]
         },
         {
            objectId: { type: 332, instance: device.deviceId },
            properties: [
               { id: PropertyIds.PROP_ALL },
               // { id: PropertyIds.PROP_OBJECT_NAME },
               // { id: PropertyIds.PROP_OBJECT_TYPE }
            ]
         }
      ]

      return new Promise((resolve, reject) => {
         this.client.readPropertyMultiple(device.address, requestArray, (err, data) => {
            if (err) {
               reject(err);
               return;
            }

            const dataFormated = data.values.map(el => this._formatProperty(device.deviceId, el))

            const obj = {
               id: device.deviceId,
               address: device.address,
               name: dataFormated[0][this._getPropertyNameByCode(PropertyIds.PROP_OBJECT_NAME)],
               type: dataFormated[0].type
               // type: this._getObjectTypeByCode(dataFormated[0][this._getPropertyNameByCode(PropertyIds.PROP_OBJECT_TYPE)][0])
            }

            resolve(obj)
         })
      });
      // return {
      //    id: this.device.deviceId,
      //    name: "string",
      //    type: "string",
      //    path: "string",
      // }
   }

   private _getPropertyNameByCode(type: number): string {
      const property = PropertyNames[type];
      if (property) return property.toLocaleLowerCase().replace('prop_', '');
      return;
   }

   private _getObjectTypeByCode(typeCode: number): string {
      const property = ObjectTypesCode[typeCode];
      if (property) return property.toLocaleLowerCase().replace('object_', '');
      return;
   }

   private _getUnitsByCode(typeCode: number): string {
      const property = UNITS_TYPES[typeCode];
      if (property) return property.toLocaleLowerCase().replace('units_', '').replace("_", " ");
      return;
   }

   private _formatProperty(deviceId, object) {

      if (object) {
         const { objectId, values } = object;

         const obj = {
            objectId: objectId,
            id: objectId.instance,
            type: this._getObjectTypeByCode(objectId.type),
            instance: objectId.instance,
            deviceId: deviceId
         }

         for (const { id, value } of values) {
            const propertyName = this._getPropertyNameByCode(id);

            if (propertyName) {
               obj[propertyName] = this._getObjValue(value);
            }

         }

         return obj;
      }

   }

   private _getObjValue(value: any) {
      if (Array.isArray(value)) {
         if (value.length === 0) return "";
         return value[0].value;
      }

      return value.value;
   }

   // private _groupByType(itemList) {
   //    const res = []
   //    const obj = lodash.groupBy(itemList, (a) => a.type);

   //    for (const [key, value] of Object.entries(obj)) {
   //       res.push({
   //          id: parseInt(key),
   //          children: obj[key]
   //       })
   //    }

   //    return res;
   // }

   private _formatCurrentValue(value: any, type: number) {

      if ([ObjectTypes.OBJECT_BINARY_INPUT, ObjectTypes.OBJECT_BINARY_VALUE].indexOf(type) !== -1) {
         return value ? true : false;
      }

      return value;

   }

}