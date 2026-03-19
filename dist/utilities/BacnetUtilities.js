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
const SpinalCov_1 = require("../modules/SpinalCov");
class BacnetUtilitiesClass {
    constructor() {
        this._client = null;
        this.clientState = {
            // failed: { count: 0, time: null },
            // success: { count: 0, time: null },
            consecutiveFailures: 0
        };
    }
    static getInstance() {
        if (!this.instance)
            this.instance = new BacnetUtilitiesClass();
        return this.instance;
    }
    createNewBacnetClient() {
        const client = new bacnet({ adpuTimeout: 10000 });
        return client;
    }
    getClient() {
        return new Promise((resolve) => {
            if (!this._client)
                this._client = this.createNewBacnetClient();
            return resolve(this._client);
        });
    }
    incrementState(state) {
        if (state === "failed") {
            this.clientState.consecutiveFailures++;
            // reset client if consecutive failures
            if (this.clientState.consecutiveFailures >= 5) {
                this._client = null; // reset client after 5 consecutive failures;
                SpinalCov_1.SpinalCov.getInstance().restartAllCovSubscriptions();
                this.clientState.consecutiveFailures = 0;
            }
        }
        else {
            this.clientState.consecutiveFailures = 0;
        }
    }
    _listenClientErrorEvent(client) {
        client.on('error', () => {
            console.log("error client");
            this._client = null;
        });
    }
    ////////////////////////////////////////////////////////////////
    ////                  READ BACNET DATA                        //
    ////////////////////////////////////////////////////////////////
    readPropertyMultiple(address, sadr, requestArray, argClient) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                // const client = argClient || await this.getClient();
                const client = yield this.getClient();
                requestArray = Array.isArray(requestArray) ? requestArray : [requestArray];
                if (sadr && typeof sadr == "object")
                    sadr = Object.keys(sadr).length === 0 ? null : sadr;
                client.readPropertyMultiple(address, sadr, requestArray, (err, data) => {
                    if (err) {
                        this.incrementState("failed");
                        reject(err);
                        return;
                    }
                    this.incrementState("success");
                    resolve(data);
                });
            }
            catch (error) {
                reject(error);
            }
        }));
    }
    readProperty(address, sadr, objectId, propertyId, argClient, clientOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            // sadr = { dest: { net: '35383', adr: [''] } };
            // const client = argClient || await this.getClient();
            const client = yield this.getClient();
            const options = clientOptions || {};
            if (sadr && typeof sadr == "object")
                sadr = Object.keys(sadr).length === 0 ? null : sadr;
            return new Promise((resolve, reject) => {
                client.readProperty(address, sadr, objectId, propertyId, options, (err, data) => {
                    if (err) {
                        this.incrementState("failed");
                        return reject(err);
                    }
                    this.incrementState("success");
                    resolve(data);
                });
            });
        });
    }
    ////////////////////////////////////////////////////////////////
    ////                  GET ALL BACNET OBJECT LIST              //
    ////////////////////////////////////////////////////////////////
    _getDeviceObjectList(device_1, SENSOR_TYPES_1, argClient_1) {
        return __awaiter(this, arguments, void 0, function* (device, SENSOR_TYPES, argClient, getListUsingFragment = false) {
            const objectId = { type: GlobalVariables_1.ObjectTypes.OBJECT_DEVICE, instance: device.deviceId };
            let values;
            const deviceAddress = device.address;
            if (!deviceAddress)
                throw new Error("Device address is required");
            try {
                if (getListUsingFragment)
                    throw new Error("reason:4"); // Force to use fragment method;
                const deviceAcceptSegmentation = [GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_BOTH, GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_TRANSMIT].indexOf(device.segmentation) != -1;
                if (deviceAcceptSegmentation) {
                    const params = [{ objectId: objectId, properties: [{ id: GlobalVariables_1.PropertyIds.PROP_OBJECT_LIST }] }];
                    let data = yield this.readPropertyMultiple(deviceAddress, device.SADR, params, argClient);
                    const dataFormatted = data.values.map(el => el.values.map(el2 => el2.value));
                    values = lodash.flattenDeep(dataFormatted);
                }
                else {
                    const params = [objectId, GlobalVariables_1.PropertyIds.PROP_OBJECT_LIST];
                    let data = yield this.readProperty(deviceAddress, device.SADR, params[0], params[1], argClient);
                    values = data.values;
                }
            }
            catch (error) {
                if (error.message.match(/reason:4/i) || error.message.match(/err_timeout/i))
                    values = yield this.getItemListByFragment(device, objectId, argClient);
            }
            if (typeof values === "undefined" || !(values === null || values === void 0 ? void 0 : values.length))
                throw "No values found";
            return values.filter((item) => SENSOR_TYPES.indexOf(item.value.type) !== -1);
        });
    }
    getItemListByFragment(device, objectId, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const bacnetItemsFound = [];
            let error;
            let index = 1;
            let finish = false;
            const deviceAddress = device.address;
            if (!deviceAddress)
                throw new Error("Device address is required");
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                while (!error && !finish) {
                    try {
                        const clientOptions = { arrayIndex: index };
                        const value = yield this.readProperty(deviceAddress, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_OBJECT_LIST, argClient, clientOptions);
                        if (value) {
                            index++;
                            bacnetItemsFound.push(...value.values);
                        }
                        else {
                            finish = true;
                        }
                    }
                    catch (err) {
                        error = err;
                    }
                }
                resolve(bacnetItemsFound);
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
            const callbackFunc = deviceAcceptSegmentation ? this._getObjectDetailWithReadPropertyMultiple : this._getObjectDetailWithReadProperty;
            if (deviceAcceptSegmentation) {
                objectLists = lodash.chunk(objects, 10);
            }
            while (objectLists.length > 0) {
                const object = objectLists.shift();
                if (object) {
                    try {
                        const res = yield callbackFunc.call(this, device, object, argClient);
                        objectListDetails.push(res);
                    }
                    catch (err) {
                        if (deviceAcceptSegmentation) {
                            const itemsFound = yield this._retryGetObjectDetailWithReadProperty(object, device, argClient);
                            if (itemsFound.length > 0)
                                objectListDetails.push(itemsFound);
                        }
                    }
                }
            }
            if (deviceAcceptSegmentation)
                objectListDetails = lodash.flattenDeep(objectListDetails);
            return objectListDetails;
        });
    }
    _retryGetObjectDetailWithReadProperty(items, device, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const itemsFound = [];
            for (const item of items) {
                try {
                    const res = yield this._getObjectDetailWithReadProperty(device, item, argClient);
                    if (res)
                        itemsFound.push(res);
                }
                catch (error) {
                }
            }
            return itemsFound;
        });
    }
    _getObjectDetailWithReadPropertyMultiple(device, objects, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const deviceAddress = device.address;
                if (!deviceAddress)
                    throw new Error("Device address is required");
                const requestArray = objects.map(el => ({
                    objectId: JSON.parse(JSON.stringify(el)),
                    properties: [
                        { id: GlobalVariables_1.PropertyIds.PROP_OBJECT_NAME },
                        { id: GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE },
                        { id: GlobalVariables_1.PropertyIds.PROP_DESCRIPTION },
                        { id: GlobalVariables_1.PropertyIds.PROP_OBJECT_TYPE },
                        { id: GlobalVariables_1.PropertyIds.PROP_UNITS },
                        { id: GlobalVariables_1.PropertyIds.PROP_MAX_PRES_VALUE },
                        { id: GlobalVariables_1.PropertyIds.PROP_MIN_PRES_VALUE },
                    ]
                }));
                const data = yield this.readPropertyMultiple(deviceAddress, device.SADR, requestArray, argClient);
                return data.values.map(el => {
                    const { objectId } = el;
                    const itemInfo = {
                        objectId: objectId,
                        id: objectId.instance,
                        typeId: objectId.type,
                        type: this._getObjectTypeByCode(objectId.type),
                        instance: objectId.instance,
                        deviceId: device.deviceId
                    };
                    const formated = this._formatProperty(el);
                    for (let key in formated) {
                        itemInfo[key] = formated[key];
                    }
                    return itemInfo;
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
            const itemInfo = {
                objectId: objectId,
                id: objectId.instance,
                typeId: objectId.type,
                type: this._getObjectTypeByCode(objectId.type),
                instance: objectId.instance,
                deviceId: device.deviceId
            };
            const deviceAddress = device.address;
            if (!deviceAddress)
                throw new Error("Device address is required");
            while (properties.length > 0) {
                try {
                    const property = properties.shift();
                    if (typeof property !== "undefined") {
                        // console.log("property not undefined");
                        const formated = yield this._getPropertyValue(deviceAddress, device.SADR, objectId, property, argClient);
                        for (let key in formated) {
                            itemInfo[key] = formated[key];
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
            return itemInfo;
        });
    }
    _getChildrenNewValue(device, children, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = argClient || (yield this.getClient());
            const deviceAcceptSegmentation = [GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_BOTH, GlobalVariables_2.SEGMENTATIONS.SEGMENTATION_TRANSMIT].indexOf(device.segmentation) !== -1;
            if (deviceAcceptSegmentation)
                return this.getChildrenNewValueWithReadPropertyMultiple(device, children, client);
            return this.getChildrenNewValueWithReadProperty(device, children, client);
        });
    }
    getChildrenNewValueWithReadPropertyMultiple(device, children, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = argClient || (yield this.getClient());
                const requestArray = children.map(el => ({ objectId: el, properties: [{ id: GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE }] }));
                const list_chunked = lodash.chunk(requestArray, 50);
                const deviceAddress = device.address;
                if (!deviceAddress)
                    throw new Error("Device address is required");
                const res = [];
                while (list_chunked.length > 0) {
                    const arr = list_chunked.pop();
                    const data = yield this.readPropertyMultiple(deviceAddress, device.SADR, arr, client);
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
            catch (error) { }
        });
    }
    getChildrenNewValueWithReadProperty(device, children, argClient) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const client = argClient || (yield this.getClient());
            const res = [];
            try {
                const deep_children = [...children];
                while (deep_children.length > 0) {
                    const child = deep_children.shift();
                    const deviceAddress = device.address;
                    if (!deviceAddress)
                        throw new Error("Device address is required");
                    if (child) {
                        try {
                            child.id = child.instance;
                            const data = yield this.readProperty(deviceAddress, device.SADR, child, GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE, client);
                            const value = (_a = data.values[0]) === null || _a === void 0 ? void 0 : _a.value;
                            child.currentValue = this._getObjValue(value);
                            res.push(child);
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
            const alreadyExist = yield this._itemExistInChild(deviceId, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.relationName, networkId);
            if (alreadyExist)
                return alreadyExist;
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
                const endpointInfo = endpointArray[counter];
                const existingEndpoint = childNetwork[endpointInfo.id];
                if (existingEndpoint) {
                    // console.log(item.id, "already exists", deviceName ? `in "${deviceName}"` : "");
                    yield this._updateEndpointInfo(endpointInfo, existingEndpoint);
                    counter++;
                    continue;
                }
                const ref = yield this._createEndpoint(networkService, groupId, endpointInfo);
                if (ref)
                    nodeCreated.push(ref);
                counter++;
            }
            return nodeCreated;
        });
    }
    _updateEndpointInfo(endpointNewInfo, endpoint) {
        return __awaiter(this, void 0, void 0, function* () {
            const realNode = spinal_env_viewer_graph_service_1.SpinalGraphService.getRealNode(endpoint.id.get());
            if (!realNode)
                return;
            const endpointElement = yield realNode.getElement(true);
            endpointNewInfo.currentValue = this._formatCurrentValue(endpointNewInfo.present_value, endpointNewInfo.objectId.type);
            for (let key in endpointNewInfo) {
                const value = endpointNewInfo[key];
                if (endpointElement[key])
                    endpointElement[key].set(value);
                if (realNode.info[key])
                    realNode.info[key].set(value);
            }
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
                description: endpointObj.description || "",
            };
            if (obj.name && typeof obj.name === "string" && obj.name.trim()) {
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
    _formatProperty(propertyValue) {
        if (propertyValue) {
            const { values, property } = propertyValue;
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
            const childObj = {};
            for (const child of children) {
                const networkId = child.idNetwork.get();
                childObj[networkId] = child;
            }
            return childObj;
        });
    }
}
const BacnetUtilities = BacnetUtilitiesClass.getInstance();
exports.BacnetUtilities = BacnetUtilities;
exports.default = BacnetUtilities;
//# sourceMappingURL=BacnetUtilities.js.map