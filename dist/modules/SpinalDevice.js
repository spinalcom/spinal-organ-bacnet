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
exports.SpinalDevice = void 0;
const lodash = require("lodash");
const bacnet = require("bacstack");
const events_1 = require("events");
// import { store } from "../store";
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
class SpinalDevice extends events_1.EventEmitter {
    constructor(device, client, networkService) {
        super();
        this.device = device;
        this.client = client || new bacnet();
    }
    init() {
        return this._getDeviceInfo(this.device).then((deviceInfo) => __awaiter(this, void 0, void 0, function* () {
            this.info = deviceInfo;
            console.log("this.info", this.info);
            this.emit("initialized", this);
        })).catch((err) => this.emit("error", err));
    }
    createStructureNodes(networkService, node, parentId) {
        // this.networkService = networkService;
        if (node) {
            return;
        }
        ;
        return this._createDevice(networkService, parentId);
    }
    createDeviceItemList(networkService, node, spinalBacnetValueModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const deviceId = node.getId().get();
            let sensors;
            if (spinalBacnetValueModel) {
                sensors = spinalBacnetValueModel.sensor.get();
                spinalBacnetValueModel.setRecoverState();
            }
            else {
                sensors = GlobalVariables_1.SENSOR_TYPES;
            }
            const objectLists = yield BacnetUtilities_1.BacnetUtilities._getDeviceObjectList(this.device, sensors, this.client);
            const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getObjectDetail(this.device, objectLists, this.client);
            const children = lodash.groupBy(objectListDetails, function (a) { return a.type; });
            const listes = Array.from(Object.keys(children)).map((el) => [el, children[el]]);
            const maxLength = listes.length;
            let isError = false;
            if (spinalBacnetValueModel) {
                console.log("set progress mode");
                spinalBacnetValueModel.setProgressState();
            }
            while (!isError && listes.length > 0) {
                const item = listes.shift();
                if (item) {
                    const [key, value] = item;
                    try {
                        yield BacnetUtilities_1.BacnetUtilities.createEndpointsInGroup(networkService, deviceId, key, value);
                        if (spinalBacnetValueModel) {
                            const percent = Math.floor((100 * (maxLength - listes.length)) / maxLength);
                            spinalBacnetValueModel.progress.set(percent);
                        }
                    }
                    catch (error) {
                        isError = true;
                    }
                }
            }
            if (spinalBacnetValueModel) {
                if (isError) {
                    console.log("set error model");
                    spinalBacnetValueModel.setErrorState();
                    return;
                }
                console.log("set success model");
                spinalBacnetValueModel.setSuccessState();
            }
        });
    }
    checkAndCreateIfNotExist(networkService, objectIds) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("check and create if not exist");
            const client = new bacnet();
            // const children = lodash.chunk(objectIds, 60);
            // const objectListDetails = await this._getAllObjectDetails(children, client);
            const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getObjectDetail(this.device, objectIds, client);
            const childrenGroups = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type; });
            const promises = Array.from(Object.keys(childrenGroups)).map((el) => {
                return BacnetUtilities_1.BacnetUtilities.createEndpointsInGroup(networkService, this.device.id, el, childrenGroups[el]);
            });
            return Promise.all(promises);
        });
    }
    updateEndpoints(networkService, networkNode, children) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = new bacnet();
                console.log(`${new Date()} ===> update ${this.device.name}`);
                const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getChildrenNewValue(this.device, children, client);
                const obj = {
                    id: this.device.idNetwork,
                    children: this._groupByType(lodash.flattenDeep(objectListDetails))
                };
                networkService.updateData(obj, null, networkNode);
            }
            catch (error) {
                // console.log(`${new Date()} ===> error ${(<any>this.device).name}`)
                // console.error(error);
            }
        });
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
            return {
                name: yield this._getDataValue(device.address, objectId, GlobalVariables_1.PropertyIds.PROP_OBJECT_NAME),
                address: device.address,
                deviceId: device.deviceId,
                segmentation: device.segmentation || (yield this._getDataValue(device.address, objectId, GlobalVariables_1.PropertyIds.PROP_SEGMENTATION_SUPPORTED)),
                // objectId: objectId,
                id: objectId.instance,
                typeId: objectId.type,
                type: BacnetUtilities_1.BacnetUtilities._getObjectTypeByCode(objectId.type),
                // instance: objectId.instance,
                vendorId: device.vendorId || (yield this._getDataValue(device.address, objectId, GlobalVariables_1.PropertyIds.PROP_VENDOR_IDENTIFIER)),
                maxApdu: device.maxApdu || (yield this._getDataValue(device.address, objectId, GlobalVariables_1.PropertyIds.PROP_MAX_APDU_LENGTH_ACCEPTED))
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
    _getDataValue(address, objectId, PropertyId) {
        return __awaiter(this, void 0, void 0, function* () {
            const formated = yield BacnetUtilities_1.BacnetUtilities._getPropertyValue(address, objectId, PropertyId);
            return formated[BacnetUtilities_1.BacnetUtilities._getPropertyNameByCode(PropertyId)];
        });
    }
}
exports.SpinalDevice = SpinalDevice;
//# sourceMappingURL=SpinalDevice.js.map