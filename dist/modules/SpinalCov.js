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
        this._bacnetClient = BacnetUtilities_1.default.createNewBacnetClient();
        this.forkedProcess = null;
        this.queue.on("start", this.monitorQueue.bind(this));
        this._bacnetClient.on('covNotifyUnconfirmed', (data) => {
            console.log(data);
        });
    }
    static getInstance() {
        if (!this._instance)
            this._instance = new SpinalCov();
        return this._instance;
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
            const formatted = list.reduce((l, { networkService, spinalDevice, children }) => {
                const ip = spinalDevice.device.address;
                this.itemMonitored.set(ip, { networkService, spinalDevice }); // Store the device
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
        forked.on("message", (result) => {
            switch (result.eventName) {
                case GlobalVariables_1.COV_EVENTS_NAMES.subscribed:
                    console.log("[COV] - Subscribed to", result.key);
                    break;
                case GlobalVariables_1.COV_EVENTS_NAMES.error:
                    console.error("[COV] - Failed to subscribe due to", result.error.message);
                    forked.kill();
                    break;
                case GlobalVariables_1.COV_EVENTS_NAMES.changed:
                    const [ip, type, instance] = result.key.split("_");
                    const device = this.itemMonitored.get(ip);
                    console.log("[COV] - Data changed", result.data);
            }
        });
        forked.on("error", (err) => { });
        forked.on("exit", (code) => {
            console.log("child process exited with code", code);
        });
        return forked;
    }
}
const spinalCov = SpinalCov.getInstance();
exports.spinalCov = spinalCov;
exports.default = spinalCov;
//# sourceMappingURL=SpinalCov.js.map