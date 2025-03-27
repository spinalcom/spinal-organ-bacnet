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
const bacnet = require("bacstack");
const events_1 = require("events");
const SpinalQueuing_1 = require("../utilities/SpinalQueuing");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const SpinalDevice_1 = require("./SpinalDevice");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const SpinalNetworkServiceUtilities_1 = require("../utilities/SpinalNetworkServiceUtilities");
const GlobalVariables_1 = require("../utilities/GlobalVariables");
class SpinalDiscover {
    constructor(model) {
        var _a, _b;
        this.devices = new Map();
        this.discoverModel = model;
        this.CONNECTION_TIME_OUT = ((_b = (_a = model.network) === null || _a === void 0 ? void 0 : _a.timeout) === null || _b === void 0 ? void 0 : _b.get()) || 10000;
        // this.init(model)
    }
    init() {
        var _a, _b, _c, _d;
        this.client = new bacnet({
            broadcastAddress: (_b = (_a = this.discoverModel.network) === null || _a === void 0 ? void 0 : _a.address) === null || _b === void 0 ? void 0 : _b.get(),
            port: ((_d = (_c = this.discoverModel.network) === null || _c === void 0 ? void 0 : _c.port) === null || _d === void 0 ? void 0 : _d.get()) || 47808,
            adpuTimeout: 6000
        });
        this.client.on('error', (err) => {
            console.log('Error occurred: ', err);
            this.client.close();
        });
        this._bindState();
    }
    _bindState() {
        this.bindSateProcess = this.discoverModel.state.bind(() => {
            switch (this.discoverModel.state.get()) {
                case spinal_model_bacnet_1.STATES.discovering:
                    console.log("discovering...");
                    this._discover();
                    break;
                case spinal_model_bacnet_1.STATES.creating:
                    console.log("creating...");
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
                let isFinish = false;
                while (!isFinish) {
                    const item = queue.dequeue();
                    if (typeof item !== "undefined") {
                        const info = yield this._initSpinalDevice(item);
                        if (info)
                            this._addDeviceFound(info);
                    }
                    else {
                        console.log("isFinish");
                        isFinish = true;
                    }
                }
                if (this.discoverModel.devices.length !== 0) {
                    console.log("discovered");
                    this.discoverModel.setDiscoveredMode();
                }
                else {
                    console.log("Timeout !");
                    this.discoverModel.setTimeoutMode();
                }
            }
            catch (error) {
                console.log("Timeout !");
                this.discoverModel.setTimeoutMode();
            }
        });
    }
    _getDevicesQueue() {
        const queue = new SpinalQueuing_1.SpinalQueuing();
        return new Promise((resolve, reject) => {
            var _a, _b, _c, _d;
            const useBroadcast = (_b = (_a = this.discoverModel.network) === null || _a === void 0 ? void 0 : _a.useBroadcast) === null || _b === void 0 ? void 0 : _b.get();
            // listen iAm event
            const deviceDiscovered = {};
            this.client.on('iAm', (device) => {
                if (typeof timeOutId !== "undefined") {
                    clearTimeout(timeOutId);
                }
                const { address, deviceId } = device;
                const key = `${address}-${deviceId}`;
                if (!deviceDiscovered[key]) {
                    deviceDiscovered[key] = device;
                    queue.addToQueue(device);
                }
            });
            // end of listen iAm event
            // send whoIs
            if (useBroadcast) {
                console.log("use broadcast");
                this.client.whoIs();
            }
            else {
                console.log("use unicast");
                const ips = ((_d = (_c = this.discoverModel.network) === null || _c === void 0 ? void 0 : _c.ips) === null || _d === void 0 ? void 0 : _d.get()) || [];
                for (const { address } of ips) {
                    this.client.whoIs({
                        address,
                        dest: { net: '65535', adr: [''] }
                    });
                }
            }
            // end of send whoIs
            // wait [CONNECTION_TIME_OUT] ms to get all devices, if not found, add ips not found to queue or reject
            let timeOutId = setTimeout(() => {
                var _a, _b;
                if (!useBroadcast) {
                    // if use unicast, add ips not found to queue
                    // because the whoIs not found the device, but readProperty should found it
                    const ips = ((_b = (_a = this.discoverModel.network) === null || _a === void 0 ? void 0 : _a.ips) === null || _b === void 0 ? void 0 : _b.get()) || [];
                    queue.setQueue(ips);
                    // return resolve(queue);
                }
                reject("[TIMEOUT] - Cannot establish connection with BACnet server.");
            }, this.CONNECTION_TIME_OUT);
            // listen start event
            queue.once("start", () => {
                var _a, _b;
                if (!useBroadcast) {
                    // if use unicast, add ips not found to queue
                    // because the whoIs not found the device, but readProperty can found it
                    const temp_queueList = queue.getQueue();
                    const ips = ((_b = (_a = this.discoverModel.network) === null || _a === void 0 ? void 0 : _a.ips) === null || _b === void 0 ? void 0 : _b.get()) || [];
                    for (const { address, deviceId } of ips) {
                        if (!deviceDiscovered[address]) {
                            temp_queueList.push({ address, deviceId: deviceId || GlobalVariables_1.PropertyIds.MAX_BACNET_PROPERTY_ID });
                        }
                    }
                    queue.setQueue(temp_queueList);
                }
                resolve(queue);
            });
        });
    }
    _initSpinalDevice(device) {
        return new Promise((resolve, reject) => {
            const spinalDevice = new SpinalDevice_1.SpinalDevice(device, this.client);
            spinalDevice.on("initialized", (res) => {
                this.devices.set(res.device.deviceId, res);
                resolve(res.info);
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
            try {
                const queue = this._getDevicesSelected();
                const { networkService, network } = yield SpinalNetworkServiceUtilities_1.SpinalNetworkServiceUtilities.initSpinalDiscoverNetwork(this.discoverModel);
                const devices = yield this._getDevicesNodes(network.id.get());
                let isFinish = false;
                while (!isFinish) {
                    const device = queue.dequeue();
                    if (typeof device !== "undefined") {
                        const deviceId = device.deviceId.get();
                        const node = devices[deviceId];
                        const spinalDevice = this.devices.get(deviceId);
                        yield spinalDevice.createStructureNodes(networkService, node, network.id.get());
                    }
                    else {
                        isFinish = true;
                    }
                }
                this.discoverModel.setCreatedMode();
                this.discoverModel.state.unbind(this.bindSateProcess);
                this.discoverModel.remove();
                console.log("nodes created!");
            }
            catch (error) {
                this.discoverModel.setErrorMode();
                this.discoverModel.state.unbind(this.bindSateProcess);
                this.discoverModel.remove();
            }
        });
    }
    _getDevicesNodes(id) {
        const obj = {};
        return spinal_env_viewer_graph_service_1.SpinalGraphService.getChildren(id, [spinal_model_bmsnetwork_1.SpinalBmsDevice.relationName]).then((result) => {
            result.forEach(el => {
                obj[el.idNetwork.get()] = el;
            });
            return obj;
        }).catch((err) => {
            return obj;
        });
    }
    _getDevicesSelected() {
        const queue = new SpinalQueuing_1.SpinalQueuing();
        for (let i = 0; i < this.discoverModel.devices.length; i++) {
            const element = this.discoverModel.devices[i];
            queue.addToQueue(element);
        }
        return queue;
    }
}
class Discover extends events_1.EventEmitter {
    constructor() {
        super();
        this._discoverQueue = new SpinalQueuing_1.SpinalQueuing();
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
        if (!this._discoverQueue.isEmpty()) {
            const model = this._discoverQueue.dequeue();
            const spinalDiscover = new SpinalDiscover(model);
            spinalDiscover.init();
            let timeout = false;
            let bindSateProcess = model.state.bind(() => {
                const state = model.state.get();
                switch (state) {
                    case spinal_model_bacnet_1.STATES.discovered:
                        model.state.unbind(bindSateProcess);
                        if (!timeout) {
                            this.emit("next");
                        }
                        break;
                    case spinal_model_bacnet_1.STATES.timeout:
                        if (!timeout) {
                            this.emit("next");
                        }
                        timeout = true;
                    default:
                        break;
                }
            });
        }
        else {
            this._isProcess = false;
        }
    }
}
exports.spinalDiscover = Discover.getInstance();
exports.default = exports.spinalDiscover;
//# sourceMappingURL=SpinalDiscover.js.map