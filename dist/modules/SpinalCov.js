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
exports.SpinalCov = void 0;
const spinal_connector_service_1 = require("spinal-connector-service");
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
const child_process_1 = require("child_process");
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const cov_1 = require("./cov");
class SpinalCov {
    constructor() {
        this.itemToWatchQueue = new spinal_connector_service_1.SpinalQueue(60 * 1000);
        this.itemsToStopQueue = new spinal_connector_service_1.SpinalQueue();
        // private forkedProcess: ChildProcess | null = null; // process handling COV subscriptions 
        this._lastCovNotification = null;
        this.itemMonitored = new Map();
        (0, cov_1.listenEventMessage)(); // start listening to messages from cov process
        this._checkCovStatus(); // Check COV status every 1 minute
        this.itemToWatchQueue.on("start", this.processToQueueTreatment.bind(this, this.itemToWatchQueue, GlobalVariables_1.COV_EVENTS_NAMES.subscribe));
        this.itemsToStopQueue.on("start", this.processToQueueTreatment.bind(this, this.itemsToStopQueue, GlobalVariables_1.COV_EVENTS_NAMES.unsubscribe));
    }
    static getInstance() {
        if (!this._instance)
            this._instance = new SpinalCov();
        return this._instance;
    }
    updateLastCovNotificationTime() {
        this._lastCovNotification = Date.now();
    }
    startCovProcessing() {
        console.log("Hello from startCovProcessing", this.itemMonitored.size);
        this.itemToWatchQueue.start();
    }
    stopAllCovSubscriptions() {
        const allItems = Array.from(this.itemMonitored.values());
        this.addToStopCovQueue(allItems);
        return allItems;
    }
    restartAllCovSubscriptions() {
        console.log("[COV] - Restarting all COV subscriptions after client reset");
        const allItems = Array.from(this.itemMonitored.values());
        this.addToCovQueue(allItems);
        setTimeout(() => {
            this.startCovProcessing();
        }, 4000);
    }
    // resetAllSubscriptions() {
    //     const allItems = Array.from(this.itemMonitored.values());
    //     console.log("[COV] - Resetting all subscriptions", allItems.length);
    //     this.itemsToStopQueue.setQueue(allItems as ICovData[]); // stop all first
    //     // then 4s later, re-subscribe all
    //     setTimeout(() => {
    //         console.log("[COV] - Re-subscribing all subscriptions", allItems.length);
    //         this.itemToWatchQueue.setQueue(allItems as ICovData[]);
    //         this.itemToWatchQueue.start();
    //     }, 4000);
    // }
    addToCovQueue(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(data))
                data = [data];
            for (const obj of data) {
                this.itemToWatchQueue.addToQueue(obj);
            }
        });
    }
    addToStopCovQueue(data) {
        if (!Array.isArray(data))
            data = [data];
        for (const obj of data) {
            this.itemsToStopQueue.addToQueue(obj);
        }
    }
    processToQueueTreatment(queue, eventName) {
        return __awaiter(this, void 0, void 0, function* () {
            // init process before starting cov, initialization
            // if (!this.forkedProcess) {
            //     this.forkedProcess = this.createForkedProcess();
            // }
            var _a;
            const list = queue.getQueue();
            queue.refresh();
            const formatted = [];
            for (const { networkService, network, spinalDevice, children } of list) {
                const ip = (_a = spinalDevice === null || spinalDevice === void 0 ? void 0 : spinalDevice.device) === null || _a === void 0 ? void 0 : _a.address;
                if (!ip)
                    continue; // skip if no ip
                if (eventName === GlobalVariables_1.COV_EVENTS_NAMES.subscribe)
                    this.itemMonitored.set(ip, { networkService, network, spinalDevice, children }); // Store the device
                else if (eventName === GlobalVariables_1.COV_EVENTS_NAMES.unsubscribe && this.itemMonitored.has(ip)) {
                    console.log(`[COV] - Unsubscribing from device ${ip}`);
                    this.itemMonitored.delete(ip); // Remove the device
                }
                formatted.push(...this.formatChildren(ip, children));
            }
            (0, cov_1.sendEvent)({ eventName, data: formatted });
        });
    }
    _checkCovStatus() {
        setInterval(() => {
            if (this.itemMonitored.size === 0)
                return; // no subscription, skip check
            const sinceNow = this._lastCovNotification ? (Date.now() - this._lastCovNotification) : -1;
            const alertTime = 60 * 1000; // 1 minute without COV notification;
            const tooLong = sinceNow > alertTime; // more than 1 minute
            if (tooLong) {
                console.log(`[COV] - No COV notification received for more than ${alertTime / 1000}s , restarting all subscriptions`);
                this.restartAllCovSubscriptions();
            }
        }, 60 * 1000);
    }
    formatChildren(ip, children) {
        return children.map((child) => ({ ip, object: child }));
    }
    createForkedProcess() {
        const path = require.resolve("./cov");
        const forked = (0, child_process_1.fork)(path);
        forked.on("message", (result) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            switch (result.eventName) {
                case GlobalVariables_1.COV_EVENTS_NAMES.subscribed:
                    console.log("[COV] - Subscribed to", result.key);
                    break;
                case GlobalVariables_1.COV_EVENTS_NAMES.error:
                    BacnetUtilities_1.default.incrementState("failed");
                    console.error(`[COV] - Failed  due to", `, (_a = result.error) === null || _a === void 0 ? void 0 : _a.message);
                    // forked.kill();
                    break;
                case GlobalVariables_1.COV_EVENTS_NAMES.changed:
                    this.updateLastCovNotificationTime();
                    yield this._updateDeviceValue(result.data.address, result.data.request);
                    break;
            }
        }));
        forked.on("error", (err) => { });
        forked.on("exit", (code) => { });
        return forked;
    }
    _updateDeviceValue(address, request) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const currentValue = request.values.find((v) => { var _a; return ((_a = v.property) === null || _a === void 0 ? void 0 : _a.id) === GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE; });
            if (!currentValue)
                return;
            const value = BacnetUtilities_1.default._getObjValue(currentValue.value); // extract value
            const object = request.monitoredObjectId;
            const monitoredData = this.itemMonitored.get(address);
            if (!monitoredData)
                return;
            const { networkService, network, spinalDevice } = monitoredData;
            const obj = {
                id: (_a = spinalDevice.device) === null || _a === void 0 ? void 0 : _a.deviceId,
                children: [{ id: object.type, children: [{ id: object.instance, currentValue: value }] }],
            };
            console.log(`[COV] - Updating ${address}_${object.type}_${object.instance}`, value);
            return spinalDevice.updateEndpointInGraph(obj, networkService, network);
        });
    }
}
exports.SpinalCov = SpinalCov;
//# sourceMappingURL=SpinalCov.js.map