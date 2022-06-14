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

import { FileSystem, File } from "spinal-core-connectorjs_type";
import { SpinalDevice } from "../modules/SpinalDevice";
import {
   SpinalDisoverModel, SpinalListenerModel,
   SpinalOrganConfigModel, SpinalBacnetValueModel,
   SpinalPilotModel, STATES
} from "spinal-model-bacnet";

import { SpinalNetworkServiceUtilities } from "./SpinalNetworkServiceUtilities";

import { SpinalDiscover, discover } from "../modules/SpinalDiscover";
import { spinalMonitoring } from "../modules/SpinalMonitoring";
import { spinalPilot } from "../modules/SpinalPilot";

const Q = require('q');
const pm2 = require("pm2");

const WaitModelReady = (): Promise<any> => {
   const deferred = Q.defer();
   const WaitModelReadyLoop = (defer) => {
      if (FileSystem._sig_server === false) {
         setTimeout(() => {
            defer.resolve(WaitModelReadyLoop(defer));
         }, 200);
      } else {
         defer.resolve();
      }
      return defer.promise;
   };
   return WaitModelReadyLoop(deferred);
};

export const connectionErrorCallback = (err?: Error): void => {
   if (!err) console.error('Error Connect');
   else console.error('Error Connect', err)
   process.exit(0);
}

export const CreateOrganConfigFile = (spinalConnection: any, path: string, connectorName: string): Promise<SpinalOrganConfigModel> => {

   return new Promise((resolve) => {
      spinalConnection.load_or_make_dir(`${path}`, async (directory) => {

         const found = await findFileInDirectory(directory, connectorName);
         if (found) {
            console.log("organ found !");
            return resolve(found);
         }


         console.log("organ not found");
         const model = new SpinalOrganConfigModel(connectorName);
         WaitModelReady().then(() => {
            const file = new File(`${connectorName}.conf`, model, { model_type: model.type.get() })
            directory.push(file);
            console.log("organ created");
            return resolve(model);
         })

      })
   });
}

export const GetPm2Instance = (organName: string) => {
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


function findFileInDirectory(directory: spinal.Directory, fileName: string): Promise<SpinalOrganConfigModel | void> {
   return new Promise((resolve, reject) => {
      for (let index = 0; index < directory.length; index++) {
         const element = directory[index];
         const elementName = element.name.get();
         if (elementName.toLowerCase() === `${fileName}.conf`.toLowerCase()) {

            return element.load(file => {
               WaitModelReady().then(() => {
                  resolve(file)
               })
            });
         }
      }

      resolve();
   });

}

////////////////////////////////////////////////
////                 CALLBACKS                //
////////////////////////////////////////////////


export const SpinalDiscoverCallback = async (spinalDisoverModel: SpinalDisoverModel, organModel: SpinalOrganConfigModel): Promise<void | boolean> => {

   await WaitModelReady();

   if (organModel.id?.get() === spinalDisoverModel.organ?.id?.get()) {
      const minute = 2 * (60 * 1000)
      const time = Date.now();
      const creation = spinalDisoverModel.creation?.get() || 0;

      // Check if model is not timeout.
      if ((time - creation) >= minute || spinalDisoverModel.state.get() === STATES.created) {
         spinalDisoverModel.setTimeoutMode();
         return spinalDisoverModel.remove();
      }

      discover.addToQueue(spinalDisoverModel)
      // new SpinalDiscover(spinalDisoverModel);
   }

}


export const SpinalBacnetValueModelCallback = async (spinalBacnetValueModel: SpinalBacnetValueModel, organModel: SpinalOrganConfigModel): Promise<void | boolean> => {
   await WaitModelReady();

   try {
      spinalBacnetValueModel.organ.load(async (organ) => {

         if (organ && (<any>organ).id?.get() !== organModel.id?.get()) return;

         const { networkService, device, node } = (<any>await SpinalNetworkServiceUtilities.initSpinalBacnetValueModel(spinalBacnetValueModel));

         if (spinalBacnetValueModel.state.get() === 'wait') {

            const spinalDevice = new SpinalDevice(device);

            await spinalDevice.createDeviceItemList(networkService, node, spinalBacnetValueModel)

         } else {
            return spinalBacnetValueModel.remToNode();
         }
      })

   } catch (error) {
      // console.error(error);

      await spinalBacnetValueModel.setErrorState();
      return spinalBacnetValueModel.remToNode();
   }

}


export const SpinalListnerCallback = async (spinalListenerModel: SpinalListenerModel, organModel: SpinalOrganConfigModel): Promise<void> => {
   await WaitModelReady();

   spinalListenerModel.organ.load((organ) => {
      if (organ) {
         if (organ.id?.get() === organModel.id?.get()) {
            spinalMonitoring.addToMonitoringList(spinalListenerModel);
         }
      }

   })
}

export const SpinalPilotCallback = async (spinalPilotModel: SpinalPilotModel, organModel: SpinalOrganConfigModel): Promise<void> => {
   await WaitModelReady();
   if (spinalPilotModel.organ?.id.get() === organModel.id?.get()) {
      spinalPilot.addToPilotList(spinalPilotModel);
   }
}

