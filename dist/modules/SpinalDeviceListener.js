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
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const globalVariables_1 = require("../utilities/globalVariables");
const events_1 = require("events");
const bacnet = require("bacstack");
const lodash = require("lodash");
const SpinalMonitoring_1 = require("./SpinalMonitoring");
const bacnetUtilities_1 = require("../utilities/bacnetUtilities");
class SpinalDeviceListener extends events_1.EventEmitter {
    constructor(listenerModel) {
        super();
        this.client = new bacnet();
        this.networkService = new spinal_model_bmsnetwork_1.default(false);
        this.spinalMonitors = [];
        this.listenerModel = listenerModel;
        this.init();
        this.on("initialize", () => {
            this._bindListen();
            // this._bindTimeInterval();
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            // loadFile(this.listenerModel.deviceId.get()).then(async (data: { device: IDevice, children: Array<Array<{ type: number, instance: number }>> }) => {
            const graph = yield this._getGraph();
            // this.children = data.children;
            this.device = yield this._getDeviceInfo();
            this.networkNode = yield this._getNetworkNode();
            this.contextNode = yield this._getContextNode();
            this.organ = yield this._getOrganInfo();
            yield this.networkService.init(graph, {
                contextName: this.contextNode.getName().get(),
                contextType: this.contextNode.getType().get(),
                networkType: this.organ.type.get(),
                networkName: this.organ.name.get()
                // // networkType: this.listenerModel.network.type.get(),
                // // networkName: this.listenerModel.network.networkName.get()
            });
            if (this.listenerModel.listen.get()) {
                yield this.checkIfItemExist(this.networkService, this.device.id);
            }
            this.emit("initialize");
        });
    }
    _bindListen() {
        this.listenerModel.listen.bind(() => {
            if (this.listenerModel.listen.get() && this.listenerModel.monitor) {
                this.monitorBind = this.listenerModel.monitor.bind(() => {
                    this._stopMonitors();
                    for (let i = 0; i < this.listenerModel.monitor.length; i++) {
                        const model = this.listenerModel.monitor[i];
                        const spinalMonitoring = new SpinalMonitoring_1.default(model, (children) => this._updateEndpoints(children));
                        spinalMonitoring.start();
                        this.spinalMonitors.push(spinalMonitoring);
                    }
                });
                return;
            }
            else if (!this.listenerModel.listen.get()) {
                if (this.monitorBind) {
                    this.listenerModel.monitor.unbind(this.monitorBind);
                }
                console.log(`${this.device.name} is stopped`);
                this._stopMonitors();
            }
            // this.timeIntervalDebounced()
        });
        // setInterval(() => {
        //    this._updateEndpoints();
        // }, 15000);
    }
    _stopMonitors() {
        for (const spinalMonitoring of this.spinalMonitors) {
            spinalMonitoring.stop();
        }
        this.spinalMonitors = [];
    }
    _updateEndpoints(children) {
        console.log(`update ${this.device.name}`);
        this._getChildrenNewValue(children).then((objectListDetails) => {
            console.log("new values", objectListDetails);
            const obj = {
                id: this.device.idNetwork,
                children: this._groupByType(lodash.flattenDeep(objectListDetails))
            };
            this.networkService.updateData(obj, null, this.networkNode);
        }).catch(() => { });
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
                    // console.error(err)
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
    _getNetworkNode() {
        return new Promise((resolve, reject) => {
            this.listenerModel.network.load((networkNode) => {
                resolve(networkNode);
            });
        });
        // console.log(contextId, nodeId);
        // const realNode = SpinalGraphService.getRealNode(nodeId);
        // if (realNode) return realNode;
        // const found = await SpinalGraphService.findInContext(contextId, contextId, (node) => {
        //    console.log("node", node)
        //    if (node.getId().get() === nodeId) return true;
        //    return false;
        // });
        // console.log("found", found)
        // if (found.length > 0) {
        //    return found[0];
        // }
    }
    _getContextNode() {
        return new Promise((resolve, reject) => {
            this.listenerModel.context.load((contextNode) => {
                resolve(contextNode);
            });
        });
    }
    _getDeviceInfo() {
        return new Promise((resolve, reject) => {
            this.listenerModel.device.load((deviceNode) => {
                const info = deviceNode.info.get();
                resolve(info);
            });
        });
    }
    _getOrganInfo() {
        return new Promise((resolve, reject) => {
            this.listenerModel.organ.load((organ) => {
                resolve(organ);
            });
        });
    }
    checkIfItemExist(networkService, deviceId) {
        if (this.listenerModel.monitor) {
            let children = [];
            console.log(this.device.name);
            for (let i = 0; i < this.listenerModel.monitor.length; i++) {
                children.push(...this.listenerModel.monitor[i].children.get());
            }
            const objectListDetails = [];
            lodash.chunk(children, 60).map(object => {
                return () => {
                    return bacnetUtilities_1.default._getObjectDetail(this.client, this.device, object).then((g) => objectListDetails.push(g)).catch(() => { });
                };
            })
                .reduce((previous, current) => { return previous.then(current).catch(current); }, Promise.resolve()).then(() => __awaiter(this, void 0, void 0, function* () {
                const children = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type; });
                const promises = Array.from(Object.keys(children)).map((el) => {
                    return bacnetUtilities_1.default._createEndpointsGroup(networkService, deviceId, el).then(endpointGroup => {
                        const groupId = endpointGroup.id.get();
                        return bacnetUtilities_1.default._createEndpointByArray(networkService, groupId, children[el]);
                    });
                });
                return Promise.all(promises);
            })).catch(() => { });
        }
    }
    _createObjectIfNotExit(children) {
    }
}
exports.SpinalDeviceListener = SpinalDeviceListener;
//# sourceMappingURL=SpinalDeviceListener.js.map