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
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const events_1 = require("events");
// import { store } from "../store";
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
class SpinalDevice extends events_1.EventEmitter {
    constructor(device, client, networkService) {
        super();
        this.chunkLength = 60;
        this.children = [];
        this.device = device;
        this.client = client || new bacnet();
        this.networkService = networkService || new spinal_model_bmsnetwork_1.NetworkService(false);
    }
    init() {
        return this._getDeviceInfo(this.device).then((deviceInfo) => __awaiter(this, void 0, void 0, function* () {
            this.info = deviceInfo;
            this.emit("initialized", this);
        })).catch((err) => this.emit("error", err));
    }
    createStructureNodes(networkService, node, parentId) {
        this.networkService = networkService;
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
            const objectLists = yield this._getDeviceObjectList(this.device, sensors, this.client);
            const objectListDetails = yield this._getAllObjectDetails(objectLists, this.client);
            const children = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type; });
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
            const client = new bacnet();
            const children = lodash.chunk(objectIds, 60);
            const objectListDetails = yield this._getAllObjectDetails(children, client);
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
                const objectListDetails = yield BacnetUtilities_1.BacnetUtilities._getChildrenNewValue(client, this.device.address, children);
                const obj = {
                    id: this.device.idNetwork,
                    children: this._groupByType(lodash.flattenDeep(objectListDetails))
                };
                networkService.updateData(obj, null, networkNode);
            }
            catch (error) {
                // console.log(`${new Date()} ===> error ${(<any>this.device).name}`)
                console.error(error);
            }
        });
    }
    //////////////////////////////////////////////////////////////////////////////
    ////                      PRIVATES                                        ////
    //////////////////////////////////////////////////////////////////////////////
    _createDevice(networkService, parentId) {
        return networkService.createNewBmsDevice(parentId, this.info);
    }
    _getDeviceObjectList(device, SENSOR_TYPES, argClient) {
        console.log("getting object list");
        return new Promise((resolve, reject) => {
            try {
                const client = argClient || new bacnet();
                const sensor = [];
                const requestArray = [
                    {
                        objectId: { type: GlobalVariables_1.ObjectTypes.OBJECT_DEVICE, instance: device.deviceId },
                        properties: [
                            { id: GlobalVariables_1.PropertyIds.PROP_OBJECT_LIST },
                        ]
                    }
                ];
                client.readPropertyMultiple(device.address, requestArray, (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    const values = this._formatMultipleProperty(data.values);
                    for (const item of values) {
                        if (SENSOR_TYPES.indexOf(item.value.type) !== -1) {
                            sensor.push(item.value);
                        }
                    }
                    this.children = lodash.chunk(sensor, this.chunkLength);
                    resolve(this.children);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    _getDeviceInfo(device) {
        const client = this.client || new bacnet();
        const requestArray = [
            {
                objectId: { type: GlobalVariables_1.ObjectTypes.OBJECT_DEVICE, instance: device.deviceId },
                properties: [
                    { id: GlobalVariables_1.PropertyIds.PROP_OBJECT_NAME },
                ]
            }
        ];
        return new Promise((resolve, reject) => {
            client.readPropertyMultiple(device.address, requestArray, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                const [dataFormated] = data.values.map(el => BacnetUtilities_1.BacnetUtilities._formatProperty(device.deviceId, el));
                const tempName = dataFormated[BacnetUtilities_1.BacnetUtilities._getPropertyNameByCode(GlobalVariables_1.PropertyIds.PROP_OBJECT_NAME)];
                const obj = {
                    id: device.deviceId,
                    deviceId: device.deviceId,
                    address: device.address,
                    name: (tempName === null || tempName === void 0 ? void 0 : tempName.length) > 0 ? tempName : `Device_${device.deviceId}`,
                    type: dataFormated.type
                };
                resolve(obj);
            });
        });
    }
    _formatMultipleProperty(data) {
        return lodash.flattenDeep(data.map(object => {
            const { objectId, values } = object;
            return values.map(({ id, value }) => {
                return value;
            });
        }));
    }
    _getAllObjectDetails(objectLists, client) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("getting object details");
            try {
                const objectListDetails = [];
                while (objectLists.length > 0) {
                    const object = objectLists.shift();
                    if (object) {
                        const res = yield BacnetUtilities_1.BacnetUtilities._getObjectDetail(this.device, object, client);
                        objectListDetails.push(res);
                    }
                }
                return objectListDetails;
            }
            catch (error) {
                return [];
            }
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
}
exports.SpinalDevice = SpinalDevice;
//# sourceMappingURL=SpinalDevice.js.map