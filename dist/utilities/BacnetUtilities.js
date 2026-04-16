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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BacnetUtilities = void 0;
const bacnet = __importStar(require("bacstack"));
const GlobalVariables_1 = require("./GlobalVariables");
const SpinalCov_1 = require("../modules/SpinalCov");
const uuid_1 = require("uuid");
const node_ipc_1 = __importDefault(require("node-ipc"));
const spinal_bacnet_service_1 = require("spinal-bacnet-service");
class BacnetUtilitiesClass {
    constructor() {
        this._client = null;
        this._ipcClient = null;
        this.clientState = {
            consecutiveFailures: 0
        };
    }
    static getInstance() {
        if (!this.instance)
            this.instance = new BacnetUtilitiesClass();
        return this.instance;
    }
    initAndConnect() {
        return __awaiter(this, void 0, void 0, function* () {
            this._ipcClient = yield this._connectToServer();
            this._ipcClient.on('disconnect', () => __awaiter(this, void 0, void 0, function* () {
                this._ipcClient = yield this._connectToServer();
            }));
            console.log("connected to bacnet service");
            this._ipcClient.on(spinal_bacnet_service_1.BACNET_COV_EVENT_NAME, (result) => {
                SpinalCov_1.SpinalCov.getInstance().emit(result.eventName, result);
            });
        });
    }
    _connectToServer() {
        return new Promise((resolve, reject) => {
            var _a;
            const serverServiceName = spinal_bacnet_service_1.SERVICE_NAME;
            const clientServiceName = process.env.ORGAN_NAME || "spinal-organ-bacnet";
            node_ipc_1.default.config.id = clientServiceName; // Set the IPC client ID to the organ name or a default value
            node_ipc_1.default.config.retry = 5000; // Retry every 5 seconds if connection to server is lost 
            node_ipc_1.default.config.silent = true; // Disable IPC debug logs
            const bacnetServicePort = (_a = process.env.BACNET_SERVICE_PORT) === null || _a === void 0 ? void 0 : _a.trim();
            const ipcServerPort = bacnetServicePort ? parseInt(bacnetServicePort) : 47810;
            node_ipc_1.default.connectToNet(serverServiceName, "127.0.0.1", ipcServerPort, () => {
                this._ipcClient = node_ipc_1.default.of[serverServiceName];
                resolve(node_ipc_1.default.of[serverServiceName]);
            });
        });
    }
    createNewBacnetClient() {
        const client = new bacnet({ adpuTimeout: 10000 });
        return client;
    }
    getClient() {
        return new Promise((resolve) => {
            if (!this._client)
                this._client = this.createNewBacnetClient();
            return resolve(this._client);
        });
    }
    sendCovRequest(data) {
        if (this._ipcClient)
            this._ipcClient.emit(spinal_bacnet_service_1.COV_EVENT_NAME, data);
    }
    ////////////////////////////////////////////////////////////////
    ////                  GET ALL BACNET OBJECT LIST              //
    ////////////////////////////////////////////////////////////////
    _getDeviceObjectList(device_1, SENSOR_TYPES_1) {
        return __awaiter(this, arguments, void 0, function* (device, SENSOR_TYPES, getListUsingFragment = false) {
            return this._sendDataToBacnetServer("_getDeviceObjectList", [device, SENSOR_TYPES, getListUsingFragment]);
        });
    }
    getItemListByFragment(device, objectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("getItemListByFragment", [device, objectId]);
        });
    }
    ////////////////////////////////////////////////////////////////
    ////                  GET OBJECT DETAIL                       //
    ////////////////////////////////////////////////////////////////
    _getObjectDetail(device, objects) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("_getObjectDetail", [device, objects]);
        });
    }
    _getObjectDetailWithReadPropertyMultiple(device, objects) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("_getObjectDetailWithReadPropertyMultiple", [device, objects]);
        });
    }
    _getObjectDetailWithReadProperty(device, objectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("_getObjectDetailWithReadProperty", [device, objectId]);
        });
    }
    _getChildrenNewValue(device, children) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("_getChildrenNewValue", [device, children]);
        });
    }
    //////////////////////////////////////////////////////////////////////
    ////                             OTHER UTILITIES                  ////
    //////////////////////////////////////////////////////////////////////
    _getPropertyValue(address, sadr, objectId, propertyId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("_getPropertyValue", [address, sadr, objectId, propertyId]);
        });
    }
    getDeviceId(address, sadr) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._sendDataToBacnetServer("getDeviceId", [address, sadr]);
        });
    }
    sendPilotRequest(request) {
        return this._sendDataToBacnetServer("writeProperty", [request]);
    }
    /////////////////////////////////////////////////////////
    //                         UTILS                      // 
    ////////////////////////////////////////////////////////
    _getObjValue(value) {
        var _a;
        if (typeof value !== "object")
            return value;
        let temp_value = Array.isArray(value) ? (_a = value[0]) === null || _a === void 0 ? void 0 : _a.value : value.value;
        return typeof temp_value === "object" ? "" : temp_value;
    }
    _getPropertyNameByCode(type) {
        const property = GlobalVariables_1.PropertyNames[type];
        if (property)
            return property.toLocaleLowerCase().replace('prop_', '');
        return;
    }
    _getObjectTypeByCode(typeCode) {
        const property = GlobalVariables_1.ObjectTypesCode[typeCode];
        if (property)
            return property.toLocaleLowerCase().replace('object_', '');
        return;
    }
    _sendDataToBacnetServer(functionName, parameters) {
        return new Promise((resolve, reject) => {
            const params = {
                name: functionName,
                id: (0, uuid_1.v4)(),
                parameters: parameters
            };
            this._ipcClient.emit(spinal_bacnet_service_1.MESSAGE_EVENT_NAME, (params));
            this._ipcClient.once(`${spinal_bacnet_service_1.RESPONSE_EVENT_NAME}_${params.id}`, (response) => {
                if (response.status === "error") {
                    return reject({ message: response.error });
                }
                resolve(response.data);
            });
        });
    }
}
const BacnetUtilities = BacnetUtilitiesClass.getInstance();
exports.BacnetUtilities = BacnetUtilities;
exports.default = BacnetUtilities;
//# sourceMappingURL=BacnetUtilities.js.map