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
const spinal_model_graph_1 = require("spinal-model-graph");
// import { store } from "../store";
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const spinal_connector_service_1 = require("spinal-connector-service");
const Functions_1 = require("../utilities/Functions");
const profileManager_1 = require("../utilities/profileManager");
const SpinalNetworkUtilities_1 = require("../utilities/SpinalNetworkUtilities");
class SpinalDevice extends events_1.EventEmitter {
    // private client: bacnet;
    constructor(device) {
        super();
        this.covData = [];
        // private _networkService: NetworkService;
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
    getBmsDeviceNode() {
        return this._bmsDevice;
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
        return data.map(el => el.children).flat().filter((el) => typeof el !== "undefined");
    }
    /**  add item to covList */
    pushToCovList(children) {
        if (!Array.isArray(children))
            children = [children];
        // const networkService = this.getNetworkService();
        // const covData: ICovData = { spinalModel: this._listenerModel, spinalDevice: this, children, network: this._network };
        // const covData: ICovData = { spinalDevice: this };
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
                console.log(`[${deviceName}] - getting object list`);
                const listes = yield this.fetchAndFormatAllBacnetObjectList(spinalBacnetValueModel, deviceName);
                console.log(`[${deviceName}] - object list retrieved`);
                spinalBacnetValueModel.changeState(spinal_model_bacnet_1.BACNET_VALUES_STATE.progress);
                // create items in graph
                console.log(`[${deviceName}] - creating items in graph`);
                yield this._createEndpointGroupWithChildren(context, deviceNode, listes, spinalBacnetValueModel);
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
    fetchAndFormatAllBacnetObjectList(spinalBacnetValueModel, deviceName) {
        return __awaiter(this, void 0, void 0, function* () {
            let sensors = this._getSensors(spinalBacnetValueModel);
            // FRAGMENTATION is used when bacnet device has a loop object
            let useFragment = true; // TODO: remove this line when useFragment is implemented in the UI
            const objectListDetails = yield this._getObjectListDetails(sensors, useFragment);
            // group and format items by type to optimize the creation in the graph
            return this._groupAndFormatItems(objectListDetails);
        });
    }
    /** Check and create endpoints if they do not exist */
    checkAndCreateEndpointsIfNotExist(endpointsToCreate) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // const networkService = this.getNetworkService();
            const deviceName = (_a = this.device) === null || _a === void 0 ? void 0 : _a.name;
            console.log(`[${deviceName}] - check and create endpoints, if not exist`);
            if (!this.device) {
                console.log(`[${deviceName}] - device is not found, cannot create endpoints`);
                return [];
            }
            const client = yield BacnetUtilities_1.BacnetUtilities.getClient();
            const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getObjectDetail(this.device, endpointsToCreate);
            const childrenGroups = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (item) { return item.type; });
            if (!this._context || !this._bmsDevice) {
                console.log(`[${deviceName}] - context or bmsDevice is not initialized, cannot create endpoints`);
                return [];
            }
            const promises = Array.from(Object.keys(childrenGroups)).map((childKey) => {
                return SpinalNetworkUtilities_1.SpinalNetworkUtilities.createEndpointsInGroup(this._context, this._bmsDevice, childKey, childrenGroups[childKey]);
            });
            return Promise.all(promises)
                .then((result) => {
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
                console.log("device is not defined, cannot update endpoints");
                return;
            }
            const children = this.getProfileDataByInterval(interval);
            // const networkService = this.getNetworkService();
            const deviceName = this.device.name;
            try {
                console.log(`[${deviceName}] ===> updating endpoints for interval ${interval}`);
                const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getChildrenNewValue(this.device, children);
                if (!objectListDetails || objectListDetails.length === 0)
                    throw new Error("Failed to retreive endpoints on device");
                // const obj: any = { id: (this.device as any).idNetwork, children: this._groupByType(lodash.flattenDeep(objectListDetails)) }
                if (!this._bmsDevice || !this._network)
                    throw new Error("BMS Device or network is not defined, cannot update endpoints");
                const saveTimeSeries = this.shoulSaveTimeSeries();
                return SpinalNetworkUtilities_1.SpinalNetworkUtilities.updateEndpointInGraph(this._bmsDevice, objectListDetails, saveTimeSeries);
            }
            catch (error) {
                console.error(`[${deviceName}] - Error updating endpoints for device due to "${error.message}"`);
            }
        });
    }
    shoulSaveTimeSeries() {
        var _a;
        return ((_a = this._listenerModel.saveTimeSeries) === null || _a === void 0 ? void 0 : _a.get()) || false;
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
    // private _groupByType(itemList: any) {
    //    const res = []
    //    const obj = lodash.groupBy(itemList, (a: any) => a.type);
    //    for (const [key, value] of Object.entries(obj)) {
    //       res.push({ id: parseInt(key), children: obj[key] })
    //    }
    //    return res;
    // }
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
            if (deviceId && deviceId !== GlobalVariables_1.PropertyIds.MAX_BACNET_PROPERTY_ID)
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
            const promises = treeList.map(ptr => (0, Functions_1.loadPtrValue)(ptr));
            return Promise.all(promises).then(([graph, context, network, organ, bmsDevice, profile]) => {
                return { graph, context, network, organ, bmsDevice, profile };
            });
        });
    }
    // private async _initNetworkService(graph: SpinalGraph, context: SpinalContext, organ: SpinalNode) {
    //    const networkInfo = {
    //       contextName: context.getName().get(),
    //       contextType: context.getType().get(),
    //       networkType: organ.getType().get(),
    //       networkName: organ.getName().get()
    //    };
    //    await this._networkService.init(graph, networkInfo);
    // }
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