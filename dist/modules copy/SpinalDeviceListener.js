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
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const events_1 = require("events");
const bacnet = require("bacstack");
const lodash = require("lodash");
const SpinalMonitoring_1 = require("./SpinalMonitoring");
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
class SpinalDeviceListener extends events_1.EventEmitter {
    constructor(listenerModel) {
        super();
        // private client: bacnet = new bacnet();
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
            const graph = yield this._getGraph();
            this.device = yield this._getDeviceInfo();
            this.networkNode = yield this._getNetworkNode();
            this.contextNode = yield this._getContextNode();
            this.organ = yield this._getOrganInfo();
            if (graph && this.device && this.networkNode && this.contextNode && this.organ) {
                yield this.networkService.init(graph, {
                    contextName: this.contextNode.getName().get(),
                    contextType: this.contextNode.getType().get(),
                    networkType: this.organ.type.get(),
                    networkName: this.organ.name.get()
                });
                // // if (this.listenerModel.listen.get()) {
                // await this.checkIfItemExist(this.networkService, (<any>this.device).id);
                // // }
                this.emit("initialize");
            }
        });
    }
    _bindListen() {
        this.listenerModel.listen.bind(() => __awaiter(this, void 0, void 0, function* () {
            if (this.listenerModel.listen.get() && this.listenerModel.monitor) {
                yield this.checkIfItemExist(this.networkService, this.device.id);
                this.monitorBind = this.listenerModel.monitor.bind(() => {
                    this._stopMonitors();
                    for (let i = 0; i < this.listenerModel.monitor.length; i++) {
                        const model = this.listenerModel.monitor[i];
                        const spinalMonitoring = new SpinalMonitoring_1.default(model, (children) => {
                            if (children.length > 0)
                                this._updateEndpoints(children);
                        });
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
                // console.log(`${new Date()} ===> ${(<any>this.device).name} is stopped`);
                this._stopMonitors();
            }
            // this.timeIntervalDebounced()
        }));
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
        console.log(`${new Date()} ===> update ${this.device.name}`);
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
        const client = new bacnet();
        const requestArray = children.map(el => {
            return {
                objectId: el,
                properties: [{ id: GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE }]
            };
        });
        return new Promise((resolve, reject) => {
            client.readPropertyMultiple(this.device.address, requestArray, (err, data) => {
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
                client.close();
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
        if ([GlobalVariables_1.ObjectTypes.OBJECT_BINARY_INPUT, GlobalVariables_1.ObjectTypes.OBJECT_BINARY_VALUE].indexOf(type) !== -1) {
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
            this.listenerModel.graph.load((graph) => {
                resolve(graph);
            });
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
        return __awaiter(this, void 0, void 0, function* () {
            console.log(new Date(), "===> checking if items exists", this.device.name);
            const client = new bacnet();
            if (this.listenerModel.monitor) {
                let objectIds = [];
                for (let i = 0; i < this.listenerModel.monitor.length; i++) {
                    objectIds.push(...this.listenerModel.monitor[i].children.get());
                }
                const children = lodash.chunk(objectIds, 60);
                return this._getAllObjectDetails(children, client).then((objectListDetails) => {
                    const childrenGroups = lodash.groupBy(lodash.flattenDeep(objectListDetails), function (a) { return a.type; });
                    const promises = Array.from(Object.keys(childrenGroups)).map((el) => {
                        return BacnetUtilities_1.default.createEndpointsInGroup(networkService, deviceId, el, childrenGroups[el]);
                    });
                    return Promise.all(promises).then((result) => {
                        console.log("result", result);
                    });
                }).catch((err) => {
                    // console.error(err)
                });
            }
        });
    }
    _getAllObjectDetails(objectLists, client) {
        // console.log("getting object details");
        const objectListDetails = [];
        return new Promise((resolve, reject) => {
            objectLists.map(object => {
                return () => {
                    return BacnetUtilities_1.default._getObjectDetail(this.device, object, client).then((g) => objectListDetails.push(g));
                };
            }).reduce((previous, current) => { return previous.then(current); }, Promise.resolve()).then(() => {
                resolve(objectListDetails);
            });
        });
    }
}
exports.SpinalDeviceListener = SpinalDeviceListener;
//# sourceMappingURL=SpinalDeviceListener.js.map