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
const SpinalNetworkServiceUtilities_1 = require("../utilities/SpinalNetworkServiceUtilities");
const Queuing_1 = require("../utilities/Queuing");
const Monitor_1 = require("../utilities/Monitor");
class SpinalMonitoring {
    constructor() {
        this.queue = new Queuing_1.SpinalQueuing();
        this.devices = [];
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
            let isFinish = false;
            while (!isFinish) {
                const spinalListenerModel = this.queue.dequeue();
                try {
                    if (typeof spinalListenerModel !== "undefined") {
                        const objectIds = this._getItemLists(spinalListenerModel);
                        const data = yield SpinalNetworkServiceUtilities_1.SpinalNetworkServiceUtilities.initSpinalListenerModel(spinalListenerModel);
                        yield data.spinalDevice.checkAndCreateIfNotExist(data.networkService, objectIds);
                        this.devices.push(data);
                    }
                    else {
                        isFinish = true;
                    }
                }
                catch (error) {
                    console.error(error);
                }
            }
            this.startMonitoring();
        });
    }
    startMonitoring() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const data of this.devices) {
                this.monitDevice(data);
            }
        });
    }
    monitDevice(data) {
        let monitorBind;
        data.spinalModel.listen.bind(() => {
            if (data.spinalModel.listen.get() && data.spinalModel.monitor) {
                monitorBind = data.spinalModel.monitor.bind(() => {
                    this._stopMonitors(data.monitors);
                    for (let i = 0; i < data.spinalModel.monitor.length; i++) {
                        const model = data.spinalModel.monitor[i];
                        const monitor = new Monitor_1.Monitor(model, data.networkService, data.spinalDevice, data.spinalModel, data.network);
                        monitor.start();
                        if (data.monitors) {
                            data.monitors.push(monitor);
                        }
                        else {
                            data.monitors = [monitor];
                        }
                        // this.monitors.push(monitor);
                    }
                });
            }
            else if (!data.spinalModel.listen.get()) {
                if (monitorBind) {
                    data.spinalModel.monitor.unbind(monitorBind);
                }
                this._stopMonitors(data.monitors);
            }
        });
    }
    _stopMonitors(monitors = []) {
        for (const spinalMonitoring of monitors) {
            spinalMonitoring.stop();
        }
        monitors = [];
    }
    _getItemLists(listenerModel) {
        if (listenerModel.monitor) {
            let objectIds = [];
            for (let i = 0; i < listenerModel.monitor.length; i++) {
                objectIds.push(...listenerModel.monitor[i].children.get());
            }
            return objectIds;
        }
        return [];
    }
}
const spinalMonitoring = new SpinalMonitoring();
exports.spinalMonitoring = spinalMonitoring;
spinalMonitoring.init();
exports.default = spinalMonitoring;
//# sourceMappingURL=SpinalMonitoring.js.map