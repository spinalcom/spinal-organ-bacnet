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
const globalVariables_1 = require("../utilities/globalVariables");
const events_1 = require("events");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
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
            // this.node = node;
            // return Promise.resolve(true);
            return;
        }
        ;
        return this._createDevice(networkService, parentId);
        /*
           .then(device => {
              this.node = device;
              // return saveAsFile(this).then((result) => {
              const deviceId = device.id.get();
  
  
              return this._getDeviceObjectList(this.device).then((objectLists) => {
                 const objectListDetails = [];
  
                 return objectLists.map(object => {
                    return () => {
                       return this._getObjectDetail(this.device, object).then((g) => objectListDetails.push(g))
                    }
                 }).reduce((previous, current) => { return previous.then(current) }, Promise.resolve()).then(() => {
                    const children = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type });
  
  
                    const promises = Array.from(Object.keys(children)).map((el: string) => {
                       return this._createEndpointsGroup(networkService, deviceId, el).then(endpointGroup => {
                          const groupId = endpointGroup.id.get();
                          return this._createEndpointByArray(networkService, groupId, children[el]);
                       })
                    })
  
                    return Promise.all(promises)
  
                 })
  
              })
           })
        */
    }
    createDeviceItemList(networkService, node, sensors) {
        // return saveAsFile(this).then((result) => {
        const deviceId = node.getId().get();
        return this._getDeviceObjectList(this.device, sensors).then((objectLists) => {
            const objectListDetails = [];
            return objectLists.map(object => {
                return () => {
                    return this._getObjectDetail(this.device, object).then((g) => objectListDetails.push(g));
                };
            }).reduce((previous, current) => { return previous.then(current); }, Promise.resolve()).then(() => {
                const children = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type; });
                const promises = Array.from(Object.keys(children)).map((el) => {
                    return this._createEndpointsGroup(networkService, deviceId, el).then(endpointGroup => {
                        const groupId = endpointGroup.id.get();
                        return this._createEndpointByArray(networkService, groupId, children[el]);
                    });
                });
                return Promise.all(promises);
            });
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
    _createDevice(networkService, parentId) {
        return networkService.createNewBmsDevice(parentId, this.info);
    }
    _createEndpointsGroup(networkService, deviceId, groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            const networkId = globalVariables_1.ObjectTypes[`object_${groupName}`.toUpperCase()];
            const exist = yield this._itemExistInChild(deviceId, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.relationName, networkId);
            if (exist)
                return exist;
            const obj = {
                name: groupName,
                id: networkId,
                type: groupName,
                path: ""
            };
            return networkService.createNewBmsEndpointGroup(deviceId, obj);
        });
    }
    _createEndpointByArray(networkService, groupId, endpointArray) {
        const promises = endpointArray.map(el => this._createEndpoint(networkService, groupId, el));
        return Promise.all(promises);
    }
    _createEndpoint(networkService, groupId, endpointObj) {
        return __awaiter(this, void 0, void 0, function* () {
            const networkId = endpointObj.id;
            const exist = yield this._itemExistInChild(groupId, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName, networkId);
            if (exist)
                return exist;
            const obj = {
                id: networkId,
                typeId: endpointObj.typeId,
                name: endpointObj.object_name,
                path: "",
                currentValue: this._formatCurrentValue(endpointObj.present_value, endpointObj.objectId.type),
                unit: endpointObj.units,
                type: endpointObj.type,
            };
            return networkService.createNewBmsEndpoint(groupId, obj);
            ;
        });
    }
    _getDeviceObjectList(device, SENSOR_TYPES) {
        return new Promise((resolve, reject) => {
            this.client = new bacnet({ adpuTimeout: 45000 });
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
                resolve(this.children);
            });
        });
    }
    _getObjectDetail(device, objects) {
        const requestArray = objects.map(el => ({
            objectId: JSON.parse(JSON.stringify(el)),
            properties: [
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
                const dataFormated = data.values.map(el => this._formatProperty(device.deviceId, el));
                const obj = {
                    id: device.deviceId,
                    deviceId: device.deviceId,
                    address: device.address,
                    name: dataFormated[0][this._getPropertyNameByCode(globalVariables_1.PropertyIds.PROP_OBJECT_NAME)],
                    type: dataFormated[0].type
                };
                resolve(obj);
            });
        });
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
    _formatCurrentValue(value, type) {
        if ([globalVariables_1.ObjectTypes.OBJECT_BINARY_INPUT, globalVariables_1.ObjectTypes.OBJECT_BINARY_VALUE].indexOf(type) !== -1) {
            return value ? true : false;
        }
        return value;
    }
    _itemExistInChild(parentId, relationName, childNetworkId) {
        return __awaiter(this, void 0, void 0, function* () {
            const children = yield spinal_env_viewer_graph_service_1.SpinalGraphService.getChildren(parentId, [relationName]);
            const found = children.find(el => el.idNetwork.get() == childNetworkId);
            return found;
        });
    }
}
exports.SpinalDevice = SpinalDevice;
//# sourceMappingURL=SpinalDevice.js.map