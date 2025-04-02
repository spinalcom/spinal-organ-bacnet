"use strict";
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
const GlobalVariables_2 = require("./GlobalVariables");
class BacnetUtilitiesClass {
    constructor() { }
    static getInstance() {
        if (!this.instance)
            this.instance = new BacnetUtilitiesClass();
        return this.instance;
    }
    createNewBacnetClient() {
        const client = new bacnet({ adpuTimeout: 6000 });
        return client;
    }
    ////////////////////////////////////////////////////////////////
    ////                  READ BACNET DATA                        //
    ////////////////////////////////////////////////////////////////
    readPropertyMultiple(address, sadr, requestArray, argClient) {
        return new Promise((resolve, reject) => {
            try {
                const client = argClient || this.createNewBacnetClient();
                requestArray = Array.isArray(requestArray) ? requestArray : [requestArray];
                if (sadr && typeof sadr == "object")
                    sadr = Object.keys(sadr).length === 0 ? null : sadr;
                client.readPropertyMultiple(address, sadr, requestArray, (err, data) => {
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
    readProperty(address, sadr, objectId, propertyId, argClient, clientOptions) {
        const client = argClient || this.createNewBacnetClient();
        const options = clientOptions || {};
        if (sadr && typeof sadr == "object")
            sadr = Object.keys(sadr).length === 0 ? null : sadr;
        return new Promise((resolve, reject) => {
            client.readProperty(address, sadr, objectId, propertyId, options, (err, data) => {
                if (err)
                    return reject(err);
                resolve(data);
            });
        });
    }
    ////////////////////////////////////////////////////////////////
    ////                  GET ALL BACNET OBJECT LIST              //
    ////////////////////////////////////////////////////////////////
    _getDeviceObjectList(device, SENSOR_TYPES, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("getting object list");
            const objectId = { type: GlobalVariables_1.ObjectTypes.OBJECT_DEVICE, instance: device.deviceId };
            let values;
            try {
                const deviceAcceptSegmentation = [GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_BOTH, GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_TRANSMIT].indexOf(device.segmentation) != -1;
                let params = deviceAcceptSegmentation ? [{ objectId: objectId, properties: [{ id: GlobalVariables_1.PropertyIds.PROP_OBJECT_LIST }] }] : [objectId, GlobalVariables_1.PropertyIds.PROP_OBJECT_LIST];
                let func = deviceAcceptSegmentation ? this.readPropertyMultiple : this.readProperty;
                const data = yield func.call(this, device.address, device.SADR, ...params, argClient);
                values = deviceAcceptSegmentation ? lodash.flattenDeep(data.values.map(el => el.values.map(el2 => el2.value))) : data.values;
            }
            catch (error) {
                console.error(error);
                if (error.message.match(/reason:4/i) || error.message.match(/err_timeout/i))
                    values = yield this.getItemListByFragment(device, objectId, argClient);
            }
            if (typeof values === "undefined")
                throw "No values found";
            return values.filter(item => SENSOR_TYPES.indexOf(item.value.type) !== -1);
        });
    }
    getItemListByFragment(device, objectId, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const list = [];
            let error;
            let index = 1;
            let finish = false;
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                while (!error && !finish) {
                    try {
                        const clientOptions = { arrayIndex: index };
                        const value = yield this.readProperty(device.address, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_OBJECT_LIST, argClient, clientOptions);
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
                    }
                }
                resolve(list);
            }));
        });
    }
    ////////////////////////////////////////////////////////////////
    ////                  GET OBJECT DETAIL                       //
    ////////////////////////////////////////////////////////////////
    _getObjectDetail(device, objects, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            let objectLists = [...objects];
            let objectListDetails = [];
            const deviceAcceptSegmentation = [GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_BOTH, GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_TRANSMIT].indexOf(device.segmentation) !== -1;
            const func = deviceAcceptSegmentation ? this._getObjectDetailWithReadPropertyMultiple : this._getObjectDetailWithReadProperty;
            if (deviceAcceptSegmentation) {
                objectLists = lodash.chunk(objects, 10);
            }
            while (objectLists.length > 0) {
                const object = objectLists.shift();
                if (object) {
                    try {
                        const res = yield func.call(this, device, object, argClient);
                        objectListDetails.push(res);
                    }
                    catch (err) {
                    }
                }
            }
            if (deviceAcceptSegmentation)
                objectListDetails = lodash.flattenDeep(objectListDetails);
            return objectListDetails;
        });
    }
    _getObjectDetailWithReadPropertyMultiple(device, objects, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestArray = objects.map(el => ({
                    objectId: JSON.parse(JSON.stringify(el)),
                    properties: [
                        { id: GlobalVariables_1.PropertyIds.PROP_OBJECT_NAME },
                        { id: GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE },
                        { id: GlobalVariables_1.PropertyIds.PROP_DESCRIPTION },
                        { id: GlobalVariables_1.PropertyIds.PROP_OBJECT_TYPE },
                        { id: GlobalVariables_1.PropertyIds.PROP_UNITS },
                        { id: GlobalVariables_1.PropertyIds.PROP_MAX_PRES_VALUE },
                        { id: GlobalVariables_1.PropertyIds.PROP_MIN_PRES_VALUE }
                    ]
                }));
                const data = yield this.readPropertyMultiple(device.address, device.SADR, requestArray, argClient);
                return data.values.map(el => {
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
            }
            catch (error) {
                throw error;
            }
        });
    }
    _getObjectDetailWithReadProperty(device, objectId, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const properties = [
                GlobalVariables_1.PropertyIds.PROP_OBJECT_NAME, GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE, GlobalVariables_1.PropertyIds.PROP_DESCRIPTION,
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
                        // console.log("property not undefined");
                        const formated = yield this._getPropertyValue(device.address, device.SADR, objectId, property, argClient);
                        for (let key in formated) {
                            obj[key] = formated[key];
                        }
                    }
                    else {
                        // console.log("property is undefined");
                    }
                }
                catch (error) {
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
        });
    }
    _getChildrenNewValue(device, children, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = argClient || this.createNewBacnetClient();
            const deviceAcceptSegmentation = [GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_BOTH, GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_TRANSMIT].indexOf(device.segmentation) !== -1;
            const func = deviceAcceptSegmentation ? this.getChildrenNewValueWithReadPropertyMultiple : this.getChildrenNewValueWithReadProperty;
            return func.call(this, device, children, client);
            // if (device.segmentation == SEGMENTATIONS.SEGMENTATION_BOTH || device.segmentation == SEGMENTATIONS.SEGMENTATION_TRANSMIT) {
            //    return this.getChildrenNewValueWithReadPropertyMultiple(device, children, client);
            // } else {
            //    return this.getChildrenNewValueWithReadProperty(device, children, client);
            // }
        });
    }
    getChildrenNewValueWithReadPropertyMultiple(device, children, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = argClient || this.createNewBacnetClient();
                const requestArray = children.map(el => ({ objectId: el, properties: [{ id: GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE }] }));
                const list_chunked = lodash.chunk(requestArray, 50);
                const res = [];
                while (list_chunked.length > 0) {
                    const arr = list_chunked.pop();
                    const data = yield this.readPropertyMultiple(device.address, device.SADR, arr, client);
                    const dataFormated = data.values.map(el => {
                        const value = this._getObjValue(el.values[0].value);
                        return {
                            id: el.objectId.instance,
                            type: el.objectId.type,
                            currentValue: this._formatCurrentValue(value, el.objectId.type)
                        };
                    });
                    res.push(dataFormated);
                }
                return lodash.flattenDeep(res);
            }
            catch (error) {
            }
        });
    }
    getChildrenNewValueWithReadProperty(device, children, argClient) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const client = argClient || this.createNewBacnetClient();
            const res = [];
            try {
                const deep_children = [...children];
                while (deep_children.length > 0) {
                    const obj = deep_children.shift();
                    if (obj) {
                        try {
                            obj["id"] = obj.instance;
                            const data = yield this.readProperty(device.address, device.SADR, obj, GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE, client);
                            const value = (_a = data.values[0]) === null || _a === void 0 ? void 0 : _a.value;
                            obj["currentValue"] = this._getObjValue(value);
                            res.push(obj);
                        }
                        catch (error) { }
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
    createEndpointsInGroup(networkService, deviceId, groupName, endpointArray, deviceName) {
        return __awaiter(this, void 0, void 0, function* () {
            const endpointGroup = yield this._createEndpointsGroup(networkService, deviceId, groupName);
            const groupId = endpointGroup.id.get();
            return this._createEndpointByArray(networkService, groupId, endpointArray, deviceName);
        });
    }
    _createEndpointsGroup(networkService, deviceId, groupName) {
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
    _createEndpointByArray(networkService, groupId, endpointArray, deviceName) {
        return __awaiter(this, void 0, void 0, function* () {
            const childNetwork = yield this.getChildrenObj(groupId, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName);
            const nodeCreated = [];
            let counter = 0;
            while (counter < endpointArray.length) {
                const item = endpointArray[counter];
                if (childNetwork[item.id]) {
                    // console.log(item.id, "already exists", deviceName ? `in "${deviceName}"` : "");
                    counter++;
                    continue;
                }
                const ref = yield this._createEndpoint(networkService, groupId, item);
                if (ref)
                    nodeCreated.push(ref);
                counter++;
            }
            return nodeCreated;
        });
    }
    _createEndpoint(networkService, groupId, endpointObj) {
        return __awaiter(this, void 0, void 0, function* () {
            const obj = {
                id: endpointObj.id,
                typeId: endpointObj.typeId,
                name: endpointObj.object_name,
                path: "",
                currentValue: this._formatCurrentValue(endpointObj.present_value, endpointObj.objectId.type),
                unit: endpointObj.units,
                type: endpointObj.type,
            };
            if (obj.name && typeof obj.name === "string" && obj.name.trim()) {
                // console.log("creating", endpointObj.id);
                return networkService.createNewBmsEndpoint(groupId, obj);
            }
        });
    }
    _itemExistInChild(parentId, relationName, childNetworkId) {
        return __awaiter(this, void 0, void 0, function* () {
            const children = yield spinal_env_viewer_graph_service_1.SpinalGraphService.getChildren(parentId, [relationName]);
            const found = children.find(el => el.idNetwork.get() == childNetworkId);
            return found;
        });
    }
    //////////////////////////////////////////////////////////////////////
    ////                             OTHER UTILITIES                  ////
    //////////////////////////////////////////////////////////////////////
    _getPropertyValue(address, sadr, objectId, propertyId, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield this.readProperty(address, sadr, objectId, propertyId, argClient);
                const formated = this._formatProperty(data);
                return formated;
            }
            catch (error) {
                throw error;
            }
        });
    }
    getDeviceId(address, sadr, client) {
        return __awaiter(this, void 0, void 0, function* () {
            const objectId = { type: GlobalVariables_1.ObjectTypes.OBJECT_DEVICE, instance: GlobalVariables_1.PropertyIds.MAX_BACNET_PROPERTY_ID };
            const data = yield this.readProperty(address, sadr, objectId, GlobalVariables_1.PropertyIds.PROP_OBJECT_IDENTIFIER, client);
            return data.values[0].value.instance;
        });
    }
    _formatProperty(object) {
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
    _getObjValue(value) {
        var _a;
        if (typeof value !== "object")
            return value;
        let temp_value = Array.isArray(value) ? (_a = value[0]) === null || _a === void 0 ? void 0 : _a.value : value.value;
        return typeof temp_value === "object" ? "" : temp_value;
    }
    _formatCurrentValue(value, type) {
        if ([GlobalVariables_1.ObjectTypes.OBJECT_BINARY_INPUT, GlobalVariables_1.ObjectTypes.OBJECT_BINARY_VALUE].indexOf(type) !== -1) {
            return value ? true : false;
        }
        return value;
    }
    _getPropertyNameByCode(type) {
        const property = GlobalVariables_1.PropertyNames[type];
        if (property)
            return property.toLocaleLowerCase().replace('prop_', '');
        return;
    }
    _getObjectTypeByCode(typeCode) {
        const property = GlobalVariables_1.ObjectTypesCode[typeCode];
        if (property)
            return property.toLocaleLowerCase().replace('object_', '');
        return;
    }
    _getUnitsByCode(typeCode) {
        const property = GlobalVariables_1.UNITS_TYPES[typeCode];
        if (property)
            return property.toLocaleLowerCase().replace('units_', '').replace("_", " ");
        return;
    }
    getChildrenObj(parentId, relationName) {
        return __awaiter(this, void 0, void 0, function* () {
            const children = yield spinal_env_viewer_graph_service_1.SpinalGraphService.getChildren(parentId, [relationName]);
            const obj = {};
            children.forEach(el => obj[el.idNetwork.get()] = el);
            return obj;
        });
    }
}
const BacnetUtilities = BacnetUtilitiesClass.getInstance();
exports.BacnetUtilities = BacnetUtilities;
exports.default = BacnetUtilities;
//# sourceMappingURL=BacnetUtilities.js.map