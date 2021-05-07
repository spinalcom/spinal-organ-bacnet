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
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const globalVariables_1 = require("./globalVariables");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
class BacnetUtilities {
    constructor() { }
    static _getObjectDetail(client, device, objects) {
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
            client.readPropertyMultiple(device.address, requestArray, (err, data) => {
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
        if (Array.isArray(value)) {
            if (value.length === 0)
                return "";
            return value[0].value;
        }
        return value.value;
    }
    static _formatCurrentValue(value, type) {
        if ([globalVariables_1.ObjectTypes.OBJECT_BINARY_INPUT, globalVariables_1.ObjectTypes.OBJECT_BINARY_VALUE].indexOf(type) !== -1) {
            return value ? true : false;
        }
        return value;
    }
    static _getPropertyNameByCode(type) {
        const property = globalVariables_1.PropertyNames[type];
        if (property)
            return property.toLocaleLowerCase().replace('prop_', '');
        return;
    }
    static _getObjectTypeByCode(typeCode) {
        const property = globalVariables_1.ObjectTypesCode[typeCode];
        if (property)
            return property.toLocaleLowerCase().replace('object_', '');
        return;
    }
    static _getUnitsByCode(typeCode) {
        const property = globalVariables_1.UNITS_TYPES[typeCode];
        if (property)
            return property.toLocaleLowerCase().replace('units_', '').replace("_", " ");
        return;
    }
    static _itemExistInChild(parentId, relationName, childNetworkId) {
        return __awaiter(this, void 0, void 0, function* () {
            const children = yield spinal_env_viewer_graph_service_1.SpinalGraphService.getChildren(parentId, [relationName]);
            const found = children.find(el => el.idNetwork.get() == childNetworkId);
            return found;
        });
    }
    static _createEndpointsGroup(networkService, deviceId, groupName) {
        return __awaiter(this, void 0, void 0, function* () {
            const networkId = globalVariables_1.ObjectTypes[`object_${groupName}`.toUpperCase()];
            const exist = yield BacnetUtilities._itemExistInChild(deviceId, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.relationName, networkId);
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
    static _createEndpointByArray(networkService, groupId, endpointArray) {
        const promises = endpointArray.map(el => this._createEndpoint(networkService, groupId, el));
        return Promise.all(promises);
    }
    static _createEndpoint(networkService, groupId, endpointObj) {
        return __awaiter(this, void 0, void 0, function* () {
            const networkId = endpointObj.id;
            const exist = yield BacnetUtilities._itemExistInChild(groupId, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName, networkId);
            if (exist)
                return exist;
            const obj = {
                id: networkId,
                typeId: endpointObj.typeId,
                name: endpointObj.object_name,
                path: "",
                currentValue: BacnetUtilities._formatCurrentValue(endpointObj.present_value, endpointObj.objectId.type),
                unit: endpointObj.units,
                type: endpointObj.type,
            };
            return networkService.createNewBmsEndpoint(groupId, obj);
            ;
        });
    }
}
exports.default = BacnetUtilities;
exports.BacnetUtilities = BacnetUtilities;
//# sourceMappingURL=bacnetUtilities.js.map