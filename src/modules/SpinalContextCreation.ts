import { SpinalGraph, SpinalGraphService } from "spinal-env-viewer-graph-service";
import { NetworkService } from "spinal-model-bmsnetwork";
import { SpinalBacnet } from "./spinalBacnet";
import { IDevice } from './SpinalDevice';
import { STATES } from 'spinal-model-bacnet';



export class SpinalContextCreation {

   private bindSateProcess: any;
   private bindDevicesProcess: any;
   private bacnet: SpinalBacnet;
   private networkService: NetworkService = new NetworkService(false);
   private discoverModel: any;

   constructor(model) {
      this.bacnet = new SpinalBacnet(model.network.get())
      this.discoverModel = model;

      this.init();
   }

   public init() {
      this.listenEvents();
      this.bindItem();
      this.bindDevices();
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

   /**
    * Methods
    */

   private async discover() {
      console.log("Discovering...");

      this.bacnet.discoverDevices();
   }

   private async createNodes() {
      console.log("creating nodes...");
      const organ = {
         contextName: this.discoverModel.context.name.get(),
         contextType: this.discoverModel.context.type.get(),
         networkType: this.discoverModel.organ.type.get(),
         networkName: this.discoverModel.organ.name.get()
         // networkType: this.discoverModel.network.type.get(),
         // networkName: this.discoverModel.network.name.get()
      };
      const graph = await this.getGraph();
      await this.networkService.init(graph, organ);
      const net = this.discoverModel.network.get();

      const networkNodeInfo = await this.getOrCreateNetNode(net);

      this.bacnet.createDevicesNodes(this.networkService, networkNodeInfo.get()).then((result) => {
         this.discoverModel.setCreatedMode();
         this.discoverModel.state.unbind(this.bindSateProcess);
         this.discoverModel.remove();
         console.log("nodes created!");

      }).catch((err) => {

      });
   }

   private async getOrCreateNetNode(net) {
      const organId = (<any>this.networkService).networkId;
      const contextId = (<any>this.networkService).contextId;

      const children = await SpinalGraphService.getChildrenInContext(organId, contextId);

      for (const child of children) {
         if (child.name.get() === net.name) {
            return child;
         }
      }

      return this.networkService.createNewBmsNetwork(organId, net.type, net.name);

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