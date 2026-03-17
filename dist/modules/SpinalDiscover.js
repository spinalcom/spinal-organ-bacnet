"use strict";
/*
 * Copyright 2022 SpinalCom - www.spinalcom.com
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
exports.spinalDiscover = void 0;
const events_1 = require("events");
const spinal_connector_service_1 = require("spinal-connector-service");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const SpinalDevice_1 = require("./SpinalDevice");
const spinal_connector_service_2 = require("spinal-connector-service");
const SpinalNetworkServiceUtilities_1 = require("../utilities/SpinalNetworkServiceUtilities");
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
const config = require("../../config.js");
class SpinalDiscover {
    constructor(model) {
        var _a, _b;
        this.devices = new Map();
        this.discoverModel = model;
        this.CONNECTION_TIME_OUT = ((_b = (_a = model.network) === null || _a === void 0 ? void 0 : _a.timeout) === null || _b === void 0 ? void 0 : _b.get()) || 15000;
        // this.init(model)
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.client = yield BacnetUtilities_1.default.getClient();
            this._bindState();
        });
    }
    _bindState() {
        this.bindSateProcess = this.discoverModel.state.bind(() => {
            switch (this.discoverModel.state.get()) {
                case spinal_connector_service_2.STATES.discovering:
                    this._discover();
                    break;
                case spinal_connector_service_2.STATES.creating:
                    this._createNodes();
                default:
                    break;
            }
        });
    }
    _discover() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const queue = yield this._getDevicesQueue();
                let isFinished = false;
                const devices = [];
                while (!isFinished) {
                    const item = queue.dequeue();
                    if (typeof item !== "undefined") {
                        const info = yield this._initSpinalDevice(item);
                        if (info)
                            devices.push(info);
                        // if (info) this._addDeviceFound(info);
                    }
                    else {
                        console.log("discovery finished");
                        isFinished = true;
                    }
                }
                // if no device found, set timeout mode
                if (devices.length === 0) {
                    console.log("No device found, timeout !");
                    this.discoverModel.changeState(spinal_connector_service_2.STATES.timeout);
                    return;
                }
                this.discoverModel.setTreeDiscovered(devices);
                this.discoverModel.changeState(spinal_connector_service_2.STATES.discovered);
                console.log("discovered !", devices.length, "device(s) found");
            }
            catch (error) {
                console.log("No device found, timeout !");
                this.discoverModel.changeState(spinal_connector_service_2.STATES.timeout);
            }
        });
    }
    _getDevicesQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const queue = new spinal_connector_service_1.SpinalQueue();
            const useBroadcast = (_b = (_a = this.discoverModel.network) === null || _a === void 0 ? void 0 : _a.useBroadcast) === null || _b === void 0 ? void 0 : _b.get();
            const deviceDiscovered = {};
            return new Promise((resolve, reject) => {
                let timeoutCleared = false;
                // Create a single handler for 'iAm' events to avoid multiple listeners and potential memory leaks
                const iAmHandler = this._createIAmHandler(deviceDiscovered, queue, () => {
                    if (!timeoutCleared) {
                        timeoutCleared = true;
                        clearTimeout(timeOutId);
                    }
                });
                const cleanup = () => this.client.removeListener('iAm', iAmHandler);
                // Register start event BEFORE sending whoIs to avoid race condition
                queue.once("start", () => {
                    if (!useBroadcast)
                        this._addMissingIpsToQueue(queue, deviceDiscovered);
                    cleanup();
                    resolve(queue);
                });
                const timeOutId = setTimeout(() => {
                    if (!useBroadcast) {
                        queue.setQueue([]);
                        return;
                    }
                    cleanup();
                    reject("[TIMEOUT] - Cannot establish connection with BACnet server.");
                }, this.CONNECTION_TIME_OUT);
                this.client.on('iAm', iAmHandler);
                this._sendWhoIsRequests(useBroadcast);
            });
        });
    }
    _createIAmHandler(deviceDiscovered, queue, onFirstDevice) {
        let firstDeviceReceived = false;
        return (device) => {
            console.log("device found", device);
            if (!firstDeviceReceived) {
                firstDeviceReceived = true;
                onFirstDevice();
            }
            const { address, deviceId } = device;
            const key = `${address}-${deviceId}`;
            if (!deviceDiscovered[key]) {
                deviceDiscovered[key] = device;
                queue.addToQueue(device);
            }
        };
    }
    _sendWhoIsRequests(useBroadcast) {
        var _a, _b;
        if (useBroadcast) {
            console.log("discover using broadcast");
            this.client.whoIs({ dest: { net: '65535', adr: [''] } });
        }
        else {
            console.log("discover using unicast");
            const ips = ((_b = (_a = this.discoverModel.network) === null || _a === void 0 ? void 0 : _a.ips) === null || _b === void 0 ? void 0 : _b.get()) || [];
            for (const { address } of ips) {
                this.client.whoIs({
                    address,
                    dest: { net: '65535', adr: [''] }
                });
            }
        }
    }
    _addMissingIpsToQueue(queue, deviceDiscovered) {
        var _a, _b;
        // console.log("queue.once unicast");
        const missingDevices = [];
        const ips = ((_b = (_a = this.discoverModel.network) === null || _a === void 0 ? void 0 : _a.ips) === null || _b === void 0 ? void 0 : _b.get()) || [];
        const ipsFound = Object.values(deviceDiscovered).map((device) => device.address);
        for (const { address, deviceId } of ips) {
            const key = `${address}-${deviceId}`;
            if (!deviceDiscovered[key] && !ipsFound.includes(address)) {
                missingDevices.push({
                    address,
                    deviceId: deviceId || GlobalVariables_1.PropertyIds.MAX_BACNET_PROPERTY_ID
                });
            }
        }
        // console.log("ips not found", missingDevices);
        queue.addToQueue(missingDevices);
    }
    _initSpinalDevice(device) {
        return new Promise((resolve, reject) => {
            const spinalDevice = new SpinalDevice_1.SpinalDevice(device);
            spinalDevice.on("initialized", (res) => {
                const info = res.device;
                if (!info)
                    return resolve();
                this.devices.set(info.deviceId, res);
                resolve(info);
            });
            spinalDevice.on("error", () => {
                console.log(device.address, "not found");
                resolve();
            });
            spinalDevice.init();
        });
    }
    _addDeviceFound(device) {
        this.discoverModel.devices.push(device);
    }
    _createNodes() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("creating nodes in graph...");
            try {
                const queue = yield this._getDevicesSelected(this.discoverModel);
                const { networkService, network } = yield SpinalNetworkServiceUtilities_1.SpinalNetworkServiceUtilities.initSpinalDiscoverNetwork(this.discoverModel);
                const devices = yield this._getDevicesNodes(network.id.get());
                let isFinished = false;
                while (!isFinished) {
                    const device = queue.dequeue();
                    if (typeof device !== "undefined") {
                        const deviceId = device.deviceId;
                        const nodeAlreadyExist = devices[deviceId];
                        if (nodeAlreadyExist)
                            continue;
                        const spinalDevice = this.devices.get(deviceId);
                        if (spinalDevice)
                            yield spinalDevice.createDeviceNodeInGraph(networkService, network.id.get());
                    }
                    else {
                        isFinished = true;
                    }
                }
                this.discoverModel.changeState(spinal_connector_service_2.STATES.created);
                console.log("nodes created with success!");
            }
            catch (error) {
                this.discoverModel.changeState(spinal_connector_service_2.STATES.error);
                console.error("Error creating nodes:", error.message || error);
            }
            finally {
                const state = this.discoverModel.state.get();
                if (state === spinal_connector_service_2.STATES.created) {
                    this.discoverModel.state.unbind(this.bindSateProcess);
                    this.discoverModel.removeFromGraph();
                }
            }
        });
    }
    _getDevicesNodes(id) {
        const obj = {};
        return spinal_env_viewer_graph_service_1.SpinalGraphService.getChildren(id, [spinal_model_bmsnetwork_1.SpinalBmsDevice.relationName]).then((devices) => {
            var _a;
            for (const device of devices) {
                const networkId = (_a = device.idNetwork) === null || _a === void 0 ? void 0 : _a.get();
                obj[networkId] = device;
            }
            return obj;
        }).catch((err) => {
            return obj;
        });
    }
    _getDevicesSelected(discoverModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const queue = new spinal_connector_service_1.SpinalQueue();
            const { protocol, host, port } = config.spinalConnector;
            const url = `${protocol}://${host}:${port}`;
            const list = yield discoverModel.getTreeToCreate(url);
            queue.addToQueue(list);
            return queue;
            // for (let i = 0; i < this.discoverModel.devices.length; i++) {
            //    const element = this.discoverModel.devices[i];
            //    queue.addToQueue(element);
            // }
            // return queue;
        });
    }
}
class Discover extends events_1.EventEmitter {
    constructor() {
        super();
        this._discoverQueue = new spinal_connector_service_1.SpinalQueue();
        this._isProcess = false;
        this._listenEvent();
    }
    static getInstance() {
        if (!this.instance)
            this.instance = new Discover();
        return this.instance;
    }
    addToQueue(model) {
        this._discoverQueue.addToQueue(model);
    }
    _listenEvent() {
        this._discoverQueue.on("start", () => {
            if (!this._isProcess) {
                this._isProcess = true;
                this._discoverNext();
            }
        });
        this.on("next", () => {
            this._discoverNext();
        });
    }
    _discoverNext() {
        if (this._discoverQueue.isEmpty()) {
            this._isProcess = false;
            return;
        }
        const model = this._discoverQueue.dequeue();
        const spinalDiscover = new SpinalDiscover(model);
        spinalDiscover.init();
        let timeout = false;
        let bindSateProcess = model.state.bind(() => {
            const state = model.state.get();
            switch (state) {
                case spinal_connector_service_2.STATES.discovered:
                    model.state.unbind(bindSateProcess);
                    if (!timeout)
                        this.emit("next");
                    break;
                case spinal_connector_service_2.STATES.timeout:
                    if (!timeout)
                        this.emit("next");
                    timeout = true;
                default:
                    break;
            }
        });
    }
}
exports.spinalDiscover = Discover.getInstance();
exports.default = exports.spinalDiscover;
//# sourceMappingURL=SpinalDiscover.js.map