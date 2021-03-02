import { FileSystem } from "spinal-core-connectorjs_type";
// import { SpinalBacnet } from "../modules/spinalBacnet";
import { SpinalDevice } from "../modules/SpinalDevice";

import { writeFile, existsSync, mkdirSync, createReadStream } from "fs";
import bigJSON from "big-json";

// import { Transform } from "stream";
// import { inherits } from "util";


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