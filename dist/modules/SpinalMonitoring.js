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
    // private devices: Array<{
    //    networkService: NetworkService,
    //    spinalDevice: SpinalDevice,
    //    spinalModel: SpinalListenerModel,
    //    network: SpinalNode<any>,
    //    monitors?: Monitor[]
    // }> = [];
    constructor() {
        this.queue = new SpinalQueuing_1.SpinalQueuing();
        this.priorityQueue = new priority_queue_1.MinPriorityQueue();
        this.isProcessing = false;
        this.intervalTimesMap = new Map();
    }
    init() {
        this.queue.on("start", () => {
            console.log("start");
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
            this._addToMaps(devices);
            if (!this.isProcessing) {
                this.isProcessing = true;
                this.startMonitoring();
            }
        });
    }
    startMonitoring() {
        return __awaiter(this, void 0, void 0, function* () {
            let p = true;
            while (p) {
                const { priority, element } = this.priorityQueue.dequeue();
                yield this.execFunc(element.functions, element.interval, priority);
            }
            // for (const data of this.devices) {
            //    await this.monitDevice(data);
            // }
        });
    }
    execFunc(functions, interval, date) {
        return __awaiter(this, void 0, void 0, function* () {
            if (date && Date.now() < date) {
                yield this.waitFct(date - Date.now());
            }
            try {
                yield Promise.all(functions.map(func => {
                    if (typeof func === "function")
                        return func();
                }));
                this.priorityQueue.enqueue({ interval, functions }, Date.now() + interval);
            }
            catch (error) {
                this.priorityQueue.enqueue({ interval, functions }, Date.now() + interval);
            }
        });
    }
    _addToMaps(devices) {
        for (const { interval, func } of devices) {
            if (isNaN(interval))
                continue;
            const value = this.intervalTimesMap.get(interval);
            if (typeof value !== "undefined") {
                value.push(func);
            }
            else {
                this.intervalTimesMap.set(interval, [func]);
                this.priorityQueue.enqueue({ interval, functions: this.intervalTimesMap.get(interval) }, Date.now() + interval);
            }
        }
    }
    waitFct(nb) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, nb >= 0 ? nb : 0);
        });
    }
}
const spinalMonitoring = new SpinalMonitoring();
exports.spinalMonitoring = spinalMonitoring;
spinalMonitoring.init();
exports.default = spinalMonitoring;
//# sourceMappingURL=SpinalMonitoring.js.map