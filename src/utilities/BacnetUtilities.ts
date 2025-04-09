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
import { SpinalGraphService, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { ObjectTypes, PropertyIds, PropertyNames, ObjectTypesCode, UNITS_TYPES } from "./GlobalVariables";
import { SpinalBmsEndpointGroup, NetworkService, SpinalBmsEndpoint } from "spinal-model-bmsnetwork";
import { IDevice, IObjectId, IReadPropertyMultiple, IRequestArray, IReadProperty } from "../Interfaces";
import { SEGMENTATIONS } from "./GlobalVariables";



class BacnetUtilitiesClass {

   private static instance: BacnetUtilitiesClass;
   private _client: bacnet = null;
   private constructor() { }


   public static getInstance(): BacnetUtilitiesClass {
      if (!this.instance) this.instance = new BacnetUtilitiesClass();
      return this.instance;
   }

   public createNewBacnetClient(): bacnet {
      const client = new bacnet({ adpuTimeout: 6000 });
      this._listenClientErrorEvent(client);
      return client;
   }

   public getClient(): Promise<bacnet> {
      return new Promise((resolve) => {
         if (!this._client) {
            this._client = this.createNewBacnetClient();
            // const callback = () => resolve(this._client);
            resolve(this._client);
         }

         return resolve(this._client);
      });

   }

   private _listenClientErrorEvent(client: bacnet): void {
      client.on('error', () => {
         client = null;
      });
   }

   ////////////////////////////////////////////////////////////////
   ////                  READ BACNET DATA                        //
   ////////////////////////////////////////////////////////////////

   public readPropertyMultiple(address: string, sadr: any, requestArray: IRequestArray | IRequestArray[], argClient?: bacnet): Promise<IReadPropertyMultiple> {
      return new Promise(async (resolve, reject) => {
         try {
            const client = argClient || await this.getClient();
            requestArray = Array.isArray(requestArray) ? requestArray : [requestArray];
            if (sadr && typeof sadr == "object") sadr = Object.keys(sadr).length === 0 ? null : sadr;

            client.readPropertyMultiple(address, sadr, requestArray, (err, data) => {
               if (err) {
                  reject(err);
                  return;
               }
               resolve(data);
            })
         } catch (error) {
            reject(error);
         }
      });
   }

   public async readProperty(address: string, sadr: any, objectId: IObjectId, propertyId: number | string, argClient?: bacnet, clientOptions?: any): Promise<IReadProperty> {
      const client = argClient || await this.getClient();
      const options = clientOptions || {};
      if (sadr && typeof sadr == "object") sadr = Object.keys(sadr).length === 0 ? null : sadr;

      return new Promise((resolve, reject) => {
         client.readProperty(address, sadr, objectId, propertyId, options, (err, data) => {
            if (err) return reject(err);

            resolve(data);
         })
      });
   }

   ////////////////////////////////////////////////////////////////
   ////                  GET ALL BACNET OBJECT LIST              //
   ////////////////////////////////////////////////////////////////

   public async _getDeviceObjectList(device: IDevice, SENSOR_TYPES: Array<number>, argClient?: bacnet): Promise<IObjectId[]> {
      console.log("getting object list");
      const objectId = { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId };
      let values;

      try {
         const deviceAcceptSegmentation = [SEGMENTATIONS.SEGMENTATION_BOTH, SEGMENTATIONS.SEGMENTATION_TRANSMIT].indexOf(device.segmentation) != -1;
         let params = deviceAcceptSegmentation ? [{ objectId: objectId, properties: [{ id: PropertyIds.PROP_OBJECT_LIST }] }] : [objectId, PropertyIds.PROP_OBJECT_LIST];
         let func = deviceAcceptSegmentation ? this.readPropertyMultiple : this.readProperty;

         const data = await func.call(this, device.address, device.SADR, ...params, argClient);
         values = deviceAcceptSegmentation ? lodash.flattenDeep(data.values.map(el => el.values.map(el2 => el2.value))) : data.values;

      } catch (error) {
         console.error(error);

         if (error.message.match(/reason:4/i) || error.message.match(/err_timeout/i)) values = await this.getItemListByFragment(device, objectId, argClient);

      }

      if (typeof values === "undefined") throw "No values found";

      return values.filter(item => SENSOR_TYPES.indexOf(item.value.type) !== -1);

   }

   public async getItemListByFragment(device: IDevice, objectId: IObjectId, argClient?: bacnet): Promise<IObjectId[]> {
      const list = [];
      let error;
      let index = 1;
      let finish = false;

      return new Promise(async (resolve, reject) => {

         while (!error && !finish) {
            try {
               const clientOptions = { arrayIndex: index }
               const value = await this.readProperty(device.address, device.SADR, objectId, PropertyIds.PROP_OBJECT_LIST, argClient, clientOptions);
               if (value) {
                  index++;
                  list.push(...value.values);
               } else {
                  finish = true;
               }

            } catch (err) {
               error = err;
            }
         }

         resolve(list);
      });
   }

   ////////////////////////////////////////////////////////////////
   ////                  GET OBJECT DETAIL                       //
   ////////////////////////////////////////////////////////////////

   public async _getObjectDetail(device: IDevice, objects: Array<IObjectId>, argClient?: any): Promise<{ [key: string]: string | boolean | number }[]> {

      let objectLists = [...objects];

      let objectListDetails = [];
      const deviceAcceptSegmentation = [SEGMENTATIONS.SEGMENTATION_BOTH, SEGMENTATIONS.SEGMENTATION_TRANSMIT].indexOf(device.segmentation) !== -1;

      const func = deviceAcceptSegmentation ? this._getObjectDetailWithReadPropertyMultiple : this._getObjectDetailWithReadProperty;


      if (deviceAcceptSegmentation) {
         objectLists = lodash.chunk(objects, 10);
      }

      while (objectLists.length > 0) {
         const object: any = objectLists.shift();
         if (object) {
            try {
               const res = await func.call(this, device, object, argClient);
               objectListDetails.push(res);
            } catch (err) {
            }
         }
      }

      if (deviceAcceptSegmentation) objectListDetails = lodash.flattenDeep(objectListDetails);

      return objectListDetails;

   }

   public async _getObjectDetailWithReadPropertyMultiple(device: IDevice, objects: Array<IObjectId>, argClient?: any): Promise<any[]> {

      try {
         const requestArray: IRequestArray[] = objects.map(el => ({
            objectId: JSON.parse(JSON.stringify(el)),
            properties: [
               { id: PropertyIds.PROP_OBJECT_NAME },
               { id: PropertyIds.PROP_PRESENT_VALUE },
               { id: PropertyIds.PROP_DESCRIPTION },
               { id: PropertyIds.PROP_OBJECT_TYPE },
               { id: PropertyIds.PROP_UNITS },
               { id: PropertyIds.PROP_MAX_PRES_VALUE },
               { id: PropertyIds.PROP_MIN_PRES_VALUE }
            ]
         }))
         const data = await this.readPropertyMultiple(device.address, device.SADR, requestArray, argClient);
         return data.values.map(el => {
            const { objectId } = el;

            const obj = {
               objectId: objectId,
               id: objectId.instance,
               typeId: objectId.type,
               type: this._getObjectTypeByCode(objectId.type),
               instance: objectId.instance,
               deviceId: device.deviceId
            }

            const formated: any = this._formatProperty(el);

            for (let key in formated) {
               obj[key] = formated[key];
            }

            return obj;
         });

      } catch (error) {
         throw error;
      }
   }

   public async _getObjectDetailWithReadProperty(device: IDevice, objectId: IObjectId, argClient?: any): Promise<any> {

      const properties = [
         PropertyIds.PROP_OBJECT_NAME, PropertyIds.PROP_PRESENT_VALUE, PropertyIds.PROP_DESCRIPTION,
         PropertyIds.PROP_OBJECT_TYPE, PropertyIds.PROP_UNITS,
         PropertyIds.PROP_MAX_PRES_VALUE, PropertyIds.PROP_MIN_PRES_VALUE
      ]

      const obj = {
         objectId: objectId,
         id: objectId.instance,
         typeId: objectId.type,
         type: this._getObjectTypeByCode(objectId.type),
         instance: objectId.instance,
         deviceId: device.deviceId
      };

      while (properties.length > 0) {
         try {
            const property = properties.shift();
            if (typeof property !== "undefined") {
               // console.log("property not undefined");
               const formated = await this._getPropertyValue(device.address, device.SADR, objectId, property, argClient);

               for (let key in formated) {
                  obj[key] = formated[key];
               }
            } else {
               // console.log("property is undefined");
            }

         } catch (error) {
            // console.error(error);
         }
      }


      return obj;

      // const requestArray = objects.map(el => ({
      //    objectId: JSON.parse(JSON.stringify(el)),
      //    properties: [
      //       { id: PropertyIds.PROP_OBJECT_NAME },
      //       { id: PropertyIds.PROP_PRESENT_VALUE },
      //       { id: PropertyIds.PROP_OBJECT_TYPE },
      //       { id: PropertyIds.PROP_UNITS },
      //       { id: PropertyIds.PROP_MAX_PRES_VALUE }, 
      //       { id: PropertyIds.PROP_MIN_PRES_VALUE }
      //    ]
      // }))

      // return new Promise((resolve, reject) => {
      //    client.readPropertyMultiple(device.address, requestArray, (err, data) => {
      //       if (err) {
      //          console.error(err)
      //          client.close()
      //          reject(err);
      //          return;
      //       }

      //       const dataFormated = data.values.map(el => {
      //          const formated: any = this._formatProperty(device.deviceId, el);

      //          if (typeof formated.units === "object") formated.units = "";
      //          else formated.units = this._getUnitsByCode(formated.units);
      //          return formated;
      //       })

      //       resolve(dataFormated);
      //    })
      // });
   }

   public async _getChildrenNewValue(device: IDevice, children: Array<IObjectId>, argClient?: bacnet): Promise<Array<{ id: string | number; type: string | number; currentValue: any }>> {
      const client = argClient || await this.getClient();
      const deviceAcceptSegmentation = [SEGMENTATIONS.SEGMENTATION_BOTH, SEGMENTATIONS.SEGMENTATION_TRANSMIT].indexOf(device.segmentation) !== -1;
      const func = deviceAcceptSegmentation ? this.getChildrenNewValueWithReadPropertyMultiple : this.getChildrenNewValueWithReadProperty;

      return func.call(this, device, children, client);
      // if (device.segmentation == SEGMENTATIONS.SEGMENTATION_BOTH || device.segmentation == SEGMENTATIONS.SEGMENTATION_TRANSMIT) {
      //    return this.getChildrenNewValueWithReadPropertyMultiple(device, children, client);
      // } else {
      //    return this.getChildrenNewValueWithReadProperty(device, children, client);
      // }

   }

   private async getChildrenNewValueWithReadPropertyMultiple(device: IDevice, children: Array<IObjectId>, argClient?: bacnet): Promise<Array<{ id: string | number; type: string | number; currentValue: any }>> {

      try {
         const client = argClient || await this.getClient();
         const requestArray = children.map(el => ({ objectId: el, properties: [{ id: PropertyIds.PROP_PRESENT_VALUE }] }));

         const list_chunked = lodash.chunk(requestArray, 50);

         const res = [];
         while (list_chunked.length > 0) {
            const arr = list_chunked.pop();
            const data = await this.readPropertyMultiple(device.address, device.SADR, arr, client);

            const dataFormated = data.values.map(el => {
               const value = this._getObjValue(el.values[0].value);
               return {
                  id: el.objectId.instance,
                  type: el.objectId.type,
                  currentValue: this._formatCurrentValue(value, el.objectId.type)
               }
            })

            res.push(dataFormated);
         }

         return lodash.flattenDeep(res);

      } catch (error) {
      }
   }

   private async getChildrenNewValueWithReadProperty(device: IDevice, children: Array<IObjectId>, argClient?: bacnet): Promise<Array<{ id: string | number; type: string | number; currentValue: any }>> {
      const client = argClient || await this.getClient();
      const res = [];

      try {
         const deep_children = [...children];
         while (deep_children.length > 0) {
            const obj = deep_children.shift();
            if (obj) {
               try {
                  obj["id"] = obj.instance;
                  const data = await this.readProperty(device.address, device.SADR, obj, PropertyIds.PROP_PRESENT_VALUE, client);
                  const value = data.values[0]?.value;
                  obj["currentValue"] = this._getObjValue(value);
                  res.push(obj);
               } catch (error) { }
            }
         }

         return res;
      } catch (error) {
         throw error;
      }
   }

   ////////////////////////////////////////////////////////////////
   ////                       Endpoints                          //
   ////////////////////////////////////////////////////////////////

   public async createEndpointsInGroup(networkService: NetworkService, deviceId: string, groupName: string, endpointArray: any, deviceName?: string): Promise<SpinalNodeRef[]> {
      const endpointGroup = await this._createEndpointsGroup(networkService, deviceId, groupName);
      const groupId = endpointGroup.id.get();
      return this._createEndpointByArray(networkService, groupId, endpointArray, deviceName);
   }

   public async _createEndpointsGroup(networkService: NetworkService, deviceId: string, groupName: string): Promise<SpinalNodeRef> {
      const networkId = ObjectTypes[`object_${groupName}`.toUpperCase()]

      const exist = await this._itemExistInChild(deviceId, SpinalBmsEndpointGroup.relationName, networkId);
      if (exist) return exist;

      const obj: any = {
         name: groupName,
         id: networkId,
         type: groupName,
         path: ""
      }
      const endpointGroup = await networkService.createNewBmsEndpointGroup(deviceId, obj);
      return endpointGroup;
   }

   public async _createEndpointByArray(networkService: NetworkService, groupId: string, endpointArray: any, deviceName?: string): Promise<SpinalNodeRef[]> {
      const childNetwork = await this.getChildrenObj(groupId, SpinalBmsEndpoint.relationName);
      const nodeCreated = []
      let counter = 0;
      while (counter < endpointArray.length) {
         const item = endpointArray[counter];
         if (childNetwork[item.id]) {
            // console.log(item.id, "already exists", deviceName ? `in "${deviceName}"` : "");
            counter++;
            continue;
         }

         const ref = await this._createEndpoint(networkService, groupId, item);
         if (ref) nodeCreated.push(ref);
         counter++;
      }

      return nodeCreated;
   }

   public async _createEndpoint(networkService: NetworkService, groupId: string, endpointObj: any): Promise<void | SpinalNodeRef> {

      const obj: any = {
         id: endpointObj.id,
         typeId: endpointObj.typeId,
         name: endpointObj.object_name,
         path: "",
         currentValue: this._formatCurrentValue(endpointObj.present_value, endpointObj.objectId.type),
         unit: endpointObj.units,
         type: endpointObj.type,
         description: endpointObj.description || "",
      }

      if (obj.name && typeof obj.name === "string" && obj.name.trim()) {
         // console.log("creating", endpointObj.id);
         return networkService.createNewBmsEndpoint(groupId, obj);
      }

   }

   public async _itemExistInChild(parentId: string, relationName: string, childNetworkId: string | number): Promise<SpinalNodeRef> {
      const children = await SpinalGraphService.getChildren(parentId, [relationName]);
      const found = children.find(el => el.idNetwork.get() == childNetworkId);

      return found;
   }

   //////////////////////////////////////////////////////////////////////
   ////                             OTHER UTILITIES                  ////
   //////////////////////////////////////////////////////////////////////


   public async _getPropertyValue(address: string, sadr: any, objectId: IObjectId, propertyId: number | string, argClient?: bacnet): Promise<any> {

      try {
         const data = await this.readProperty(address, sadr, objectId, propertyId, argClient);
         const formated: any = this._formatProperty(data);
         return formated;

      } catch (error) {
         throw error;
      }
   }

   public async getDeviceId(address: string, sadr: any, client?: bacnet): Promise<number> {
      const objectId = { type: ObjectTypes.OBJECT_DEVICE, instance: PropertyIds.MAX_BACNET_PROPERTY_ID };
      const data = await this.readProperty(address, sadr, objectId, PropertyIds.PROP_OBJECT_IDENTIFIER, client);
      return data.values[0].value.instance;
   }


   public _formatProperty(object): { [key: string]: boolean | string | number } {
      if (object) {
         const { values, property } = object;

         const obj: any = {};

         for (const { id, value } of values) {
            const argId = id || property?.id;
            const propertyName = this._getPropertyNameByCode(argId);

            if (propertyName) {
               obj[propertyName] = this._getObjValue(value);
            }
         }

         if (typeof obj.units !== "undefined") {
            if (typeof obj.units === "object") obj.units = "";
            else obj.units = this._getUnitsByCode(obj.units);
         }


         return obj;
      }

      return {}

   }

   public _getObjValue(value: any): boolean | string | number {
      if (typeof value !== "object") return value;

      let temp_value = Array.isArray(value) ? value[0]?.value : value.value;
      return typeof temp_value === "object" ? "" : temp_value;
   }

   public _formatCurrentValue(value: any, type: number | string): boolean | string | number {
      if ([ObjectTypes.OBJECT_BINARY_INPUT, ObjectTypes.OBJECT_BINARY_VALUE].indexOf(type) !== -1) {
         return value ? true : false;
      }
      return value;
   }

   public _getPropertyNameByCode(type: number): string {
      const property = PropertyNames[type];
      if (property) return property.toLocaleLowerCase().replace('prop_', '');
      return;
   }

   public _getObjectTypeByCode(typeCode: number | string): string {
      const property = ObjectTypesCode[typeCode];
      if (property) return property.toLocaleLowerCase().replace('object_', '');
      return;
   }

   public _getUnitsByCode(typeCode: number): string {
      const property = UNITS_TYPES[typeCode];
      if (property) return property.toLocaleLowerCase().replace('units_', '').replace("_", " ");
      return;
   }



   private async getChildrenObj(parentId: string, relationName: string): Promise<{ [key: string]: SpinalNodeRef }> {
      const children = await SpinalGraphService.getChildren(parentId, [relationName]);
      const obj = {};
      children.forEach(el => obj[el.idNetwork.get()] = el);

      return obj;
   }

}


const BacnetUtilities = BacnetUtilitiesClass.getInstance();
export default BacnetUtilities;
export { BacnetUtilities };