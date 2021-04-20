require("json5/lib/register");

import { spinalCore, File } from "spinal-core-connectorjs_type";
import { SpinalDisoverModel, SpinalListenerModel, SpinalOrganConfigModel, SpinalBacnetValueModel } from "spinal-model-bacnet";
import { waitModelReady, SpinalDiscoverCallback, SpinalListnerCallback, SpinalBacnetValueModelCallback, connectionErrorCallback } from './utilities/Utilities'

// import { SpinalBacnet } from "./modules/spinalBacnet";
// import { NetworkService } from "spinal-model-bmsnetwork";

const pm2 = require("pm2");

const config = require("../config.json5");
// const url = `${config.spinalConnector.protocol}://${config.spinalConnector.userId}:${config.spinalConnector.password}@${config.spinalConnector.host}/`;
const url = `${config.spinalConnector.protocol}://${config.spinalConnector.userId}:${config.spinalConnector.password}@${config.spinalConnector.host}:${config.spinalConnector.port}/`;
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
               return element.load(file => {
                  waitModelReady(file).then(() => {
                     resolve(file)
                  })
               });
            }
         }


         console.log("file not found")
         const model = new SpinalOrganConfigModel(name);
         waitModelReady(model).then(() => {
            const file = new File(`${name}.conf`, model, undefined)
            directory.push(file);
            return resolve(model);
         })

      })
   });
}

const getPm2Instance = (organName: string) => {
   return new Promise((resolve, reject) => {
      pm2.list((err, apps) => {
         if (err) {
            console.error(err);
            return reject(err);
         }
         const instance = apps.find(app => app.name === organName);

         resolve(instance)

      })
   });
}


const listenLoadType = (connect, organModel) => {
   return new Promise((resolve, reject) => {
      spinalCore.load_type(connect, 'SpinalDisoverModel', (spinalDisoverModel: SpinalDisoverModel) => {
         SpinalDiscoverCallback(spinalDisoverModel, organModel)
      }, connectionErrorCallback);

      spinalCore.load_type(connect, 'SpinalListenerModel', (spinalListenerModel: SpinalListenerModel) => {
         SpinalListnerCallback(spinalListenerModel, organModel);
      }, connectionErrorCallback);

      spinalCore.load_type(connect, 'SpinalBacnetValueModel', (spinalBacnetValueModel: SpinalBacnetValueModel) => {
         SpinalBacnetValueModelCallback(spinalBacnetValueModel);
      }, connectionErrorCallback);
   });

}

createOrganConfigFile().then((organModel: SpinalOrganConfigModel) => {

   organModel.restart.bind(() => {
      const restart = organModel.restart.get();
      if (!restart) {
         listenLoadType(connect, organModel);
         return;
      }

      getPm2Instance(name).then(async (app: any) => {

         if (app) {
            console.log("restart", app.pm_id);
            organModel.restart.set(false)

            pm2.restart(app.pm_id, (err) => {
               if (err) {
                  console.error(err);
                  return;
               }
               console.log("success");
            })
         }

      })
   })
})


