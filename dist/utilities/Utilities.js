"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadFile = exports.saveAsFile = exports.connectionErrorCallback = exports.SpinalDeviceConnectionSuccessCallback = exports.SpinalDisoverModelConnectionSuccessCallback = exports.waitModelReady = void 0;
const spinal_core_connectorjs_type_1 = require("spinal-core-connectorjs_type");
const fs_1 = require("fs");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const SpinalContextCreation_1 = require("../modules/SpinalContextCreation");
const SpinalDeviceListener_1 = require("../modules/SpinalDeviceListener");
const Q = require('q');
const waitModelReady = (spinalContext) => {
    const deferred = Q.defer();
    const waitModelReadyLoop = (f, defer) => {
        if (spinal_core_connectorjs_type_1.FileSystem._sig_server === false) {
            setTimeout(() => {
                defer.resolve(waitModelReadyLoop(f, defer));
            }, 100);
        }
        else {
            defer.resolve(f);
        }
        return defer.promise;
    };
    return waitModelReadyLoop(spinalContext, deferred);
};
exports.waitModelReady = waitModelReady;
const SpinalDisoverModelConnectionSuccessCallback = (spinalDisoverModel, organModel) => {
    exports.waitModelReady(spinalDisoverModel).then(() => {
        // console.log(spinalDisoverModel.organ._server_id, organModel._server_id);
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
    }).catch((err) => {
        console.error(err);
    });
};
exports.SpinalDisoverModelConnectionSuccessCallback = SpinalDisoverModelConnectionSuccessCallback;
const SpinalDeviceConnectionSuccessCallback = (graph) => {
    exports.waitModelReady(graph).then((model) => {
        new SpinalDeviceListener_1.SpinalDeviceListener(model);
    }).catch((err) => {
        console.error(err);
    });
};
exports.SpinalDeviceConnectionSuccessCallback = SpinalDeviceConnectionSuccessCallback;
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