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
exports.spinalMonitoring = void 0;
const priority_queue_1 = require("@datastructures-js/priority-queue");
const SpinalNetworkServiceUtilities_1 = require("../utilities/SpinalNetworkServiceUtilities");
const SpinalQueuing_1 = require("../utilities/SpinalQueuing");
const lodash = require("lodash");
class SpinalMonitoring {
    constructor() {
        this.queue = new SpinalQueuing_1.SpinalQueuing();
        this.priorityQueue = new priority_queue_1.MinPriorityQueue();
        this.isProcessing = false;
        this.intervalTimesMap = new Map();
        this.initializedMap = new Map();
        this.devices = [];
    }
    init() {
        this.queue.on("start", () => {
            console.log("start monitoring...");
            this.startDeviceInitialisation();
        });
    }
    addToMonitoringList(spinalListenerModel) {
        return __awaiter(this, void 0, void 0, function* () {
            this.queue.addToQueue(spinalListenerModel);
        });
    }
    startDeviceInitialisation() {
        return __awaiter(this, void 0, void 0, function* () {
            const list = this.queue.getQueue();
            this.queue.refresh();
            const promises = list.map(el => SpinalNetworkServiceUtilities_1.SpinalNetworkServiceUtilities.initSpinalListenerModel(el));
            const devices = lodash.flattenDeep(yield Promise.all(promises));
            yield this._addToMaps(devices);
            if (!this.isProcessing) {
                this.isProcessing = true;
                this.startMonitoring();
            }
        });
    }
    _addToMaps(devices) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const { interval, id, children, spinalModel, spinalDevice, networkService, network } of devices) {
                if (this.devices.indexOf(id) === -1) {
                    //    await this.removeToMaps(id);
                    // } else {
                    this.devices.push(id);
                }
                // console.log(interval, children);
                if (isNaN(interval) || interval <= 0 || children.length <= 0)
                    continue;
                yield this.createDataIfNotExist(spinalModel, spinalDevice, children, networkService, network, interval);
                const func = () => __awaiter(this, void 0, void 0, function* () { return this.funcToExecute(spinalModel, spinalDevice, children, networkService, network); });
                let value = this.intervalTimesMap.get(interval);
                if (typeof value === "undefined") {
                    value = [];
                }
                value.push({ id, func });
                this.intervalTimesMap.set(interval, value);
            }
            yield this.addToQueue();
        });
    }
    addToQueue() {
        this.intervalTimesMap.forEach((value, interval) => {
            this.priorityQueue.enqueue({ interval, functions: value }, Date.now() + interval);
        });
    }
    removeToMaps(deviceId) {
        this.intervalTimesMap.forEach((value, key) => {
            this.intervalTimesMap.set(key, value.filter(el => el.id !== deviceId));
        });
    }
    startMonitoring() {
        return __awaiter(this, void 0, void 0, function* () {
            let p = true;
            while (p) {
                if (this.priorityQueue.isEmpty()) {
                    yield this.waitFct(100);
                    continue;
                }
                const { priority, element } = this.priorityQueue.dequeue();
                if (element.functions.length > 0) {
                    yield this.execFunc(element.functions, element.interval, priority);
                }
            }
            // for (const data of this.devices) {
            //    await this.monitDevice(data);
            // }
        });
    }
    execFunc(functions, interval, date) {
        return __awaiter(this, void 0, void 0, function* () {
            // console.log("functions !!",functions);
            if (date && Date.now() < date) {
                console.log("wait ");
                yield this.waitFct(date - Date.now());
            }
            try {
                const deep_functions = [...functions];
                // console.log("deep_functions", deep_functions);
                while (deep_functions.length > 0) {
                    try {
                        const { func } = deep_functions.shift();
                        if (typeof func === "function") {
                            yield func();
                        }
                    }
                    catch (error) {
                        console.error(error);
                    }
                }
                this.priorityQueue.enqueue({ interval, functions: this.intervalTimesMap.get(interval) }, Date.now() + interval);
            }
            catch (error) {
                console.error(error);
                this.priorityQueue.enqueue({ interval, functions: this.intervalTimesMap.get(interval) }, Date.now() + interval);
            }
        });
    }
    waitFct(nb) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, nb >= 0 ? nb : 0);
        });
    }
    createDataIfNotExist(spinalModel, spinalDevice, children, networkService, network, interval) {
        return __awaiter(this, void 0, void 0, function* () {
            // console.log("inside funcToExecute");
            const id = `${spinalDevice.device.deviceId}_${interval}`;
            let init = this.initializedMap.get(id);
            if (!init) {
                console.log("initialisation");
                this.initializedMap.set(id, true);
                yield spinalDevice.checkAndCreateIfNotExist(networkService, children);
            }
        });
    }
    funcToExecute(spinalModel, spinalDevice, children, networkService, network) {
        return __awaiter(this, void 0, void 0, function* () {
            // console.log("children", children);
            if (spinalModel.listen.get() && (children === null || children === void 0 ? void 0 : children.length) > 0) {
                yield spinalDevice.updateEndpoints(networkService, network, children);
            }
            // if (typeof callback === "function") callback(networkService, spinalDevice, spinalModel, children);
        });
    }
}
const spinalMonitoring = new SpinalMonitoring();
exports.spinalMonitoring = spinalMonitoring;
spinalMonitoring.init();
exports.default = spinalMonitoring;
//# sourceMappingURL=SpinalMonitoring.js.map