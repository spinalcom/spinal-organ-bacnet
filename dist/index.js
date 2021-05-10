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
require("json5/lib/register");
const spinal_core_connectorjs_type_1 = require("spinal-core-connectorjs_type");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const Utilities_1 = require("./utilities/Utilities");
// import { SpinalBacnet } from "./modules/spinalBacnet";
// import { NetworkService } from "spinal-model-bmsnetwork";
const pm2 = require("pm2");
const config = require("../config.json5");
// const url = `${config.spinalConnector.protocol}://${config.spinalConnector.userId}:${config.spinalConnector.password}@${config.spinalConnector.host}/`;
const url = `${config.spinalConnector.protocol}://${config.spinalConnector.userId}:${config.spinalConnector.password}@${config.spinalConnector.host}:${config.spinalConnector.port}/`;
const connect = spinal_core_connectorjs_type_1.spinalCore.connect(url);
const path = config.spinalConnector.path;
const name = config.spinalConnector.name;
const createOrganConfigFile = () => {
    return new Promise((resolve, reject) => {
        connect.load_or_make_dir(`${path}`, (directory) => {
            for (let index = 0; index < directory.length; index++) {
                const element = directory[index];
                if (element.name.get() === `${name}.conf`) {
                    console.log("element found");
                    return element.load(file => {
                        Utilities_1.waitModelReady(file).then(() => {
                            resolve(file);
                        });
                    });
                }
            }
            console.log("file not found");
            const model = new spinal_model_bacnet_1.SpinalOrganConfigModel(name);
            Utilities_1.waitModelReady(model).then(() => {
                const file = new spinal_core_connectorjs_type_1.File(`${name}.conf`, model, undefined);
                directory.push(file);
                return resolve(model);
            });
        });
    });
};
const getPm2Instance = (organName) => {
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
const listenLoadType = (connect, organModel) => {
    return new Promise((resolve, reject) => {
        spinal_core_connectorjs_type_1.spinalCore.load_type(connect, 'SpinalDisoverModel', (spinalDisoverModel) => {
            Utilities_1.SpinalDiscoverCallback(spinalDisoverModel, organModel);
        }, Utilities_1.connectionErrorCallback);
        spinal_core_connectorjs_type_1.spinalCore.load_type(connect, 'SpinalListenerModel', (spinalListenerModel) => {
            Utilities_1.SpinalListnerCallback(spinalListenerModel, organModel);
        }, Utilities_1.connectionErrorCallback);
        spinal_core_connectorjs_type_1.spinalCore.load_type(connect, 'SpinalBacnetValueModel', (spinalBacnetValueModel) => {
            Utilities_1.SpinalBacnetValueModelCallback(spinalBacnetValueModel, organModel);
        }, Utilities_1.connectionErrorCallback);
    });
};
createOrganConfigFile().then((organModel) => {
    organModel.restart.bind(() => {
        const restart = organModel.restart.get();
        if (!restart) {
            listenLoadType(connect, organModel);
            return;
        }
        getPm2Instance(name).then((app) => __awaiter(void 0, void 0, void 0, function* () {
            if (app) {
                console.log("restart", app.pm_id);
                organModel.restart.set(false);
                pm2.restart(app.pm_id, (err) => {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    console.log("success");
                });
            }
        }));
    });
});
//# sourceMappingURL=index.js.map