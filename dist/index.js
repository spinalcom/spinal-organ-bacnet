"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("json5/lib/register");
const spinal_core_connectorjs_type_1 = require("spinal-core-connectorjs_type");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const Utilities_1 = require("./utilities/Utilities");
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
                    return element.load(file => resolve(file));
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
createOrganConfigFile().then((organModel) => {
    spinal_core_connectorjs_type_1.spinalCore.load_type(connect, 'SpinalDisoverModel', (spinalDisoverModel) => {
        Utilities_1.SpinalDisoverModelConnectionSuccessCallback(spinalDisoverModel, organModel);
    }, Utilities_1.connectionErrorCallback);
    // spinalCore.load_type(connect, 'SpinalListenerModel', SpinalDeviceConnectionSuccessCallback, connectionErrorCallback);
});
//# sourceMappingURL=index.js.map