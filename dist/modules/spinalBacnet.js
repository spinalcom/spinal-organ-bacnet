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
        this.CONNECTION_TIME_OUT = config.timeout;
        this.client = new bacnet({
            port: config.port,
            adpuTimeout: this.CONNECTION_TIME_OUT
        });
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
            // const devices = await this.getDevices((<any>networkService).networkId);
            this.count = 0;
            const timeOutId = setTimeout(() => {
                console.error("[TIMEOUT] - Cannot establish connection with BACnet server.");
                this.emit("timeout");
                // this.client.close();
                // process.exit();
            }, this.CONNECTION_TIME_OUT);
            this.client.on('iAm', (device) => {
                clearTimeout(timeOutId);
                this.count++;
                // const node = devices.find(el => el.idNetwork.get() == device.deviceId)
                const spinalDevice = new SpinalDevice_1.SpinalDevice(device, this.client);
                spinalDevice.on("initialized", (res) => {
                    this.devices.set(res.device.deviceId, res);
                    this.emit("deviceFound", res.device);
                });
                // spinalDevice.init(node, networkService);
                // this._getDeviceObjectList(device).then((objects: Array<Array<{ type: string, instance: number }>>) => {
                //     console.log(objects);
                //     // let objectListDetails = []
                //     // objects.map(object => {
                //     //     return () => {
                //     //         return this._getObjectDetail(device, object).then((g) => objectListDetails.push(g))
                //     //     }
                //     // }).reduce((previous, current) => { return previous.then(current) }, Promise.resolve()).then(() => {
                //     //     // objectListDetails = [].concat.apply([], objectListDetails)
                //     //     const obj = { device, itemsList: [].concat.apply([], objectListDetails) }
                //     //     this.devices.set(device.deviceId, obj);
                //     //     this.emit("deviceFound", obj)
                //     // })
                // })
            });
            this.client.whoIs();
        });
    }
    createDevicesNodes(networkService) {
        return __awaiter(this, void 0, void 0, function* () {
            const devices = yield this.getDevices(networkService.networkId);
            const promises = Array.from(this.devices.keys()).map(key => {
                const node = devices.find(el => el.idNetwork.get() == key);
                const device = this.devices.get(key);
                return device.createStructureNodes(networkService, node);
            });
            return Promise.all(promises);
        });
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