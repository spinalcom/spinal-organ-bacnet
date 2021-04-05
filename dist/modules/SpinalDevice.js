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
const globalVariables_1 = require("../utilities/globalVariables");
const events_1 = require("events");
// export interface IEndpoint {
//    id: string;
//    objectId: { type: number, instance: number };
//    currentValue: number | boolean | string;
// }
class SpinalDevice extends events_1.EventEmitter {
    constructor(device, client, updateTime) {
        super();
        // private itemListCached: Array<{ type: string, instance: number }> = []
        this.chunkLength = 60;
        // private nodeId: string;
        this.endpointGroups = new Map();
        this.children = [];
        this.device = device;
        this.client = client;
        this.updateInterval = updateTime || 15000;
        // this.networkService = networkService;
        // this.node = node;
        this.init();
    }
    init() {
        // this.on("createNodes", this.createStructureNodes);
        // this.on("nodeCreated", this.updateEndpoints);
        return this._getDeviceInfo(this.device).then((deviceInfo) => __awaiter(this, void 0, void 0, function* () {
            this.info = deviceInfo;
            const objectLists = yield this._getDeviceObjectList(this.device);
            // return new Promise((resolve, reject) => {
            const objectListDetails = [];
            objectLists.map(object => {
                return () => {
                    return this._getObjectDetail(this.device, object).then((g) => objectListDetails.push(g));
                };
            }).reduce((previous, current) => { return previous.then(current); }, Promise.resolve()).then(() => {
                const children = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type; });
                // deviceInfo.children = children;
                for (const key in children) {
                    if (Object.prototype.hasOwnProperty.call(children, key)) {
                        this.endpointGroups.set(key, children[key]);
                    }
                }
                this.emit("initialized", this);
            });
            // });
        }));
    }
    createStructureNodes(networkService, node, parentId) {
        this.networkService = networkService;
        if (node) {
            this.node = node;
            // // emit("nodeCreated")
            // return saveAsFile(this);
            return;
        }
        ;
        return this._createDevice(networkService, parentId).then(device => {
            this.node = device;
            // return saveAsFile(this).then((result) => {
            const deviceId = device.id.get();
            const promises = Array.from(this.endpointGroups.keys()).map(el => {
                return this._createEndpointsGroup(networkService, deviceId, el).then(endpointGroup => {
                    const groupId = endpointGroup.id.get();
                    return this._createEndpointByArray(networkService, groupId, this.endpointGroups.get(el));
                });
            });
            return Promise.all(promises).then(() => this.emit("nodeCreated"));
            // })
            // // const node = device;
        });
    }
    convertToString() {
        return JSON.stringify({
            children: this.children,
            id: this.node.id.get(),
            device: this.device
        });
    }
    // public updateEndpoints(networkService: NetworkService) {
    //    setInterval(() => {
    //       console.log("update")
    //       const objectListDetails = [];
    //       this.children.map(object => {
    //          return () => {
    //             return this._getChildrenNewValue(object).then((g) => objectListDetails.push(g))
    //          }
    //       }).reduce((previous, current) => { return previous.then(current) }, Promise.resolve()).then(() => {
    //          const obj: any = {
    //             id: this.device.deviceId,
    //             children: this._groupByType(lodash.flattenDeep(objectListDetails))
    //          }
    //          networkService.updateData(obj)
    //       })
    //    }, 5000);
    //    // // const promises = this.children.map(el => {
    //    // //    return .checkAndUpdateCurrentValue();
    //    // // })
    //    // // console.log("updateEndpoints", promises)
    // }
    //////////////////////////////////////////////////////////////////////////////
    ////                      PRIVATES                                        ////
    //////////////////////////////////////////////////////////////////////////////
    // _getChildrenNewValue(children: Array<{ type: string, instance: number }>) {
    //    const requestArray = children.map(el => {
    //       return {
    //          objectId: el,
    //          properties: [{ id: PropertyIds.PROP_PRESENT_VALUE }]
    //       }
    //    })
    //    return new Promise((resolve, reject) => {
    //       this.client.readPropertyMultiple(this.device.address, requestArray, (err, data) => {
    //          if (err) {
    //             console.error(err)
    //             reject(err);
    //             return;
    //          }
    //          const dataFormated = data.values.map(el => {
    //             const value = this._getObjValue(el.values[0].value);
    //             return {
    //                id: el.objectId.instance,
    //                type: el.objectId.type,
    //                currentValue: this._formatCurrentValue(value, el.objectId.type)
    //             }
    //          })
    //          resolve(dataFormated);
    //       })
    //    });
    // }
    _createDevice(networkService, parentId) {
        // const parentId = (<any>networkService).networkId;
        return networkService.createNewBmsDevice(parentId, this.info);
    }
    _createEndpointsGroup(networkService, deviceId, groupName) {
        const obj = {
            name: groupName,
            id: globalVariables_1.ObjectTypes[`object_${groupName}`.toUpperCase()],
            type: groupName,
            path: ""
        };
        return networkService.createNewBmsEndpointGroup(deviceId, obj);
    }
    _createEndpointByArray(networkService, groupId, endpointArray) {
        const promises = endpointArray.map(el => this._createEndpoint(networkService, groupId, el));
        return Promise.all(promises);
    }
    _createEndpoint(networkService, groupId, endpointObj) {
        return __awaiter(this, void 0, void 0, function* () {
            const obj = {
                id: endpointObj.id,
                typeId: endpointObj.typeId,
                name: endpointObj.object_name,
                path: "",
                currentValue: this._formatCurrentValue(endpointObj.present_value, endpointObj.objectId.type),
                unit: endpointObj.units,
                type: endpointObj.type,
            };
            // const nodeInfo = await this.networkService.createNewBmsEndpoint(groupId, obj);
            // this.children.push({ objectId: endpointObj.objectId, currentValue: endpointObj.present_value });
            // return nodeInfo;
            return networkService.createNewBmsEndpoint(groupId, obj);
            ;
        });
    }
    // private _getChunkObjectDetail(device: IDevice, groupName: string, chunkedObjArray: Array<Array<{ type: string, instance: number }>>) {
    //    return new Promise((resolve, reject) => {
    //       const objectListDetails = [];
    //       chunkedObjArray.map(object => {
    //          return () => {
    //             return this._getObjectDetail(device, object).then((g) => objectListDetails.push(g))
    //          }
    //       }).reduce((previous, current) => { return previous.then(current) }, Promise.resolve()).then(() => {
    //          resolve({ name: groupName, children: [].concat.apply([], objectListDetails) })
    //       })
    //    });
    // }
    _getDeviceObjectList(device) {
        return new Promise((resolve, reject) => {
            // if (this.itemListCached.length > 0) {
            //    return resolve(lodash.chunk(this.itemListCached, this.chunkLength))
            // }
            const sensor = [];
            // const response = {};
            this.client.readProperty(device.address, { type: globalVariables_1.ObjectTypes.OBJECT_DEVICE, instance: device.deviceId }, globalVariables_1.PropertyIds.PROP_OBJECT_LIST, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                for (const item of res.values) {
                    if (globalVariables_1.SENSOR_TYPES.indexOf(item.value.type) !== -1) {
                        // const property = this._getObjectTypeByCode(item.value.type);
                        // if (typeof response[property] === "undefined") response[property] = [];
                        // response[property].push(item.value);
                        // this.itemListCached.push(item.value);
                        sensor.push(item.value);
                    }
                }
                // for (const key in response) {
                //    if (Object.prototype.hasOwnProperty.call(response, key)) {
                //       response[key] = lodash.chunk(response[key], this.chunkLength)
                //    }
                // }
                // resolve(response);
                this.children = lodash.chunk(sensor, this.chunkLength);
                resolve(this.children);
            });
        });
    }
    _getObjectDetail(device, objects) {
        const requestArray = objects.map(el => ({
            objectId: JSON.parse(JSON.stringify(el)),
            properties: [
                // { id: PropertyIds.PROP_ALL }
                { id: globalVariables_1.PropertyIds.PROP_OBJECT_NAME },
                { id: globalVariables_1.PropertyIds.PROP_PRESENT_VALUE },
                { id: globalVariables_1.PropertyIds.PROP_OBJECT_TYPE },
                { id: globalVariables_1.PropertyIds.PROP_UNITS },
            ]
        }));
        return new Promise((resolve, reject) => {
            this.client.readPropertyMultiple(device.address, requestArray, (err, data) => {
                if (err) {
                    console.error(err);
                    reject(err);
                    return;
                }
                const dataFormated = data.values.map(el => {
                    const formated = this._formatProperty(device.deviceId, el);
                    if (typeof formated.units === "object")
                        formated.units = "";
                    else
                        formated.units = this._getUnitsByCode(formated.units);
                    return formated;
                });
                resolve(dataFormated);
            });
        });
    }
    _getDeviceInfo(device) {
        const requestArray = [
            {
                objectId: { type: globalVariables_1.ObjectTypes.OBJECT_DEVICE, instance: device.deviceId },
                properties: [
                    { id: globalVariables_1.PropertyIds.PROP_ALL },
                ]
            },
            {
                objectId: { type: 332, instance: device.deviceId },
                properties: [
                    { id: globalVariables_1.PropertyIds.PROP_ALL },
                ]
            }
        ];
        return new Promise((resolve, reject) => {
            this.client.readPropertyMultiple(device.address, requestArray, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                const dataFormated = data.values.map(el => this._formatProperty(device.deviceId, el));
                const obj = {
                    id: device.deviceId,
                    address: device.address,
                    name: dataFormated[0][this._getPropertyNameByCode(globalVariables_1.PropertyIds.PROP_OBJECT_NAME)],
                    type: dataFormated[0].type
                    // type: this._getObjectTypeByCode(dataFormated[0][this._getPropertyNameByCode(PropertyIds.PROP_OBJECT_TYPE)][0])
                };
                resolve(obj);
            });
        });
        // return {
        //    id: this.device.deviceId,
        //    name: "string",
        //    type: "string",
        //    path: "string",
        // }
    }
    _getPropertyNameByCode(type) {
        const property = globalVariables_1.PropertyNames[type];
        if (property)
            return property.toLocaleLowerCase().replace('prop_', '');
        return;
    }
    _getObjectTypeByCode(typeCode) {
        const property = globalVariables_1.ObjectTypesCode[typeCode];
        if (property)
            return property.toLocaleLowerCase().replace('object_', '');
        return;
    }
    _getUnitsByCode(typeCode) {
        const property = globalVariables_1.UNITS_TYPES[typeCode];
        if (property)
            return property.toLocaleLowerCase().replace('units_', '').replace("_", " ");
        return;
    }
    _formatProperty(deviceId, object) {
        if (object) {
            const { objectId, values } = object;
            const obj = {
                objectId: objectId,
                id: objectId.instance,
                typeId: objectId.type,
                type: this._getObjectTypeByCode(objectId.type),
                instance: objectId.instance,
                deviceId: deviceId
            };
            for (const { id, value } of values) {
                const propertyName = this._getPropertyNameByCode(id);
                if (propertyName) {
                    obj[propertyName] = this._getObjValue(value);
                }
            }
            return obj;
        }
    }
    _getObjValue(value) {
        if (Array.isArray(value)) {
            if (value.length === 0)
                return "";
            return value[0].value;
        }
        return value.value;
    }
    // private _groupByType(itemList) {
    //    const res = []
    //    const obj = lodash.groupBy(itemList, (a) => a.type);
    //    for (const [key, value] of Object.entries(obj)) {
    //       res.push({
    //          id: parseInt(key),
    //          children: obj[key]
    //       })
    //    }
    //    return res;
    // }
    _formatCurrentValue(value, type) {
        if ([globalVariables_1.ObjectTypes.OBJECT_BINARY_INPUT, globalVariables_1.ObjectTypes.OBJECT_BINARY_VALUE].indexOf(type) !== -1) {
            return value ? true : false;
        }
        return value;
    }
}
exports.SpinalDevice = SpinalDevice;
//# sourceMappingURL=SpinalDevice.js.map