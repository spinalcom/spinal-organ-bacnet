require("json5/lib/register");

import { spinalCore, File } from "spinal-core-connectorjs_type";
import { SpinalDisoverModel, SpinalListenerModel, SpinalOrganConfigModel, STATES } from "spinal-model-bacnet";
import { waitModelReady, SpinalDisoverModelConnectionSuccessCallback, SpinalDeviceConnectionSuccessCallback, connectionErrorCallback } from './utilities/Utilities'

// import { SpinalBacnet } from "./modules/spinalBacnet";
// import { NetworkService } from "spinal-model-bmsnetwork";

const pm2 = require("pm2");

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

const getPm2Instance = (organName: string) => {
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

         resolve(instance)

      })
      // });
   });
}

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



createOrganConfigFile().then((organModel: SpinalOrganConfigModel) => {

   organModel.restart.bind(() => {
      const restart = organModel.restart.get();
      if (!restart) {
         spinalCore.load_type(connect, 'SpinalDisoverModel', (spinalDisoverModel: SpinalDisoverModel) => {
            SpinalDisoverModelConnectionSuccessCallback(spinalDisoverModel, organModel)
         }, connectionErrorCallback);

         spinalCore.load_type(connect, 'SpinalListenerModel', (spinalListenerModel: SpinalListenerModel) => {
            SpinalDeviceConnectionSuccessCallback(spinalListenerModel, organModel);
         }, connectionErrorCallback);
         return;
      }

      // console.log(organModel.restart._server_id)
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

         // // restartPm2(apps).then((result) => {
         // //    console.log("stop restart")
         // //    //       organModel.restart.set(false);
         // // }).catch((err) => {
         // //    console.log("error in restart")
         // //    //    organModel.restart.set(false);

         // // });

      })
   })

   // spinalCore.load_type(connect, 'SpinalDisoverModel', (spinalDisoverModel: SpinalDisoverModel) => {
   //    SpinalDisoverModelConnectionSuccessCallback(spinalDisoverModel, organModel)
   // }, connectionErrorCallback);

   // spinalCore.load_type(connect, 'SpinalListenerModel', (spinalListenerModel: SpinalListenerModel) => {
   //    SpinalDeviceConnectionSuccessCallback(spinalListenerModel, organModel);
   // }, connectionErrorCallback);
})


