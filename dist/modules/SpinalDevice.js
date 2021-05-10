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
const globalVariables_1 = require("../utilities/globalVariables");
const events_1 = require("events");
// import { store } from "../store";
const bacnetUtilities_1 = require("../utilities/bacnetUtilities");
class SpinalDevice extends events_1.EventEmitter {
    constructor(device, client, updateTime) {
        super();
        this.chunkLength = 60;
        this.endpointGroups = new Map();
        this.children = [];
        this.device = device;
        this.client = client;
        this.updateInterval = updateTime || 15000;
        // this.init();
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
        const deviceId = node.getId().get();
        let sensors;
        if (spinalBacnetValueModel) {
            console.log("sensors", spinalBacnetValueModel.sensor.get());
            sensors = spinalBacnetValueModel.sensor.get();
            spinalBacnetValueModel.setRecoverState();
        }
        else {
            sensors = globalVariables_1.SENSOR_TYPES;
        }
        spinalBacnetValueModel.setProgressState();
        return this._getDeviceObjectList(this.device, sensors).then((objectLists) => {
            const objectListDetails = [];
            return objectLists.map(object => {
                return () => {
                    return bacnetUtilities_1.BacnetUtilities._getObjectDetail(this.device, object).then((g) => objectListDetails.push(g));
                };
            }).reduce((previous, current) => { return previous.then(current); }, Promise.resolve()).then(() => __awaiter(this, void 0, void 0, function* () {
                const children = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type; });
                const listes = Array.from(Object.keys(children)).map((el) => {
                    return [el, children[el]];
                });
                return new Promise((resolve, reject) => {
                    this.createItemRecur(listes, networkService, deviceId, listes.length, spinalBacnetValueModel, resolve);
                });
            }));
        });
    }
    convertToString() {
        return JSON.stringify({
            children: this.children,
            id: this.node.id.get(),
            device: this.device
        });
    }
    //////////////////////////////////////////////////////////////////////////////
    ////                      PRIVATES                                        ////
    //////////////////////////////////////////////////////////////////////////////
    createItemRecur(liste, networkService, deviceId, maxLength, spinalBacnetValueModel, resolve) {
        const item = liste.shift();
        if (item) {
            const [key, value] = item;
            bacnetUtilities_1.BacnetUtilities._createEndpointsGroup(networkService, deviceId, key).then(endpointGroup => {
                const groupId = endpointGroup.id.get();
                return bacnetUtilities_1.BacnetUtilities._createEndpointByArray(networkService, groupId, value);
            }).then(() => {
                const percent = Math.floor((100 * (maxLength - liste.length)) / maxLength);
                spinalBacnetValueModel.progress.set(percent);
                this.createItemRecur(liste, networkService, deviceId, maxLength, spinalBacnetValueModel, resolve);
            }).catch(() => {
                const percent = Math.floor((100 * (maxLength - liste.length)) / maxLength);
                spinalBacnetValueModel.progress.set(percent);
                this.createItemRecur(liste, networkService, deviceId, maxLength, spinalBacnetValueModel, resolve);
            });
        }
        else {
            spinalBacnetValueModel.setSuccessState();
            console.log("success");
            return spinalBacnetValueModel.remToNode().then(() => {
                resolve(true);
            });
        }
    }
    _createDevice(networkService, parentId) {
        return networkService.createNewBmsDevice(parentId, this.info);
    }
    _getDeviceObjectList(device, SENSOR_TYPES) {
        return new Promise((resolve, reject) => {
            this.client = new bacnet();
            const sensor = [];
            this.client.readProperty(device.address, { type: globalVariables_1.ObjectTypes.OBJECT_DEVICE, instance: device.deviceId }, globalVariables_1.PropertyIds.PROP_OBJECT_LIST, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                for (const item of res.values) {
                    if (SENSOR_TYPES.indexOf(item.value.type) !== -1) {
                        sensor.push(item.value);
                    }
                }
                this.children = lodash.chunk(sensor, this.chunkLength);
                this.client.close();
                resolve(this.children);
            });
        });
    }
    _getDeviceInfo(device) {
        const requestArray = [
            {
                objectId: { type: globalVariables_1.ObjectTypes.OBJECT_DEVICE, instance: device.deviceId },
                properties: [
                    { id: globalVariables_1.PropertyIds.PROP_OBJECT_NAME },
                ]
            }
        ];
        return new Promise((resolve, reject) => {
            this.client.readPropertyMultiple(device.address, requestArray, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                const dataFormated = data.values.map(el => bacnetUtilities_1.BacnetUtilities._formatProperty(device.deviceId, el));
                const obj = {
                    id: device.deviceId,
                    deviceId: device.deviceId,
                    address: device.address,
                    name: dataFormated[0][bacnetUtilities_1.BacnetUtilities._getPropertyNameByCode(globalVariables_1.PropertyIds.PROP_OBJECT_NAME)],
                    type: dataFormated[0].type
                };
                resolve(obj);
            });
        });
    }
}
exports.SpinalDevice = SpinalDevice;
//# sourceMappingURL=SpinalDevice.js.map