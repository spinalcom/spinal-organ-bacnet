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
exports.SpinalDeviceListener = void 0;
const Utilities_1 = require("../utilities/Utilities");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const globalVariables_1 = require("../utilities/globalVariables");
const events_1 = require("events");
const bacnet = require("bacstack");
const lodash = require("lodash");
class SpinalDeviceListener extends events_1.EventEmitter {
    constructor(listenerModel) {
        super();
        this.client = new bacnet();
        this.networkService = new spinal_model_bmsnetwork_1.default(false);
        this.listenerModel = listenerModel;
        this.init();
        this.on("initialize", () => {
            this._bindListen();
            this._bindTimeInterval();
        });
        // console.log("listenerModel", listenerModel);
    }
    init() {
        Utilities_1.loadFile(this.listenerModel.deviceId.get()).then((data) => __awaiter(this, void 0, void 0, function* () {
            const graph = yield this._getGraph();
            this.children = data.children;
            this.device = data.device;
            yield this.networkService.init(graph, {
                contextName: this.listenerModel.context.name.get(),
                contextType: this.listenerModel.context.type.get(),
                networkType: this.listenerModel.network.type.get(),
                networkName: this.listenerModel.network.networkName.get()
            });
            this.timeIntervalDebounced = lodash.debounce(() => { console.log("call inside debounce"); this._createTimeInterval(); }, 500);
            this.emit("initialize");
        })).catch((err) => {
            console.error(err);
        });
    }
    _bindListen() {
        this.listenerModel.listen.bind(() => {
            this.timeIntervalDebounced();
        });
        // setInterval(() => {
        //    this._updateEndpoints();
        // }, 15000);
    }
    _bindTimeInterval() {
        this.listenerModel.timeInterval.bind(() => {
            this.timeIntervalDebounced();
        });
    }
    _createTimeInterval() {
        if (this.timeIntervalId) {
            clearInterval(this.timeIntervalId);
        }
        if (this.listenerModel.listen.get()) {
            this.timeIntervalId = setInterval(() => this._updateEndpoints(), this.listenerModel.timeInterval.get());
        }
    }
    _updateEndpoints() {
        console.log("update");
        const objectListDetails = [];
        this.children.map(object => {
            return () => {
                return this._getChildrenNewValue(object).then((g) => objectListDetails.push(g));
            };
        }).reduce((previous, current) => { return previous.then(current); }, Promise.resolve()).then(() => {
            const obj = {
                id: this.device.deviceId,
                children: this._groupByType(lodash.flattenDeep(objectListDetails))
            };
            this.networkService.updateData(obj);
        });
    }
    _getChildrenNewValue(children) {
        const requestArray = children.map(el => {
            return {
                objectId: el,
                properties: [{ id: globalVariables_1.PropertyIds.PROP_PRESENT_VALUE }]
            };
        });
        return new Promise((resolve, reject) => {
            this.client.readPropertyMultiple(this.device.address, requestArray, (err, data) => {
                if (err) {
                    console.error(err);
                    reject(err);
                    return;
                }
                const dataFormated = data.values.map(el => {
                    const value = this._getObjValue(el.values[0].value);
                    return {
                        id: el.objectId.instance,
                        type: el.objectId.type,
                        currentValue: this._formatCurrentValue(value, el.objectId.type)
                    };
                });
                resolve(dataFormated);
            });
        });
    }
    _getObjValue(value) {
        if (Array.isArray(value)) {
            if (value.length === 0)
                return "";
            return value[0].value;
        }
        return value.value;
    }
    _formatCurrentValue(value, type) {
        if ([globalVariables_1.ObjectTypes.OBJECT_BINARY_INPUT, globalVariables_1.ObjectTypes.OBJECT_BINARY_VALUE].indexOf(type) !== -1) {
            return value ? true : false;
        }
        return value;
    }
    _groupByType(itemList) {
        const res = [];
        const obj = lodash.groupBy(itemList, (a) => a.type);
        for (const [key, value] of Object.entries(obj)) {
            res.push({
                id: parseInt(key),
                children: obj[key]
            });
        }
        return res;
    }
    _getGraph() {
        return new Promise((resolve, reject) => {
            this.listenerModel.graph.load((graph) => resolve(graph));
        });
    }
}
exports.SpinalDeviceListener = SpinalDeviceListener;
//# sourceMappingURL=SpinalDeviceListener.js.map