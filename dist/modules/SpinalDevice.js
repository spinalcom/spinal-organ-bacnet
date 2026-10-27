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
exports.SpinalDevice = void 0;
exports.addToGetAllBacnetValuesQueue = addToGetAllBacnetValuesQueue;
const lodash = __importStar(require("lodash"));
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const events_1 = require("events");
const spinal_model_graph_1 = require("spinal-model-graph");
// import { store } from "../store";
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const spinal_connector_service_1 = require("spinal-connector-service");
const Functions_1 = require("../utilities/Functions");
const profileManager_1 = __importDefault(require("../utilities/profileManager"));
const SpinalNetworkUtilities_1 = require("../utilities/SpinalNetworkUtilities");
const DeviceCommunicationIndicators_1 = require("../indicators/DeviceCommunicationIndicators");
const indicatorConfiguration_1 = require("../indicators/indicatorConfiguration");
class SpinalDevice extends events_1.EventEmitter {
    // private client: bacnet;
    constructor(device) {
        super();
        this.indicators = new DeviceCommunicationIndicators_1.DeviceCommunicationIndicators();
        this.covData = [];
        // private _networkService: NetworkService;
        this._profileData = {};
        this._communicationMetricsLogTimer = null;
        this._communicationControlEndpointSync = Promise.resolve();
        this._communicationControlEndpointSyncTimer = null;
        this.device = device;
        this._listenProfileEvent();
    }
    _listenProfileEvent() {
        const instance = profileManager_1.default.getInstance();
        instance.on("changed", ({ profileId, data }) => {
            var _a, _b, _c;
            if (((_a = this._profile) === null || _a === void 0 ? void 0 : _a.getId().get()) !== profileId)
                return;
            console.log(`[onCallback] [PROFILE CHANGED] - ${this.Name} will restart for refreshing data...`);
            this._profileData = this._classifyChildrenByInterval(data);
            // if the device is currently monitored, restart it to update the monitored items with the new profile data
            if ((_c = (_b = this._listenerModel) === null || _b === void 0 ? void 0 : _b.monitored) === null || _c === void 0 ? void 0 : _c.get())
                this._restartDevice();
        });
    }
    _restartDevice() {
        if (!this._listenerModel)
            return;
        this._listenerModel.monitored.set(false);
        // restart the device after 1 second to let time to the system to remove old data
        setTimeout(() => {
            if (this._listenerModel)
                this._listenerModel.monitored.set(true);
        }, 1000);
    }
    /** use this function only if device is not created yet */
    init() {
        if (!this.device)
            throw new Error("Device info is not defined");
        return this._getDeviceInfo(this.device)
            .then((deviceInfo) => __awaiter(this, void 0, void 0, function* () {
            // this.info = deviceInfo;
            this.device = deviceInfo;
            this.emit("initialized", this);
            return true;
        }))
            .catch((err) => {
            this.emit("error", err);
            return false;
        });
    }
    initExistingDevice(listenerModel) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._listenerModel = listenerModel;
                const { graph, context, network, organ, bmsDevice, profile } = yield this._getDeviceStructureFromGraph(listenerModel);
                this._graph = graph;
                this._context = context;
                this._network = network;
                this._organ = organ;
                this._bmsDevice = bmsDevice;
                this._profile = profile;
                if (this._bmsDevice)
                    this.device = this._bmsDevice.info.get(); // set the device info from the graph
                // const saveTimeSeries = listenerModel.saveTimeSeries?.get() || false;
                // this._networkService = new NetworkService(saveTimeSeries);
                // await this._initNetworkService(graph, context, organ);
                return true;
            }
            catch (error) {
                console.error("[initExistingDevice] Error initializing existing device", error);
                return false;
            }
        });
    }
    get Id() {
        var _a;
        return (_a = this.device) === null || _a === void 0 ? void 0 : _a.id;
    }
    get Name() {
        var _a;
        return (_a = this.device) === null || _a === void 0 ? void 0 : _a.name;
    }
    getBmsDeviceNode() {
        return this._bmsDevice;
    }
    getCommunicationIndicators() {
        return this.indicators.fetchCurrentIndicators();
    }
    startCommunicationMetricsLogging() {
        if (!(0, indicatorConfiguration_1.areIndicatorsEnabled)())
            return;
        if (this._communicationMetricsLogTimer)
            return;
        this.indicators.setMonitoringActive(true);
        this._logCommunicationMetrics();
        this._communicationMetricsLogTimer = setInterval(() => this._logCommunicationMetrics(), 60000);
        this._communicationMetricsLogTimer.unref();
    }
    stopCommunicationMetricsLogging() {
        this.indicators.setMonitoringActive(false);
        if (!this._communicationMetricsLogTimer)
            return;
        clearInterval(this._communicationMetricsLogTimer);
        this._communicationMetricsLogTimer = null;
        this._logCommunicationMetrics();
    }
    updateCommunicationControlEndpoints() {
        return __awaiter(this, arguments, void 0, function* (recordTimeSeries = true) {
            if (!(0, indicatorConfiguration_1.areIndicatorsEnabled)())
                return;
            const update = this._communicationControlEndpointSync.then(() => __awaiter(this, void 0, void 0, function* () {
                if (!this._bmsDevice)
                    throw new Error("BMS device node is not initialized");
                yield SpinalNetworkUtilities_1.SpinalNetworkUtilities.updateCommunicationControlEndpoints(this._bmsDevice, this.getCommunicationIndicators(), recordTimeSeries);
            }));
            this._communicationControlEndpointSync = update.catch((error) => {
                console.error(`[updateCommunicationControlEndpoints] [${this.Name}] - Failed to synchronize communication indicators:`, error);
            });
            yield this._communicationControlEndpointSync;
        });
    }
    scheduleCommunicationControlEndpointUpdate(delay = 250) {
        if (!(0, indicatorConfiguration_1.areIndicatorsEnabled)())
            return;
        if (this._communicationControlEndpointSyncTimer)
            clearTimeout(this._communicationControlEndpointSyncTimer);
        this._communicationControlEndpointSyncTimer = setTimeout(() => {
            this._communicationControlEndpointSyncTimer = null;
            void this.updateCommunicationControlEndpoints(false);
        }, delay);
        this._communicationControlEndpointSyncTimer.unref();
    }
    _logCommunicationMetrics() {
        // console.log("[_logCommunicationMetrics] ", { device: this.Name, indicators: this.getCommunicationIndicators() });
    }
    // public getNetworkService() {
    //    const saveTimeSeries = this._listenerModel.saveTimeSeries?.get() || false;
    //    this._networkService.useTimeseries = saveTimeSeries;
    //    return this._networkService;
    // }
    getListenerModel() {
        return this._listenerModel;
    }
    getProfileData() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._profile)
                return [];
            const intervals = yield profileManager_1.default.getInstance().getProfileData(this._profile);
            this._profileData = this._classifyChildrenByInterval(intervals);
            return intervals;
        });
    }
    getAllIntervals() {
        return Object.keys(this._profileData);
    }
    getProfileDataByInterval(interval) {
        const data = this._profileData[interval] || [];
        const allChildren = data.reduce((acc, el) => {
            acc.push(...(el.children || []));
            return acc;
        }, []);
        return allChildren.reduce((acc, curr) => {
            if (typeof curr === "undefined")
                return acc;
            acc.push({ instance: curr.instance, type: curr.type });
            return acc;
        }, []);
    }
    getAllItemsMonitored() {
        const intervals = this.getAllIntervals();
        const res = [];
        for (const interval of intervals) {
            const items = this.getProfileDataByInterval(parseInt(interval));
            res.push(...items);
        }
        return res;
    }
    /**  add item to covList */
    pushToCovList(children = []) {
        if (!Array.isArray(children))
            children = [children];
        // const networkService = this.getNetworkService();
        // const covData: ICovData = { spinalModel: this._listenerModel, spinalDevice: this, children, network: this._network };
        // const covData: ICovData = { spinalDevice: this };
        if (children.length === 0)
            return this.covData;
        console.log("[pushToCovList] Childrens' number ", children.length, " has been added to COV ", this.Name);
        this.covData.push(...children);
        return this.covData;
    }
    /** clear covList */
    clearCovList() {
        this.covData = [];
    }
    createDeviceNodeInGraph(context, network, deviceNode) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!deviceNode) {
                deviceNode = yield SpinalNetworkUtilities_1.SpinalNetworkUtilities.createNetworkElementNode(this.device, spinal_model_bmsnetwork_1.SpinalBmsDevice.nodeTypeName);
                return network.addChildInContext(deviceNode, spinal_model_bmsnetwork_1.SpinalBmsDevice.relationName, spinal_model_graph_1.SPINAL_RELATION_PTR_LST_TYPE, context);
            }
            return SpinalNetworkUtilities_1.SpinalNetworkUtilities.updateNetworkElementNode(deviceNode, this.device);
        });
    }
    /** create device item list in graph */
    createDeviceItemList(context, deviceNode, spinalBacnetValueModel) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const deviceName = (_a = this.device) === null || _a === void 0 ? void 0 : _a.name;
            try {
                console.log(`[createDeviceItemList] - [${deviceName}] - getting object list`);
                const objectListDetails = yield this.fetchAllBacnetObjectList(spinalBacnetValueModel, deviceName);
                console.log(`[createDeviceItemList] - [${deviceName}] - ${objectListDetails.length} object(s) retrieved`);
                const listes = this._groupAndFormatItems(objectListDetails);
                spinalBacnetValueModel.changeState(spinal_model_bacnet_1.BACNET_VALUES_STATE.progress);
                // create items in graph
                console.log(`[createDeviceItemList] - [${deviceName}] - creating items in graph`);
                yield this._createEndpointGroupWithChildren(context, deviceNode, listes, spinalBacnetValueModel);
                yield spinalBacnetValueModel.changeState(spinal_model_bacnet_1.BACNET_VALUES_STATE.success);
            }
            catch (error) {
                console.log(`[createDeviceItemList] [${deviceName}] - items creation failed due to "${error.message}"`);
                yield spinalBacnetValueModel.changeState(spinal_model_bacnet_1.BACNET_VALUES_STATE.error);
                return;
            }
        });
    }
    fetchAllBacnetObjectList(spinalBacnetValueModel, deviceName) {
        return __awaiter(this, void 0, void 0, function* () {
            let sensors = this._getSensors(spinalBacnetValueModel);
            // FRAGMENTATION is used when bacnet device has a loop object
            let useFragment = true; // TODO: remove this line when useFragment is implemented in the UI
            return this._getObjectListDetails(sensors, useFragment);
        });
    }
    /** Check and create endpoints if they do not exist */
    checkAndCreateEndpointsIfNotExist(endpointsToCreate) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const deviceName = (_a = this.device) === null || _a === void 0 ? void 0 : _a.name;
                if (this._skipInitialization()) {
                    console.log(`[checkAndCreateEndpointsIfNotExist] [${deviceName}] - skipping endpoints initialization as per environment settings`);
                    return [];
                }
                // const networkService = this.getNetworkService();
                console.log(`[checkAndCreateEndpointsIfNotExist] [${deviceName}] - check and create endpoints, if not exist`);
                if (!this._context || !this._bmsDevice) {
                    console.log(`[checkAndCreateEndpointsIfNotExist] [${deviceName}] - context or bmsDevice is not initialized, cannot create endpoints`);
                    return [];
                }
                const childrenGroups = yield this.formatAndGroupEndpoints(deviceName, endpointsToCreate);
                if (Object.keys(childrenGroups).length === 0) {
                    console.error(`[checkAndCreateEndpointsIfNotExist] [${deviceName}] - no endpoints found, device might not respond`);
                    return [];
                }
                const result = yield this.generateNetworkEndpoints(childrenGroups);
                console.log(`[checkAndCreateEndpointsIfNotExist] [${deviceName}] - ${result.flat().length} endpoints created`);
                return result.flat();
            }
            catch (error) {
                console.error(`[checkAndCreateEndpointsIfNotExist] [${(_b = this.device) === null || _b === void 0 ? void 0 : _b.name}] - check and create endpoints failed due to "${error.message}"`);
                return [];
            }
        });
    }
    _skipInitialization() {
        const skip = process.env.SKIP_ENDPOINTS_INITIALIZATION || "";
        return skip === "true" || skip === "1";
    }
    generateNetworkEndpoints(childrenGroups) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = Array.from(Object.keys(childrenGroups)).map((childKey) => {
                return SpinalNetworkUtilities_1.SpinalNetworkUtilities.createEndpointsInGroup(this._context, this._bmsDevice, childKey, childrenGroups[childKey]);
            });
            const result = yield Promise.all(promises);
            return result;
        });
    }
    formatAndGroupEndpoints(deviceName, endpointsToCreate) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.device) {
                console.log(`[formatAndGroupEndpoints] [${deviceName}] - device is not found, cannot create endpoints`);
                return [];
            }
            const endpointToCreateFormatted = endpointsToCreate.map((el) => ({ type: el.type, instance: el.instance }));
            const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getObjectDetail(this.device, endpointToCreateFormatted);
            const childrenGroups = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (item) {
                return item.type;
            });
            return childrenGroups;
        });
    }
    updateEndpoints(interval) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.device) {
                console.log("[updateEndpoints] device is not defined, cannot update endpoints");
                return false;
            }
            const children = this.getProfileDataByInterval(interval);
            if (children.length === 0)
                return true;
            const deviceName = this.device.name;
            try {
                console.log(`[updateEndpoints] [${deviceName}] ===> updating endpoints for interval [${interval}]`);
                const objectListDetails = yield this._readMonitoredValues(children);
                if (!objectListDetails || objectListDetails.length === 0)
                    throw new Error("Failed to retreive endpoints on device");
                if (!this._bmsDevice || !this._network)
                    throw new Error("BMS Device or network is not defined, cannot update endpoints");
                const spinalDevice = this;
                yield SpinalNetworkUtilities_1.SpinalNetworkUtilities.updateEndpointInGraph(spinalDevice, objectListDetails);
                return true;
            }
            catch (error) {
                console.error(`[updateEndpoints] [${deviceName}] - Error updating endpoints for device due to "${error.message}"`);
                return false;
            }
        });
    }
    _readMonitoredValues(children) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(0, indicatorConfiguration_1.areIndicatorsEnabled)())
                return BacnetUtilities_1.BacnetUtilities._getChildrenNewValue(this.device, children);
            let outcome;
            try {
                outcome = yield BacnetUtilities_1.BacnetUtilities._getChildrenNewValueWithMetrics(this.device, children);
                if (!(outcome === null || outcome === void 0 ? void 0 : outcome.telemetry))
                    throw new Error("BACnet service returned no communication telemetry; deploy the telemetry-enabled service");
            }
            catch (error) {
                this.indicators.recordRequestFailure(children.length, error);
                yield this.updateCommunicationControlEndpoints();
                throw error;
            }
            this.indicators.recordReadCycle(outcome.telemetry);
            yield this.updateCommunicationControlEndpoints();
            if (outcome.error)
                throw new Error(outcome.error);
            const values = outcome.values;
            const successfulPoints = outcome.telemetry.finalSuccesses;
            const complete = successfulPoints === children.length;
            if (!complete) {
                console.error(`[_readMonitoredValues] [${this.Name}] - Incomplete BACnet read: ${successfulPoints} values received for ${children.length} requested points`);
            }
            return values;
        });
    }
    shouldSaveTimeSeries(objectId) {
        var _a, _b, _c, _d;
        if (!objectId || typeof objectId.savetimeseries === "undefined")
            return ((_b = (_a = this._listenerModel) === null || _a === void 0 ? void 0 : _a.saveTimeSeries) === null || _b === void 0 ? void 0 : _b.get()) || false;
        const itemsMonitored = this.getAllItemsMonitored();
        const found = itemsMonitored.find((el) => el.instance == objectId.instance && el.type == objectId.type);
        if (!found)
            return ((_d = (_c = this._listenerModel) === null || _c === void 0 ? void 0 : _c.saveTimeSeries) === null || _d === void 0 ? void 0 : _d.get()) || false;
        return this._getChildrenTimeSeries(found);
    }
    //////////////////////////////////////////////////////////////////////////////
    ////                      PRIVATES                                        ////
    //////////////////////////////////////////////////////////////////////////////
    _getChildrenTimeSeries(objectId) {
        var _a, _b;
        if (!(objectId === null || objectId === void 0 ? void 0 : objectId.savetimeseries))
            return ((_b = (_a = this._listenerModel) === null || _a === void 0 ? void 0 : _a.saveTimeSeries) === null || _b === void 0 ? void 0 : _b.get()) || false;
        const timeSeries = objectId === null || objectId === void 0 ? void 0 : objectId.savetimeseries.get();
        if (typeof timeSeries == "boolean")
            return timeSeries;
        return timeSeries.toString().toLowerCase() == "true";
    }
    _getDeviceInfo(device) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const deviceAddress = device.address;
            if (!deviceAddress)
                throw new Error("Device address is not defined");
            try {
                const objectId = { type: GlobalVariables_1.ObjectTypes.OBJECT_DEVICE, instance: device.deviceId };
                const deviceId = yield this._getDeviceId(deviceAddress, device.SADR, device.deviceId);
                return {
                    id: deviceId,
                    SADR: device.SADR,
                    deviceId,
                    name: (_a = device.name) !== null && _a !== void 0 ? _a : (yield this._getDataValue(deviceAddress, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_OBJECT_NAME)),
                    address: deviceAddress,
                    typeId: objectId.type,
                    type: BacnetUtilities_1.BacnetUtilities._getObjectTypeByCode(objectId.type),
                    description: (_b = device.description) !== null && _b !== void 0 ? _b : (yield this._getDataValue(deviceAddress, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_DESCRIPTION)),
                    segmentation: (_c = device.segmentation) !== null && _c !== void 0 ? _c : (yield this._getDataValue(deviceAddress, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_SEGMENTATION_SUPPORTED)),
                    vendorId: (_d = device.vendorId) !== null && _d !== void 0 ? _d : (yield this._getDataValue(deviceAddress, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_VENDOR_IDENTIFIER)),
                    maxApdu: (_e = device.maxApdu) !== null && _e !== void 0 ? _e : (yield this._getDataValue(deviceAddress, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_MAX_APDU_LENGTH_ACCEPTED)),
                };
            }
            catch (error) {
                if (error.message.includes("ERR_TIMEOUT")) {
                    throw error;
                }
                console.error(`[_getDeviceInfo] Error getting device info for device at address ${deviceAddress} with ID ${device.deviceId} due to "${error.message}"`);
                throw error;
            }
        });
    }
    _groupAndFormatItems(objectListDetails) {
        const itemsGrouped = lodash.groupBy(objectListDetails, function (item) {
            return item.type;
        });
        const listes = Array.from(Object.keys(itemsGrouped)).map((key) => [key, itemsGrouped[key]]);
        return listes;
    }
    _getDataValue(address, sadr, objectId, PropertyId) {
        return __awaiter(this, void 0, void 0, function* () {
            const formated = yield BacnetUtilities_1.BacnetUtilities._getPropertyValue(address, sadr, objectId, PropertyId);
            const propertyName = BacnetUtilities_1.BacnetUtilities._getPropertyNameByCode(PropertyId);
            if (formated && propertyName)
                return formated[propertyName];
        });
    }
    _getSensors(spinalBacnetValueModel) {
        if (spinalBacnetValueModel) {
            spinalBacnetValueModel.changeState(spinal_model_bacnet_1.BACNET_VALUES_STATE.recover);
            return spinalBacnetValueModel.sensor.get();
        }
        return GlobalVariables_1.SENSOR_TYPES;
    }
    _getObjectListDetails(sensors_1) {
        return __awaiter(this, arguments, void 0, function* (sensors, useFragment = false) {
            if (!this.device)
                throw new Error("Device is not defined");
            const objectLists = yield BacnetUtilities_1.BacnetUtilities._getDeviceObjectList(this.device, sensors, useFragment);
            const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getObjectDetail(this.device, objectLists.map((el) => el.value));
            return objectListDetails;
        });
    }
    _getDeviceId(deviceAdress, sadr, deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof deviceId === "number" && deviceId !== GlobalVariables_1.PropertyIds.MAX_BACNET_PROPERTY_ID)
                return deviceId;
            return BacnetUtilities_1.BacnetUtilities.getDeviceId(deviceAdress, sadr);
        });
    }
    _createEndpointGroupWithChildren(context, deviceNode, listes, spinalBacnetValueModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const maxLength = listes.length;
            while (listes.length > 0) {
                const item = listes.pop();
                if (!item)
                    continue;
                const [key, value] = item;
                yield SpinalNetworkUtilities_1.SpinalNetworkUtilities.createEndpointsInGroup(context, deviceNode, key, value);
                const percent = Math.floor((100 * (maxLength - listes.length)) / maxLength);
                spinalBacnetValueModel.progress.set(percent);
            }
        });
    }
    _getDeviceStructureFromGraph(listenerModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const treeList = [listenerModel.graph, listenerModel.context, listenerModel.network, listenerModel.organ, listenerModel.bmsDevice, listenerModel.profile];
            const promises = treeList.map((ptr) => (0, Functions_1.loadPtrValue)(ptr));
            return Promise.all(promises).then(([graph, context, network, organ, bmsDevice, profile]) => {
                return { graph, context, network, organ, bmsDevice, profile };
            });
        });
    }
    _classifyChildrenByInterval(intervals) {
        const res = {};
        for (const intervalData of intervals) {
            const interval = intervalData.interval;
            if (typeof interval === "undefined")
                continue;
            if (!res[interval])
                res[interval] = [];
            res[interval].push(intervalData);
        }
        return res;
    }
}
exports.SpinalDevice = SpinalDevice;
/////////////////////////////////////////////////////////////////
//  create a queue to get all bacnet values of a device and create items in graph,
// this is to avoid multiple calls at the same time which can cause performance issues and bacnet timeouts
/////////////////////////////////////////////////////////////////
const allBacnetValueQueue = new spinal_connector_service_1.SpinalQueue();
allBacnetValueQueue.on("start", () => __awaiter(void 0, void 0, void 0, function* () {
    while (!allBacnetValueQueue.isEmpty()) {
        const queueItem = allBacnetValueQueue.dequeue();
        if (!queueItem)
            continue;
        const { device, node, context, spinalBacnetValueModel } = queueItem;
        let spinalDevice = new SpinalDevice(device);
        yield spinalDevice.createDeviceItemList(context, node, spinalBacnetValueModel);
    }
}));
function addToGetAllBacnetValuesQueue(device, node, context, spinalBacnetValueModel) {
    allBacnetValueQueue.addToQueue({ device, node, context, spinalBacnetValueModel });
}
//# sourceMappingURL=SpinalDevice.js.map