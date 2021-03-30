require("json5/lib/register");

import { spinalCore, File } from "spinal-core-connectorjs_type";
import { SpinalDisoverModel, SpinalOrganConfigModel, STATES } from "spinal-model-bacnet";
import { waitModelReady, SpinalDisoverModelConnectionSuccessCallback, SpinalDeviceConnectionSuccessCallback, connectionErrorCallback } from './utilities/Utilities'

import { SpinalBacnet } from "./modules/spinalBacnet";
import { NetworkService } from "spinal-model-bmsnetwork";

const config = require("../config.json5");
const url = `http://${config.spinalConnector.userId}:${config.spinalConnector.password}@${config.spinalConnector.host}:${config.spinalConnector.port}/`;
const connect = spinalCore.connect(url);
const path = config.spinalConnector.path;
const name = config.spinalConnector.name;



const createOrganConfigFile = () => {
   return new Promise((resolve, reject) => {
      connect.load_or_make_dir(`${path}`, (directory) => {

         for (let index = 0; index < directory.length; index++) {
            const element = directory[index];
            if (element.name.get() === `${name}.conf`) {
               console.log("element found")
               return element.load(file => resolve(file));
            }
         }


         console.log("file not found")
         const model = new SpinalOrganConfigModel(name);
         waitModelReady(model).then(() => {
            const file = new File(`${name}.conf`, model, undefined)
            directory.push(file);
            return resolve(model);
         })

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
      })

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
}


createOrganConfigFile().then((organModel: SpinalOrganConfigModel) => {
   spinalCore.load_type(connect, 'SpinalDisoverModel', (spinalDisoverModel: SpinalDisoverModel) => {
      SpinalDisoverModelConnectionSuccessCallback(spinalDisoverModel, organModel)
   }, connectionErrorCallback);

   // spinalCore.load_type(connect, 'SpinalListenerModel', SpinalDeviceConnectionSuccessCallback, connectionErrorCallback);
})


