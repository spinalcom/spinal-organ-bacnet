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
const Functions_1 = require("./utilities/Functions");
const pm2 = require("pm2");
const config = require("../config.json5");
const url = `${config.spinalConnector.protocol}://${config.spinalConnector.userId}:${config.spinalConnector.password}@${config.spinalConnector.host}:${config.spinalConnector.port}/`;
const connect = spinal_core_connectorjs_type_1.spinalCore.connect(url);
const path = config.spinalConnector.path;
const name = config.spinalConnector.name;
const listenLoadType = (connect, organModel) => {
    return new Promise((resolve, reject) => {
        spinal_core_connectorjs_type_1.spinalCore.load_type(connect, 'SpinalDisoverModel', (spinalDisoverModel) => {
            Functions_1.SpinalDiscoverCallback(spinalDisoverModel, organModel);
        }, Functions_1.connectionErrorCallback);
        spinal_core_connectorjs_type_1.spinalCore.load_type(connect, 'SpinalListenerModel', (spinalListenerModel) => {
            Functions_1.SpinalListnerCallback(spinalListenerModel, organModel);
        }, Functions_1.connectionErrorCallback);
        spinal_core_connectorjs_type_1.spinalCore.load_type(connect, 'SpinalBacnetValueModel', (spinalBacnetValueModel) => {
            Functions_1.SpinalBacnetValueModelCallback(spinalBacnetValueModel, organModel);
        }, Functions_1.connectionErrorCallback);
        spinal_core_connectorjs_type_1.spinalCore.load_type(connect, 'SpinalPilotModel', (spinalPilotModel) => {
            Functions_1.SpinalPilotCallback(spinalPilotModel, organModel);
        }, Functions_1.connectionErrorCallback);
    });
};
Functions_1.CreateOrganConfigFile(connect, path, name).then((organModel) => {
    organModel.restart.bind(() => {
        Functions_1.GetPm2Instance(name).then((app) => __awaiter(void 0, void 0, void 0, function* () {
            const restart = organModel.restart.get();
            console.log(app);
            if (!restart) {
                listenLoadType(connect, organModel);
                return;
            }
            if (app) {
                console.log("restart organ", app.pm_id);
                organModel.restart.set(false);
                pm2.restart(app.pm_id, (err) => {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    console.log("organ restarted with success !");
                });
            }
        }));
    });
});
//# sourceMappingURL=index.js.map