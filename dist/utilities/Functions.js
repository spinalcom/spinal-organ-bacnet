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
exports.GetPm2Instance = void 0;
exports.bindAllModels = bindAllModels;
exports.restartProcessById = restartProcessById;
exports.loadPtrValue = loadPtrValue;
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const SpinalDevice_1 = require("../modules/SpinalDevice");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const spinal_connector_service_1 = require("spinal-connector-service");
const SpinalNetworkUtilities_1 = require("./SpinalNetworkUtilities");
const SpinalDiscover_1 = require("../modules/SpinalDiscover");
const SpinalMonitoring_1 = require("../modules/SpinalMonitoring");
const SpinalPilot_1 = require("../modules/SpinalPilot");
const pm2 = require("pm2");
const Q = require('q');
function bindAllModels(organModel) {
    const listenerAlreadyBinded = new Set();
    const discoverAlreadyBinded = new Set();
    ///////////////// listen discover model to browse bacnet network and get all devices (broadcast or unicast)
    organModel.discover.modification_date.bind(() => __awaiter(this, void 0, void 0, function* () {
        const discoverList = yield organModel.getDiscoverModelFromGraph();
        for (const spinalDiscoverModel of discoverList) {
            if (discoverAlreadyBinded.has(spinalDiscoverModel._server_id))
                continue;
            SpinalDiscoverCallback(spinalDiscoverModel, organModel);
            discoverAlreadyBinded.add(spinalDiscoverModel._server_id);
        }
    }));
    ///////////////// listen pilot model to update bacnet value of devices
    organModel.pilot.modification_date.bind(() => __awaiter(this, void 0, void 0, function* () {
        const pilotList = yield organModel.getPilotModelFromGraph();
        for (const spinalPilotModel of pilotList) {
            SpinalPilotCallback(spinalPilotModel, organModel);
        }
    }), true);
    ///////////////// listen listener model to monitor devices
    organModel.listener.modification_date.bind(() => __awaiter(this, void 0, void 0, function* () {
        const listenerList = yield organModel.getListenerModelFromGraph();
        for (let i = 0; i < listenerList.length; i++) {
            const spinalListenerModel = listenerList[i];
            if (listenerAlreadyBinded.has(spinalListenerModel._server_id))
                continue;
            SpinalListenerCallback(spinalListenerModel, organModel);
            listenerAlreadyBinded.add(spinalListenerModel._server_id);
        }
    }), true);
    ///////////////// listen allbacnetvalues model to get bacnet values of devices
    organModel.allBacnetValues.modification_date.bind(() => __awaiter(this, void 0, void 0, function* () {
        const allBacnetValuesList = yield organModel.getBacnetValuesModelFromGraph();
        for (const spinalBacnetValueModel of allBacnetValuesList) {
            SpinalBacnetValueModelCallback(spinalBacnetValueModel, organModel);
        }
    }), true);
}
const GetPm2Instance = (organName) => {
    return new Promise((resolve, reject) => {
        pm2.list((err, apps) => {
            if (err) {
                return reject(err);
            }
            const instance = apps.find(app => app.name === organName);
            resolve(instance);
        });
    });
};
exports.GetPm2Instance = GetPm2Instance;
function restartProcessById(instanceId) {
    return new Promise((resolve, reject) => {
        pm2.restart(instanceId, (err) => {
            if (err)
                return resolve(false);
            resolve(true);
        });
    });
}
////////////////////////////////////////////////
////                 CALLBACKS                //
////////////////////////////////////////////////
function SpinalDiscoverCallback(spinalDiscoverModel, organModel) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // await WaitModelReady();
            //// this check is not necessary when not using load_type
            // const itsForThisOrgan = await checkOrgan(spinalDiscoverModel, organModel.id?.get() || '');
            // if (!itsForThisOrgan) return;
            const actualState = spinalDiscoverModel.state.get();
            // if the state is different than initial that means that the discover model was already treated
            if (actualState !== spinal_connector_service_1.STATES.discovering && actualState !== spinal_connector_service_1.STATES.initial) {
                spinalDiscoverModel.changeState(spinal_connector_service_1.STATES.error);
                return spinalDiscoverModel.removeFromGraph();
            }
            SpinalDiscover_1.spinalDiscover.addToQueue(spinalDiscoverModel);
            // new SpinalDiscover(spinalDiscoverModel);
        }
        catch (error) {
            spinalDiscoverModel.removeFromGraph();
        }
    });
}
function SpinalBacnetValueModelCallback(spinalBacnetValueModel, organModel) {
    return __awaiter(this, void 0, void 0, function* () {
        // await WaitModelReady();
        try {
            //// this check is not necessary when not using load_type 
            // const itsForThisOrgan = await checkOrgan(spinalBacnetValueModel, organModel.id?.get() || '');
            // if (!itsForThisOrgan) return;
            const { context, device } = yield SpinalNetworkUtilities_1.SpinalNetworkUtilities.initSpinalBacnetValueModel(spinalBacnetValueModel);
            if (spinalBacnetValueModel.state.get() === spinal_model_bacnet_1.BACNET_VALUES_STATE.wait)
                (0, SpinalDevice_1.addToGetAllBacnetValuesQueue)(device.info.get(), device, context, spinalBacnetValueModel);
            else
                throw new Error('lost connection with bacnet network');
        }
        catch (error) {
            yield spinalBacnetValueModel.changeState(spinal_model_bacnet_1.BACNET_VALUES_STATE.error);
            return spinalBacnetValueModel.removeFromGraph();
        }
    });
}
function SpinalListenerCallback(spinalListenerModel, organModel) {
    // await WaitModelReady();
    //// this check is not necessary when not using load_type
    // const itsForThisOrgan = await checkOrgan(spinalListenerModel, organModel.id?.get() || '');
    // if (itsForThisOrgan) spinalMonitoring.addToMonitoringList(spinalListenerModel);
    SpinalMonitoring_1.spinalMonitoring.addToMonitoringList(spinalListenerModel);
}
function SpinalPilotCallback(spinalPilotModel, organModel) {
    // await WaitModelReady();
    //// this check is not necessary when not using load_type
    // const itsForThisOrgan = await checkOrgan(spinalPilotModel, organModel.id?.get() || '');
    // if (itsForThisOrgan) spinalPilot.addToPilotList(spinalPilotModel);
    SpinalPilot_1.spinalPilot.addToPilotList(spinalPilotModel);
}
function checkOrgan(spinalOrgan, organId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            if (!organId)
                return false;
            // await WaitModelReady();
            let spinalDiscoverModelOrgan = yield spinalOrgan.getOrgan();
            if (spinalDiscoverModelOrgan instanceof spinal_env_viewer_graph_service_1.SpinalNode) {
                spinalDiscoverModelOrgan = yield spinalDiscoverModelOrgan.getElement(true);
            }
            return !!(organId === ((_a = spinalDiscoverModelOrgan.id) === null || _a === void 0 ? void 0 : _a.get()));
        }
        catch (error) {
            return false;
        }
    });
}
function loadPtrValue(ptrModel) {
    return new Promise((resolve) => {
        ptrModel.load((data) => resolve(data));
    });
}
//# sourceMappingURL=Functions.js.map