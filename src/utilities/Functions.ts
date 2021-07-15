import { FileSystem, File } from "spinal-core-connectorjs_type";
import { SpinalDevice } from "../modules/SpinalDevice";
import {
   SpinalDisoverModel, SpinalListenerModel,
   SpinalOrganConfigModel, SpinalBacnetValueModel,
   SpinalPilotModel, STATES
} from "spinal-model-bacnet";

import { SpinalDiscover } from "../modules/SpinalDiscover";
import { SpinalNetworkServiceUtilities } from "./SpinalNetworkServiceUtilities";

import { spinalMonitoring } from "../modules/SpinalMonitoring";
import { spinalPilot } from "../modules/SpinalPilot";

const Q = require('q');
const pm2 = require("pm2");

const WaitModelReady = () => {
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

export const connectionErrorCallback = (err?) => {
   if (!err) console.error('Error Connect');
   else console.error('Error Connect', err)
   process.exit(0);
}

export const CreateOrganConfigFile = (spinalConnection: any, path: string, connectorName: string) => {

   return new Promise((resolve, reject) => {
      spinalConnection.load_or_make_dir(`${path}`, (directory) => {

         for (let index = 0; index < directory.length; index++) {
            const element = directory[index];
            if (element.name.get() === `${connectorName}.conf`) {
               console.log("organ found !");
               return element.load(file => {
                  WaitModelReady().then(() => {
                     resolve(file)
                  })
               });
            }
         }


         console.log("organ not found");
         const model = new SpinalOrganConfigModel(connectorName);
         WaitModelReady().then(() => {
            const file = new File(`${connectorName}.conf`, model, undefined)
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


////////////////////////////////////////////////
////                 CALLBACKS                //
////////////////////////////////////////////////


export const SpinalDiscoverCallback = async (spinalDisoverModel: SpinalDisoverModel, organModel: SpinalOrganConfigModel) => {

   await WaitModelReady();

   if (organModel.id?.get() === spinalDisoverModel.organ?.id?.get()) {
      const minute = 2 * (60 * 1000)
      const time = Date.now();
      const creation = spinalDisoverModel.creation?.get() || 0;

      // Check if model is not timeout.
      if ((time - creation) >= minute || spinalDisoverModel.state.get() === STATES.created) {
         spinalDisoverModel.remove();
         return;
      }
      new SpinalDiscover(spinalDisoverModel);
   }


}


export const SpinalBacnetValueModelCallback = async (spinalBacnetValueModel: SpinalBacnetValueModel, organModel: SpinalOrganConfigModel) => {
   await WaitModelReady();

   try {
      const { networkService, device, organ, node } = (<any>await SpinalNetworkServiceUtilities.initSpinalBacnetValueModel(spinalBacnetValueModel));

      if (organ && (<any>organ).id?.get() !== organModel.id?.get()) return;

      if (spinalBacnetValueModel.state.get() === 'wait') {

         const spinalDevice = new SpinalDevice(device);

         await spinalDevice.createDeviceItemList(networkService, node, spinalBacnetValueModel)

      } else {
         return spinalBacnetValueModel.remToNode();
      }
   } catch (error) {
      spinalBacnetValueModel.setErrorState();
   }

}


export const SpinalListnerCallback = async (spinalListenerModel: SpinalListenerModel, organModel: SpinalOrganConfigModel) => {
   await WaitModelReady();

   spinalListenerModel.organ.load((organ) => {
      if (organ) {
         if (organ.id?.get() === organModel.id?.get()) {
            spinalMonitoring.addToMonitoringList(spinalListenerModel);
         }
      }

   })
}

export const SpinalPilotCallback = async (spinalPilotModel: SpinalPilotModel, organModel: SpinalOrganConfigModel) => {
   await WaitModelReady();
   if (spinalPilotModel.organ?.id.get() === organModel.id?.get()) {
      spinalPilot.addToPilotList(spinalPilotModel);
   }
}

