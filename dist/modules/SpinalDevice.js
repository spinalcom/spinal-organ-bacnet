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
exports.SpinalDevice = void 0;
exports.addToGetAllBacnetValuesQueue = addToGetAllBacnetValuesQueue;
const lodash = require("lodash");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const events_1 = require("events");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
// import { store } from "../store";
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const spinal_connector_service_1 = require("spinal-connector-service");
const Functions_1 = require("../utilities/Functions");
const SpinalNetworkUtilities_1 = require("../utilities/SpinalNetworkUtilities");
class SpinalDevice extends events_1.EventEmitter {
    // private client: bacnet;
    constructor(device) {
        super();
        this.covData = [];
        this._profileData = {};
        this.device = device;
    }
    /** use this function only if device is not created yet */
    init() {
        if (!this.device)
            throw new Error("Device info is not defined");
        return this._getDeviceInfo(this.device).then((deviceInfo) => __awaiter(this, void 0, void 0, function* () {
            // this.info = deviceInfo;
            this.device = deviceInfo;
            this.emit("initialized", this);
            return true;
        })).catch((err) => {
            this.emit("error", err);
            return false;
        });
    }
    initExistingDevice(listenerModel) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                this._listenerModel = listenerModel;
                const { graph, context, network, organ, bmsDevice, profile } = yield this._getDeviceStructureFromGraph(listenerModel);
                // set the device structure in the class to be used later for update
                [this._graph, this._context, this._network, this._organ, this._bmsDevice, this._profile] = [graph, context, network, organ, bmsDevice, profile];
                this.device = this._bmsDevice.info.get(); // set the device info from the graph
                const saveTimeSeries = ((_a = listenerModel.saveTimeSeries) === null || _a === void 0 ? void 0 : _a.get()) || false;
                this._networkService = new spinal_model_bmsnetwork_1.NetworkService(saveTimeSeries);
                yield this._initNetworkService(graph, context, organ);
                return true;
            }
            catch (error) {
                console.error("Error initializing existing device", error);
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
    getNetworkService() {
        var _a;
        const saveTimeSeries = ((_a = this._listenerModel.saveTimeSeries) === null || _a === void 0 ? void 0 : _a.get()) || false;
        this._networkService.useTimeseries = saveTimeSeries;
        return this._networkService;
    }
    getListenerModel() {
        return this._listenerModel;
    }
    getProfileData() {
        return __awaiter(this, void 0, void 0, function* () {
            const intervals = yield SpinalNetworkUtilities_1.SpinalNetworkUtilities.getProfileData(this._profile);
            this._profileData = this._classifyChildrenByInterval(intervals);
            return intervals;
        });
    }
    getAllIntervals() {
        return Object.keys(this._profileData);
    }
    getProfileDataByInterval(interval) {
        const data = this._profileData[interval] || [];
        return data.map(el => el.children).flat();
    }
    /**  add item to covList */
    pushToCovList(children) {
        if (!Array.isArray(children))
            children = [children];
        const networkService = this.getNetworkService();
        const covData = { spinalModel: this._listenerModel, spinalDevice: this, children, networkService, network: this._network };
        this.covData.push(covData);
        return covData;
    }
    /** clear covList */
    clearCovList() {
        this.covData = [];
    }
    createDeviceNodeInGraph(networkService, parentId) {
        return __awaiter(this, void 0, void 0, function* () {
            return networkService.createNewBmsDevice(parentId, this.device);
        });
    }
    /** create device item list in graph */
    createDeviceItemList(networkService, node, spinalBacnetValueModel) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const deviceName = (_a = this.device) === null || _a === void 0 ? void 0 : _a.name;
            try {
                const deviceId = node.getId().get();
                let sensors = this._getSensors(spinalBacnetValueModel);
                let useFragment = true; // TODO: remove this line when useFragment is implemented in the UI
                // get object list details
                console.log(`[${deviceName}] - getting object list`);
                const objectListDetails = yield this._getObjecListDetails(sensors, useFragment);
                console.log(`[${deviceName}] - ${objectListDetails.length} item(s) found`);
                // group and format items
                const listes = this._groupAndFormatItems(objectListDetails);
                const maxLength = listes.length;
                spinalBacnetValueModel.changeState(spinal_model_bacnet_1.BACNET_VALUES_STATE.progress);
                // create items in graph
                console.log(`[${deviceName}] - creating items in graph`);
                yield this._createEndpointGroupWithChildren(listes, networkService, deviceId, deviceName, maxLength, spinalBacnetValueModel);
                console.log(`[${deviceName}] - items created in graph`);
                yield spinalBacnetValueModel.changeState(spinal_model_bacnet_1.BACNET_VALUES_STATE.success);
            }
            catch (error) {
                console.log(`[${deviceName}] - items creation failed`);
                yield spinalBacnetValueModel.changeState(spinal_model_bacnet_1.BACNET_VALUES_STATE.error);
                return;
            }
        });
    }
    /** Check and create endpoints if they do not exist */
    checkAndCreateEndpointsIfNotExist(endpointsToCreate) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const networkService = this.getNetworkService();
            const deviceName = (_a = this.device) === null || _a === void 0 ? void 0 : _a.name;
            console.log(`[${deviceName}] - check and create endpoints, if not exist`);
            const client = yield BacnetUtilities_1.BacnetUtilities.getClient();
            if (!this.device) {
                console.log(`[${deviceName}] - device is not defined`);
                return [];
            }
            const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getObjectDetail(this.device, endpointsToCreate, client);
            const childrenGroups = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (item) { return item.type; });
            const promises = Array.from(Object.keys(childrenGroups)).map((childKey) => {
                var _a;
                return BacnetUtilities_1.BacnetUtilities.createEndpointsInGroup(networkService, this.Id, childKey, childrenGroups[childKey], (_a = this.device) === null || _a === void 0 ? void 0 : _a.name);
            });
            return Promise.all(promises).then((result) => {
                console.log(`[${deviceName}] - endpoints creation completed`);
                return result.flat();
            }).catch((err) => {
                console.error(`[${deviceName}] - check and create endpoints failed due to "${err.message}"`);
                return [];
            });
        });
    }
    updateEndpoints(interval) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.device) {
                console.log("device is not defined");
                return;
            }
            const children = this.getProfileDataByInterval(interval);
            const networkService = this.getNetworkService();
            const networkNode = this._network;
            const deviceName = this.device.name;
            try {
                const client = yield BacnetUtilities_1.BacnetUtilities.getClient();
                console.log(`[${deviceName}] ===> updating endpoints for interval ${interval}`);
                const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getChildrenNewValue(this.device, children, client);
                if (!objectListDetails || objectListDetails.length === 0)
                    throw new Error("Failed to retreive endpoints on device");
                const obj = { id: this.device.idNetwork, children: this._groupByType(lodash.flattenDeep(objectListDetails)) };
                yield this.updateEndpointInGraph(obj, networkService, networkNode);
            }
            catch (error) {
                console.error(`[${deviceName}] - Error updating endpoints for device due to "${error.message}"`);
            }
        });
    }
    updateEndpointInGraph(obj, networkService, networkNode) {
        return networkService.updateData(obj, null, networkNode);
    }
    //////////////////////////////////////////////////////////////////////////////
    ////                      PRIVATES                                        ////
    //////////////////////////////////////////////////////////////////////////////
    _getDeviceInfo(device) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    name: yield this._getDataValue(deviceAddress, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_OBJECT_NAME),
                    address: deviceAddress,
                    typeId: objectId.type,
                    type: BacnetUtilities_1.BacnetUtilities._getObjectTypeByCode(objectId.type),
                    description: yield this._getDataValue(deviceAddress, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_DESCRIPTION),
                    segmentation: device.segmentation || (yield this._getDataValue(deviceAddress, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_SEGMENTATION_SUPPORTED)),
                    vendorId: device.vendorId || (yield this._getDataValue(deviceAddress, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_VENDOR_IDENTIFIER)),
                    maxApdu: device.maxApdu || (yield this._getDataValue(deviceAddress, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_MAX_APDU_LENGTH_ACCEPTED))
                };
            }
            catch (error) {
                if (error.message.includes("ERR_TIMEOUT")) {
                    throw error;
                }
                console.error(`Error getting device info for device at address ${deviceAddress} with ID ${device.deviceId} due to "${error.message}"`);
                throw error;
            }
        });
    }
    _groupAndFormatItems(objectListDetails) {
        const itemsGrouped = lodash.groupBy(objectListDetails, function (item) { return item.type; });
        const listes = Array.from(Object.keys(itemsGrouped)).map((key) => [key, itemsGrouped[key]]);
        return listes;
    }
    _groupByType(itemList) {
        const res = [];
        const obj = lodash.groupBy(itemList, (a) => a.type);
        for (const [key, value] of Object.entries(obj)) {
            res.push({ id: parseInt(key), children: obj[key] });
        }
        return res;
    }
    _getDataValue(address, sadr, objectId, PropertyId) {
        return __awaiter(this, void 0, void 0, function* () {
            const formated = yield BacnetUtilities_1.BacnetUtilities._getPropertyValue(address, sadr, objectId, PropertyId);
            return formated[BacnetUtilities_1.BacnetUtilities._getPropertyNameByCode(PropertyId)];
        });
    }
    _getSensors(spinalBacnetValueModel) {
        if (spinalBacnetValueModel) {
            spinalBacnetValueModel.changeState(spinal_model_bacnet_1.BACNET_VALUES_STATE.recover);
            return spinalBacnetValueModel.sensor.get();
        }
        return GlobalVariables_1.SENSOR_TYPES;
    }
    _getObjecListDetails(sensors_1) {
        return __awaiter(this, arguments, void 0, function* (sensors, useFragment = false) {
            if (!this.device)
                throw new Error("Device is not defined");
            const client = yield BacnetUtilities_1.BacnetUtilities.getClient();
            const objectLists = yield BacnetUtilities_1.BacnetUtilities._getDeviceObjectList(this.device, sensors, client, useFragment);
            const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getObjectDetail(this.device, objectLists.map((el) => el.value), client);
            return objectListDetails;
        });
    }
    _getDeviceId(deviceAdress, sadr, deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (deviceId && deviceId !== GlobalVariables_1.PropertyIds.MAX_BACNET_PROPERTY_ID)
                return deviceId;
            return BacnetUtilities_1.BacnetUtilities.getDeviceId(deviceAdress, sadr);
        });
    }
    _createEndpointGroupWithChildren(listes, networkService, deviceId, deviceName, maxLength, spinalBacnetValueModel) {
        return __awaiter(this, void 0, void 0, function* () {
            while (listes.length > 0) {
                const item = listes.pop();
                if (!item)
                    continue;
                const [key, value] = item;
                yield BacnetUtilities_1.BacnetUtilities.createEndpointsInGroup(networkService, deviceId, key, value, deviceName);
                const percent = Math.floor((100 * (maxLength - listes.length)) / maxLength);
                spinalBacnetValueModel.progress.set(percent);
            }
        });
    }
    _getDeviceStructureFromGraph(listenerModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const treeList = [listenerModel.graph, listenerModel.context, listenerModel.network, listenerModel.organ, listenerModel.bmsDevice, listenerModel.profile];
            const promises = treeList.map(ptr => (0, Functions_1.loadPtrValue)(ptr));
            return Promise.all(promises).then(([graph, context, network, organ, bmsDevice, profile]) => {
                if (graph)
                    spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(graph);
                if (bmsDevice)
                    spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(bmsDevice);
                if (network)
                    spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(network);
                if (context)
                    spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(context);
                return { graph, context, network, organ, bmsDevice, profile };
            });
        });
    }
    _initNetworkService(graph, context, organ) {
        return __awaiter(this, void 0, void 0, function* () {
            const networkInfo = {
                contextName: context.getName().get(),
                contextType: context.getType().get(),
                networkType: organ.getType().get(),
                networkName: organ.getName().get()
            };
            yield this._networkService.init(graph, networkInfo);
        });
    }
    _classifyChildrenByInterval(intervals) {
        const res = {};
        for (const intervalData of intervals) {
            const interval = intervalData.interval;
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
        const { device, node, networkService, spinalBacnetValueModel } = queueItem;
        let spinalDevice = new SpinalDevice(device);
        yield spinalDevice.createDeviceItemList(networkService, node, spinalBacnetValueModel);
    }
}));
function addToGetAllBacnetValuesQueue(device, node, networkService, spinalBacnetValueModel) {
    allBacnetValueQueue.addToQueue({ device, node, networkService, spinalBacnetValueModel });
}
//# sourceMappingURL=SpinalDevice.js.map