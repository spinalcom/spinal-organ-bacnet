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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BacnetUtilities = void 0;
const bacnet = __importStar(require("bacstack"));
const GlobalVariables_1 = require("./GlobalVariables");
const SpinalCov_1 = require("../modules/SpinalCov");
const uuid_1 = require("uuid");
const node_ipc_1 = __importDefault(require("node-ipc"));
const spinal_bacnet_service_1 = require("spinal-bacnet-service");
class BacnetUtilitiesClass {
    constructor() {
        this._client = null;
        this._ipcClient = null;
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
    initAndConnect() {
        return __awaiter(this, void 0, void 0, function* () {
            this._ipcClient = yield this._connectToServer();
            this._ipcClient.on('disconnect', () => __awaiter(this, void 0, void 0, function* () {
                this._ipcClient = yield this._connectToServer();
            }));
            console.log("connected to bacnet service");
            this._ipcClient.on(spinal_bacnet_service_1.BACNET_COV_EVENT_NAME, (result) => {
                // console.log("cov result event received", result);
                SpinalCov_1.SpinalCov.getInstance().emit(result.eventName, result);
            });
        });
    }
    _connectToServer() {
        return new Promise((resolve, reject) => {
            var _a;
            const serverServiceName = spinal_bacnet_service_1.SERVICE_NAME;
            const clientServiceName = process.env.ORGAN_NAME || "spinal-organ-bacnet";
            node_ipc_1.default.config.id = clientServiceName; // Set the IPC client ID to the organ name or a default value
            node_ipc_1.default.config.retry = 5000; // Retry every 5 seconds if connection to server is lost 
            node_ipc_1.default.config.silent = true; // Disable IPC debug logs
            const bacnetServicePort = (_a = process.env.BACNET_SERVICE_PORT) === null || _a === void 0 ? void 0 : _a.trim();
            const ipcServerPort = bacnetServicePort ? parseInt(bacnetServicePort) : 47810;
            node_ipc_1.default.connectToNet(serverServiceName, "127.0.0.1", ipcServerPort, () => {
                this._ipcClient = node_ipc_1.default.of[serverServiceName];
                resolve(node_ipc_1.default.of[serverServiceName]);
            });
        });
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
    sendCovRequest(data) {
        if (this._ipcClient)
            this._ipcClient.emit(spinal_bacnet_service_1.COV_EVENT_NAME, data);
    }
    // public incrementState(state: "failed" | "success") {
    //    if (state === "failed") {
    //       this.clientState.consecutiveFailures++;
    //       // reset client if consecutive failures
    //       if (this.clientState.consecutiveFailures >= 5) {
    //          this._client = null; // reset client after 5 consecutive failures;
    //          SpinalCov.getInstance().restartAllCovSubscriptions();
    //          this.clientState.consecutiveFailures = 0;
    //       }
    //    } else {
    //       this.clientState.consecutiveFailures = 0;
    //    }
    // }
    // private _listenClientErrorEvent(client: bacnet): void {
    //    client.on('error', () => {
    //       console.log("error client");
    //       this._client = null;
    //    });
    // }
    ////////////////////////////////////////////////////////////////
    ////                  READ BACNET DATA                        //
    ////////////////////////////////////////////////////////////////
    // public readPropertyMultiple(address: string, sadr: any, requestArray: IRequestArray | IRequestArray[]): Promise<IReadPropertyMultiple> {
    //    return new Promise(async (resolve, reject) => {
    //       try {
    //          const client = await this.getClient();
    //          requestArray = Array.isArray(requestArray) ? requestArray : [requestArray];
    //          if (sadr && typeof sadr == "object") sadr = Object.keys(sadr).length === 0 ? null : sadr;
    //          client.readPropertyMultiple(address, sadr, requestArray, (err: Error, data: any) => {
    //             if (err) {
    //                // this.incrementState("failed");
    //                reject(err);
    //                return;
    //             }
    //             this.incrementState("success");
    //             resolve(data);
    //          })
    //       } catch (error) {
    //          reject(error);
    //       }
    //    });
    // }
    // public async readProperty(address: string, sadr: any, objectId: IObjectId, propertyId: number | string, clientOptions?: any): Promise<IReadProperty> {
    //    const client = await this.getClient();
    //    const options = clientOptions || {};
    //    if (sadr && typeof sadr == "object") sadr = Object.keys(sadr).length === 0 ? null : sadr;
    //    return new Promise((resolve, reject) => {
    //       client.readProperty(address, sadr, objectId, propertyId, options, (err: Error, data: any) => {
    //          if (err) {
    //             // this.incrementState("failed");
    //             return reject(err);
    //          }
    //          this.incrementState("success");
    //          resolve(data);
    //       })
    //    });
    // }
    ////////////////////////////////////////////////////////////////
    ////                  GET ALL BACNET OBJECT LIST              //
    ////////////////////////////////////////////////////////////////
    _getDeviceObjectList(device_1, SENSOR_TYPES_1) {
        return __awaiter(this, arguments, void 0, function* (device, SENSOR_TYPES, getListUsingFragment = false) {
            return this._sendDataToBacnetServer("_getDeviceObjectList", [device, SENSOR_TYPES, getListUsingFragment]);
            // const objectId = { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId };
            // let values;
            // const deviceAddress = device.address;
            // if (!deviceAddress) throw new Error("Device address is required");
            // try {
            //    if (getListUsingFragment) throw new Error("reason:4") // Force to use fragment method;
            //    const deviceAcceptSegmentation = [SEGMENTATIONS.SEGMENTATION_BOTH, SEGMENTATIONS.SEGMENTATION_TRANSMIT].indexOf(device.segmentation) != -1;
            //    if (deviceAcceptSegmentation) {
            //       const params = [{ objectId: objectId, properties: [{ id: PropertyIds.PROP_OBJECT_LIST }] }]
            //       let data = await this.readPropertyMultiple(deviceAddress, device.SADR, params);
            //       const dataFormatted = data.values.map(el => el.values.map(el2 => el2.value));
            //       values = lodash.flattenDeep(dataFormatted);
            //    } else {
            //       const params = [objectId, PropertyIds.PROP_OBJECT_LIST];
            //       let data = await this.readProperty(deviceAddress, device.SADR, params[0], params[1]);
            //       values = data.values;
            //    }
            // } catch (error: any) {
            //    if (error.message.match(/reason:4/i) || error.message.match(/err_timeout/i)) values = await this.getItemListByFragment(device, objectId);
            // }
            // if (typeof values === "undefined" || !values?.length) throw "No values found";
            // return values.filter((item: any) => SENSOR_TYPES.indexOf(item.value.type) !== -1);
        });
    }
    getItemListByFragment(device, objectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("getItemListByFragment", [device, objectId]);
            // const bacnetItemsFound: IObjectId[] = [];
            // let error: Error;
            // let index = 1;
            // let finish = false;
            // const deviceAddress = device.address;
            // if (!deviceAddress) throw new Error("Device address is required");
            // return new Promise(async (resolve) => {
            //    while (!error && !finish) {
            //       try {
            //          const clientOptions = { arrayIndex: index }
            //          const value = await this.readProperty(deviceAddress, device.SADR, objectId, PropertyIds.PROP_OBJECT_LIST, clientOptions);
            //          if (value) {
            //             index++;
            //             bacnetItemsFound.push(...(value.values as any[]));
            //          } else {
            //             finish = true;
            //          }
            //       } catch (err: any) {
            //          error = err;
            //       }
            //    }
            //    resolve(bacnetItemsFound);
            // });
        });
    }
    ////////////////////////////////////////////////////////////////
    ////                  GET OBJECT DETAIL                       //
    ////////////////////////////////////////////////////////////////
    _getObjectDetail(device, objects) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("_getObjectDetail", [device, objects]);
            // let objectLists = [...objects];
            // let objectListDetails: Array<{ [key: string]: string | boolean | number }> = [];
            // const deviceAcceptSegmentation = [SEGMENTATIONS.SEGMENTATION_BOTH, SEGMENTATIONS.SEGMENTATION_TRANSMIT].indexOf(device.segmentation) !== -1;
            // const callbackFunc = deviceAcceptSegmentation ? this._getObjectDetailWithReadPropertyMultiple : this._getObjectDetailWithReadProperty;
            // if (deviceAcceptSegmentation) {
            //    objectLists = lodash.chunk(objects, 10);
            // }
            // while (objectLists.length > 0) {
            //    const object: any = objectLists.shift();
            //    if (object) {
            //       try {
            //          const res = await callbackFunc.call(this, device, object);
            //          objectListDetails.push(res);
            //       } catch (err) {
            //          if (deviceAcceptSegmentation) {
            //             const itemsFound = await this._retryGetObjectDetailWithReadProperty(object, device);
            //             if (itemsFound.length > 0) objectListDetails.push(itemsFound);
            //          }
            //       }
            //    }
            // }
            // if (deviceAcceptSegmentation) objectListDetails = lodash.flattenDeep(objectListDetails);
            // return objectListDetails;
        });
    }
    // private async _retryGetObjectDetailWithReadProperty(items: any, device: IDevice): Promise<any> {
    //    const itemsFound = [];
    //    for (const item of items) {
    //       try {
    //          const res = await this._getObjectDetailWithReadProperty(device, item);
    //          if (res) itemsFound.push(res);
    //       } catch (error) {
    //       }
    //    }
    //    return itemsFound;
    // }
    _getObjectDetailWithReadPropertyMultiple(device, objects) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("_getObjectDetailWithReadPropertyMultiple", [device, objects]);
            // try {
            //    const deviceAddress = device.address;
            //    if (!deviceAddress) throw new Error("Device address is required");
            //    const requestArray: IRequestArray[] = objects.map(el => ({
            //       objectId: JSON.parse(JSON.stringify(el)),
            //       properties: [
            //          { id: PropertyIds.PROP_OBJECT_NAME },
            //          { id: PropertyIds.PROP_PRESENT_VALUE },
            //          { id: PropertyIds.PROP_DESCRIPTION },
            //          { id: PropertyIds.PROP_OBJECT_TYPE },
            //          { id: PropertyIds.PROP_UNITS },
            //          { id: PropertyIds.PROP_MAX_PRES_VALUE },
            //          { id: PropertyIds.PROP_MIN_PRES_VALUE },
            //       ]
            //    }))
            //    const data = await this.readPropertyMultiple(deviceAddress, device.SADR, requestArray);
            //    return data.values.map(el => {
            //       const { objectId } = el;
            //       const itemInfo: any = {
            //          objectId: objectId,
            //          id: objectId.instance,
            //          typeId: objectId.type,
            //          type: this._getObjectTypeByCode(objectId.type),
            //          instance: objectId.instance,
            //          deviceId: device.deviceId
            //       }
            //       const formated: any = this._formatProperty(el);
            //       for (let key in formated) {
            //          itemInfo[key] = formated[key];
            //       }
            //       return itemInfo;
            //    });
            // } catch (error) {
            //    throw error;
            // }
        });
    }
    _getObjectDetailWithReadProperty(device, objectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("_getObjectDetailWithReadProperty", [device, objectId]);
            // const properties = [
            //    PropertyIds.PROP_OBJECT_NAME, PropertyIds.PROP_PRESENT_VALUE, PropertyIds.PROP_DESCRIPTION,
            //    PropertyIds.PROP_OBJECT_TYPE, PropertyIds.PROP_UNITS,
            //    PropertyIds.PROP_MAX_PRES_VALUE, PropertyIds.PROP_MIN_PRES_VALUE
            // ]
            // const itemInfo: any = {
            //    objectId: objectId,
            //    id: objectId.instance,
            //    typeId: objectId.type,
            //    type: this._getObjectTypeByCode(objectId.type),
            //    instance: objectId.instance,
            //    deviceId: device.deviceId
            // };
            // const deviceAddress = device.address;
            // if (!deviceAddress) throw new Error("Device address is required");
            // while (properties.length > 0) {
            //    try {
            //       const property = properties.shift();
            //       if (typeof property !== "undefined") {
            //          // console.log("property not undefined");
            //          const formated = await this._getPropertyValue(deviceAddress, device.SADR, objectId, property);
            //          for (let key in formated) {
            //             itemInfo[key] = formated[key];
            //          }
            //       } else {
            //          // console.log("property is undefined");
            //       }
            //    } catch (error) {
            //       // console.error(error);
            //    }
            // }
            // return itemInfo;
        });
    }
    _getChildrenNewValue(device, children) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("_getChildrenNewValue", [device, children]);
            // const deviceAcceptSegmentation = [SEGMENTATIONS.SEGMENTATION_BOTH, SEGMENTATIONS.SEGMENTATION_TRANSMIT].indexOf(device.segmentation) !== -1;
            // if (deviceAcceptSegmentation) return this.getChildrenNewValueWithReadPropertyMultiple(device, children);
            // return this.getChildrenNewValueWithReadProperty(device, children);
        });
    }
    // private async getChildrenNewValueWithReadPropertyMultiple(device: IDevice, children: Array<IObjectId>): Promise<Array<{ id: string | number; type: string | number; currentValue: any }> | undefined> {
    //    try {
    //       const requestArray = children.map(el => ({ objectId: el, properties: [{ id: PropertyIds.PROP_PRESENT_VALUE }] }));
    //       const list_chunked = lodash.chunk(requestArray, 50);
    //       const deviceAddress = device.address;
    //       if (!deviceAddress) throw new Error("Device address is required");
    //       const res = [];
    //       while (list_chunked.length > 0) {
    //          const arr = list_chunked.pop();
    //          const data = await this.readPropertyMultiple(deviceAddress, device.SADR, arr);
    //          const dataFormated = data.values.map(el => {
    //             const value = this._getObjValue(el.values[0].value);
    //             return {
    //                id: el.objectId.instance,
    //                type: el.objectId.type,
    //                currentValue: this._formatCurrentValue(value, el.objectId.type)
    //             }
    //          })
    //          res.push(dataFormated);
    //       }
    //       return lodash.flattenDeep(res);
    //    } catch (error) { }
    // }
    // private async getChildrenNewValueWithReadProperty(device: IDevice, children: Array<IObjectId>): Promise<Array<{ id: string | number; type: string | number; currentValue: any }> | undefined> {
    //    const res = [];
    //    try {
    //       const deep_children = [...children];
    //       while (deep_children.length > 0) {
    //          const child: any = deep_children.shift();
    //          const deviceAddress = device.address;
    //          if (!deviceAddress) throw new Error("Device address is required");
    //          if (child) {
    //             try {
    //                child.id = child.instance;
    //                const data = await this.readProperty(deviceAddress, device.SADR, child, PropertyIds.PROP_PRESENT_VALUE);
    //                const value = data.values[0]?.value;
    //                child.currentValue = this._getObjValue(value);
    //                res.push(child);
    //             } catch (error) { }
    //          }
    //       }
    //       return res;
    //    } catch (error) {
    //       throw error;
    //    }
    // }
    ////////////////////////////////////////////////////////////////
    ////                       Endpoints                          //
    ////////////////////////////////////////////////////////////////
    // public async createEndpointsInGroup(networkService: NetworkService, deviceId: string, groupName: string, endpointArray: any, deviceName?: string): Promise<SpinalNodeRef[]> {
    //    const endpointGroup = await this._createEndpointsGroup(networkService, deviceId, groupName);
    //    const groupId = endpointGroup.id.get();
    //    return this._createEndpointByArray(networkService, groupId, endpointArray, deviceName);
    // }
    // public async _createEndpointsGroup(networkService: NetworkService, deviceId: string, groupName: string): Promise<SpinalNodeRef> {
    //    const networkId = ObjectTypes[`object_${groupName}`.toUpperCase()]
    //    const alreadyExist = await this._itemExistInChild(deviceId, SpinalBmsEndpointGroup.relationName, networkId);
    //    if (alreadyExist) return alreadyExist;
    //    const obj: any = {
    //       name: groupName,
    //       id: networkId,
    //       type: groupName,
    //       path: ""
    //    }
    //    const endpointGroup = await networkService.createNewBmsEndpointGroup(deviceId, obj);
    //    return endpointGroup;
    // }
    // public async _createEndpointByArray(networkService: NetworkService, groupId: string, endpointArray: any, deviceName?: string): Promise<SpinalNodeRef[]> {
    //    const childNetwork = await this.getChildrenObj(groupId, SpinalBmsEndpoint.relationName);
    //    const nodeCreated = []
    //    let counter = 0;
    //    while (counter < endpointArray.length) {
    //       const endpointInfo = endpointArray[counter];
    //       const existingEndpoint = childNetwork[endpointInfo.id];
    //       endpointInfo.type = SpinalBmsEndpoint.nodeTypeName;
    //       if (existingEndpoint) {
    //          console.log("already exists  ", endpointInfo);
    //          await this._updateEndpointInfo(endpointInfo, existingEndpoint);
    //          counter++;
    //          continue;
    //       }
    //       const ref = await this._createEndpoint(networkService, groupId, endpointInfo);
    //       if (ref) nodeCreated.push(ref);
    //       counter++;
    //    }
    //    return nodeCreated;
    // }
    // private async _updateEndpointInfo(endpointNewInfo: any, endpoint: SpinalNodeRef): Promise<void> {
    //    const realNode = SpinalGraphService.getRealNode(endpoint.id.get());
    //    if (!realNode) return;
    //    const endpointElement: SpinalBmsEndpoint = await realNode.getElement(true);
    //    endpointNewInfo.currentValue = this._formatCurrentValue(endpointNewInfo.present_value, endpointNewInfo.objectId.type);
    //    for (let key in endpointNewInfo) {
    //       if (['id', 'idNetwork'].includes(key)) continue; // list of non updatable keys if exist in the future
    //       console.log("key is ", key);
    //       const value = endpointNewInfo[key];
    //       if (key == "object_name")
    //          key = "name";
    //       if (key == "present_value")
    //          key = "currentValue";
    //       if (key == "object_type")
    //          key = "type";
    //       if (endpointElement[key]) endpointElement[key].set(value);
    //       if (realNode.info[key]) realNode.info[key].set(value);
    //    }
    // }
    // public async _createEndpoint(networkService: NetworkService, groupId: string, endpointObj: any): Promise<void | SpinalNodeRef> {
    //    const obj: any = {
    //       id: endpointObj.id,
    //       typeId: endpointObj.typeId,
    //       name: endpointObj.object_name,
    //       path: "",
    //       currentValue: this._formatCurrentValue(endpointObj.present_value, endpointObj.objectId.type),
    //       unit: endpointObj.units,
    //       type: endpointObj.type,
    //       description: endpointObj.description || "",
    //    }
    //    if (obj.name && typeof obj.name === "string" && obj.name.trim()) {
    //       return networkService.createNewBmsEndpoint(groupId, obj);
    //    }
    // }
    // public async _itemExistInChild(parentId: string, relationName: string, childNetworkId: string | number): Promise<SpinalNodeRef | undefined> {
    //    const children = await SpinalGraphService.getChildren(parentId, [relationName]);
    //    const found = children.find(el => el.idNetwork.get() == childNetworkId);
    //    return found;
    // }
    //////////////////////////////////////////////////////////////////////
    ////                             OTHER UTILITIES                  ////
    //////////////////////////////////////////////////////////////////////
    _getPropertyValue(address, sadr, objectId, propertyId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("_getPropertyValue", [address, sadr, objectId, propertyId]);
            // try {
            //    const data = await this.readProperty(address, sadr, objectId, propertyId);
            //    const formated: any = this._formatProperty(data);
            //    return formated;
            // } catch (error) {
            //    throw error;
            // }
        });
    }
    getDeviceId(address, sadr) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("getDeviceId", [address, sadr]);
            // const objectId = { type: ObjectTypes.OBJECT_DEVICE, instance: PropertyIds.MAX_BACNET_PROPERTY_ID };
            // const data = await this.readProperty(address, sadr, objectId, PropertyIds.PROP_OBJECT_IDENTIFIER);
            // return data.values[0].value.instance;
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
    // private async getChildrenObj(parentId: string, relationName: string): Promise<{ [key: string]: SpinalNodeRef }> {
    //    const children = await SpinalGraphService.getChildren(parentId, [relationName]);
    //    const childObj: { [key: string]: SpinalNodeRef } = {};
    //    for (const child of children) {
    //       const networkId = child.idNetwork.get();
    //       childObj[networkId] = child;
    //    }
    //    return childObj;
    // }
    _sendDataToBacnetServer(functionName, parameters) {
        return new Promise((resolve, reject) => {
            const params = {
                name: functionName,
                id: (0, uuid_1.v4)(),
                parameters: parameters
            };
            this._ipcClient.emit(spinal_bacnet_service_1.MESSAGE_EVENT_NAME, params);
            this._ipcClient.once(`${spinal_bacnet_service_1.RESPONSE_EVENT_NAME}_${params.id}`, (response) => {
                if (response.status === "error") {
                    return reject({ message: response.error });
                }
                resolve(response.data);
            });
        });
    }
}
const BacnetUtilities = BacnetUtilitiesClass.getInstance();
exports.BacnetUtilities = BacnetUtilities;
exports.default = BacnetUtilities;
//# sourceMappingURL=BacnetUtilities.js.map