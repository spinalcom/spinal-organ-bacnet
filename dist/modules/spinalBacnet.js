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
// import { saveAsFile } from "../utilities/Utilities";
// import { ObjectTypes } from '../utilities/globalVariables';
class SpinalBacnet extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.devices = new Map();
        this.queueSize = 60;
        this.events = {};
        this.count = 0;
        this.CONNECTION_TIME_OUT = config.timeout || 45000;
        this.config = config;
    }
    discoverDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            this.count = 0;
            if (this.config.useBroadcast) {
                console.log("useBroadcast");
                this.useBroadcast();
            }
            else {
                console.log("useUnicast");
                this.useUnicast();
            }
        });
    }
    createDevicesNodes(networkService, network) {
        return __awaiter(this, void 0, void 0, function* () {
            const devices = yield this.getDevices(network.id);
            const iterator = this.convertListToIterator(Array.from(this.devices.keys()));
            this.createDeviceRecursively(iterator, devices, iterator.next(), networkService, network);
            // const promises = Array.from(this.devices.keys()).map(key => {
            //     const node = devices.find(el => el.idNetwork.get() == key);
            //     const device = this.devices.get(key);
            //     return device.createStructureNodes(networkService, node, network.id);
            // })
            // return Promise.all(promises).then(res => console.log("created")).catch(err => { console.error(err); throw new Error('error') })
        });
    }
    useBroadcast() {
        this.client = new bacnet({
            address: this.config.address,
            port: this.config.port,
        });
        this.client.on('error', (err) => {
            console.log('Error occurred: ', err);
            this.client.close();
        });
        const timeOutId = setTimeout(() => {
            console.error("[TIMEOUT] - Cannot establish connection with BACnet server.");
            this.emit("timeout");
            this.closeClient();
        }, this.CONNECTION_TIME_OUT);
        this.client.on('iAm', (device) => {
            console.log("deviceFound", device);
            clearTimeout(timeOutId);
            this.count++;
            this.getDeviceInformation(device);
        });
        this.client.whoIs();
    }
    useUnicast() {
        this.client = new bacnet();
        const devices = this.config.ips.map(({ address, deviceId }) => {
            return { address, deviceId: parseInt(deviceId) };
        });
        this.count = devices.length;
        const iterator = this.convertListToIterator(devices);
        this.discoverRecursively(iterator, iterator.next());
    }
    closeClient() {
        if (this.client) {
            this.client.close();
        }
    }
    /////////////////////////////////////////////////////////////////////////////
    //                                  PRIVATES                               //
    /////////////////////////////////////////////////////////////////////////////
    createDeviceRecursively(iterator, devices, next, networkService, network) {
        if (!next.done) {
            const value = next.value;
            const node = devices.find(el => el.idNetwork.get() == value);
            const device = this.devices.get(value);
            device.createStructureNodes(networkService, node, network.id).then((result) => {
                this.createDeviceRecursively(iterator, devices, iterator.next(), networkService, network);
            }).catch((err) => {
                this.createDeviceRecursively(iterator, devices, iterator.next(), networkService, network);
            });
        }
        else {
            this.emit("created");
        }
    }
    getDeviceInformation(device) {
        return new Promise((resolve, reject) => {
            const spinalDevice = new SpinalDevice_1.SpinalDevice(device, this.client);
            spinalDevice.on("initialized", (res) => {
                this.devices.set(res.device.deviceId, res);
                this.emit("deviceFound", res.info);
                resolve(true);
            });
            spinalDevice.on("error", () => {
                this.count--;
                this.emit("noResponse");
                if (this.count === 0) {
                    this.emit("timeout");
                    this.closeClient();
                }
                resolve(true);
            });
            spinalDevice.init();
        });
    }
    discoverRecursively(iterator, next) {
        if (!next.done) {
            this.getDeviceInformation(next.value).then(() => {
                this.discoverRecursively(iterator, iterator.next());
            });
        }
        else {
            this.emit("discovered");
        }
    }
    getDevices(id) {
        return spinal_env_viewer_graph_service_1.SpinalGraphService.getChildren(id, [spinal_model_bmsnetwork_1.SpinalBmsDevice.relationName]);
    }
    *convertListToIterator(devices) {
        yield* devices;
    }
}
exports.SpinalBacnet = SpinalBacnet;
//# sourceMappingURL=spinalBacnet.js.map