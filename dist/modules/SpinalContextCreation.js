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
exports.SpinalContextCreation = void 0;
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const spinalBacnet_1 = require("./spinalBacnet");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
class SpinalContextCreation {
    constructor(model) {
        this.networkService = new spinal_model_bmsnetwork_1.NetworkService(false);
        this.bacnet = new spinalBacnet_1.SpinalBacnet(model.network.get());
        this.discoverModel = model;
        this.init();
    }
    init() {
        this.listenEvents();
        this.bindItem();
        this.bindDevices();
    }
    bindItem() {
        this.bindSateProcess = this.discoverModel.state.bind(() => {
            this.binFunc();
        });
        // this.graph.info.discover.context.bind(lodash.debounce(this.binFunc.bind(this), 1000))
    }
    bindDevices() {
        this.bindDevicesProcess = this.discoverModel.devices.bind(() => {
            console.log("inside if", this.discoverModel.devices.length, this.bacnet.count);
            if (this.discoverModel.devices.length !== 0 && this.discoverModel.devices.length === this.bacnet.count) {
                this.discoverModel.setDiscoveredMode();
                this.bacnet.closeClient();
                this.discoverModel.devices.unbind(this.bindDevicesProcess);
            }
        });
    }
    binFunc() {
        switch (this.discoverModel.state.get()) {
            case spinal_model_bacnet_1.STATES.discovering:
                this.discover();
                break;
            case spinal_model_bacnet_1.STATES.creating:
                this.createNodes();
            default:
                break;
        }
    }
    /**
     * Methods
     */
    discover() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Discovering...");
            this.bacnet.discoverDevices();
        });
    }
    createNodes() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("creating nodes...");
            const organ = {
                contextName: this.discoverModel.context.name.get(),
                contextType: this.discoverModel.context.type.get(),
                networkType: this.discoverModel.organ.type.get(),
                networkName: this.discoverModel.organ.name.get()
                // networkType: this.discoverModel.network.type.get(),
                // networkName: this.discoverModel.network.name.get()
            };
            const graph = yield this.getGraph();
            yield this.networkService.init(graph, organ);
            const net = this.discoverModel.network.get();
            const networkNodeInfo = yield this.getOrCreateNetNode(net);
            console.log(networkNodeInfo);
            this.bacnet.createDevicesNodes(this.networkService, networkNodeInfo.get()).then((result) => {
                //    //    this.discoverModel.setCreatedMode();
                //    //    this.discoverModel.state.unbind(this.bindSateProcess);
                //    //    this.discoverModel.remove();
                //    //    console.log("nodes created!");
            }).catch((err) => {
            });
        });
    }
    getOrCreateNetNode(net) {
        return __awaiter(this, void 0, void 0, function* () {
            const organId = this.networkService.networkId;
            const contextId = this.networkService.contextId;
            const children = yield spinal_env_viewer_graph_service_1.SpinalGraphService.getChildrenInContext(organId, contextId);
            for (const child of children) {
                if (child.name.get() === net.name) {
                    return child;
                }
            }
            return this.networkService.createNewBmsNetwork(organId, net.type, net.name);
        });
    }
    listenEvents() {
        this.bacnet.on("deviceFound", (device) => this.addDeviceFound(device));
        this.bacnet.on("timeout", () => this.timeOutEvent());
    }
    addDeviceFound(device) {
        console.log("device found", device.address);
        // const device: IDevice = (<any>spinalDevice).device
        // this.devicesFound.set(device.deviceId, spinalDevice);
        this.discoverModel.devices.push(device);
    }
    timeOutEvent() {
        console.log("Timeout...");
        this.discoverModel.setTimeoutMode();
    }
    getGraph() {
        return new Promise((resolve, reject) => {
            this.discoverModel.graph.load((graph) => {
                resolve(graph);
            });
        });
    }
}
exports.SpinalContextCreation = SpinalContextCreation;
//# sourceMappingURL=SpinalContextCreation.js.map