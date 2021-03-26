import { SpinalGraph } from "spinal-env-viewer-graph-service";
import { NetworkService } from "spinal-model-bmsnetwork";
import { SpinalBacnet } from "./spinalBacnet";
import { IDevice } from './SpinalDevice';
import { STATES } from 'spinal-model-bacnet';



export class SpinalContextCreation {

   private bindSateProcess: any;
   private bindDevicesProcess: any;
   // private bacnet: SpinalBacnet = new SpinalBacnet(config.network);
   private bacnet: SpinalBacnet;
   private networkService: NetworkService = new NetworkService(false);
   private discoverModel: any;

   constructor(model) {
      // this.graph = graph;
      // this.initialize();
      // this.discoverModel = this.graph.info.discover;
      this.bacnet = new SpinalBacnet(model.network.get())
      this.discoverModel = model;

      this.listenEvents();
      this.bindItem();
      this.bindDevices();
   }

   // private initialize() {
   //    this.listenEvents();

   //    // if (this.graph.info.discover) {
   //    //    this.graph.info.discover.status.set(STATES.reseted);
   //    //    this.graph.info.discover.context.set({})
   //    //    this.graph.info.discover.network.set({})
   //    //    this.graph.info.discover.devices.set(new Lst())
   //    // } else {
   //    //    const discover = {
   //    //       status: STATES.reseted,
   //    //       context: {},
   //    //       netwinitork: {},
   //    //       devices: new Lst()
   //    //    }

   //    //    this.graph.info.add_attr({ discover })
   //    // }

   // }

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
            this.discoverModel.setDiscoveredMode();
            this.bacnet.closeClient();
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
      console.log("Discovering...");

      this.bacnet.discoverDevices();
   }

   private async createNodes() {
      console.log("creating nodes...");
      const organ = {
         contextName: this.discoverModel.context.name.get(),
         contextType: this.discoverModel.context.type.get(),
         networkType: this.discoverModel.network.type.get(),
         networkName: this.discoverModel.network.name.get()
      };
      const graph = await this.getGraph();
      await this.networkService.init(graph, organ);

      this.bacnet.createDevicesNodes(this.networkService).then((result) => {
         this.discoverModel.setCreatedMode();
         this.discoverModel.state.unbind(this.bindSateProcess);
         this.discoverModel.remove();
         console.log("nodes created!");

      }).catch((err) => {

      });
   }

   private listenEvents() {
      this.bacnet.on("deviceFound", (device) => this.addDeviceFound(device));
      this.bacnet.on("timeout", () => this.timeOutEvent());
   }

   private addDeviceFound(device: IDevice) {
      console.log("device found", device.address);

      // const device: IDevice = (<any>spinalDevice).device
      // this.devicesFound.set(device.deviceId, spinalDevice);
      this.discoverModel.devices.push(device);
   }

   private timeOutEvent() {
      console.log("Timeout...");
      this.discoverModel.setTimeoutMode();
   }

   private getGraph(): Promise<SpinalGraph<any>> {
      return new Promise((resolve, reject) => {
         this.discoverModel.graph.load((graph) => {
            resolve(graph);
         });
      });

   }

}