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
exports.SpinalDiscover = exports.DiscoverQueing = void 0;
const bacnet = require("bacstack");
const events_1 = require("events");
const SpinalQueuing_1 = require("../utilities/SpinalQueuing");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const SpinalDevice_1 = require("./SpinalDevice");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const SpinalNetworkServiceUtilities_1 = require("../utilities/SpinalNetworkServiceUtilities");
exports.DiscoverQueing = (function () {
    const discoverQueue = new SpinalQueuing_1.SpinalQueuing();
    let _isProcess = false;
    discoverQueue.on("start", () => {
        if (!_isProcess) {
            startDiscovering();
        }
    });
    const addToQueue = (model) => {
        discoverQueue.addToQueue(model);
    };
    const startDiscovering = () => {
        if (!discoverQueue.isEmpty()) {
            const model = discoverQueue.dequeue();
            const spinalDiscover = new SpinalDiscover(model);
        }
    };
    return {
        addToQueue
    };
})();
class SpinalDiscover extends events_1.EventEmitter {
    constructor(model) {
        var _a, _b;
        super();
        this.devices = new Map();
        this.discoverModel = model;
        this.CONNECTION_TIME_OUT = ((_b = (_a = model.network) === null || _a === void 0 ? void 0 : _a.timeout) === null || _b === void 0 ? void 0 : _b.get()) || 45000;
        this.init(model);
    }
    init(model) {
        var _a, _b, _c, _d;
        this.client = new bacnet({
            broadcastAddress: (_b = (_a = model.network) === null || _a === void 0 ? void 0 : _a.address) === null || _b === void 0 ? void 0 : _b.get(),
            port: ((_d = (_c = model.network) === null || _c === void 0 ? void 0 : _c.port) === null || _d === void 0 ? void 0 : _d.get()) || 47808,
            adpuTimeout: 6000
        });
        this.client.on('error', (err) => {
            console.log('Error occurred: ', err);
            this.client.close();
        });
        this.bindState();
    }
    bindState() {
        this.bindSateProcess = this.discoverModel.state.bind(() => {
            switch (this.discoverModel.state.get()) {
                case spinal_model_bacnet_1.STATES.discovering:
                    console.log("discovering");
                    this.discover();
                    break;
                case spinal_model_bacnet_1.STATES.creating:
                    this.createNodes();
                default:
                    break;
            }
        });
    }
    discover() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const queue = yield this.getDevicesQueue();
                let isFinish = false;
                while (!isFinish) {
                    const item = queue.dequeue();
                    if (typeof item !== "undefined") {
                        const info = yield this.createSpinalDevice(item);
                        if (info)
                            this.addDeviceFound(info);
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
                console.log("Timeout...");
                this.discoverModel.setTimeoutMode();
            }
        });
    }
    getDevicesQueue() {
        const queue = new SpinalQueuing_1.SpinalQueuing();
        return new Promise((resolve, reject) => {
            var _a, _b, _c, _d;
            // if (this.discoverModel.network?.useBroadcast?.get()) {
            //    console.log("use broadcast");
            let timeOutId;
            if ((_b = (_a = this.discoverModel.network) === null || _a === void 0 ? void 0 : _a.useBroadcast) === null || _b === void 0 ? void 0 : _b.get()) {
                console.log("use broadcast");
                timeOutId = setTimeout(() => {
                    reject("[TIMEOUT] - Cannot establish connection with BACnet server.");
                }, this.CONNECTION_TIME_OUT);
                this.client.whoIs({
                    address: this.discoverModel.network.address.get(),
                    dest: {
                        net: '65535',
                        adr: [''],
                    },
                });
            }
            else {
                // ips.forEach(({ address, deviceId }) => {
                //    this.client.whoIs({ address })
                // });
                console.log("use unicast");
                const ips = ((_d = (_c = this.discoverModel.network) === null || _c === void 0 ? void 0 : _c.ips) === null || _d === void 0 ? void 0 : _d.get()) || [];
                const devices = ips.filter(({ address, deviceId }) => address && deviceId)
                    .map(({ address, deviceId }) => {
                    return { address, deviceId: parseInt(deviceId) };
                });
                queue.setQueue(devices);
            }
            const res = [];
            this.client.on('iAm', (device) => {
                if (typeof timeOutId !== "undefined") {
                    clearTimeout(timeOutId);
                }
                console.log(device);
                const { address, deviceId } = device;
                const found = res.find(el => el.address === address && el.deviceId === deviceId);
                if (!found) {
                    res.push(device);
                    queue.addToQueue(device);
                }
            });
            queue.on("start", () => { resolve(queue); });
            // if (this.discoverModel.network?.useBroadcast?.get()) {
            //    console.log("use broadcast");
            //    const timeOutId = setTimeout(() => {
            //       reject("[TIMEOUT] - Cannot establish connection with BACnet server.");
            //    }, this.CONNECTION_TIME_OUT);
            //    this.client.on('iAm', (device) => {
            //       clearTimeout(timeOutId);
            //       queue.addToQueue(device);
            //    })
            //    this.client.whoIs();
            // } else {
            //    console.log("use unicast");
            //    const ips = this.discoverModel.network?.ips?.get() || [];
            //    const devices = ips.filter(({ address, deviceId }) => address && deviceId)
            //       .map(({ address, deviceId }) => {
            //          return { address, deviceId: parseInt(deviceId) }
            //       })
            //    queue.setQueue(devices);
            // }
            // queue.on("start", () => { resolve(queue) });
        });
    }
    createSpinalDevice(device) {
        return new Promise((resolve, reject) => {
            const spinalDevice = new SpinalDevice_1.SpinalDevice(device, this.client);
            spinalDevice.on("initialized", (res) => {
                this.devices.set(res.device.deviceId, res);
                resolve(res.info);
            });
            spinalDevice.on("error", () => {
                resolve();
            });
            spinalDevice.init();
        });
    }
    addDeviceFound(device) {
        console.log("device found", device.address);
        this.discoverModel.devices.push(device);
    }
    createNodes() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("creating nodes...");
            try {
                const queue = new SpinalQueuing_1.SpinalQueuing();
                queue.setQueue(Array.from(this.devices.keys()));
                const { networkService, network } = yield SpinalNetworkServiceUtilities_1.SpinalNetworkServiceUtilities.initSpinalDiscoverNetwork(this.discoverModel);
                const devices = yield this.getDevices(network.id.get());
                let isFinish = false;
                while (!isFinish) {
                    const value = queue.dequeue();
                    if (typeof value !== "undefined") {
                        const node = devices.find(el => el.idNetwork.get() == value);
                        const device = this.devices.get(value);
                        yield device.createStructureNodes(networkService, node, network.id.get());
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
    getDevices(id) {
        return spinal_env_viewer_graph_service_1.SpinalGraphService.getChildren(id, [spinal_model_bmsnetwork_1.SpinalBmsDevice.relationName]);
    }
}
exports.SpinalDiscover = SpinalDiscover;
//# sourceMappingURL=SpinalDiscover.js.map