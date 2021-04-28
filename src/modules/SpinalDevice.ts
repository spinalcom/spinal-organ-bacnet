import * as lodash from "lodash";
import * as bacnet from "bacstack";

import { SpinalBmsEndpointGroup, NetworkService, SpinalBmsEndpoint } from "spinal-model-bmsnetwork";
import { ObjectTypes, PropertyIds, PropertyNames, ObjectTypesCode, UNITS_TYPES } from "../utilities/globalVariables";
import { EventEmitter } from "events";
import { SpinalEndpoint } from "./SpinalEndpoint";
import { SpinalGraphService, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { saveAsFile } from "../utilities/Utilities";
// import { store } from "../store";

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
         // this.node = node;
         // return Promise.resolve(true);
         return;
      };

      return this._createDevice(networkService, parentId);
      /*
         .then(device => {
            this.node = device;
            // return saveAsFile(this).then((result) => {
            const deviceId = device.id.get();


            return this._getDeviceObjectList(this.device).then((objectLists) => {
               const objectListDetails = [];

               return objectLists.map(object => {
                  return () => {
                     return this._getObjectDetail(this.device, object).then((g) => objectListDetails.push(g))
                  }
               }).reduce((previous, current) => { return previous.then(current) }, Promise.resolve()).then(() => {
                  const children = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type });


                  const promises = Array.from(Object.keys(children)).map((el: string) => {
                     return this._createEndpointsGroup(networkService, deviceId, el).then(endpointGroup => {
                        const groupId = endpointGroup.id.get();
                        return this._createEndpointByArray(networkService, groupId, children[el]);
                     })
                  })

                  return Promise.all(promises)

               })

            })
         })
      */
   }

   public createDeviceItemList(networkService: NetworkService, node: SpinalNodeRef, sensors: Array<number>): Promise<any> {

      // return saveAsFile(this).then((result) => {

      const deviceId = node.getId().get();


      return this._getDeviceObjectList(this.device, sensors).then((objectLists) => {
         const objectListDetails = [];

         return objectLists.map(object => {
            return () => {
               return this._getObjectDetail(this.device, object).then((g) => objectListDetails.push(g))
            }
         }).reduce((previous, current) => { return previous.then(current) }, Promise.resolve()).then(async () => {
            const children = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type });


            const promises = Array.from(Object.keys(children)).map((el: string) => {
               return this._createEndpointsGroup(networkService, deviceId, el).then(endpointGroup => {
                  const groupId = endpointGroup.id.get();
                  return this._createEndpointByArray(networkService, groupId, children[el]);
               })
            })

            return Promise.all(promises);

         })

      })

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

   private _createDevice(networkService: NetworkService, parentId: string): Promise<any> {
      return networkService.createNewBmsDevice(parentId, this.info);
   }

   private async _createEndpointsGroup(networkService: NetworkService, deviceId: string, groupName: string) {
      const networkId = ObjectTypes[`object_${groupName}`.toUpperCase()]

      const exist = await this._itemExistInChild(deviceId, SpinalBmsEndpointGroup.relationName, networkId);
      if (exist) return exist;

      const obj: any = {
         name: groupName,
         id: networkId,
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
      const networkId = endpointObj.id;
      const exist = await this._itemExistInChild(groupId, SpinalBmsEndpoint.relationName, networkId);
      if (exist) return exist;

      const obj: any = {
         id: networkId,
         typeId: endpointObj.typeId,
         name: endpointObj.object_name,
         path: "",
         currentValue: this._formatCurrentValue(endpointObj.present_value, endpointObj.objectId.type),
         unit: endpointObj.units,
         type: endpointObj.type,
      }

      return networkService.createNewBmsEndpoint(groupId, obj);;
   }

   private _getDeviceObjectList(device: any, SENSOR_TYPES: Array<number>): Promise<Array<Array<{ type: string, instance: number }>>> {
      return new Promise((resolve, reject) => {

         this.client = new bacnet({ adpuTimeout: 45000 });


         const sensor = []


         this.client.readProperty(device.address, { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId }, PropertyIds.PROP_OBJECT_LIST, (err, res) => {
            if (err) {
               reject(err);
               return;
            }

            for (const item of res.values) {
               if (SENSOR_TYPES.indexOf(item.value.type) !== -1) {
                  sensor.push(item.value);
               }
            }

            this.children = lodash.chunk(sensor, this.chunkLength)
            resolve(this.children);
         })
      });
   }

   private _getObjectDetail(device: IDevice, objects: Array<{ type: string, instance: number }>) {

      const requestArray = objects.map(el => ({
         objectId: JSON.parse(JSON.stringify(el)),
         properties: [
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
               { id: PropertyIds.PROP_OBJECT_NAME },
               // { id: PropertyIds.PROP_OBJECT_IDENTIFIER }
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
               deviceId: device.deviceId,
               address: device.address,
               name: dataFormated[0][this._getPropertyNameByCode(PropertyIds.PROP_OBJECT_NAME)],
               type: dataFormated[0].type
            }

            resolve(obj)
         })
      });
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
            typeId: objectId.type,
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

   private _formatCurrentValue(value: any, type: number) {

      if ([ObjectTypes.OBJECT_BINARY_INPUT, ObjectTypes.OBJECT_BINARY_VALUE].indexOf(type) !== -1) {
         return value ? true : false;
      }

      return value;

   }

   private async _itemExistInChild(parentId: string, relationName: string, childNetworkId: string | number) {
      const children = await SpinalGraphService.getChildren(parentId, [relationName]);
      const found = children.find(el => el.idNetwork.get() == childNetworkId);

      return found;
   }

}
