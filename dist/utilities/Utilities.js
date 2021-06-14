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
exports.loadFile = exports.saveAsFile = exports.connectionErrorCallback = exports.SpinalBacnetValueModelCallback = exports.SpinalListnerCallback = exports.SpinalDiscoverCallback = exports.waitModelReady = void 0;
const spinal_core_connectorjs_type_1 = require("spinal-core-connectorjs_type");
const SpinalDevice_1 = require("../modules/SpinalDevice");
const fs_1 = require("fs");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const SpinalContextCreation_1 = require("../modules/SpinalContextCreation");
const SpinalDeviceListener_1 = require("../modules/SpinalDeviceListener");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const Q = require('q');
const waitModelReady = (spinalContext) => {
    const deferred = Q.defer();
    const waitModelReadyLoop = (f, defer) => {
        if (spinal_core_connectorjs_type_1.FileSystem._sig_server === false) {
            // if (typeof f._server_id === "undefined") {
            setTimeout(() => {
                defer.resolve(waitModelReadyLoop(f, defer));
            }, 200);
        }
        else {
            defer.resolve(f);
        }
        return defer.promise;
    };
    return waitModelReadyLoop(spinalContext, deferred);
};
exports.waitModelReady = waitModelReady;
////////////////////////////////////////////////
////                 CALLBACKS                //
////////////////////////////////////////////////
const SpinalDiscoverCallback = (spinalDisoverModel, organModel) => {
    const promises = [exports.waitModelReady(organModel), exports.waitModelReady(spinalDisoverModel)];
    Promise.all(promises).then(() => __awaiter(void 0, void 0, void 0, function* () {
        // console.log(spinalDisoverModel.organ._server_id, organModel._server_id);
        yield exports.waitModelReady(spinalDisoverModel.organ);
        console.log(organModel._server_id, spinalDisoverModel.organ._server_id);
        if (organModel._server_id === spinalDisoverModel.organ._server_id) {
            const minute = 2 * (60 * 1000);
            const time = Date.now();
            const creation = spinalDisoverModel.creation ? spinalDisoverModel.creation.get() : 0;
            if ((time - creation) >= minute || spinalDisoverModel.state.get() === spinal_model_bacnet_1.STATES.created) {
                spinalDisoverModel.remove();
                return;
            }
            new SpinalContextCreation_1.SpinalContextCreation(spinalDisoverModel);
        }
    })).catch((err) => {
        console.error(err);
    });
};
exports.SpinalDiscoverCallback = SpinalDiscoverCallback;
const SpinalListnerCallback = (spinalListenerModel, organModel) => {
    const promises = [exports.waitModelReady(organModel), exports.waitModelReady(spinalListenerModel)];
    Promise.all(promises).then(() => __awaiter(void 0, void 0, void 0, function* () {
        yield exports.waitModelReady(spinalListenerModel.organ);
        spinalListenerModel.organ.load((organ) => {
            exports.waitModelReady(organ).then(() => {
                if (organ._server_id === organModel._server_id) {
                    new SpinalDeviceListener_1.SpinalDeviceListener(spinalListenerModel);
                }
            });
        });
    })).catch((err) => {
        console.error(err);
    });
};
exports.SpinalListnerCallback = SpinalListnerCallback;
const SpinalBacnetValueModelCallback = (spinalBacnetValueModel, organModel) => {
    const promises = [exports.waitModelReady(organModel), exports.waitModelReady(spinalBacnetValueModel)];
    Promise.all(promises).then(() => __awaiter(void 0, void 0, void 0, function* () {
        const { node, context, graph, network, organ } = yield spinalBacnetValueModel.getAllItem();
        if (organ._server_id !== organModel._server_id)
            return;
        if (spinalBacnetValueModel.state.get() !== 'wait') {
            return spinalBacnetValueModel.remToNode();
        }
        const networkService = new spinal_model_bmsnetwork_1.NetworkService(false);
        spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(node);
        spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(context);
        spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(graph);
        spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(network);
        console.log(`get ${node.getName().get()} bacnet values`);
        const device = { address: node.info.address.get(), deviceId: node.info.idNetwork.get() };
        const organNetwork = {
            contextName: context.getName().get(),
            contextType: context.getType().get(),
            networkType: network.getType().get(),
            networkName: network.getName().get()
        };
        // const client = new bacnet();
        yield networkService.init(graph, organNetwork);
        // const spinalDevice = new SpinalDevice(device, client);
        const spinalDevice = new SpinalDevice_1.SpinalDevice(device);
        spinalDevice.createDeviceItemList(networkService, node, spinalBacnetValueModel).then(() => {
            // spinalBacnetValueModel.setSuccessState();
            // console.log(`success ==> ${(<any>node).getName().get()}`);
            // return spinalBacnetValueModel.remToNode();
            console.log("hello world");
        }).catch((err) => {
            spinalBacnetValueModel.setErrorState();
            console.log(`error ===> ${node.getName().get()}`);
            // return spinalBacnetValueModel.remToNode();
            // console.error(err);
        });
    }));
};
exports.SpinalBacnetValueModelCallback = SpinalBacnetValueModelCallback;
const connectionErrorCallback = (err) => {
    if (!err)
        console.error('Error Connect');
    else
        console.error('Error Connect', err);
    process.exit(0);
};
exports.connectionErrorCallback = connectionErrorCallback;
////////////////////////////////////////////////
////                 FILES                    //
////////////////////////////////////////////////
const saveAsFile = (obj) => {
    const data = obj.convertToString();
    const folder = `${process.cwd()}/db`;
    const fileName = `${obj.node.id.get()}.db`;
    if (!fs_1.existsSync(folder)) {
        fs_1.mkdirSync(folder);
    }
    return new Promise((resolve, reject) => {
        fs_1.writeFile(`${folder}/${fileName}`, data, (err) => {
            if (err) {
                console.error(err);
                reject(err);
                return;
            }
            resolve(true);
        });
    });
};
exports.saveAsFile = saveAsFile;
const loadFile = (id) => {
    return new Promise((resolve, reject) => {
        const path = `${process.cwd()}/db/${id}.db`;
        if (!fs_1.existsSync(path)) {
            reject("file not exist");
            return;
        }
        ;
        const data = [];
        const readStream = fs_1.createReadStream(path, { highWaterMark: 16 });
        readStream.on('data', function (chunk) {
            data.push(chunk);
        });
        readStream.on('end', () => {
            const x = Buffer.concat(data).toString();
            resolve(JSON.parse(x));
        });
        readStream.on('error', (err) => {
            reject(err);
        });
    });
};
exports.loadFile = loadFile;
//# sourceMappingURL=Utilities.js.map