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
exports.BacnetUtilities = void 0;
const bacnet = require("bacstack");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const GlobalVariables_1 = require("./GlobalVariables");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
class BacnetUtilities {
    constructor() { }
    static _getObjectDetail(device, objects, argClient) {
        const client = argClient || new bacnet();
        const requestArray = objects.map(el => ({
            objectId: JSON.parse(JSON.stringify(el)),
            properties: [
                { id: GlobalVariables_1.PropertyIds.PROP_OBJECT_NAME },
                { id: GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE },
                { id: GlobalVariables_1.PropertyIds.PROP_OBJECT_TYPE },
                { id: GlobalVariables_1.PropertyIds.PROP_UNITS },
                { id: GlobalVariables_1.PropertyIds.PROP_MAXIMUM_VALUE },
                { id: GlobalVariables_1.PropertyIds.PROP_MINIMUM_VALUE }
            ]
        }));
        // console.log(device, requestArray);
        return new Promise((resolve, reject) => {
            client.readPropertyMultiple(device.address, requestArray, (err, data) => {
                if (err) {
                    console.error(err);
                    client.close();
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
    static _getChildrenNewValue(client, address, children) {
        client = client || new bacnet();
        const requestArray = children.map(el => {
            return {
                objectId: el,
                properties: [{ id: GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE }]
            };
        });
        return new Promise((resolve, reject) => {
            client.readPropertyMultiple(address, requestArray, (err, data) => {
                if (err) {
                    // console.error(err)
                    reject(err);
                    return;
                }
                const dataFormated = data.values.map(el => {
                    const value = this._getObjValue(el.values[0].value);
                    return {
                        id: el.objectId.instance,
                        type: el.objectId.type,
                        currentValue: this._formatCurrentValue(value, el.objectId.type)
                    };
                });
                client.close();
                resolve(dataFormated);
            });
        });
    }
    static _formatProperty(deviceId, object) {
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
    static _getObjValue(value) {
        var _a;
        let temp_value = Array.isArray(value) ? (_a = value[0]) === null || _a === void 0 ? void 0 : _a.value : value.value;
        return typeof temp_value === "object" ? "" : temp_value;
        // if (Array.isArray(value)) {
        //    if (value.length === 0 || typeof value[0].value === "object") return "";
        //    return value[0].value;
        // }
        // return value.value;
    }
    static _formatCurrentValue(value, type) {
        if ([GlobalVariables_1.ObjectTypes.OBJECT_BINARY_INPUT, GlobalVariables_1.ObjectTypes.OBJECT_BINARY_VALUE].indexOf(type) !== -1) {
            return value ? true : false;
        }
        return value;
    }
    static _getPropertyNameByCode(type) {
        const property = GlobalVariables_1.PropertyNames[type];
        if (property)
            return property.toLocaleLowerCase().replace('prop_', '');
        return;
    }
    static _getObjectTypeByCode(typeCode) {
        const property = GlobalVariables_1.ObjectTypesCode[typeCode];
        if (property)
            return property.toLocaleLowerCase().replace('object_', '');
        return;
    }
    static _getUnitsByCode(typeCode) {
        const property = GlobalVariables_1.UNITS_TYPES[typeCode];
        if (property)
            return property.toLocaleLowerCase().replace('units_', '').replace("_", " ");
        return;
    }
    static createEndpointsInGroup(networkService, deviceId, groupName, endpointArray) {
        return __awaiter(this, void 0, void 0, function* () {
            const endpointGroup = yield this._createEndpointsGroup(networkService, deviceId, groupName);
            const groupId = endpointGroup.id.get();
            return this._createEndpointByArray(networkService, groupId, endpointArray);
        });
    }
    static _createEndpointsGroup(networkService, deviceId, groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            const networkId = GlobalVariables_1.ObjectTypes[`object_${groupName}`.toUpperCase()];
            const exist = yield BacnetUtilities._itemExistInChild(deviceId, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.relationName, networkId);
            if (exist)
                return exist;
            const obj = {
                name: groupName,
                id: networkId,
                type: groupName,
                path: ""
            };
            const endpointGroup = yield networkService.createNewBmsEndpointGroup(deviceId, obj);
            return endpointGroup;
        });
    }
    static _createEndpointByArray(networkService, groupId, endpointArray) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = endpointArray.map(el => this._createEndpoint(networkService, groupId, el));
            const endpoints = yield Promise.all(promises);
            return endpoints;
        });
    }
    static _createEndpoint(networkService, groupId, endpointObj) {
        return __awaiter(this, void 0, void 0, function* () {
            const networkId = endpointObj.id;
            const exist = yield this._itemExistInChild(groupId, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName, networkId);
            if (exist)
                return exist;
            console.log("endpointObj", endpointObj);
            const obj = {
                id: networkId,
                typeId: endpointObj.typeId,
                name: endpointObj.object_name.length > 0 ? endpointObj.object_name : `endpoint_${networkId}`,
                path: "",
                currentValue: this._formatCurrentValue(endpointObj.present_value, endpointObj.objectId.type),
                unit: endpointObj.units,
                type: endpointObj.type,
            };
            return networkService.createNewBmsEndpoint(groupId, obj);
        });
    }
    static _itemExistInChild(parentId, relationName, childNetworkId) {
        return __awaiter(this, void 0, void 0, function* () {
            const children = yield spinal_env_viewer_graph_service_1.SpinalGraphService.getChildren(parentId, [relationName]);
            const found = children.find(el => el.idNetwork.get() == childNetworkId);
            return found;
        });
    }
}
exports.default = BacnetUtilities;
exports.BacnetUtilities = BacnetUtilities;
//# sourceMappingURL=BacnetUtilities.js.map