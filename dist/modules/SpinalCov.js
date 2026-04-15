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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpinalCov = void 0;
const spinal_connector_service_1 = require("spinal-connector-service");
const BacnetUtilities_1 = __importDefault(require("../utilities/BacnetUtilities"));
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const SpinalNetworkUtilities_1 = require("../utilities/SpinalNetworkUtilities");
const events_1 = __importDefault(require("events"));
class SpinalCov extends events_1.default {
    constructor() {
        super();
        this.itemToWatchQueue = new spinal_connector_service_1.SpinalQueue(10000); // 5s delay before start item treatment, no auto start
        this.itemsToStopQueue = new spinal_connector_service_1.SpinalQueue();
        // private forkedProcess: ChildProcess | null = null; // process handling COV subscriptions 
        this._lastCovNotification = null;
        this.itemMonitored = new Map();
        this._listenEvents(); // start listening to messages from cov process
        this.itemToWatchQueue.on("start", () => {
            const list = this.itemToWatchQueue.toArray();
            this.itemToWatchQueue.clear(); // clear queue to avoid duplicate processing
            this.processToDataTreatment(list, GlobalVariables_1.COV_EVENTS_NAMES.subscribe);
        });
        this.itemsToStopQueue.on("start", () => {
            const list = this.itemsToStopQueue.toArray();
            this.itemsToStopQueue.clear(); // clear queue to avoid duplicate processing
            this.processToDataTreatment(list, GlobalVariables_1.COV_EVENTS_NAMES.unsubscribe);
        });
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
        console.log("start cov proccessing with", this.itemToWatchQueue.toArray().length, "items to monitor");
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
    processToDataTreatment(list, eventName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const formatted = [];
            for (const { spinalDevice, children } of list) {
                const ip = (_a = spinalDevice === null || spinalDevice === void 0 ? void 0 : spinalDevice.device) === null || _a === void 0 ? void 0 : _a.address;
                if (!ip)
                    continue; // skip if no ip
                if (eventName === GlobalVariables_1.COV_EVENTS_NAMES.subscribe)
                    this.itemMonitored.set(ip, { spinalDevice, children }); // Store the device
                else if (eventName === GlobalVariables_1.COV_EVENTS_NAMES.unsubscribe && this.itemMonitored.has(ip)) {
                    console.log(`[COV] - Unsubscribing from device ${ip}`);
                    this.itemMonitored.delete(ip); // Remove the device
                }
                formatted.push(...this.formatChildren(ip, children));
            }
            BacnetUtilities_1.default.sendCovRequest({ eventName, data: formatted });
            // sendEvent({ eventName, data: formatted });
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
        return children.map((child) => ({ ip, object: { instance: child.instance, type: child.type } }));
    }
    /*
    private createForkedProcess(): ChildProcess {

        const path = require.resolve("./cov");
        const forked = fork(path);

        forked.on("message", async (result: { key: string, eventName: string, error?: Error, data: any }) => {
            switch (result.eventName) {
                case COV_EVENTS_NAMES.subscribed:
                    console.log("[COV] - Subscribed to", result.key);
                    break;
                case COV_EVENTS_NAMES.error:
                    BacnetUtilities.incrementState("failed");
                    console.error(`[COV] - Failed  due to", "${result.error?.message}"`);
                    // forked.kill();
                    break;
                case COV_EVENTS_NAMES.changed:
                    this.updateLastCovNotificationTime();
                    await this._updateDeviceValue(result.data.address, result.data.request);
                    break;

            }

        });

        forked.on("error", (err: Error) => { });

        forked.on("exit", (code: number) => { });

        return forked;
    }
    */
    _updateDeviceValue(address, request) {
        return __awaiter(this, void 0, void 0, function* () {
            const currentValue = request.values.find((v) => { var _a; return ((_a = v.property) === null || _a === void 0 ? void 0 : _a.id) === GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE; });
            if (!currentValue)
                return;
            const value = BacnetUtilities_1.default._getObjValue(currentValue.value); // extract value
            const object = request.monitoredObjectId;
            const monitoredData = this.itemMonitored.get(address);
            if (!monitoredData)
                return;
            const { spinalDevice } = monitoredData;
            const key = `${object.type}_${object.instance}`;
            const children = [{ id: object.instance, currentValue: value, type: object.type }]; // format children to update
            console.log(`[COV] - Updating item (${object}) from device ${address} with value ${value}`);
            const node = spinalDevice.getBmsDeviceNode();
            if (node)
                return SpinalNetworkUtilities_1.SpinalNetworkUtilities.updateEndpointInGraph(spinalDevice, children);
        });
    }
    _listenEvents() {
        this.on(GlobalVariables_1.COV_EVENTS_NAMES.subscribed, (data) => __awaiter(this, void 0, void 0, function* () {
            console.log("[COV] - Subscribed to", data === null || data === void 0 ? void 0 : data.key);
        }));
        this.on(GlobalVariables_1.COV_EVENTS_NAMES.error, (data) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            console.error(`[COV] - Failed to subscribe to ${data === null || data === void 0 ? void 0 : data.key} due to", "${(_a = data === null || data === void 0 ? void 0 : data.error) === null || _a === void 0 ? void 0 : _a.message}"`);
        }));
        this.on(GlobalVariables_1.COV_EVENTS_NAMES.changed, (_a) => __awaiter(this, [_a], void 0, function* ({ data }) {
            console.log("[COV] - Change event received from", data === null || data === void 0 ? void 0 : data.address);
            // SpinalCov.getInstance().updateLastCovNotificationTime();
            yield SpinalCov.getInstance()._updateDeviceValue(data.address, data.request);
        }));
    }
}
exports.SpinalCov = SpinalCov;
//# sourceMappingURL=SpinalCov.js.map