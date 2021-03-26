require("json5/lib/register");

import { spinalCore } from "spinal-core-connectorjs_type";
import { SpinalBacnet } from "./modules/spinalBacnet";
import { NetworkService } from "spinal-model-bmsnetwork";
import { SpinalContextCreation } from "./modules/SpinalContextCreation";
import { SpinalDeviceListener } from "./modules/SpinalDeviceListener";
import { waitModelReady } from './utilities/Utilities'
import { STATES } from 'spinal-model-bacnet';


const config = require("../config.json5");
const url = `http://${config.spinalConnector.userId}:${config.spinalConnector.password}@${config.spinalConnector.host}:${config.spinalConnector.port}/`;
const connect = spinalCore.connect(url);

const bacnet: SpinalBacnet = new SpinalBacnet(config.network);
const networkService: NetworkService = new NetworkService(false);


const connectionErrorCallback = (err?) => {
   if (!err) console.error('Error Connect');
   else console.error('Error Connect', err)
   process.exit(0);
}

const SpinalDisoverModelConnectionSuccessCallback = (graph: any) => {
   waitModelReady(graph).then((model: any) => {
      console.log(model)
      const minute = 2 * (60 * 1000)
      const time = Date.now();
      const creation = model.creation ? model.creation.get() : 0
      if ((time - creation) >= minute || model.state.get() === STATES.created) {
         model.remove();
         return;
      }
      new SpinalContextCreation(model);
   }).catch((err) => {
      console.error(err)
   });
}

const SpinalDeviceConnectionSuccessCallback = (graph: any) => {
   waitModelReady(graph).then((model: any) => {
      new SpinalDeviceListener(model);
   }).catch((err) => {
      console.error(err)
   });
}

spinalCore.load_type(connect, 'SpinalDisoverModel', SpinalDisoverModelConnectionSuccessCallback, connectionErrorCallback);
// spinalCore.load_type(connect, 'SpinalListenerModel', SpinalDeviceConnectionSuccessCallback, connectionErrorCallback);





