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
const SpinalCov_1 = require("./SpinalCov");
const spinal_connector_service_1 = require("spinal-connector-service");
const SpinalNetworkUtilities_1 = require("../utilities/SpinalNetworkUtilities");
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
        this.queue.on("start", () => this.startDeviceInitialisation());
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
                    const { spinalDevice, children } = item;
                    yield spinalDevice.checkAndCreateEndpointsIfNotExist(children);
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
            if (item && typeof item.id !== "undefined") {
                const device = this.devices[item.id];
                if (device)
                    this._addDeviceIntervalsToMonitoringMap(device);
            }
        }
    }
    startDeviceInitialisation() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("start device(s) initialization...");
            const devices = yield this._initListenerModels();
            console.log(`${devices.length} devices found`);
            const devicesInitialized = yield this._initAllDevices(devices);
            if (this.initIsProcessing)
                return;
            // if monitoring is not already initialized
            this.initIsProcessing = true;
            for (const device of devicesInitialized) {
                this._addDeviceIntervalsToMonitoringMap(device); // add to monitoring map
            }
            yield this._waitEndpointCreation();
            console.log(`All devices initialized`);
            this.startMonitoring();
            SpinalCov_1.SpinalCov.getInstance().startCovProcessing(); // start cov processing
        });
    }
    startMonitoring() {
        return __awaiter(this, void 0, void 0, function* () {
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
                const itsTimeToExecute = priority && priority <= Date.now();
                if (itsTimeToExecute) {
                    yield this.triggerIntervalUpdate(priority, element);
                }
                else
                    yield this.requeueIfNotReady(element, priority);
            }
        });
    }
    requeueIfNotReady(element, priority) {
        return __awaiter(this, void 0, void 0, function* () {
            // const spinalDevice = this.devices[element.id];
            // const spinalModel = spinalDevice?.getListenerModel();
            // const deviceIsAlreadyMonitored = spinalModel?.monitored?.get();
            // if (deviceIsAlreadyMonitored) {
            this._addToPriorityQueue(element.interval, priority);
            yield this.waitFct(500);
            // }
        });
    }
    triggerIntervalUpdate(priority, element) {
        return __awaiter(this, void 0, void 0, function* () {
            let ids = this.intervalTimesMap.get(element.interval);
            if (ids) {
                ids = !Array.isArray(ids) ? [ids] : ids;
                yield this.launchUpdating(ids, element.interval, priority);
            }
            // this.intervalTimesMap.delete(element.interval);
        });
    }
    _initListenerModels() {
        return __awaiter(this, void 0, void 0, function* () {
            const queueList = this.queue.toArray();
            this.queue.clear();
            const promises = [];
            for (const listenerModel of queueList) {
                promises.push(SpinalNetworkUtilities_1.SpinalNetworkUtilities.initSpinalListenerModel(listenerModel));
            }
            return Promise.all(promises);
        });
    }
    _initAllDevices(devices) {
        const promises = devices.map((device) => this._initDevice(device));
        return Promise.all(promises);
    }
    _initDevice(device) {
        const id = device.Id;
        return new Promise((resolve) => {
            if (typeof id === "undefined")
                return resolve(device);
            const deviceAlreadyBinded = this.binded.get(id);
            // Device already binded
            if (deviceAlreadyBinded)
                return resolve(device);
            const process = this._bindDeviceListener(device, resolve);
            this.binded.set(id, process);
        });
    }
    _bindDeviceListener(device, resolve) {
        const listenerModel = device.getListenerModel();
        return listenerModel.monitored.bind(() => __awaiter(this, void 0, void 0, function* () {
            const isMonitored = listenerModel.monitored.get();
            if (isMonitored) {
                yield this._handleMonitoredDevice(device, resolve);
                return;
            }
            yield this._handleStoppedDevice(device, resolve);
        }), true);
    }
    _handleMonitoredDevice(device, resolve) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = device.Id;
            const alreadyInit = this.devices[String(id)];
            const deviceName = device.Name;
            console.log(`${deviceName} is monitored, it will be initialized`);
            // get All data monitor inside the profile
            const intervals = yield device.getProfileData();
            const children = intervals.map((interval) => interval.children)
                .flat()
                .filter((child) => typeof child !== "undefined" && child !== null);
            yield this._addToEndpointCreationQueue(device, children); // add to endpoint creation queue
            if (!alreadyInit && typeof id !== "undefined") {
                this.devices[id] = device; // store to device object if not already initialized
                resolve(device);
                return device;
            }
            // separate cov items from poll items
            const [covItems, pollItems] = intervals.reduce((acc, interval) => {
                var _a, _b, _c;
                if (((_a = interval.interval) === null || _a === void 0 ? void 0 : _a.toString().toLowerCase()) === 'cov' && ((_b = interval.children) === null || _b === void 0 ? void 0 : _b.length)) {
                    acc[0].push(...interval.children);
                }
                else if ((_c = interval.children) === null || _c === void 0 ? void 0 : _c.length) {
                    acc[1].push(interval);
                }
                return acc;
            }, [[], []]); // separate cov items from poll items
            yield this._addToCovQueue(device, covItems); // add to cov queue
            yield this._addToIntervalQueue(id, pollItems); // add to interval queue
            resolve(device);
            return device;
        });
    }
    _handleStoppedDevice(device, resolve) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = device.Id;
            const alreadyInit = this.devices[id];
            const deviceName = device.Name;
            console.log(`${deviceName} is stopped`);
            yield this.removeFromMonitoringMaps(id); // remove from monitoring maps
            if (device === null || device === void 0 ? void 0 : device.covData)
                SpinalCov_1.SpinalCov.getInstance().addToStopCovQueue({ spinalDevice: device, children: device.covData });
            yield (device === null || device === void 0 ? void 0 : device.clearCovList());
            // Keep the device in the list even if not initialized
            if (!alreadyInit) {
                this.devices[id] = device;
            }
            resolve(device);
        });
    }
    _addToCovQueue(spinalDevice, children) {
        return __awaiter(this, void 0, void 0, function* () {
            const covData = spinalDevice.pushToCovList(children);
            SpinalCov_1.SpinalCov.getInstance().addToCovQueue({ spinalDevice, children: covData });
        });
    }
    _addToIntervalQueue(id, intervals) {
        for (const { interval } of intervals) {
            if (typeof interval !== 'undefined' && interval !== null && !isNaN(Number(interval))) {
                this._itemToAddToMap.addToQueue({ id, interval });
            }
        }
    }
    /**
     *  Add an item to the monitoring map and priority queue
     * @param id
     * @param interval
     * @param func
     */
    _addDeviceIntervalsToMonitoringMap(spinalDevice) {
        const intervals = spinalDevice.getAllIntervals();
        const id = spinalDevice.Id;
        for (const interval of intervals) {
            if (isNaN(Number(interval)))
                return; // if the interval is not a number, do not add to monitoring
            const _interval = Number(interval);
            let priority = Date.now() + _interval;
            let values = this.intervalTimesMap.get(_interval); // get existing data for this interval time
            if (!values)
                values = []; // create new array if not exist
            values.push({ id });
            this.intervalTimesMap.set(_interval, values);
            this._addToPriorityQueue(_interval, priority);
        }
    }
    _addToPriorityQueue(interval, priority) {
        const priorities = this.priorityQueue.toArray().map(el => el.element);
        // if the same id with the same interval already exist in the priority queue, do not add it again
        if (!priorities.some(el => el.interval === interval))
            this.priorityQueue.enqueue({ interval, priority }, priority);
    }
    removeFromMonitoringMaps(deviceId) {
        // this.removeFromPriorityQueue(deviceId);
        const intervals = Array.from(this.intervalTimesMap.keys());
        for (const interval of intervals) {
            const value = this.intervalTimesMap.get(interval);
            if (!value)
                continue;
            const valueCopy = !Array.isArray(value) ? [value] : value;
            const valueFiltered = valueCopy.filter(el => el.id !== deviceId);
            if (valueFiltered.length === 0)
                this.intervalTimesMap.delete(interval);
            else
                this.intervalTimesMap.set(interval, valueFiltered);
        }
    }
    launchUpdating(deviceToUpdate, interval, date) {
        return __awaiter(this, void 0, void 0, function* () {
            const deviceCopy = [...deviceToUpdate];
            while (deviceCopy.length > 0) {
                const item = deviceCopy.shift();
                if (!item)
                    continue;
                const { id } = item;
                try {
                    const device = this.devices[id];
                    if (device)
                        yield (device === null || device === void 0 ? void 0 : device.updateEndpoints(interval));
                }
                catch (error) {
                    console.error(error);
                }
            }
            const new_priority = Date.now() + interval;
            this._addToPriorityQueue(interval, new_priority);
            // this.intervalTimesMap.set(new_priority, deviceToUpdate);
        });
    }
    _addToEndpointCreationQueue(spinalDevice, children) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Traiter la creation des endpoinrs dans une Queue, 
                // pour eviter l'envoie de plusieurs requête bacnet
                this._endpointsCreationQueue.addToQueue({ spinalDevice, children });
            }
            catch (error) {
                console.error(error);
            }
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
}
const spinalMonitoring = SpinalMonitoring.getInstance();
exports.spinalMonitoring = spinalMonitoring;
// spinalMonitoring.init();
exports.default = spinalMonitoring;
//# sourceMappingURL=SpinalMonitoring.js.map