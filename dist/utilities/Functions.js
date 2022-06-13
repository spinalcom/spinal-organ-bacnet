"use strict";
/*
 * Copyright 2022 SpinalCom - www.spinalcom.com
 *
 * This file is part of SpinalCore.
 *
 * Please read all of the following terms and conditions
 * of the Free Software license Agreement ("Agreement")
 * carefully.
 *
 * This Agreement is a legally binding contract between
 * the Licensee (as defined below) and SpinalCom that
 * sets forth the terms and conditions that govern your
 * use of the Program. By installing and/or using the
 * Program, you agree to abide by all the terms and
 * conditions stated or referenced herein.
 *
 * If you do not agree to abide by these terms and
 * conditions, do not demonstrate your acceptance and do
 * not install or use the Program.
 * You should have received a copy of the license along
 * with this file. If not, see
 * <http://resources.spinalcom.com/licenses.pdf>.
 */
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
exports.SpinalPilotCallback = exports.SpinalListnerCallback = exports.SpinalBacnetValueModelCallback = exports.SpinalDiscoverCallback = exports.GetPm2Instance = exports.CreateOrganConfigFile = exports.connectionErrorCallback = void 0;
const spinal_core_connectorjs_type_1 = require("spinal-core-connectorjs_type");
const SpinalDevice_1 = require("../modules/SpinalDevice");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const SpinalNetworkServiceUtilities_1 = require("./SpinalNetworkServiceUtilities");
const SpinalDiscover_1 = require("../modules/SpinalDiscover");
const SpinalMonitoring_1 = require("../modules/SpinalMonitoring");
const SpinalPilot_1 = require("../modules/SpinalPilot");
const Q = require('q');
const pm2 = require("pm2");
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
    return new Promise((resolve) => {
        spinalConnection.load_or_make_dir(`${path}`, (directory) => __awaiter(void 0, void 0, void 0, function* () {
            const found = yield findFileInDirectory(directory, connectorName);
            if (found) {
                console.log("organ found !");
                return resolve(found);
            }
            console.log("organ not found");
            const model = new spinal_model_bacnet_1.SpinalOrganConfigModel(connectorName);
            WaitModelReady().then(() => {
                const file = new spinal_core_connectorjs_type_1.File(`${connectorName}.conf`, model, { model_type: model.type.get() });
                directory.push(file);
                console.log("organ created");
                return resolve(model);
            });
        }));
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
function findFileInDirectory(directory, fileName) {
    return new Promise((resolve, reject) => {
        for (let index = 0; index < directory.length; index++) {
            const element = directory[index];
            const elementName = element.name.get();
            if (elementName.toLowerCase() === `${fileName}.conf`.toLowerCase()) {
                return element.load(file => {
                    WaitModelReady().then(() => {
                        resolve(file);
                    });
                });
            }
        }
        resolve();
    });
}
////////////////////////////////////////////////
////                 CALLBACKS                //
////////////////////////////////////////////////
const SpinalDiscoverCallback = (spinalDisoverModel, organModel) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    yield WaitModelReady();
    if (((_a = organModel.id) === null || _a === void 0 ? void 0 : _a.get()) === ((_c = (_b = spinalDisoverModel.organ) === null || _b === void 0 ? void 0 : _b.id) === null || _c === void 0 ? void 0 : _c.get())) {
        const minute = 2 * (60 * 1000);
        const time = Date.now();
        const creation = ((_d = spinalDisoverModel.creation) === null || _d === void 0 ? void 0 : _d.get()) || 0;
        // Check if model is not timeout.
        if ((time - creation) >= minute || spinalDisoverModel.state.get() === spinal_model_bacnet_1.STATES.created) {
            spinalDisoverModel.setTimeoutMode();
            return spinalDisoverModel.remove();
        }
        SpinalDiscover_1.discover.addToQueue(spinalDisoverModel);
        // new SpinalDiscover(spinalDisoverModel);
    }
});
exports.SpinalDiscoverCallback = SpinalDiscoverCallback;
const SpinalBacnetValueModelCallback = (spinalBacnetValueModel, organModel) => __awaiter(void 0, void 0, void 0, function* () {
    yield WaitModelReady();
    try {
        spinalBacnetValueModel.organ.load((organ) => __awaiter(void 0, void 0, void 0, function* () {
            var _e, _f;
            if (organ && ((_e = organ.id) === null || _e === void 0 ? void 0 : _e.get()) !== ((_f = organModel.id) === null || _f === void 0 ? void 0 : _f.get()))
                return;
            const { networkService, device, node } = yield SpinalNetworkServiceUtilities_1.SpinalNetworkServiceUtilities.initSpinalBacnetValueModel(spinalBacnetValueModel);
            if (spinalBacnetValueModel.state.get() === 'wait') {
                const spinalDevice = new SpinalDevice_1.SpinalDevice(device);
                yield spinalDevice.createDeviceItemList(networkService, node, spinalBacnetValueModel);
            }
            else {
                return spinalBacnetValueModel.remToNode();
            }
        }));
    }
    catch (error) {
        // console.error(error);
        yield spinalBacnetValueModel.setErrorState();
        return spinalBacnetValueModel.remToNode();
    }
});
exports.SpinalBacnetValueModelCallback = SpinalBacnetValueModelCallback;
const SpinalListnerCallback = (spinalListenerModel, organModel) => __awaiter(void 0, void 0, void 0, function* () {
    yield WaitModelReady();
    spinalListenerModel.organ.load((organ) => {
        var _a, _b;
        if (organ) {
            if (((_a = organ.id) === null || _a === void 0 ? void 0 : _a.get()) === ((_b = organModel.id) === null || _b === void 0 ? void 0 : _b.get())) {
                SpinalMonitoring_1.spinalMonitoring.addToMonitoringList(spinalListenerModel);
            }
        }
    });
});
exports.SpinalListnerCallback = SpinalListnerCallback;
const SpinalPilotCallback = (spinalPilotModel, organModel) => __awaiter(void 0, void 0, void 0, function* () {
    var _g, _h;
    yield WaitModelReady();
    if (((_g = spinalPilotModel.organ) === null || _g === void 0 ? void 0 : _g.id.get()) === ((_h = organModel.id) === null || _h === void 0 ? void 0 : _h.get())) {
        SpinalPilot_1.spinalPilot.addToPilotList(spinalPilotModel);
    }
});
exports.SpinalPilotCallback = SpinalPilotCallback;
//# sourceMappingURL=Functions.js.map