"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("json5/lib/register");
require("./model");
const spinal_core_connectorjs_type_1 = require("spinal-core-connectorjs_type");
const spinalBacnet_1 = require("./modules/spinalBacnet");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const SpinalContextCreation_1 = require("./utilities/SpinalContextCreation");
const SpinalDeviceListener_1 = require("./utilities/SpinalDeviceListener");
const Utilities_1 = require("./utilities/Utilities");
const config = require("../config.json5");
const url = `http://${config.spinalConnector.userId}:${config.spinalConnector.password}@${config.spinalConnector.host}:${config.spinalConnector.port}/`;
const connect = spinal_core_connectorjs_type_1.spinalCore.connect(url);
const bacnet = new spinalBacnet_1.SpinalBacnet(config.network);
const networkService = new spinal_model_bmsnetwork_1.NetworkService(false);
// bacnet.on("deviceFound", (result) => {
//    const device = result;
//    setTimeout(() => {
//       device.emit("createNodes")
//    }, 5000)
// })
const connectionErrorCallback = (err) => {
    if (!err)
        console.error('Error Connect');
    else
        console.error('Error Connect', err);
    process.exit(0);
};
const SpinalDisoverModelConnectionSuccessCallback = (graph) => {
    Utilities_1.waitModelReady(graph).then((model) => {
        new SpinalContextCreation_1.SpinalContextCreation(model);
    }).catch((err) => {
        console.error(err);
    });
};
const SpinalDeviceConnectionSuccessCallback = (graph) => {
    Utilities_1.waitModelReady(graph).then((model) => {
        new SpinalDeviceListener_1.SpinalDeviceListener(model);
    }).catch((err) => {
        console.error(err);
    });
};
spinal_core_connectorjs_type_1.spinalCore.load_type(connect, 'SpinalDisoverModel', SpinalDisoverModelConnectionSuccessCallback, connectionErrorCallback);
spinal_core_connectorjs_type_1.spinalCore.load_type(connect, 'SpinalListenerModel', SpinalDeviceConnectionSuccessCallback, connectionErrorCallback);
// spinalCore.load_type(connect, 'SpinalGraph', connectionSuccessCallback, connectionErrorCallback)
// spinalCore.load(spinalCore.connect(url), config.spinalConnector.digitalTwinPath, async (graph: any) => {
//    await networkService.init(graph, config.organ);
//    bacnet.discoverDevices(networkService);
// })
//# sourceMappingURL=index.js.map