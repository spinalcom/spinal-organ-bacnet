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
const SpinalPilot_1 = require("./SpinalPilot");
class SpinalMonitoring {
    constructor() {
        this.queue = new SpinalQueuing_1.SpinalQueuing();
        // private priorityQueue: MinPriorityQueue<{ interval: number; functions: { id: string; func: Function }[] }> = new MinPriorityQueue();
        this.priorityQueue = new priority_queue_1.MinPriorityQueue();
        this.isProcessing = false;
        this.intervalTimesMap = new Map();
        this.initializedMap = new Map();
        this.binded = [];
        this.devices = [];
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
    }
    startDeviceInitialisation() {
        return __awaiter(this, void 0, void 0, function* () {
            const list = this.queue.getQueue();
            this.queue.refresh();
            const promises = list.map(el => SpinalNetworkServiceUtilities_1.SpinalNetworkServiceUtilities.initSpinalListenerModel(el));
            const devices = lodash.flattenDeep(yield Promise.all(promises)).filter(el => typeof el !== "undefined");
            yield this._createMaps(devices);
            if (!this.isProcessing) {
                this.isProcessing = true;
                this.startMonitoring();
            }
        });
    }
    startMonitoring() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("start monitoring...");
            let p = true;
            while (p) {
                if (this.priorityQueue.isEmpty()) {
                    // console.log("priority queue is empty");
                    yield this.waitFct(100);
                    continue;
                }
                const { priority, element } = this.priorityQueue.dequeue();
                const functions = this.intervalTimesMap.get(element.interval);
                if (functions && functions.length > 0) {
                    yield this.execFunc(functions, element.interval, priority);
                }
            }
        });
    }
    _createMaps(devices) {
        return __awaiter(this, void 0, void 0, function* () {
            const devices_copy = Object.assign([], devices);
            while (devices_copy.length > 0) {
                const { id, spinalModel, spinalDevice, networkService, network, profil, organ } = devices_copy.shift();
                const listen = spinalModel.listen.get();
                if (!listen) {
                    this.removeToMaps(id);
                    console.log(spinalDevice.device.name, "is stopped");
                    continue;
                }
                // const monitors = spinalModel.monitor.getMonitoringData();
                // const intervals = await this.getValidIntervals(spinalDevice, networkService, spinalModel, network, monitor);
                // const { toMonitors: intervals, toBind } = await this.getValidIntervals(spinalDevice, networkService, spinalModel, network, profil);
                // await this._bindEndpoints(toBind, organ, spinalDevice.device);
                const { measures, alarms, commands } = yield this._getSupervisionDetails(profil.getId().get());
                const measuresInfo = yield this._checkAndFormatMeasure(measures, spinalDevice, networkService, spinalModel, network);
                yield this._bindEndpoints(measuresInfo.endpoints, spinalDevice.device);
                for (const { interval, func } of measuresInfo.monitors) {
                    this._addToMap(id, interval, func);
                }
                if (this.binded.indexOf(id) === -1) {
                    spinalModel.listen.bind(() => {
                        console.log("listen changed");
                        this.addToMonitoringList(spinalModel);
                    });
                }
            }
        });
    }
    _getSupervisionDetails(profileId) {
        return __awaiter(this, void 0, void 0, function* () {
            const supervisionDetails = yield SpinalNetworkServiceUtilities_1.SpinalNetworkServiceUtilities.getSupervisionDetails(profileId);
            return { measures: this._formatByInterval(supervisionDetails.measures), alarms: this._formatByInterval(supervisionDetails.measures), commands: [] };
        });
    }
    _bindEndpoints(endpointsList, device) {
        return __awaiter(this, void 0, void 0, function* () {
            // const promises = endpointsList.map(async (endpointNode) => {
            for (const endpointNode of endpointsList) {
                const endpointElement = yield endpointNode.element.load();
                console.log(endpointElement.name.get());
                endpointElement.currentValue.bind(() => __awaiter(this, void 0, void 0, function* () {
                    const newValue = endpointElement.currentValue.get();
                    yield this.sendUpdateRequest(endpointElement, device, newValue);
                }), false);
            }
            // })
            // return Promise.all(promises)
        });
    }
    sendUpdateRequest(endpointElement, device, newValue) {
        return __awaiter(this, void 0, void 0, function* () {
            // const [organNode] = await this.getEndpointOrgan(nodeId);
            // const devices = await this.getDevices(nodeId);
            // const organ = await organNode.element.load();
            // let organ = organNode;
            const request = {
                address: device.address,
                deviceId: device.deviceId,
                objectId: { type: endpointElement.typeId.get(), instance: endpointElement.id.get() },
                value: newValue,
            };
            console.log(endpointElement.name.get(), "a changé de value", newValue);
            SpinalPilot_1.default.sendPilotRequest(request);
            // const spinalPilot = new SpinalPilotModel(organ, requests);
            // await spinalPilot.addToNode(endpointNode);
            // return spinalPilot;
        });
    }
    _addToMap(id, interval, func) {
        let value = this.intervalTimesMap.get(interval);
        if (typeof value === "undefined") {
            value = [];
        }
        value.push({ id, func });
        this.intervalTimesMap.set(interval, value);
        this._addIntervalToPriorityQueue(interval);
    }
    removeToMaps(deviceId) {
        this.intervalTimesMap.forEach((value, key) => {
            this.intervalTimesMap.set(key, value.filter(el => el.id !== deviceId));
        });
    }
    _addIntervalToPriorityQueue(interval) {
        const arr = this.priorityQueue.toArray();
        const found = arr.find(({ element }) => {
            return element.interval === interval;
        });
        if (typeof found === "undefined") {
            this.priorityQueue.enqueue({ interval }, Date.now() + interval);
        }
    }
    execFunc(functions, interval, date) {
        return __awaiter(this, void 0, void 0, function* () {
            if (date && Date.now() < date) {
                console.log("wait");
                yield this.waitFct(date - Date.now());
            }
            try {
                const deep_functions = [...functions];
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
                this.priorityQueue.enqueue({ interval }, Date.now() + interval);
            }
            catch (error) {
                console.error(error);
                this.priorityQueue.enqueue({ interval }, Date.now() + interval);
            }
        });
    }
    createDataIfNotExist(spinalDevice, children, networkService, interval) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // const id = `${spinalDevice.device.deviceId}_${interval}`;
                // let init = this.initializedMap.get(id);
                // if (!init) {
                // console.log("initialisation");
                // this.initializedMap.set(id, true);
                const endpoints = yield spinalDevice.checkAndCreateIfNotExist(networkService, children);
                return lodash.flattenDeep(endpoints);
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
    _checkAndFormatMeasure(measures, spinalDevice, networkService, spinalModel, network) {
        return __awaiter(this, void 0, void 0, function* () {
            const monitors_copy = Object.assign([], measures);
            const res = [];
            const endpoints = [];
            while (monitors_copy.length > 0) {
                const { interval, children } = monitors_copy.shift();
                if (isNaN(interval) || interval <= 0 || children.length <= 0)
                    continue;
                const liste = yield this.createDataIfNotExist(spinalDevice, children, networkService, interval);
                endpoints.push(...liste);
                const func = () => __awaiter(this, void 0, void 0, function* () { return this.funcToExecute(spinalModel, spinalDevice, children, networkService, network); });
                res.push({
                    interval,
                    children,
                    func
                });
            }
            return { monitors: res, endpoints };
        });
    }
    _checkAndFormatCommands(commands, spinalDevice, networkService, spinalModel, network, profil) {
        // Function en attente de finalisation
    }
    /*
       private async getValidIntervals(spinalDevice: SpinalDevice, networkService: NetworkService, spinalModel: SpinalListenerModel, network: SpinalNode, profil: SpinalNode) {
    
          const { measures, alarms, commands } = await SpinalNetworkServiceUtilities.getSupervisionDetails(profil.getId().get());
          const monitors_copy = this._formatByInterval(measures);
          // const monitors_copy = Object.assign([], monitors);
          const res = []
          const nodeToBind = []
          while (monitors_copy.length > 0) {
             const { interval, children } = monitors_copy.shift();
             if (isNaN(interval) || interval <= 0 || children.length <= 0) continue;
             const liste = await this.createDataIfNotExist(spinalDevice, children, networkService, interval);
             nodeToBind.push(...liste);
             const func = async () => this.funcToExecute(spinalModel, spinalDevice, children, networkService, network);
             res.push({
                interval,
                children,
                func
             })
          }
          return { toMonitors: res, toBind: nodeToBind };
       }
    private async getValidIntervals(spinalDevice: SpinalDevice, networkService: NetworkService, spinalModel: SpinalListenerModel, network: SpinalNode, monitors: { interval: number; children: [] }[]) {
       const monitors_copy = Object.assign([], monitors);
       const res = []
       while (monitors_copy.length > 0) {
          const { interval, children } = monitors_copy.shift();
          if (isNaN(interval) || interval <= 0 || children.length <= 0) continue;
          await this.createDataIfNotExist(spinalDevice, children, networkService, interval);
          const func = async () => this.funcToExecute(spinalModel, spinalDevice, children, networkService, network);
          res.push({
             interval,
             children,
             func
          })
       }
       return res;
    }
    */
    waitFct(nb) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, nb >= 0 ? nb : 0);
        });
    }
    _formatByInterval(array) {
        return array.map(({ monitoring: { IntervalTime }, children }) => ({ interval: IntervalTime, children }));
    }
}
const spinalMonitoring = new SpinalMonitoring();
exports.spinalMonitoring = spinalMonitoring;
spinalMonitoring.init();
exports.default = spinalMonitoring;
//# sourceMappingURL=SpinalMonitoring.js.map