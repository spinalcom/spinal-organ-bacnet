"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("json5/lib/register");
const spinal_core_connectorjs_type_1 = require("spinal-core-connectorjs_type");
const spinalBacnet_1 = require("./modules/spinalBacnet");
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const SpinalContextCreation_1 = require("./modules/SpinalContextCreation");
const SpinalDeviceListener_1 = require("./modules/SpinalDeviceListener");
const Utilities_1 = require("./utilities/Utilities");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const config = require("../config.json5");
const url = `http://${config.spinalConnector.userId}:${config.spinalConnector.password}@${config.spinalConnector.host}:${config.spinalConnector.port}/`;
const connect = spinal_core_connectorjs_type_1.spinalCore.connect(url);
const bacnet = new spinalBacnet_1.SpinalBacnet(config.network);
const networkService = new spinal_model_bmsnetwork_1.NetworkService(false);
const connectionErrorCallback = (err) => {
    if (!err)
        console.error('Error Connect');
    else
        console.error('Error Connect', err);
    process.exit(0);
};
const SpinalDisoverModelConnectionSuccessCallback = (graph) => {
    Utilities_1.waitModelReady(graph).then((model) => {
        console.log(model);
        const minute = 2 * (60 * 1000);
        const time = Date.now();
        const creation = model.creation ? model.creation.get() : 0;
        if ((time - creation) >= minute || model.state.get() === spinal_model_bacnet_1.STATES.created) {
            model.remove();
            return;
        }
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
// spinalCore.load_type(connect, 'SpinalListenerModel', SpinalDeviceConnectionSuccessCallback, connectionErrorCallback);
//# sourceMappingURL=index.js.map