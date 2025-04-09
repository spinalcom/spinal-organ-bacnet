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
exports.spinalCov = void 0;
const SpinalQueuing_1 = require("../utilities/SpinalQueuing");
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
const child_process_1 = require("child_process");
const GlobalVariables_1 = require("../utilities/GlobalVariables");
class SpinalCov {
    constructor() {
        this.queue = new SpinalQueuing_1.default();
        this.itemMonitored = new Map();
        this._bacnetClient = null;
        this.forkedProcess = null;
        this.queue.on("start", this.monitorQueue.bind(this));
        this.listenBacnetEvent();
    }
    static getInstance() {
        if (!this._instance)
            this._instance = new SpinalCov();
        return this._instance;
    }
    listenBacnetEvent() {
        return __awaiter(this, void 0, void 0, function* () {
            this._bacnetClient = yield BacnetUtilities_1.default.getClient();
            this._bacnetClient.on('covNotifyUnconfirmed', (data) => {
                console.log(data);
            });
        });
    }
    addToQueue(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(data))
                data = [data];
            for (const obj of data) {
                this.queue.addToQueue(obj);
            }
        });
    }
    monitorQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            // init process before starting cov, initialization
            if (!this.forkedProcess) {
                this.forkedProcess = this.createForkedProcess();
            }
            const list = this.queue.getQueue();
            this.queue.refresh();
            const formatted = list.reduce((l, { networkService, network, spinalDevice, children }) => {
                const ip = spinalDevice.device.address;
                this.itemMonitored.set(ip, { networkService, network, spinalDevice }); // Store the device
                return l.concat(this.formatChildren(ip, children));
            }, []);
            this.forkedProcess.send({ eventName: GlobalVariables_1.COV_EVENTS_NAMES.subscribe, data: formatted });
            // for (const { spinalDevice, networkService, children } of list) {
            //     const ip = spinalDevice.device.address;
            //     this.itemMonitored.set(ip, { networkService, spinalDevice }); // Store the device
            //     await this.subscribeCov(spinalDevice, children);
            // }
        });
    }
    formatChildren(ip, children) {
        return children.map((child) => {
            return { ip, object: child };
        });
    }
    // private async subscribeCov(spinalDevice: SpinalDevice, children: ICovData["children"]) {
    //     const ip = spinalDevice.device.address;
    // }
    createForkedProcess() {
        const path = require.resolve("./cov");
        const forked = (0, child_process_1.fork)(path);
        forked.on("message", (result) => __awaiter(this, void 0, void 0, function* () {
            switch (result.eventName) {
                case GlobalVariables_1.COV_EVENTS_NAMES.subscribed:
                    console.log("[COV] - Subscribed to", result.key);
                    break;
                case GlobalVariables_1.COV_EVENTS_NAMES.error:
                    console.error("[COV] - Failed to subscribe due to", result.error.message);
                    forked.kill();
                    break;
                case GlobalVariables_1.COV_EVENTS_NAMES.changed:
                    yield this._updateDeviceValue(result.data.address, result.data.request);
            }
        }));
        forked.on("error", (err) => { });
        forked.on("exit", (code) => {
            // console.log("child process exited with code", code);
        });
        return forked;
    }
    _updateDeviceValue(address, request) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const currentValue = request.values.find((v) => { var _a; return ((_a = v.property) === null || _a === void 0 ? void 0 : _a.id) === GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE; });
            if (!currentValue)
                return;
            const value = BacnetUtilities_1.default._getObjValue(currentValue.value);
            const object = request.monitoredObjectId;
            const { networkService, network, spinalDevice } = this.itemMonitored.get(address);
            const obj = {
                id: (_a = spinalDevice.device) === null || _a === void 0 ? void 0 : _a.deviceId,
                children: [{ id: object.type, children: [{ id: object.instance, currentValue: value }] }],
            };
            console.log(`[COV] - Updating ${address}_${object.type}_${object.instance}`, value);
            return spinalDevice.updateEndpointInGraph(obj, networkService, network);
        });
    }
}
const spinalCov = SpinalCov.getInstance();
exports.spinalCov = spinalCov;
exports.default = spinalCov;
//# sourceMappingURL=SpinalCov.js.map