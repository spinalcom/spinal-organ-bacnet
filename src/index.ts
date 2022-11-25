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

require("json5/lib/register");

import { FileSystem, spinalCore } from "spinal-core-connectorjs_type";

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
const config = require("../config.js");


const { protocol, host, port, userId, password, path, name } = config.spinalConnector;


const url = `${protocol}://${userId}:${password}@${host}:${port}/`;
const connect = spinalCore.connect(url);


// Cette fonction est executée en cas de deconnexion au hub
FileSystem.onConnectionError = (error_code: number) => {
   setTimeout(() => {
         console.log('STOP ERROR');
         process.exit(error_code); // kill le process;
     }, 5000);
 }


CreateOrganConfigFile(connect, path, name).then((organModel: SpinalOrganConfigModel) => {

   organModel.restart.bind(() => {
      GetPm2Instance(name).then(async (app: any) => {
         const restart = organModel.restart.get();

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

const listenLoadType = (connect, organModel) => {
   // return new Promise((resolve, reject) => {
   loadTypeInSpinalCore(connect, 'SpinalDisoverModel', (spinalDisoverModel: SpinalDisoverModel) => {
      SpinalDiscoverCallback(spinalDisoverModel, organModel)
   }, connectionErrorCallback);

   loadTypeInSpinalCore(connect, 'SpinalListenerModel', (spinalListenerModel: SpinalListenerModel) => {
      SpinalListnerCallback(spinalListenerModel, organModel);
   }, connectionErrorCallback);

   loadTypeInSpinalCore(connect, 'SpinalBacnetValueModel', (spinalBacnetValueModel: SpinalBacnetValueModel) => {
      SpinalBacnetValueModelCallback(spinalBacnetValueModel, organModel);
   }, connectionErrorCallback);

   loadTypeInSpinalCore(connect, 'SpinalPilotModel', (spinalPilotModel: SpinalPilotModel) => {
      SpinalPilotCallback(spinalPilotModel, organModel);
   }, connectionErrorCallback);


   // });
}

const loadTypeInSpinalCore = (connect, type, callback, errorCallback) => {
   spinalCore.load_type(connect, type, callback, errorCallback);
}
