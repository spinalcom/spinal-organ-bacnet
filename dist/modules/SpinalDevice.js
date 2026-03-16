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
const events_1 = require("events");
// import { store } from "../store";
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const spinal_connector_service_1 = require("spinal-connector-service");
class SpinalDevice extends events_1.EventEmitter {
    // private client: bacnet;
    constructor(device) {
        super();
        this.covData = [];
        this.device = device;
    }
    /** Initialize the device */
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
    /**  add item to covList */
    pushToCovList(argCovData) {
        if (!Array.isArray(argCovData))
            argCovData = [argCovData];
        this.covData.push(...argCovData);
        return this.covData.length;
    }
    /** clear covList */
    clearCovList() {
        this.covData = [];
    }
    /** create device node in graph if not exist */
    createStructureNodes(networkService, node, parentId) {
        if (node)
            return Promise.resolve(node);
        return this._createDevice(networkService, parentId);
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
    checkAndCreateIfNotExist(networkService, objectIds) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("check and create endpoints, if not exist");
            const client = yield BacnetUtilities_1.BacnetUtilities.getClient();
            if (!this.device) {
                console.log("device is not defined");
                return [];
            }
            const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getObjectDetail(this.device, objectIds, client);
            const childrenGroups = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (item) { return item.type; });
            const promises = Array.from(Object.keys(childrenGroups)).map((el) => {
                var _a;
                return BacnetUtilities_1.BacnetUtilities.createEndpointsInGroup(networkService, this.device.id, el, childrenGroups[el], (_a = this.device) === null || _a === void 0 ? void 0 : _a.name);
            });
            return Promise.all(promises);
        });
    }
    updateEndpoints(networkService, networkNode, children) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.device) {
                console.log("device is not defined");
                return;
            }
            const deviceName = this.device.name;
            try {
                const client = yield BacnetUtilities_1.BacnetUtilities.getClient();
                console.log(`${new Date()} ===> update ${deviceName}`);
                const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getChildrenNewValue(this.device, children, client);
                if (!objectListDetails || objectListDetails.length === 0)
                    throw new Error("Failed to retreive endpoints on device");
                const obj = {
                    id: this.device.idNetwork,
                    children: this._groupByType(lodash.flattenDeep(objectListDetails))
                };
                yield this.updateEndpointInGraph(obj, networkService, networkNode);
            }
            catch (error) {
                console.error(`Error updating endpoints for device ${deviceName}`);
            }
        });
    }
    updateEndpointInGraph(obj, networkService, networkNode) {
        return networkService.updateData(obj, null, networkNode);
    }
    //////////////////////////////////////////////////////////////////////////////
    ////                      PRIVATES                                        ////
    //////////////////////////////////////////////////////////////////////////////
    _createDevice(networkService, parentId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.info) {
                return;
            }
            ;
            return networkService.createNewBmsDevice(parentId, this.info);
        });
    }
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
                console.error(`Error getting device info for device at address ${deviceAddress} with ID ${device.deviceId} due to`, error.message);
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
        const spinalDevice = new SpinalDevice(device);
        yield spinalDevice.createDeviceItemList(networkService, node, spinalBacnetValueModel);
    }
}));
function addToGetAllBacnetValuesQueue(device, node, networkService, spinalBacnetValueModel) {
    allBacnetValueQueue.addToQueue({ device, node, networkService, spinalBacnetValueModel });
}
//# sourceMappingURL=SpinalDevice.js.map