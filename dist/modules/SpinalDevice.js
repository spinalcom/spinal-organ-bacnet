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
exports.addToGetAllBacnetValuesQueue = exports.SpinalDevice = void 0;
const lodash = require("lodash");
const events_1 = require("events");
// import { store } from "../store";
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
const SpinalQueuing_1 = require("../utilities/SpinalQueuing");
class SpinalDevice extends events_1.EventEmitter {
    // private client: bacnet;
    constructor(device, client) {
        super();
        this.device = device;
        // this.client = client || BacnetUtilities.getClient();
    }
    init() {
        return this._getDeviceInfo(this.device).then((deviceInfo) => __awaiter(this, void 0, void 0, function* () {
            this.info = deviceInfo;
            this.device = deviceInfo;
            // console.log("this.info", this.info);
            this.emit("initialized", this);
        })).catch((err) => {
            // console.error(err);
            this.emit("error", err);
        });
    }
    createStructureNodes(networkService, node, parentId) {
        // this.networkService = networkService;
        if (node) {
            return Promise.resolve(node);
        }
        ;
        return this._createDevice(networkService, parentId);
    }
    createDeviceItemList(networkService, node, spinalBacnetValueModel) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const deviceId = node.getId().get();
                let sensors = this._getSensors(spinalBacnetValueModel);
                console.log(`[${this.device.name}] - getting object list`);
                const listes = yield this._getObjecListDetails(sensors);
                console.log(`[${this.device.name}] - ${listes.length} item(s) found`);
                const maxLength = listes.length;
                // let isError = false;
                // if (spinalBacnetValueModel) {
                spinalBacnetValueModel.setProgressState();
                // }
                console.log(`[${this.device.name}] - creating items in graph`);
                while (listes.length > 0) {
                    const item = listes.pop();
                    if (item) {
                        const [key, value] = item;
                        // try {
                        yield BacnetUtilities_1.BacnetUtilities.createEndpointsInGroup(networkService, deviceId, key, value, this.device.name);
                        if (spinalBacnetValueModel) {
                            const percent = Math.floor((100 * (maxLength - listes.length)) / maxLength);
                            spinalBacnetValueModel.progress.set(percent);
                        }
                        // } catch (error) {
                        //    isError = error;
                        // }
                    }
                }
                // // if (spinalBacnetValueModel) {
                // if (isError) {
                //    // console.log("set error model", isError);
                //    spinalBacnetValueModel.setErrorState();
                //    return;
                // }
                // // console.log("set success model");
                console.log(`[${this.device.name}] - items created in graph`);
                spinalBacnetValueModel.setSuccessState();
                // // }
            }
            catch (error) {
                console.log(`[${this.device.name}] - items creation failed`);
                spinalBacnetValueModel.setErrorState();
                return;
            }
        });
    }
    checkAndCreateIfNotExist(networkService, objectIds) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("check and create if not exist");
            const client = yield BacnetUtilities_1.BacnetUtilities.getClient();
            // const children = lodash.chunk(objectIds, 60);
            // const objectListDetails = await this._getAllObjectDetails(children, client);
            const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getObjectDetail(this.device, objectIds, client);
            const childrenGroups = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type; });
            const promises = Array.from(Object.keys(childrenGroups)).map((el) => {
                return BacnetUtilities_1.BacnetUtilities.createEndpointsInGroup(networkService, this.device.id, el, childrenGroups[el], this.device.name);
            });
            return Promise.all(promises);
        });
    }
    updateEndpoints(networkService, networkNode, children) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield BacnetUtilities_1.BacnetUtilities.getClient();
                console.log(`${new Date()} ===> update ${this.device.name}`);
                const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getChildrenNewValue(this.device, children, client);
                const obj = {
                    id: this.device.idNetwork,
                    children: this._groupByType(lodash.flattenDeep(objectListDetails))
                };
                this.updateEndpointInGraph(obj, networkService, networkNode);
            }
            catch (error) {
                // console.log(`${new Date()} ===> error ${(<any>this.device).name}`)
                // console.error(error);
            }
        });
    }
    updateEndpointInGraph(obj, networkService, networkNode) {
        networkService.updateData(obj, null, networkNode);
    }
    //////////////////////////////////////////////////////////////////////////////
    ////                      PRIVATES                                        ////
    //////////////////////////////////////////////////////////////////////////////
    _createDevice(networkService, parentId) {
        return networkService.createNewBmsDevice(parentId, this.info);
    }
    _getDeviceInfo(device) {
        return __awaiter(this, void 0, void 0, function* () {
            const objectId = { type: GlobalVariables_1.ObjectTypes.OBJECT_DEVICE, instance: device.deviceId };
            const deviceId = yield this._getDeviceId(device.address, device.SADR, device.deviceId);
            return {
                id: deviceId,
                SADR: device.SADR,
                deviceId,
                name: yield this._getDataValue(device.address, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_OBJECT_NAME),
                address: device.address,
                typeId: objectId.type,
                type: BacnetUtilities_1.BacnetUtilities._getObjectTypeByCode(objectId.type),
                description: yield this._getDataValue(device.address, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_DESCRIPTION),
                segmentation: device.segmentation || (yield this._getDataValue(device.address, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_SEGMENTATION_SUPPORTED)),
                vendorId: device.vendorId || (yield this._getDataValue(device.address, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_VENDOR_IDENTIFIER)),
                maxApdu: device.maxApdu || (yield this._getDataValue(device.address, device.SADR, objectId, GlobalVariables_1.PropertyIds.PROP_MAX_APDU_LENGTH_ACCEPTED))
            };
        });
    }
    _groupByType(itemList) {
        const res = [];
        const obj = lodash.groupBy(itemList, (a) => a.type);
        for (const [key, value] of Object.entries(obj)) {
            res.push({
                id: parseInt(key),
                children: obj[key]
            });
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
            spinalBacnetValueModel.setRecoverState();
            return spinalBacnetValueModel.sensor.get();
        }
        return GlobalVariables_1.SENSOR_TYPES;
    }
    _getObjecListDetails(sensors) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield BacnetUtilities_1.BacnetUtilities.getClient();
            const objectLists = yield BacnetUtilities_1.BacnetUtilities._getDeviceObjectList(this.device, sensors, client);
            const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getObjectDetail(this.device, objectLists.map((el) => el.value), client);
            // console.log("objectListDetails", JSON.stringify(objectListDetails));
            const children = lodash.groupBy(objectListDetails, function (a) { return a.type; });
            return Array.from(Object.keys(children)).map((el) => [el, children[el]]);
        });
    }
    _getDeviceId(deviceAdress, sadr, deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (deviceId && deviceId !== GlobalVariables_1.PropertyIds.MAX_BACNET_PROPERTY_ID)
                return deviceId;
            return BacnetUtilities_1.BacnetUtilities.getDeviceId(deviceAdress, sadr);
        });
    }
}
exports.SpinalDevice = SpinalDevice;
//////////////////////////////////////////////////////////////////////
//             ALL bacnetValues Queue                               //
//////////////////////////////////////////////////////////////////////
const allBacnetValueQueue = new SpinalQueuing_1.default();
allBacnetValueQueue.on("start", () => __awaiter(void 0, void 0, void 0, function* () {
    while (!allBacnetValueQueue.isEmpty()) {
        const { device, node, networkService, spinalBacnetValueModel } = allBacnetValueQueue.dequeue();
        const spinalDevice = new SpinalDevice(device);
        yield spinalDevice.createDeviceItemList(networkService, node, spinalBacnetValueModel);
    }
}));
function addToGetAllBacnetValuesQueue(device, node, networkService, spinalBacnetValueModel) {
    allBacnetValueQueue.addToQueue({ device, node, networkService, spinalBacnetValueModel });
}
exports.addToGetAllBacnetValuesQueue = addToGetAllBacnetValuesQueue;
//# sourceMappingURL=SpinalDevice.js.map