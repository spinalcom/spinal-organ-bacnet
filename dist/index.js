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
const url = `http://${config.spinalConnector.userId}:${config.spinalConnector.password}@${config.spinalConnector.host}:${config.spinalConnector.port}/`;
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
            // spinalCore.load(connect, `${path}/${name}`, (file) => {
            //    waitModelReady(file).then((model) => {
            //       resolve(model)
            //    })
            // }, () => {
            //    const model = new SpinalOrganConfigModel(name);
            //    waitModelReady(model).then(() => {
            //       spinalCore.store(connect, model, `${path}/${name}.conf`, () => {
            //          resolve(model)
            //       })
            //    })
            // })
        });
        // spinalCore.load(connect, `${path}/${name}`, (file) => {
        //    // waitModelReady(file).then(() => {
        //    console.log("file found", file);
        //    return resolve(file)
        //    // })
        // })
        //    connect.load_or_make_dir(`${path}`, (dir) => {
        //       spinalCore.load(connect, `${path}/${name}`, (file) => {
        //          waitModelReady(file).then((model) => {
        //             resolve(model)
        //          })
        //       }, () => {
        //          const model = new SpinalOrganConfigModel(name);
        //          waitModelReady(model).then(() => {
        //             spinalCore.store(connect, model, `${path}/${name}.conf`, () => {
        //                resolve(model)
        //             })
        //          })
        //       })
        //    })
    });
};
const getPm2Instance = (organName) => {
    return new Promise((resolve, reject) => {
        // pm2.connect(function (err) {
        //    if (err) {
        //       console.error(err);
        //       return reject(err);
        //    }
        pm2.list((err, apps) => {
            if (err) {
                console.error(err);
                return reject(err);
            }
            const instance = apps.find(app => app.name === organName);
            resolve(instance);
        });
        // });
    });
};
// const restartPm2 = (apps) => {
//    console.log("restart pm2")
//    const appsIds = apps.map(app => {
//       return app.pm_id
//    });
//    return new Promise((resolve, reject) => {
//       pm2.restart(appsIds, (err) => {
//          if (err) {
//             console.error(err);
//             resolve(false)
//             return;
//          }
//          resolve(true);
//       })
//    });
//    // return Promise.all(promises);
// }
createOrganConfigFile().then((organModel) => {
    organModel.restart.bind(() => {
        const restart = organModel.restart.get();
        if (!restart) {
            spinal_core_connectorjs_type_1.spinalCore.load_type(connect, 'SpinalDisoverModel', (spinalDisoverModel) => {
                Utilities_1.SpinalDisoverModelConnectionSuccessCallback(spinalDisoverModel, organModel);
            }, Utilities_1.connectionErrorCallback);
            spinal_core_connectorjs_type_1.spinalCore.load_type(connect, 'SpinalListenerModel', (spinalListenerModel) => {
                Utilities_1.SpinalDeviceConnectionSuccessCallback(spinalListenerModel, organModel);
            }, Utilities_1.connectionErrorCallback);
            return;
        }
        // console.log(organModel.restart._server_id)
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
            // // restartPm2(apps).then((result) => {
            // //    console.log("stop restart")
            // //    //       organModel.restart.set(false);
            // // }).catch((err) => {
            // //    console.log("error in restart")
            // //    //    organModel.restart.set(false);
            // // });
        }));
    });
    // spinalCore.load_type(connect, 'SpinalDisoverModel', (spinalDisoverModel: SpinalDisoverModel) => {
    //    SpinalDisoverModelConnectionSuccessCallback(spinalDisoverModel, organModel)
    // }, connectionErrorCallback);
    // spinalCore.load_type(connect, 'SpinalListenerModel', (spinalListenerModel: SpinalListenerModel) => {
    //    SpinalDeviceConnectionSuccessCallback(spinalListenerModel, organModel);
    // }, connectionErrorCallback);
});
//# sourceMappingURL=index.js.map