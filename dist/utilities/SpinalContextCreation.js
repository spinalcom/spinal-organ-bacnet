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
const spinalBacnet_1 = require("../modules/spinalBacnet");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const stateEnum_1 = require("./stateEnum");
const config = require("../../config.json5");
class SpinalContextCreation {
    // private devicesFound: Map<number, SpinalDevice> = new Map();
    // private info : any;
    constructor(model) {
        this.bacnet = new spinalBacnet_1.SpinalBacnet(config.network);
        this.networkService = new spinal_model_bmsnetwork_1.NetworkService(false);
        // this.graph = graph;
        // this.initialize();
        // this.discoverModel = this.graph.info.discover;
        this.listenEvents();
        this.discoverModel = model;
        this.bindItem();
        this.bindDevices();
    }
    initialize() {
        this.listenEvents();
        // if (this.graph.info.discover) {
        //    this.graph.info.discover.status.set(STATES.reseted);
        //    this.graph.info.discover.context.set({})
        //    this.graph.info.discover.network.set({})
        //    this.graph.info.discover.devices.set(new Lst())
        // } else {
        //    const discover = {
        //       status: STATES.reseted,
        //       context: {},
        //       netwinitork: {},
        //       devices: new Lst()
        //    }
        //    this.graph.info.add_attr({ discover })
        // }
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
                this.discoverModel.state.set(stateEnum_1.STATES.discovered);
                this.discoverModel.devices.unbind(this.bindDevicesProcess);
            }
        });
    }
    binFunc() {
        switch (this.discoverModel.state.get()) {
            case stateEnum_1.STATES.discovering:
                this.discover();
                break;
            case stateEnum_1.STATES.creating:
                this.createNodes();
            default:
                break;
        }
    }
    discover() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("*** Discovering... ***");
            this.bacnet.discoverDevices();
        });
    }
    createNodes() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("*** creating... ***");
            const organ = {
                contextName: this.discoverModel.context.name.get(),
                contextType: this.discoverModel.context.type.get(),
                networkType: this.discoverModel.network.type.get(),
                networkName: this.discoverModel.network.name.get()
            };
            const graph = yield this.getGraph();
            yield this.networkService.init(graph, organ);
            this.bacnet.createDevicesNodes(this.networkService).then((result) => {
                console.log("*** Created ***");
                this.discoverModel.state.set(stateEnum_1.STATES.created);
                this.discoverModel.state.unbind(this.bindSateProcess);
            }).catch((err) => {
            });
        });
    }
    listenEvents() {
        this.bacnet.on("deviceFound", (device) => this.addDeviceFound(device));
        this.bacnet.on("timeout", () => this.timeOutEvent());
    }
    addDeviceFound(device) {
        console.log("*** device found ***");
        // const device: IDevice = (<any>spinalDevice).device
        // this.devicesFound.set(device.deviceId, spinalDevice);
        this.discoverModel.devices.push(device);
    }
    timeOutEvent() {
        console.log("*** Timeout ***");
        // this.discoverModel.context.rem_attr("name");
        // this.discoverModel.context.rem_attr("type");
        // this.discoverModel.network.rem_attr("name");
        // this.discoverModel.network.rem_attr("type");
        this.discoverModel.state.set(stateEnum_1.STATES.timeout);
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