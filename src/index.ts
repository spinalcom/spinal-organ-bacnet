require("json5/lib/register");

import { spinalCore } from "spinal-core-connectorjs_type";

import {
   SpinalDisoverModel, SpinalListenerModel,
   SpinalOrganConfigModel, SpinalBacnetValueModel, SpinalPilotModel
} from "spinal-model-bacnet";

import {
   SpinalDiscoverCallback, SpinalListnerCallback,
   SpinalBacnetValueModelCallback, connectionErrorCallback,
   CreateOrganConfigFile, GetPm2Instance, SpinalPilotCallback
} from './utilities/Functions';


const pm2 = require("pm2");
const config = require("../config.json5");
const url = `${config.spinalConnector.protocol}://${config.spinalConnector.userId}:${config.spinalConnector.password}@${config.spinalConnector.host}:${config.spinalConnector.port}/`;
const connect = spinalCore.connect(url);


const path = config.spinalConnector.path;
const name = config.spinalConnector.name;



const listenLoadType = (connect, organModel) => {
   return new Promise((resolve, reject) => {
      spinalCore.load_type(connect, 'SpinalDisoverModel', (spinalDisoverModel: SpinalDisoverModel) => {
         SpinalDiscoverCallback(spinalDisoverModel, organModel)
      }, connectionErrorCallback);

      spinalCore.load_type(connect, 'SpinalListenerModel', (spinalListenerModel: SpinalListenerModel) => {
         SpinalListnerCallback(spinalListenerModel, organModel);
      }, connectionErrorCallback);

      spinalCore.load_type(connect, 'SpinalBacnetValueModel', (spinalBacnetValueModel: SpinalBacnetValueModel) => {
         SpinalBacnetValueModelCallback(spinalBacnetValueModel, organModel);
      }, connectionErrorCallback);

      spinalCore.load_type(connect, 'SpinalPilotModel', (spinalPilotModel: SpinalPilotModel) => {
         SpinalPilotCallback(spinalPilotModel, organModel);
      }, connectionErrorCallback);
   });
}

CreateOrganConfigFile(connect, path, name).then((organModel: SpinalOrganConfigModel) => {

   organModel.restart.bind(() => {
      GetPm2Instance(name).then(async (app: any) => {
         const restart = organModel.restart.get();
         console.log(app);

         if (!restart) {
            listenLoadType(connect, organModel);
            return;
         }

         if (app) {
            console.log("restart organ", app.pm_id);
            organModel.restart.set(false)

            pm2.restart(app.pm_id, (err) => {
               if (err) {
                  console.error(err);
                  return;
               }
               console.log("organ restarted with success !");
            })
         }

      })
   })
})