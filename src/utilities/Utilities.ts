import { FileSystem } from "spinal-core-connectorjs_type";
import { SpinalDevice } from "../modules/SpinalDevice";
import { writeFile, existsSync, mkdirSync, createReadStream } from "fs";
import { SpinalDisoverModel, SpinalListenerModel, SpinalOrganConfigModel, SpinalBacnetValueModel, STATES } from "spinal-model-bacnet";
import { SpinalContextCreation } from "../modules/SpinalContextCreation";
import { SpinalDeviceListener } from "../modules/SpinalDeviceListener";
import { NetworkService } from "spinal-model-bmsnetwork";
import { SpinalGraphService, SpinalNode } from "spinal-env-viewer-graph-service";

const Q = require('q');
import * as bacnet from "bacstack";

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

////////////////////////////////////////////////
////                 CALLBACKS                //
////////////////////////////////////////////////


export const SpinalDiscoverCallback = (spinalDisoverModel: SpinalDisoverModel, organModel: SpinalOrganConfigModel) => {
   const promises = [waitModelReady(organModel), waitModelReady(spinalDisoverModel)];

   Promise.all(promises).then(async () => {
      // console.log(spinalDisoverModel.organ._server_id, organModel._server_id);
      await waitModelReady(spinalDisoverModel.organ);

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

export const SpinalListnerCallback = (spinalListenerModel: SpinalListenerModel, organModel: SpinalOrganConfigModel) => {
   const promises = [waitModelReady(organModel), waitModelReady(spinalListenerModel)]
   Promise.all(promises).then(async () => {

      await waitModelReady(spinalListenerModel.organ);

      spinalListenerModel.organ.load((organ) => {
         waitModelReady(organ).then(() => {
            if (organ._server_id === organModel._server_id) {
               new SpinalDeviceListener(spinalListenerModel);
            }
         })
      })
   }).catch((err) => {
      console.error(err)
   });
}

export const SpinalBacnetValueModelCallback = (spinalBacnetValueModel: SpinalBacnetValueModel, organModel: SpinalOrganConfigModel) => {
   const promises = [waitModelReady(organModel), waitModelReady(spinalBacnetValueModel)]
   Promise.all(promises).then(async () => {
      const { node, context, graph, network, organ } = await spinalBacnetValueModel.getAllItem();

      if ((<any>organ)._server_id !== organModel._server_id) return;
      // if (spinalBacnetValueModel.state.get() !== '') {
      //    return spinalBacnetValueModel.remToNode();
      // }


      const networkService: NetworkService = new NetworkService(false);


      (<any>SpinalGraphService)._addNode(node);
      (<any>SpinalGraphService)._addNode(context);
      (<any>SpinalGraphService)._addNode(graph);
      (<any>SpinalGraphService)._addNode(network);

      console.log(`get ${(<any>node).getName().get()} bacnet values`);

      const device = { address: (<any>node).info.address.get(), deviceId: (<any>node).info.idNetwork.get() }

      const organNetwork = {
         contextName: (<any>context).getName().get(),
         contextType: (<any>context).getType().get(),
         networkType: (<any>network).getType().get(),
         networkName: (<any>network).getName().get()
      };

      // const client = new bacnet();
      await networkService.init((<any>graph), organNetwork);


      // const spinalDevice = new SpinalDevice(device, client);
      const spinalDevice = new SpinalDevice(device);

      spinalDevice.createDeviceItemList(networkService, (<any>node), spinalBacnetValueModel).then(() => {
         // spinalBacnetValueModel.setSuccessState();
         // console.log(`success ==> ${(<any>node).getName().get()}`);
         // return spinalBacnetValueModel.remToNode();
         console.log("hello world")
      }).catch((err) => {
         spinalBacnetValueModel.setErrorState();
         console.log(`error ===> ${(<any>node).getName().get()}`);
         return spinalBacnetValueModel.remToNode();
         // console.error(err);

      });
   })
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