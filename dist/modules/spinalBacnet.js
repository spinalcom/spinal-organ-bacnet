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
exports.SpinalBacnet = void 0;
const bacnet = require("bacstack");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const SpinalDevice_1 = require("./SpinalDevice");
const events_1 = require("events");
class SpinalBacnet extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.devices = new Map();
        this.queueSize = 60;
        this.events = {};
        this.count = 0;
        this.CONNECTION_TIME_OUT = config.timeout || 45000;
        this.config = config;
        // this.client = new bacnet({
        //     port: config.port,
        //     // adpuTimeout: this.CONNECTION_TIME_OUT
        // });
        // this.client.on('error', (err) => {
        //     console.log('Error occurred: ', err);
        //     this.client.close();
        // });
    }
    // public getDevices() {
    //     return this.devices;
    // }
    discoverDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            this.count = 0;
            this.client = new bacnet({
                address: this.config.address,
                port: this.config.port,
            });
            const timeOutId = setTimeout(() => {
                console.error("[TIMEOUT] - Cannot establish connection with BACnet server.");
                this.emit("timeout");
                this.closeClient();
            }, this.CONNECTION_TIME_OUT);
            this.client.on('iAm', (device) => {
                clearTimeout(timeOutId);
                this.count++;
                const spinalDevice = new SpinalDevice_1.SpinalDevice(device, this.client);
                spinalDevice.on("initialized", (res) => {
                    this.devices.set(res.device.deviceId, res);
                    this.emit("deviceFound", res.device);
                });
            });
            this.client.whoIs();
        });
    }
    createDevicesNodes(networkService, network) {
        return __awaiter(this, void 0, void 0, function* () {
            const devices = yield this.getDevices(network.id);
            const promises = Array.from(this.devices.keys()).map(key => {
                const node = devices.find(el => el.idNetwork.get() == key);
                const device = this.devices.get(key);
                return device.createStructureNodes(networkService, node, network.id);
            });
            return Promise.all(promises);
        });
    }
    closeClient() {
        if (this.client) {
            this.client.close();
        }
    }
    // public on(eventName: string, listener: Function) {
    //     if (!this.events[eventName]) {
    //         this.events[eventName] = []
    //     }
    //     this.events[eventName].push(listener);
    // }
    // private emit(eventName: string, data: any) {
    //     if (!this.events[eventName]) {
    //         return;
    //     }
    //     this.events[eventName].forEach((callback) => {
    //         if (typeof callback === "function") callback(data);
    //     })
    // }
    /////////////////////////////////////////////////////////////////////////////
    //                                  PRIVATES                               //
    /////////////////////////////////////////////////////////////////////////////
    getDevices(id) {
        return spinal_env_viewer_graph_service_1.SpinalGraphService.getChildren(id, [spinal_model_bmsnetwork_1.SpinalBmsDevice.relationName]);
    }
}
exports.SpinalBacnet = SpinalBacnet;
//# sourceMappingURL=spinalBacnet.js.map