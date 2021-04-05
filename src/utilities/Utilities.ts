import { FileSystem } from "spinal-core-connectorjs_type";
import { SpinalDevice } from "../modules/SpinalDevice";

import { writeFile, existsSync, mkdirSync, createReadStream } from "fs";
import { SpinalDisoverModel, SpinalListenerModel, SpinalOrganConfigModel, STATES } from "spinal-model-bacnet";

import { SpinalContextCreation } from "../modules/SpinalContextCreation";
import { SpinalDeviceListener } from "../modules/SpinalDeviceListener";

const Q = require('q');

export const waitModelReady = (spinalContext: any) => {
   const deferred = Q.defer();
   const waitModelReadyLoop = (f: any, defer) => {
      if (FileSystem._sig_server === false) {
         setTimeout(() => {
            defer.resolve(waitModelReadyLoop(f, defer));
         }, 100);
      } else {
         defer.resolve(f);
      }
      return defer.promise;
   };
   return waitModelReadyLoop(spinalContext, deferred);
};



export const SpinalDisoverModelConnectionSuccessCallback = (spinalDisoverModel: SpinalDisoverModel, organModel: SpinalOrganConfigModel) => {
   waitModelReady(spinalDisoverModel).then(() => {
      // console.log(spinalDisoverModel.organ._server_id, organModel._server_id);

      if (organModel._server_id === spinalDisoverModel.organ._server_id) {
         const minute = 2 * (60 * 1000)
         const time = Date.now();
         const creation = spinalDisoverModel.creation ? spinalDisoverModel.creation.get() : 0
         if ((time - creation) >= minute || spinalDisoverModel.state.get() === STATES.created) {
            spinalDisoverModel.remove();
            return;
         }
         new SpinalContextCreation(spinalDisoverModel);
      }


   }).catch((err) => {
      console.error(err)
   });
}

export const SpinalDeviceConnectionSuccessCallback = (spinalListenerModel: SpinalListenerModel, organModel: SpinalOrganConfigModel) => {
   waitModelReady(spinalListenerModel).then(() => {
      // new SpinalDeviceListener(model);
      if (spinalListenerModel.organ._server_id === organModel._server_id) {
         new SpinalDeviceListener(spinalListenerModel);
      }

   }).catch((err) => {
      console.error(err)
   });
}

export const connectionErrorCallback = (err?) => {
   if (!err) console.error('Error Connect');
   else console.error('Error Connect', err)
   process.exit(0);
}



////////////////////////////////////////////////
////                 FILES                    //
////////////////////////////////////////////////
export const saveAsFile = (obj: SpinalDevice) => {

   const data = obj.convertToString();
   const folder = `${process.cwd()}/db`;
   const fileName = `${(<any>obj).node.id.get()}.db`;

   if (!existsSync(folder)) {
      mkdirSync(folder);
   }

   return new Promise((resolve, reject) => {
      writeFile(`${folder}/${fileName}`, data, (err) => {
         if (err) {
            console.error(err);

            reject(err);
            return;
         }
         resolve(true);
      })
   });
}


export const loadFile = (id: string) => {
   return new Promise((resolve, reject) => {
      const path = `${process.cwd()}/db/${id}.db`;

      if (!existsSync(path)) {
         reject("file not exist");
         return;
      };

      const data = [];
      const readStream = createReadStream(path, { highWaterMark: 16 });

      readStream.on('data', function (chunk) {
         data.push(chunk);
      });

      readStream.on('end', () => {
         const x = Buffer.concat(data).toString();
         resolve(JSON.parse(x));
      })

      readStream.on('error', (err) => {
         reject(err);
      })
   });



}