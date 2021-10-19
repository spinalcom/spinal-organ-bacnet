import * as lodash from "lodash";
import * as bacnet from "bacstack";
import { SpinalGraphService } from "spinal-env-viewer-graph-service";
import { ObjectTypes, PropertyIds, PropertyNames, ObjectTypesCode, UNITS_TYPES } from "./GlobalVariables";
import { SpinalBmsEndpointGroup, NetworkService, SpinalBmsEndpoint } from "spinal-model-bmsnetwork";
import { IDevice, IObjectId, IReadPropertyMultiple, IRequestArray, IReadProperty } from "../Interfaces";
import { SEGMENTATIONS } from "../utilities/GlobalVariables";



export default class BacnetUtilities {
   constructor() { }


   ////////////////////////////////////////////////////////////////
   ////                  READ BACNET DATA                        //
   ////////////////////////////////////////////////////////////////

   public static readPropertyMutltiple(address: string, requestArray: IRequestArray | IRequestArray[], argClient?: bacnet): Promise<IReadPropertyMultiple> {
      return new Promise((resolve, reject) => {
         try {
            const client = argClient || new bacnet();
            requestArray = Array.isArray(requestArray) ? requestArray : [requestArray];

            client.readPropertyMultiple(address, requestArray, (err, data) => {
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

   public static readProperty(address: string, objectId: IObjectId, propertyId: number | string, argClient?: bacnet, clientOptions?: any): Promise<IReadProperty> {
      const client = argClient || new bacnet();
      const options = clientOptions || {};

      return new Promise((resolve, reject) => {
         client.readProperty(address, objectId, propertyId, options, (err, data) => {
            if (err) return reject(err);

            resolve(data);
         })
      });
   }

   ////////////////////////////////////////////////////////////////
   ////                  GET ALL OBJECT LIST                     //
   ////////////////////////////////////////////////////////////////
   public static async _getDeviceObjectList(device: IDevice, SENSOR_TYPES: Array<number>, argClient?: bacnet): Promise<Array<IObjectId>> {
      console.log("getting object list");
      const objectId = { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId };
      let values;

      try {
         if (device.segmentation == SEGMENTATIONS.SEGMENTATION_BOTH || device.segmentation == SEGMENTATIONS.SEGMENTATION_TRANSMIT) {
            console.log(device.address, "device accepte segmentation");

            const requestArray: IRequestArray = {
               objectId: objectId,
               properties: [{ id: PropertyIds.PROP_OBJECT_LIST }]
            };

            const data = await this.readPropertyMutltiple(device.address, requestArray, argClient);
            values = lodash.flattenDeep(data.values.map(el => el.values.map(el2 => el2.value)));

         } else {
            console.log(device.address, "not accepte segmentation");
            const data = await this.readProperty(device.address, objectId, PropertyIds.PROP_OBJECT_LIST, argClient);
            values = data.values;
         }

      } catch (error) {

         if (error.message.match(/reason:4/i)) {
            values = await this.getItemListByFragment(device, objectId, argClient);
         } else {
            throw error;
         }

      }


      if (typeof values === "undefined") throw "No values found";

      const sensor = [];
      for (const item of values) {
         if (SENSOR_TYPES.indexOf(item.value.type) !== -1) {
            sensor.push(item.value);
         }
      }

      return sensor;
   }


   public static async getItemListByFragment(device: IDevice, objectId: IObjectId, argClient?: bacnet) {
      const list = [];

      return new Promise(async (resolve, reject) => {
         let error;
         let index = 1;
         let finish = false;
         while (!error || !finish) {
            try {
               const clientOptions = { arrayIndex: index }
               const value = await this.readProperty(device.address, objectId, PropertyIds.PROP_OBJECT_LIST, argClient, clientOptions);
               if (value) {
                  index++;
                  list.push(...value.values);
               } else {
                  finish = true;
               }

            } catch (err) {
               error = err;
               resolve(list);
            }
         }

         resolve(list);
      });
   }

   ////////////////////////////////////////////////////////////////
   ////                  GET OBJECT DETAIL                       //
   ////////////////////////////////////////////////////////////////

   public static async _getObjectDetail(device: IDevice, objects: Array<IObjectId>, argClient?: any): Promise<Array<{ [key: string]: string | boolean | number }>> {

      console.log("get object details");

      if (device.segmentation == SEGMENTATIONS.SEGMENTATION_BOTH || device.segmentation == SEGMENTATIONS.SEGMENTATION_TRANSMIT) {
         console.log("device accepte segmentation");

         const objectLists = lodash.chunk(objects, 60);
         const objectListDetails = [];

         while (objectLists.length > 0) {
            const object = objectLists.shift();
            if (object) {
               try {
                  const res = await this._getObjectDetailWithReadPropertyMultiple(device, object, argClient);
                  objectListDetails.push(res);
               } catch (err) { }
            }
         }

         return lodash.flattenDeep(objectListDetails);
      } else {
         console.log("device not accepte segmentation");

         const objectLists = [...objects];
         const objectListDetails = [];

         while (objectLists.length > 0) {
            const object = objectLists.shift();
            if (object) {
               try {
                  const res = await this._getObjectDetailWithReadProperty(device, object, argClient);
                  objectListDetails.push(res);
               } catch (error) { }

            }
         }

         return objectListDetails;
      }

   }

   public static async _getObjectDetailWithReadPropertyMultiple(device: IDevice, objects: Array<IObjectId>, argClient?: any): Promise<Array<any>> {

      try {
         const requestArray: IRequestArray[] = objects.map(el => ({
            objectId: JSON.parse(JSON.stringify(el)),
            properties: [
               { id: PropertyIds.PROP_OBJECT_NAME },
               { id: PropertyIds.PROP_PRESENT_VALUE },
               { id: PropertyIds.PROP_OBJECT_TYPE },
               { id: PropertyIds.PROP_UNITS },
               { id: PropertyIds.PROP_MAX_PRES_VALUE },
               { id: PropertyIds.PROP_MIN_PRES_VALUE }
            ]
         }))
         const data = await this.readPropertyMutltiple(device.address, requestArray, argClient);
         const dataFormated = data.values.map(el => {
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

         return dataFormated;
      } catch (error) {
         throw error;
      }
   }

   public static async _getObjectDetailWithReadProperty(device: IDevice, objectId: IObjectId, argClient?: any): Promise<any> {

      const properties = [
         PropertyIds.PROP_OBJECT_NAME, PropertyIds.PROP_PRESENT_VALUE,
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
               const formated = await this._getPropertyValue(device.address, objectId, property, argClient);
               for (let key in formated) {
                  obj[key] = formated[key];
               }
            }

         } catch (error) { }
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

   public static async _getChildrenNewValue(device: IDevice, children: Array<IObjectId>, argClient?: bacnet): Promise<Array<{ id: string | number; type: string | number; currentValue: any }>> {
      const client = argClient || new bacnet();

      if (device.segmentation == SEGMENTATIONS.SEGMENTATION_BOTH || device.segmentation == SEGMENTATIONS.SEGMENTATION_TRANSMIT) {
         return this.getChildrenNewValueWithReadPropertyMultiple(device, children, client);
      } else {
         return this.getChildrenNewValueWithReadProperty(device, children, client);
      }

   }

   private static async getChildrenNewValueWithReadPropertyMultiple(device: IDevice, children: Array<IObjectId>, argClient?: bacnet): Promise<Array<{ id: string | number; type: string | number; currentValue: any }>> {

      try {
         const client = argClient || new bacnet();
         const requestArray = children.map(el => ({ objectId: el, properties: [{ id: PropertyIds.PROP_PRESENT_VALUE }] }));
         const data = await this.readPropertyMutltiple(device.address, requestArray, client);
         const dataFormated = data.values.map(el => {
            const value = this._getObjValue(el.values[0].value);
            return {
               id: el.objectId.instance,
               type: el.objectId.type,
               currentValue: this._formatCurrentValue(value, el.objectId.type)
            }
         })

         return dataFormated;
      } catch (error) { }
   }

   private static async getChildrenNewValueWithReadProperty(device: IDevice, children: Array<IObjectId>, argClient?: bacnet): Promise<Array<{ id: string | number; type: string | number; currentValue: any }>> {
      const client = argClient || new bacnet();
      const res = [];

      try {
         const deep_children = [...children];
         while (deep_children.length > 0) {
            const obj = deep_children.shift();
            if (obj) {
               try {
                  obj["id"] = obj.instance;
                  const data = await this.readProperty(device.address, obj, PropertyIds.PROP_PRESENT_VALUE, client);
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

   public static async createEndpointsInGroup(networkService: NetworkService, deviceId: string, groupName: string, endpointArray: any) {
      const endpointGroup = await this._createEndpointsGroup(networkService, deviceId, groupName);
      const groupId = endpointGroup.id.get();
      return this._createEndpointByArray(networkService, groupId, endpointArray);
   }

   public static async _createEndpointsGroup(networkService: NetworkService, deviceId: string, groupName: string) {
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

   public static async _createEndpointByArray(networkService: NetworkService, groupId: string, endpointArray: any) {
      const promises = endpointArray.map(el => this._createEndpoint(networkService, groupId, el))
      const endpoints = await Promise.all(promises);
      return endpoints;
   }

   public static async _createEndpoint(networkService: NetworkService, groupId: string, endpointObj: any) {

      const exist = await this._itemExistInChild(groupId, SpinalBmsEndpoint.relationName, endpointObj.id);
      if (exist) return exist;

      const obj: any = {
         id: endpointObj.id,
         typeId: endpointObj.typeId,
         name: endpointObj.object_name.length > 0 ? endpointObj.object_name : `endpoint_${endpointObj.id}`,
         path: "",
         currentValue: this._formatCurrentValue(endpointObj.present_value, endpointObj.objectId.type),
         unit: endpointObj.units,
         type: endpointObj.type,
      }

      return networkService.createNewBmsEndpoint(groupId, obj);

   }

   public static async _itemExistInChild(parentId: string, relationName: string, childNetworkId: string | number) {
      const children = await SpinalGraphService.getChildren(parentId, [relationName]);
      const found = children.find(el => el.idNetwork.get() == childNetworkId);

      return found;
   }


   //////////////////////////////////////////////////////////////////////
   ////                             OTHER UTILITIES                  ////
   //////////////////////////////////////////////////////////////////////


   public static async _getPropertyValue(address: string, objectId: IObjectId, propertyId: number | string, argClient?: bacnet): Promise<any> {

      try {
         const data = await this.readProperty(address, objectId, propertyId, argClient);
         console.log(data)
         const formated: any = this._formatProperty(data);
         return formated;

      } catch (error) {
         throw error;
      }

      // const client = argClient || new bacnet();
      // return new Promise((resolve, reject) => {
      //    client.readProperty(address, objectId,propertyId,(err,data) => {
      //       if(err) {
      //          reject(err);
      //          console.error(err);
      //          return;
      //       }

      //       const formated: any = this._formatProperty(data);

      //       resolve(formated);
      //    })
      // });
   }


   public static _formatProperty(object) {
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

   public static _getObjValue(value: any) {
      if (typeof value !== "object") return value;

      let temp_value = Array.isArray(value) ? value[0]?.value : value.value;
      return typeof temp_value === "object" ? "" : temp_value;
   }

   public static _formatCurrentValue(value: any, type: number | string) {

      if ([ObjectTypes.OBJECT_BINARY_INPUT, ObjectTypes.OBJECT_BINARY_VALUE].indexOf(type) !== -1) {
         return value ? true : false;
      }

      return value;

   }

   public static _getPropertyNameByCode(type: number) {
      const property = PropertyNames[type];
      if (property) return property.toLocaleLowerCase().replace('prop_', '');
      return;
   }

   public static _getObjectTypeByCode(typeCode: number | string) {
      const property = ObjectTypesCode[typeCode];
      if (property) return property.toLocaleLowerCase().replace('object_', '');
      return;
   }

   public static _getUnitsByCode(typeCode: number): string {
      const property = UNITS_TYPES[typeCode];
      if (property) return property.toLocaleLowerCase().replace('units_', '').replace("_", " ");
      return;
   }

   // public static _formatMultipleProperty(data: any) {
   //    return lodash.flattenDeep(data.map(object => {
   //       const { values } = object;

   //       return values.map(({ value }) => {
   //          return value
   //       })
   //    }))
   // }



}


export {
   BacnetUtilities
}