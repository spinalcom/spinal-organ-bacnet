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
const lodash = require("lodash");
const SpinalCov_1 = require("./SpinalCov");
const spinal_connector_service_1 = require("spinal-connector-service");
const SpinalNetworkServiceUtilities_1 = require("../utilities/SpinalNetworkServiceUtilities");
class SpinalMonitoring {
    constructor() {
        this.queue = new spinal_connector_service_1.SpinalQueue();
        this.priorityQueue = new priority_queue_1.MinPriorityQueue();
        this.initIsProcessing = false;
        this.intervalTimesMap = new Map();
        this.binded = new Map();
        this.devices = {};
        this._itemToAddToMap = new spinal_connector_service_1.SpinalQueue();
        this._endpointsCreationQueue = new spinal_connector_service_1.SpinalQueue();
        this._covList = [];
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new SpinalMonitoring();
            this.instance.init();
        }
        return this.instance;
    }
    // this function is used to add a spinal listener model to the monitoring Queue
    addToMonitoringList(spinalListenerModel) {
        return __awaiter(this, void 0, void 0, function* () {
            this.queue.addToQueue(spinalListenerModel);
        });
    }
    // initialize the monitoring system
    init() {
        // process the monitoring queue
        this.queue.on("start", () => {
            console.log("start initialisation...");
            this.startDeviceInitialisation();
        });
        // process the item to add to map queue
        this._itemToAddToMap.on("start", () => __awaiter(this, void 0, void 0, function* () { return this._processToAddItemToMap(); }));
        // process the endpoints creation queue
        this._endpointsCreationQueue.on("start", () => __awaiter(this, void 0, void 0, function* () { return this.processToEndpointsCreation(); }));
    }
    processToEndpointsCreation() {
        return __awaiter(this, void 0, void 0, function* () {
            while (!this._endpointsCreationQueue.isEmpty()) {
                try {
                    // console.log("begin");
                    const item = this._endpointsCreationQueue.dequeue();
                    if (!item)
                        continue;
                    const { spinalDevice, children, networkService } = item;
                    yield spinalDevice.checkAndCreateIfNotExist(networkService, children);
                    // console.log("end")
                }
                catch (error) {
                    console.error(error);
                }
            }
        });
    }
    _processToAddItemToMap() {
        while (!this._itemToAddToMap.isEmpty()) {
            const item = this._itemToAddToMap.dequeue();
            if (item)
                this._addToMonitoringMap(item.id, item.interval, item.func);
        }
    }
    startDeviceInitialisation() {
        return __awaiter(this, void 0, void 0, function* () {
            const monitoringData = yield this._initNetworkUtilities();
            const promises = this._createMaps(monitoringData);
            const monitoringDataFormatted = yield Promise.all(promises);
            if (this.initIsProcessing)
                return;
            // if monitoring is not already initialized
            this.initIsProcessing = true;
            for (const iterator of monitoringDataFormatted.flat()) {
                if (iterator && iterator.id && iterator.intervals) {
                    iterator.intervals.forEach(({ interval, func }) => this._addToMonitoringMap(iterator.id, interval, func)); // add to monitoring map}
                }
            }
            console.log("waiting endpoints creation");
            yield this._waitEndpointCreation();
            console.log("end of endpoints creation");
            this.startMonitoring();
            SpinalCov_1.SpinalCov.getInstance().startCovProcessing(); // start cov processing
        });
    }
    startMonitoring() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            console.log("start monitoring...");
            let p = true;
            while (p) {
                // if the priority queue is empty, wait for 500ms, it prevents the loop from being too CPU intensive
                if (this.priorityQueue.isEmpty()) {
                    yield this.waitFct(500);
                    continue;
                }
                //@ts-ignore
                const { priority, element } = this.priorityQueue.dequeue();
                if (priority && priority <= Date.now()) {
                    let data = this.intervalTimesMap.get(priority);
                    if (data) {
                        data = !Array.isArray(data) ? [data] : data;
                        yield this.launchUpdating(data, element.interval, priority);
                    }
                    this.intervalTimesMap.delete(element.priority);
                }
                else {
                    const deviceIsAlreadyMonitored = (_b = (_a = this.devices[element.id]) === null || _a === void 0 ? void 0 : _a.monitored) === null || _b === void 0 ? void 0 : _b.get();
                    if (deviceIsAlreadyMonitored) {
                        this.priorityQueue.enqueue(element, priority);
                        yield this.waitFct(100); // wait for 100ms before checking again, it prevents the loop from being too CPU intensive
                    }
                }
            }
        });
    }
    _initNetworkUtilities() {
        return __awaiter(this, void 0, void 0, function* () {
            const queueList = this.queue.toArray();
            this.queue.clear();
            const promises = [];
            for (const element of queueList) {
                promises.push(SpinalNetworkServiceUtilities_1.SpinalNetworkServiceUtilities.initSpinalListenerModel(element));
            }
            const result = yield Promise.all(promises);
            return lodash.flattenDeep(result).filter(((el) => !!el));
        });
    }
    _createMaps(devices) {
        return devices.map((device) => this._createDeviceMap(device));
    }
    _createDeviceMap(device) {
        const { id } = device;
        return new Promise((resolve) => {
            const existingProcess = this.binded.get(id);
            // Device already binded
            if (existingProcess) {
                resolve(undefined);
                return;
            }
            const process = this._bindDeviceListener(device, resolve);
            this.binded.set(id, process);
        });
    }
    _bindDeviceListener(device, resolve) {
        const { spinalModel } = device;
        return spinalModel.monitored.bind(() => __awaiter(this, void 0, void 0, function* () {
            const isMonitored = spinalModel.monitored.get();
            if (isMonitored) {
                yield this._handleMonitoredDevice(device, resolve);
                return;
            }
            yield this._handleStoppedDevice(device, resolve);
        }), true);
    }
    _handleMonitoredDevice(device, resolve) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id, spinalModel, spinalDevice, networkService, network } = device;
            const alreadyInit = this.devices[id];
            const deviceName = (_a = spinalDevice === null || spinalDevice === void 0 ? void 0 : spinalDevice.device) === null || _a === void 0 ? void 0 : _a.name;
            if (!spinalDevice || !networkService || !network)
                return;
            console.log(`${deviceName} is running`);
            const monitors = spinalModel.monitor.getMonitoringData();
            const intervals = yield this.getValidIntervals(spinalDevice, networkService, spinalModel, network, monitors);
            if (!alreadyInit) {
                this.devices[id] = spinalModel;
                console.log(`${deviceName} initialized`);
                resolve({ id, intervals });
                return;
            }
            this._queueIntervals(id, intervals);
            resolve(undefined);
        });
    }
    _handleStoppedDevice(device, resolve) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id, spinalModel, spinalDevice } = device;
            const alreadyInit = this.devices[id];
            const deviceName = (_a = spinalDevice === null || spinalDevice === void 0 ? void 0 : spinalDevice.device) === null || _a === void 0 ? void 0 : _a.name;
            console.log(`${deviceName} is stopped`);
            yield this.removeFromMonitoringMaps(id);
            if (spinalDevice === null || spinalDevice === void 0 ? void 0 : spinalDevice.covData)
                SpinalCov_1.SpinalCov.getInstance().addToStopCovQueue(spinalDevice.covData);
            yield (spinalDevice === null || spinalDevice === void 0 ? void 0 : spinalDevice.clearCovList());
            // Keep the device in the list even if not initialized
            if (!alreadyInit) {
                this.devices[id] = spinalModel;
            }
            resolve(undefined);
        });
    }
    _queueIntervals(id, intervals) {
        for (const { interval, func } of intervals) {
            this._itemToAddToMap.addToQueue({ id, interval, func });
        }
    }
    /**
     *  Add an item to the monitoring map and priority queue
     * @param id
     * @param interval
     * @param func
     */
    _addToMonitoringMap(id, interval, func) {
        if (isNaN(interval))
            return; // if the interval is not a number, do not add to monitoring
        interval = Number(interval);
        let priority = Date.now() + interval;
        let value = this.intervalTimesMap.get(priority); // get existing data for this interval time
        if (!value)
            value = []; // create new array if not exist
        value.push({ id, func });
        this.intervalTimesMap.set(priority, value);
        this.priorityQueue.enqueue({ id, interval, priority }, priority); // add to priority queue
    }
    removeFromMonitoringMaps(deviceId) {
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
    launchUpdating(data, interval, date) {
        return __awaiter(this, void 0, void 0, function* () {
            const priority = Date.now() + interval;
            const deep_functions = [...data];
            while (deep_functions.length > 0) {
                const item = deep_functions.shift();
                if (!item)
                    continue;
                const { id, func } = item;
                try {
                    if (typeof func === "function")
                        yield func();
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
                // Traiter la creation des endpoinrs dans une Queue, 
                // pour eviter l'envoie de plusieurs requête bacnet
                this._endpointsCreationQueue.addToQueue({ spinalDevice, children, networkService });
            }
            catch (error) {
                console.error(error);
            }
        });
    }
    funcToExecute(spinalModel, spinalDevice, children, networkService, network) {
        return __awaiter(this, void 0, void 0, function* () {
            if (spinalModel.monitored.get() && (children === null || children === void 0 ? void 0 : children.length) > 0) {
                yield spinalDevice.updateEndpoints(networkService, network, children);
            }
        });
    }
    getValidIntervals(spinalDevice, networkService, spinalModel, network, monitors) {
        return __awaiter(this, void 0, void 0, function* () {
            const monitors_copy = Object.assign([], monitors);
            const res = [];
            while (monitors_copy.length > 0) {
                const item = monitors_copy.shift();
                if (!item)
                    continue;
                const { interval, children } = item;
                if (children.length <= 0 || interval == 0)
                    continue;
                // if cov or 0
                if (interval.toString().toLowerCase() === "cov") {
                    const covData = { spinalModel, spinalDevice, children, networkService, network };
                    SpinalCov_1.SpinalCov.getInstance().addToCovQueue(covData); // add directly to cov monitoring
                    spinalDevice.pushToCovList(covData);
                }
                else {
                    // add interval to pooling list
                    const func = () => __awaiter(this, void 0, void 0, function* () { return this.funcToExecute(spinalModel, spinalDevice, children, networkService, network); });
                    res.push({ interval, children, func });
                }
                yield this.createDataIfNotExist(spinalDevice, children, networkService, interval);
            }
            return res;
        });
    }
    waitFct(nb) {
        return new Promise((resolve) => {
            setTimeout(() => resolve(), nb >= 0 ? nb : 0);
        });
    }
    _waitEndpointCreation() {
        return new Promise((resolve) => {
            const wait = () => {
                setTimeout(() => {
                    if (this._endpointsCreationQueue.isEmpty())
                        resolve(undefined);
                    else
                        wait();
                }, 400);
            };
            wait();
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