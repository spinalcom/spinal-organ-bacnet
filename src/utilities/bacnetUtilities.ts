import * as bacnet from "bacstack";
import { SpinalGraphService } from "spinal-env-viewer-graph-service";
import { ObjectTypes, PropertyIds, PropertyNames, ObjectTypesCode, UNITS_TYPES } from "./globalVariables";
import { SpinalBmsEndpointGroup, NetworkService, SpinalBmsEndpoint } from "spinal-model-bmsnetwork";


export default class BacnetUtilities {
   constructor() { }

   public static _getObjectDetail(client, device: any, objects: Array<{ type: string, instance: number }>) {

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
         client.readPropertyMultiple(device.address, requestArray, (err, data) => {
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

   public static _formatProperty(deviceId, object) {

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

   public static _getObjValue(value: any) {
      if (Array.isArray(value)) {
         if (value.length === 0) return "";
         return value[0].value;
      }

      return value.value;
   }

   public static _formatCurrentValue(value: any, type: number) {

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

   public static _getObjectTypeByCode(typeCode: number) {
      const property = ObjectTypesCode[typeCode];
      if (property) return property.toLocaleLowerCase().replace('object_', '');
      return;
   }

   public static _getUnitsByCode(typeCode: number): string {
      const property = UNITS_TYPES[typeCode];
      if (property) return property.toLocaleLowerCase().replace('units_', '').replace("_", " ");
      return;
   }

   public static async _itemExistInChild(parentId: string, relationName: string, childNetworkId: string | number) {
      const children = await SpinalGraphService.getChildren(parentId, [relationName]);
      const found = children.find(el => el.idNetwork.get() == childNetworkId);

      return found;
   }


   public static async _createEndpointsGroup(networkService: NetworkService, deviceId: string, groupName: string) {
      const networkId = ObjectTypes[`object_${groupName}`.toUpperCase()]

      const exist = await BacnetUtilities._itemExistInChild(deviceId, SpinalBmsEndpointGroup.relationName, networkId);
      if (exist) return exist;

      const obj: any = {
         name: groupName,
         id: networkId,
         type: groupName,
         path: ""
      }
      return networkService.createNewBmsEndpointGroup(deviceId, obj);
   }

   public static _createEndpointByArray(networkService: NetworkService, groupId: string, endpointArray) {
      const promises = endpointArray.map(el => this._createEndpoint(networkService, groupId, el))
      return Promise.all(promises);
   }

   public static async _createEndpoint(networkService: NetworkService, groupId: string, endpointObj: any) {
      const networkId = endpointObj.id;
      const exist = await BacnetUtilities._itemExistInChild(groupId, SpinalBmsEndpoint.relationName, networkId);
      if (exist) return exist;

      const obj: any = {
         id: networkId,
         typeId: endpointObj.typeId,
         name: endpointObj.object_name,
         path: "",
         currentValue: BacnetUtilities._formatCurrentValue(endpointObj.present_value, endpointObj.objectId.type),
         unit: endpointObj.units,
         type: endpointObj.type,
      }

      return networkService.createNewBmsEndpoint(groupId, obj);;
   }

}


export {
   BacnetUtilities
}