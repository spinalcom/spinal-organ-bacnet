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
exports.SpinalBacnetValueModelCallback = exports.SpinalListnerCallback = exports.SpinalDiscoverCallback = exports.GetPm2Instance = exports.CreateOrganConfigFile = exports.connectionErrorCallback = void 0;
const spinal_core_connectorjs_type_1 = require("spinal-core-connectorjs_type");
const SpinalDevice_1 = require("../modules/SpinalDevice");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const SpinalDiscover_1 = require("../modules/SpinalDiscover");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const Queuing_1 = require("./Queuing");
const spinal_core_connectorjs_type_2 = require("spinal-core-connectorjs_type");
const Q = require('q');
const pm2 = require("pm2");
const listenerQueue = new Queuing_1.SpinalQueuing();
const WaitModelReady = () => {
    const deferred = Q.defer();
    const WaitModelReadyLoop = (defer) => {
        if (spinal_core_connectorjs_type_1.FileSystem._sig_server === false) {
            setTimeout(() => {
                defer.resolve(WaitModelReadyLoop(defer));
            }, 200);
        }
        else {
            defer.resolve();
        }
        return defer.promise;
    };
    return WaitModelReadyLoop(deferred);
};
const connectionErrorCallback = (err) => {
    if (!err)
        console.error('Error Connect');
    else
        console.error('Error Connect', err);
    process.exit(0);
};
exports.connectionErrorCallback = connectionErrorCallback;
const CreateOrganConfigFile = (spinalConnection, path, connectorName) => {
    return new Promise((resolve, reject) => {
        spinalConnection.load_or_make_dir(`${path}`, (directory) => {
            for (let index = 0; index < directory.length; index++) {
                const element = directory[index];
                if (element.name.get() === `${connectorName}.conf`) {
                    console.log("organ found !");
                    return element.load(file => {
                        WaitModelReady().then(() => {
                            resolve(file);
                        });
                    });
                }
            }
            console.log("organ not found");
            const model = new spinal_model_bacnet_1.SpinalOrganConfigModel(connectorName);
            WaitModelReady().then(() => {
                const file = new spinal_core_connectorjs_type_2.File(`${connectorName}.conf`, model, undefined);
                directory.push(file);
                console.log("organ created");
                return resolve(model);
            });
        });
    });
};
exports.CreateOrganConfigFile = CreateOrganConfigFile;
const GetPm2Instance = (organName) => {
    return new Promise((resolve, reject) => {
        pm2.list((err, apps) => {
            if (err) {
                console.error(err);
                return reject(err);
            }
            const instance = apps.find(app => app.name === organName);
            resolve(instance);
        });
    });
};
exports.GetPm2Instance = GetPm2Instance;
////////////////////////////////////////////////
////                 CALLBACKS                //
////////////////////////////////////////////////
const SpinalDiscoverCallback = (spinalDisoverModel, organModel) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    yield WaitModelReady();
    console.log("spinalDisoverModel", spinalDisoverModel);
    if (((_a = organModel.id) === null || _a === void 0 ? void 0 : _a.get()) === ((_c = (_b = spinalDisoverModel.organ) === null || _b === void 0 ? void 0 : _b.id) === null || _c === void 0 ? void 0 : _c.get())) {
        const minute = 2 * (60 * 1000);
        const time = Date.now();
        const creation = ((_d = spinalDisoverModel.creation) === null || _d === void 0 ? void 0 : _d.get()) || 0;
        // Check if model is not timeout.
        if ((time - creation) >= minute || spinalDisoverModel.state.get() === spinal_model_bacnet_1.STATES.created) {
            spinalDisoverModel.remove();
            return;
        }
        new SpinalDiscover_1.SpinalDiscover(spinalDisoverModel);
    }
});
exports.SpinalDiscoverCallback = SpinalDiscoverCallback;
const SpinalListnerCallback = (spinalListenerModel, organModel) => __awaiter(void 0, void 0, void 0, function* () {
    yield WaitModelReady();
    spinalListenerModel.organ.load((organ) => {
        var _a, _b;
        if (organ) {
            if (((_a = organ.id) === null || _a === void 0 ? void 0 : _a.get()) === ((_b = organModel.id) === null || _b === void 0 ? void 0 : _b.get())) {
                listenerQueue.addToQueue({
                    item: spinalListenerModel,
                    callback: (item) => { }
                });
            }
        }
    });
});
exports.SpinalListnerCallback = SpinalListnerCallback;
const SpinalBacnetValueModelCallback = (spinalBacnetValueModel, organModel) => __awaiter(void 0, void 0, void 0, function* () {
    var _e, _f;
    yield WaitModelReady();
    const { node, context, graph, network, organ } = yield spinalBacnetValueModel.getAllItem();
    if (organ && ((_e = organ.id) === null || _e === void 0 ? void 0 : _e.get()) !== ((_f = organModel.id) === null || _f === void 0 ? void 0 : _f.get()))
        return;
    if (spinalBacnetValueModel.state.get() === 'wait' && node && context && graph && network && organ) {
        spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(node);
        spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(context);
        spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(graph);
        spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(network);
        const networkService = new spinal_model_bmsnetwork_1.NetworkService(false);
        const organNetwork = {
            contextName: context.getName().get(),
            contextType: context.getType().get(),
            networkType: network.getType().get(),
            networkName: network.getName().get()
        };
        // const client = new bacnet();
        yield networkService.init(graph, organNetwork);
        const device = { address: node.info.address.get(), deviceId: node.info.idNetwork.get() };
        // const spinalDevice = new SpinalDevice(device, client);
        const spinalDevice = new SpinalDevice_1.SpinalDevice(device);
        spinalDevice.createDeviceItemList(networkService, node, spinalBacnetValueModel).then(() => {
            console.log("hello world");
        }).catch((err) => {
            spinalBacnetValueModel.setErrorState();
            console.log(`error ===> ${node.getName().get()}`);
        });
    }
    else {
        return spinalBacnetValueModel.remToNode();
    }
});
exports.SpinalBacnetValueModelCallback = SpinalBacnetValueModelCallback;
//# sourceMappingURL=Functions.js.map