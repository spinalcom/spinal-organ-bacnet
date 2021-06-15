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
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const events_1 = require("events");
// import { store } from "../store";
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
class SpinalDevice extends events_1.EventEmitter {
    // private updateInterval: number;
    constructor(device, client) {
        super();
        this.chunkLength = 60;
        this.children = [];
        this.device = device;
        this.client = client;
        // this.updateInterval = updateTime || 15000;
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
        return __awaiter(this, void 0, void 0, function* () {
            const client = new bacnet();
            const deviceId = node.getId().get();
            let sensors;
            if (spinalBacnetValueModel) {
                // console.log("sensors", spinalBacnetValueModel.sensor.get());
                sensors = spinalBacnetValueModel.sensor.get();
                spinalBacnetValueModel.setRecoverState();
            }
            else {
                sensors = GlobalVariables_1.SENSOR_TYPES;
            }
            const objectLists = yield this._getDeviceObjectList(this.device, sensors, client);
            const objectListDetails = yield this._getAllObjectDetails(objectLists, client);
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
                    spinalBacnetValueModel.setErrorState();
                    return;
                }
                spinalBacnetValueModel.setSuccessState();
            }
            // // return spinalBacnetValueModel.remToNode().then(() => {
            // //    console.log("removed");
            // //    resolve(true)
            // // })
            // return this._getDeviceObjectList(this.device, sensors, client).then((objectLists) => {
            //    // const objectListDetails = [];
            //    console.log("object list found", objectLists);
            //    return this._getAllObjectDetails(objectLists, client).then((objectListDetails) => {
            //       console.log("objectDetails Found", objectListDetails);
            //       const children = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type });
            //       const listes = Array.from(Object.keys(children)).map((el: string) => {
            //          return [el, children[el]];
            //       })
            //       return new Promise((resolve, reject) => {
            //          this.createItemRecur(listes, networkService, deviceId, listes.length, spinalBacnetValueModel, resolve);
            //       });
            //    })
            // })
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
            BacnetUtilities_1.BacnetUtilities._createEndpointsGroup(networkService, deviceId, key).then((endpointGroup) => __awaiter(this, void 0, void 0, function* () {
                const groupId = endpointGroup.id.get();
                yield BacnetUtilities_1.BacnetUtilities._createEndpointByArray(networkService, groupId, value);
                return;
            })).then(() => {
                const percent = Math.floor((100 * (maxLength - liste.length)) / maxLength);
                console.log("percent inside success", percent);
                spinalBacnetValueModel.progress.set(percent);
                this.createItemRecur(liste, networkService, deviceId, maxLength, spinalBacnetValueModel, resolve);
            }).catch((err) => {
                console.log(err);
                const percent = Math.floor((100 * (maxLength - liste.length)) / maxLength);
                console.log("percent inside catch", percent);
                spinalBacnetValueModel.progress.set(percent);
                this.createItemRecur(liste, networkService, deviceId, maxLength, spinalBacnetValueModel, resolve);
            });
        }
        else {
            spinalBacnetValueModel.setSuccessState();
            console.log("success");
            resolve(true);
            // return spinalBacnetValueModel.remToNode().then(() => {
            //    console.log("removed");
            //    resolve(true)
            // })
        }
    }
    _createDevice(networkService, parentId) {
        return networkService.createNewBmsDevice(parentId, this.info);
    }
    _getDeviceObjectList(device, SENSOR_TYPES, argClient) {
        console.log("getting object list");
        return new Promise((resolve, reject) => {
            const client = argClient || new bacnet();
            const sensor = [];
            // client.readProperty(device.address, { type: ObjectTypes.OBJECT_DEVICE, instance: device.deviceId }, PropertyIds.PROP_OBJECT_LIST, (err, res) => {
            //    if (err) {
            //       reject(err);
            //       return;
            //    }
            //    for (const item of res.values) {
            //       if (SENSOR_TYPES.indexOf(item.value.type) !== -1) {
            //          sensor.push(item.value);
            //       }
            //    }
            //    this.children = lodash.chunk(sensor, this.chunkLength)
            //    client.close();
            //    resolve(this.children);
            // })
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
                // client.close();
                resolve(this.children);
                // const dataFormated = data.values.map(el => BacnetUtilities._formatProperty(device.deviceId, el))
                // const obj = {
                //    id: device.deviceId,
                //    deviceId: device.deviceId,
                //    address: device.address,
                //    name: dataFormated[0][BacnetUtilities._getPropertyNameByCode(PropertyIds.PROP_OBJECT_NAME)],
                //    type: dataFormated[0].type
                // }
            });
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
                const dataFormated = data.values.map(el => BacnetUtilities_1.BacnetUtilities._formatProperty(device.deviceId, el));
                const obj = {
                    id: device.deviceId,
                    deviceId: device.deviceId,
                    address: device.address,
                    name: dataFormated[0][BacnetUtilities_1.BacnetUtilities._getPropertyNameByCode(GlobalVariables_1.PropertyIds.PROP_OBJECT_NAME)],
                    type: dataFormated[0].type
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
        console.log("getting object details");
        const objectListDetails = [];
        return new Promise((resolve, reject) => {
            objectLists.map(object => {
                return () => {
                    return BacnetUtilities_1.BacnetUtilities._getObjectDetail(this.device, object, client).then((g) => objectListDetails.push(g));
                };
            }).reduce((previous, current) => { return previous.then(current); }, Promise.resolve()).then(() => {
                resolve(objectListDetails);
            });
        });
    }
}
exports.SpinalDevice = SpinalDevice;
//# sourceMappingURL=SpinalDevice.js.map