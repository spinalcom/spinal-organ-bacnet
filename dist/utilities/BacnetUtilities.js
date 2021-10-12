"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BacnetUtilities = void 0;
const lodash = require("lodash");
const bacnet = require("bacstack");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const GlobalVariables_1 = require("./GlobalVariables");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const GlobalVariables_2 = require("../utilities/GlobalVariables");
class BacnetUtilities {
    constructor() { }
    ////////////////////////////////////////////////////////////////
    ////                  READ BACNET DATA                        //
    ////////////////////////////////////////////////////////////////
    static readPropertyMutltiple(address, requestArray, argClient) {
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
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    static readProperty(address, objectId, propertyId, argClient, clientOptions) {
        const client = argClient || new bacnet();
        const options = clientOptions || {};
        return new Promise((resolve, reject) => {
            client.readProperty(address, objectId, propertyId, options, (err, data) => {
                if (err)
                    return reject(err);
                resolve(data);
            });
        });
    }
    ////////////////////////////////////////////////////////////////
    ////                  GET ALL OBJECT LIST                     //
    ////////////////////////////////////////////////////////////////
    static _getDeviceObjectList(device, SENSOR_TYPES, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("getting object list");
            const objectId = { type: GlobalVariables_1.ObjectTypes.OBJECT_DEVICE, instance: device.deviceId };
            let values;
            try {
                if (device.segmentation == GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_BOTH || device.segmentation == GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_TRANSMIT) {
                    console.log(device.address, "device accepte segmentation");
                    const requestArray = {
                        objectId: objectId,
                        properties: [{ id: GlobalVariables_1.PropertyIds.PROP_OBJECT_LIST }]
                    };
                    const data = yield this.readPropertyMutltiple(device.address, requestArray, argClient);
                    values = lodash.flattenDeep(data.values.map(el => el.values.map(el2 => el2.value)));
                }
                else {
                    console.log(device.address, "not accepte segmentation");
                    const data = yield this.readProperty(device.address, objectId, GlobalVariables_1.PropertyIds.PROP_OBJECT_LIST, argClient);
                    values = data.values;
                }
            }
            catch (error) {
                if (error.message.match(/reason:4/i)) {
                    values = yield this.getItemListByFragment(device, objectId, argClient);
                }
                else {
                    throw error;
                }
            }
            if (typeof values === "undefined")
                throw "No values found";
            const sensor = [];
            for (const item of values) {
                if (SENSOR_TYPES.indexOf(item.value.type) !== -1) {
                    sensor.push(item.value);
                }
            }
            return sensor;
        });
    }
    static getItemListByFragment(device, objectId, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const list = [];
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                let error;
                let index = 1;
                let finish = false;
                while (!error || !finish) {
                    try {
                        const clientOptions = { arrayIndex: index };
                        const value = yield this.readProperty(device.address, objectId, GlobalVariables_1.PropertyIds.PROP_OBJECT_LIST, argClient, clientOptions);
                        if (value) {
                            index++;
                            list.push(...value.values);
                        }
                        else {
                            finish = true;
                        }
                    }
                    catch (err) {
                        error = err;
                        resolve(list);
                    }
                }
                resolve(list);
            }));
        });
    }
    ////////////////////////////////////////////////////////////////
    ////                  GET OBJECT DETAIL                       //
    ////////////////////////////////////////////////////////////////
    static _getObjectDetail(device, objects, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("get object details");
            if (device.segmentation == GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_BOTH || device.segmentation == GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_TRANSMIT) {
                console.log("device accepte segmentation");
                const objectLists = lodash.chunk(objects, 60);
                const objectListDetails = [];
                while (objectLists.length > 0) {
                    const object = objectLists.shift();
                    if (object) {
                        try {
                            const res = yield this._getObjectDetailWithReadPropertyMultiple(device, object, argClient);
                            objectListDetails.push(res);
                        }
                        catch (err) { }
                    }
                }
                return lodash.flattenDeep(objectListDetails);
            }
            else {
                console.log("device not accepte segmentation");
                const objectLists = [...objects];
                const objectListDetails = [];
                while (objectLists.length > 0) {
                    const object = objectLists.shift();
                    if (object) {
                        try {
                            const res = yield this._getObjectDetailWithReadProperty(device, object, argClient);
                            objectListDetails.push(res);
                        }
                        catch (error) { }
                    }
                }
                return objectListDetails;
            }
        });
    }
    static _getObjectDetailWithReadPropertyMultiple(device, objects, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestArray = objects.map(el => ({
                    objectId: JSON.parse(JSON.stringify(el)),
                    properties: [
                        { id: GlobalVariables_1.PropertyIds.PROP_OBJECT_NAME },
                        { id: GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE },
                        { id: GlobalVariables_1.PropertyIds.PROP_OBJECT_TYPE },
                        { id: GlobalVariables_1.PropertyIds.PROP_UNITS },
                        { id: GlobalVariables_1.PropertyIds.PROP_MAX_PRES_VALUE },
                        { id: GlobalVariables_1.PropertyIds.PROP_MIN_PRES_VALUE }
                    ]
                }));
                const data = yield this.readPropertyMutltiple(device.address, requestArray, argClient);
                const dataFormated = data.values.map(el => {
                    const { objectId } = el;
                    const obj = {
                        objectId: objectId,
                        id: objectId.instance,
                        typeId: objectId.type,
                        type: this._getObjectTypeByCode(objectId.type),
                        instance: objectId.instance,
                        deviceId: device.deviceId
                    };
                    const formated = this._formatProperty(el);
                    for (let key in formated) {
                        obj[key] = formated[key];
                    }
                    return obj;
                });
                return dataFormated;
            }
            catch (error) {
                throw error;
            }
        });
    }
    static _getObjectDetailWithReadProperty(device, objectId, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const properties = [
                GlobalVariables_1.PropertyIds.PROP_OBJECT_NAME, GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE,
                GlobalVariables_1.PropertyIds.PROP_OBJECT_TYPE, GlobalVariables_1.PropertyIds.PROP_UNITS,
                GlobalVariables_1.PropertyIds.PROP_MAX_PRES_VALUE, GlobalVariables_1.PropertyIds.PROP_MIN_PRES_VALUE
            ];
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
                        const formated = yield this._getPropertyValue(device.address, objectId, property, argClient);
                        for (let key in formated) {
                            obj[key] = formated[key];
                        }
                    }
                }
                catch (error) { }
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
        });
    }
    static _getChildrenNewValue(device, children, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = argClient || new bacnet();
            if (device.segmentation == GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_BOTH || device.segmentation == GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_TRANSMIT) {
                return this.getChildrenNewValueWithReadPropertyMultiple(device, children, client);
            }
            else {
                return this.getChildrenNewValueWithReadProperty(device, children, client);
            }
        });
    }
    static getChildrenNewValueWithReadPropertyMultiple(device, children, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = argClient || new bacnet();
                const requestArray = children.map(el => ({ objectId: el, properties: [{ id: GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE }] }));
                const data = yield this.readPropertyMutltiple(device.address, requestArray, client);
                const dataFormated = data.values.map(el => {
                    const value = this._getObjValue(el.values[0].value);
                    return {
                        id: el.objectId.instance,
                        type: el.objectId.type,
                        currentValue: this._formatCurrentValue(value, el.objectId.type)
                    };
                });
                return dataFormated;
            }
            catch (error) { }
        });
    }
    static getChildrenNewValueWithReadProperty(device, children, argClient) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const client = argClient || new bacnet();
            const res = [];
            try {
                const deep_children = [...children];
                while (deep_children.length > 0) {
                    const obj = deep_children.shift();
                    if (obj) {
                        obj["id"] = obj.instance;
                        const data = yield this.readProperty(device.address, obj, GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE, client);
                        const value = (_a = data.values[0]) === null || _a === void 0 ? void 0 : _a.value;
                        obj["currentValue"] = this._getObjValue(value);
                        res.push(obj);
                    }
                }
                return res;
            }
            catch (error) {
                throw error;
            }
        });
    }
    ////////////////////////////////////////////////////////////////
    ////                       Endpoints                          //
    ////////////////////////////////////////////////////////////////
    static createEndpointsInGroup(networkService, deviceId, groupName, endpointArray) {
        return __awaiter(this, void 0, void 0, function* () {
            const endpointGroup = yield this._createEndpointsGroup(networkService, deviceId, groupName);
            const groupId = endpointGroup.id.get();
            return this._createEndpointByArray(networkService, groupId, endpointArray);
        });
    }
    static _createEndpointsGroup(networkService, deviceId, groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            const networkId = GlobalVariables_1.ObjectTypes[`object_${groupName}`.toUpperCase()];
            const exist = yield this._itemExistInChild(deviceId, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.relationName, networkId);
            if (exist)
                return exist;
            const obj = {
                name: groupName,
                id: networkId,
                type: groupName,
                path: ""
            };
            const endpointGroup = yield networkService.createNewBmsEndpointGroup(deviceId, obj);
            return endpointGroup;
        });
    }
    static _createEndpointByArray(networkService, groupId, endpointArray) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = endpointArray.map(el => this._createEndpoint(networkService, groupId, el));
            const endpoints = yield Promise.all(promises);
            return endpoints;
        });
    }
    static _createEndpoint(networkService, groupId, endpointObj) {
        return __awaiter(this, void 0, void 0, function* () {
            const exist = yield this._itemExistInChild(groupId, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName, endpointObj.id);
            if (exist)
                return exist;
            const obj = {
                id: endpointObj.id,
                typeId: endpointObj.typeId,
                name: endpointObj.object_name.length > 0 ? endpointObj.object_name : `endpoint_${endpointObj.id}`,
                path: "",
                currentValue: this._formatCurrentValue(endpointObj.present_value, endpointObj.objectId.type),
                unit: endpointObj.units,
                type: endpointObj.type,
            };
            return networkService.createNewBmsEndpoint(groupId, obj);
        });
    }
    static _itemExistInChild(parentId, relationName, childNetworkId) {
        return __awaiter(this, void 0, void 0, function* () {
            const children = yield spinal_env_viewer_graph_service_1.SpinalGraphService.getChildren(parentId, [relationName]);
            const found = children.find(el => el.idNetwork.get() == childNetworkId);
            return found;
        });
    }
    //////////////////////////////////////////////////////////////////////
    ////                             OTHER UTILITIES                  ////
    //////////////////////////////////////////////////////////////////////
    static _getPropertyValue(address, objectId, propertyId, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield this.readProperty(address, objectId, propertyId, argClient);
                console.log(data);
                const formated = this._formatProperty(data);
                return formated;
            }
            catch (error) {
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
        });
    }
    static _formatProperty(object) {
        if (object) {
            const { values, property } = object;
            const obj = {};
            for (const { id, value } of values) {
                const argId = id || (property === null || property === void 0 ? void 0 : property.id);
                const propertyName = this._getPropertyNameByCode(argId);
                if (propertyName) {
                    obj[propertyName] = this._getObjValue(value);
                }
            }
            if (typeof obj.units !== "undefined") {
                if (typeof obj.units === "object")
                    obj.units = "";
                else
                    obj.units = this._getUnitsByCode(obj.units);
            }
            return obj;
        }
        return {};
    }
    static _getObjValue(value) {
        var _a;
        if (typeof value !== "object")
            return value;
        let temp_value = Array.isArray(value) ? (_a = value[0]) === null || _a === void 0 ? void 0 : _a.value : value.value;
        return typeof temp_value === "object" ? "" : temp_value;
    }
    static _formatCurrentValue(value, type) {
        if ([GlobalVariables_1.ObjectTypes.OBJECT_BINARY_INPUT, GlobalVariables_1.ObjectTypes.OBJECT_BINARY_VALUE].indexOf(type) !== -1) {
            return value ? true : false;
        }
        return value;
    }
    static _getPropertyNameByCode(type) {
        const property = GlobalVariables_1.PropertyNames[type];
        if (property)
            return property.toLocaleLowerCase().replace('prop_', '');
        return;
    }
    static _getObjectTypeByCode(typeCode) {
        const property = GlobalVariables_1.ObjectTypesCode[typeCode];
        if (property)
            return property.toLocaleLowerCase().replace('object_', '');
        return;
    }
    static _getUnitsByCode(typeCode) {
        const property = GlobalVariables_1.UNITS_TYPES[typeCode];
        if (property)
            return property.toLocaleLowerCase().replace('units_', '').replace("_", " ");
        return;
    }
}
exports.default = BacnetUtilities;
exports.BacnetUtilities = BacnetUtilities;
//# sourceMappingURL=BacnetUtilities.js.map