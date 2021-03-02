require("json5/lib/register");

import './model';
import { spinalCore } from "spinal-core-connectorjs_type";
import { SpinalBacnet } from "./modules/spinalBacnet";
import { NetworkService } from "spinal-model-bmsnetwork";
import { SpinalContextCreation } from "./utilities/SpinalContextCreation";
import { SpinalDeviceListener } from "./utilities/SpinalDeviceListener";
import { waitModelReady } from './utilities/Utilities'


const config = require("../config.json5");
const url = `http://${config.spinalConnector.userId}:${config.spinalConnector.password}@${config.spinalConnector.host}:${config.spinalConnector.port}/`;
const connect = spinalCore.connect(url);

const bacnet: SpinalBacnet = new SpinalBacnet(config.network);
const networkService: NetworkService = new NetworkService(false);

// bacnet.on("deviceFound", (result) => {
//    const device = result;

//    setTimeout(() => {
//       device.emit("createNodes")
//    }, 5000)

// })

const connectionErrorCallback = (err?) => {
   if (!err) console.error('Error Connect');
   else console.error('Error Connect', err)
   process.exit(0);
}

const SpinalDisoverModelConnectionSuccessCallback = (graph: any) => {
   waitModelReady(graph).then((model: any) => {
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
spinalCore.load_type(connect, 'SpinalListenerModel', SpinalDeviceConnectionSuccessCallback, connectionErrorCallback);



// spinalCore.load_type(connect, 'SpinalGraph', connectionSuccessCallback, connectionErrorCallback)

// spinalCore.load(spinalCore.connect(url), config.spinalConnector.digitalTwinPath, async (graph: any) => {
//    await networkService.init(graph, config.organ);
//    bacnet.discoverDevices(networkService);
// })



