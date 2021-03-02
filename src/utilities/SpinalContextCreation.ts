import { Process, Lst, Model, FileSystem } from 'spinal-core-connectorjs_type';
import { SpinalContext, SpinalGraph } from "spinal-env-viewer-graph-service";
import { SpinalBacnet } from "../modules/spinalBacnet";
import { NetworkService } from "spinal-model-bmsnetwork";
import { SpinalDevice, IDevice } from '../modules/SpinalDevice';
import { STATES } from './stateEnum'

import * as lodash from "lodash";

const config = require("../../config.json5");


export class SpinalContextCreation {

   // private context: SpinalContext<any>;
   // private graph: SpinalGraph<any>;

   private bindSateProcess: any;
   private bindDevicesProcess: any;

   private bacnet: SpinalBacnet = new SpinalBacnet(config.network);
   private networkService: NetworkService = new NetworkService(false);
   private discoverModel: any;

   // private devicesFound: Map<number, SpinalDevice> = new Map();
   // private info : any;

   constructor(model) {
      // this.graph = graph;
      // this.initialize();
      // this.discoverModel = this.graph.info.discover;
      this.listenEvents();

      this.discoverModel = model;
      this.bindItem();
      this.bindDevices();
   }

   private initialize() {
      this.listenEvents();

      // if (this.graph.info.discover) {
      //    this.graph.info.discover.status.set(STATES.reseted);
      //    this.graph.info.discover.context.set({})
      //    this.graph.info.discover.network.set({})
      //    this.graph.info.discover.devices.set(new Lst())
      // } else {
      //    const discover = {
      //       status: STATES.reseted,
      //       context: {},
      //       netwinitork: {},
      //       devices: new Lst()
      //    }

      //    this.graph.info.add_attr({ discover })
      // }

   }

   private bindItem() {
      this.bindSateProcess = this.discoverModel.state.bind(() => {
         this.binFunc()
      })
      // this.graph.info.discover.context.bind(lodash.debounce(this.binFunc.bind(this), 1000))
   }

   private bindDevices() {
      this.bindDevicesProcess = this.discoverModel.devices.bind(() => {
         console.log("inside if", this.discoverModel.devices.length, this.bacnet.count)

         if (this.discoverModel.devices.length !== 0 && this.discoverModel.devices.length === this.bacnet.count) {
            this.discoverModel.state.set(STATES.discovered);
            this.discoverModel.devices.unbind(this.bindDevicesProcess);
         }
      })
   }

   private binFunc() {
      switch (this.discoverModel.state.get()) {
         case STATES.discovering:
            this.discover();
            break;
         case STATES.creating:
            this.createNodes();
         default:
            break;
      }
   }

   private async discover() {
      console.log("*** Discovering... ***");

      this.bacnet.discoverDevices();
   }

   private async createNodes() {
      console.log("*** creating... ***");
      const organ = {
         contextName: this.discoverModel.context.name.get(),
         contextType: this.discoverModel.context.type.get(),
         networkType: this.discoverModel.network.type.get(),
         networkName: this.discoverModel.network.name.get()
      };
      const graph = await this.getGraph();
      await this.networkService.init(graph, organ);

      this.bacnet.createDevicesNodes(this.networkService).then((result) => {
         console.log("*** Created ***");
         this.discoverModel.state.set(STATES.created);
         this.discoverModel.state.unbind(this.bindSateProcess);
      }).catch((err) => {

      });
   }

   private listenEvents() {
      this.bacnet.on("deviceFound", (device) => this.addDeviceFound(device));
      this.bacnet.on("timeout", () => this.timeOutEvent());
   }

   private addDeviceFound(device: IDevice) {
      console.log("*** device found ***");

      // const device: IDevice = (<any>spinalDevice).device
      // this.devicesFound.set(device.deviceId, spinalDevice);
      this.discoverModel.devices.push(device);
   }

   private timeOutEvent() {
      console.log("*** Timeout ***");
      // this.discoverModel.context.rem_attr("name");
      // this.discoverModel.context.rem_attr("type");
      // this.discoverModel.network.rem_attr("name");
      // this.discoverModel.network.rem_attr("type");
      this.discoverModel.state.set(STATES.timeout);
   }

   private getGraph(): Promise<SpinalGraph<any>> {
      return new Promise((resolve, reject) => {
         this.discoverModel.graph.load((graph) => {
            resolve(graph);
         });
      });

   }

}