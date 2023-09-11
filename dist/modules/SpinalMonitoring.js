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
exports.spinalMonitoring = void 0;
const priority_queue_1 = require("@datastructures-js/priority-queue");
const SpinalNetworkServiceUtilities_1 = require("../utilities/SpinalNetworkServiceUtilities");
const SpinalQueuing_1 = require("../utilities/SpinalQueuing");
const lodash = require("lodash");
class SpinalMonitoring {
    constructor() {
        this.queue = new SpinalQueuing_1.SpinalQueuing();
        // private priorityQueue: MinPriorityQueue<{ interval: number; functions: { id: string; func: Function }[] }> = new MinPriorityQueue();
        this.priorityQueue = new priority_queue_1.MinPriorityQueue();
        this.isProcessing = false;
        this.intervalTimesMap = new Map();
        this.initializedMap = new Map();
        this.binded = new Map();
        this.devices = {};
        this._itemToAddToMap = new SpinalQueuing_1.SpinalQueuing();
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new SpinalMonitoring();
            this.instance.init();
        }
        return this.instance;
    }
    addToMonitoringList(spinalListenerModel) {
        return __awaiter(this, void 0, void 0, function* () {
            this.queue.addToQueue(spinalListenerModel);
        });
    }
    init() {
        this.queue.on("start", () => {
            console.log("start initialisation...");
            this.startDeviceInitialisation();
        });
        this._itemToAddToMap.on("start", () => __awaiter(this, void 0, void 0, function* () {
            while (!this._itemToAddToMap.isEmpty()) {
                //@ts-ignore
                const item = this._itemToAddToMap.dequeue();
                if (item) {
                    this._addToMap(item.id, item.interval, item.func);
                }
            }
        }));
    }
    startDeviceInitialisation() {
        return __awaiter(this, void 0, void 0, function* () {
            const monitoringData = yield this._initNetworkUtilities();
            const promises = this._createMaps(monitoringData);
            const data = yield Promise.all(promises);
            if (!this.isProcessing) {
                this.isProcessing = true;
                for (const iterator of data.flat()) {
                    if (iterator && iterator.id && iterator.intervals) {
                        for (const { interval, func } of iterator.intervals) {
                            this._addToMap(iterator.id, interval, func);
                        }
                    }
                }
                this.startMonitoring();
            }
        });
    }
    startMonitoring() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            console.log("start monitoring...");
            let p = true;
            while (p) {
                if (this.priorityQueue.isEmpty()) {
                    yield this.waitFct(100);
                    continue;
                }
                //@ts-ignore
                const { priority, element } = this.priorityQueue.dequeue();
                // Si c'est pas le moment de la mise à jour le remettre dans la queue uniquement s'il est toujours monitoré
                if (priority && Date.now() < priority) {
                    const listen = (_b = (_a = this.devices[element.id]) === null || _a === void 0 ? void 0 : _a.listen) === null || _b === void 0 ? void 0 : _b.get();
                    if (listen) {
                        this.priorityQueue.enqueue(element, priority);
                        yield this.waitFct(100);
                    }
                    continue;
                }
                // this.execFunc(element, priority);
                let data = this.intervalTimesMap.get(element.priority);
                if (!data)
                    continue; // l'element à été supprimer de la liste des devices à monitorer
                if (!Array.isArray(data))
                    data = [data];
                if (data && data.length > 0) {
                    yield this.execFunc(data, element.interval, priority);
                }
                this.intervalTimesMap.delete(element.priority);
            }
        });
    }
    _initNetworkUtilities() {
        return __awaiter(this, void 0, void 0, function* () {
            const queueList = this.queue.getQueue();
            this.queue.refresh();
            const promises = yield queueList.reduce((prom, el) => __awaiter(this, void 0, void 0, function* () {
                const liste = yield prom;
                const res = yield SpinalNetworkServiceUtilities_1.SpinalNetworkServiceUtilities.initSpinalListenerModel(el);
                liste.push(res);
                return liste;
            }), Promise.resolve([]));
            return lodash.flattenDeep(yield Promise.all(promises)).filter(el => typeof el !== "undefined");
        });
    }
    _createMaps(devices) {
        return devices.map(({ id, spinalModel, spinalDevice, networkService, network }) => {
            return new Promise((resolve, reject) => {
                let process = this.binded.get(id);
                if (process)
                    return resolve(undefined);
                process = spinalModel.listen.bind(() => __awaiter(this, void 0, void 0, function* () {
                    const listen = spinalModel.listen.get();
                    const alreadyInit = this.devices[id];
                    if (!listen) {
                        this.removeToMaps(id);
                        console.log(spinalDevice.device.name, "is stopped");
                        if (!alreadyInit) {
                            this.devices[id] = spinalModel;
                            return resolve(undefined);
                        }
                        return;
                    }
                    console.log(spinalDevice.device.name, "is running");
                    const monitors = spinalModel.monitor.getMonitoringData();
                    const intervals = yield this.getValidIntervals(spinalDevice, networkService, spinalModel, network, monitors);
                    if (!alreadyInit) {
                        this.devices[id] = spinalModel;
                        console.log(spinalDevice.device.name, "initialized");
                        return resolve({ id, intervals });
                    }
                    for (const { interval, func } of intervals) {
                        this._itemToAddToMap.addToQueue({ id, interval, func });
                    }
                    console.log(spinalDevice.device.name, "initialized");
                }), true);
                this.binded.set(id, process);
            });
        });
    }
    _addToMap(id, interval, func) {
        // let value = this.intervalTimesMap.get(interval);
        // if (typeof value === "undefined") {
        //    value = [];
        // }
        // value.push({ id, func })
        // this.intervalTimesMap.set(interval, value);
        // this._addIntervalToPriorityQueue(interval);
        let priority = Date.now() + interval;
        let value = this.intervalTimesMap.get(priority);
        if (!value)
            value = [];
        value.push({ id, func });
        this.intervalTimesMap.set(priority, value);
        this.priorityQueue.enqueue({ id, interval, priority }, priority);
    }
    removeToMaps(deviceId) {
        this.removeFromPriorityQueue(deviceId);
        this.intervalTimesMap.forEach((value, key) => {
            const copy = !Array.isArray(value) ? [value] : value;
            const filtered = copy.filter(el => el.id !== deviceId);
            if (filtered.length === 0)
                this.intervalTimesMap.delete(key);
            else
                this.intervalTimesMap.set(key, filtered);
        });
    }
    // private async execFunc(data: priorityQueueElementType, date?: number) {
    //    const priority = Date.now() + data.interval;
    //    // const deep_functions = [...data]
    //    // while (deep_functions.length > 0) {
    //    //    const { id, func } = deep_functions.shift();
    //       try {
    //          if (typeof data.func === "function") {
    //             await data.func();
    //          }
    //       } catch (error) { console.error(error); }
    //       this.priorityQueue.enqueue(data, priority);
    //    // }
    //    // this.intervalTimesMap.set(priority, data);
    // }
    // private _addIntervalToPriorityQueue(interval: number) {
    //    const arr = this.priorityQueue.toArray();
    //    const found = arr.find(({ element }) => {
    //       return element.interval === interval;
    //    })
    //    if (typeof found === "undefined") {
    //       this.priorityQueue.enqueue({ interval }, Date.now() + interval);
    //    }
    // }
    execFunc(data, interval, date) {
        return __awaiter(this, void 0, void 0, function* () {
            const priority = Date.now() + interval;
            const deep_functions = [...data];
            while (deep_functions.length > 0) {
                const { id, func } = deep_functions.shift();
                try {
                    if (typeof func === "function") {
                        yield func();
                    }
                }
                catch (error) {
                    console.error(error);
                }
                this.priorityQueue.enqueue({ id, interval, priority }, priority);
            }
            this.intervalTimesMap.set(priority, data);
        });
    }
    createDataIfNotExist(spinalDevice, children, networkService, interval) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // const id = `${spinalDevice.device.deviceId}_${interval}`;
                // let init = this.initializedMap.get(id);
                // if (!init) {
                //    // console.log("initialisation");
                //    this.initializedMap.set(id, true);
                yield spinalDevice.checkAndCreateIfNotExist(networkService, children);
                // }
            }
            catch (error) {
                console.error(error);
            }
        });
    }
    funcToExecute(spinalModel, spinalDevice, children, networkService, network) {
        return __awaiter(this, void 0, void 0, function* () {
            if (spinalModel.listen.get() && (children === null || children === void 0 ? void 0 : children.length) > 0) {
                yield spinalDevice.updateEndpoints(networkService, network, children);
            }
        });
    }
    getValidIntervals(spinalDevice, networkService, spinalModel, network, monitors) {
        return __awaiter(this, void 0, void 0, function* () {
            const monitors_copy = Object.assign([], monitors);
            const res = [];
            while (monitors_copy.length > 0) {
                const { interval, children } = monitors_copy.shift();
                if (isNaN(interval) || interval <= 0 || children.length <= 0)
                    continue;
                yield this.createDataIfNotExist(spinalDevice, children, networkService, interval);
                const func = () => __awaiter(this, void 0, void 0, function* () { return this.funcToExecute(spinalModel, spinalDevice, children, networkService, network); });
                res.push({ interval, children, func });
            }
            return res;
        });
    }
    waitFct(nb) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, nb >= 0 ? nb : 0);
        });
    }
    removeFromPriorityQueue(id) {
        const removed = [];
        const dequeued = [];
        while (!this.priorityQueue.isEmpty()) {
            //@ts-ignore
            const { element, priority } = this.priorityQueue.dequeue();
            if (element.id === id) {
                removed.push({ element, priority });
            }
            else {
                dequeued.push({ element, priority });
            }
        }
        dequeued.forEach((val) => this.priorityQueue.enqueue(val.element, val.priority));
        return removed;
    }
}
const spinalMonitoring = SpinalMonitoring.getInstance();
exports.spinalMonitoring = spinalMonitoring;
// spinalMonitoring.init();
exports.default = spinalMonitoring;
//# sourceMappingURL=SpinalMonitoring.js.map