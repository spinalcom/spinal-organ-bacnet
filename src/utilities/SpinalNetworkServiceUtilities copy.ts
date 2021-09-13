import { NetworkService } from "spinal-model-bmsnetwork";
import { SpinalBacnetValueModel, SpinalDisoverModel, SpinalListenerModel } from "spinal-model-bacnet";
import { SpinalGraph, SpinalGraphService, SpinalNode } from "spinal-env-viewer-graph-service";
import { SpinalDevice } from "../modules/SpinalDevice";


export class SpinalNetworkServiceUtilities {
   constructor() { }

   public static async initSpinalDiscoverNetwork(spinalModel: SpinalDisoverModel): Promise<{
      networkService: NetworkService; network: any
   }> {
      const data = await this._getSpinalDiscoverModel(spinalModel);
      const networkService = new NetworkService(false);
      await networkService.init(data.graph, data.organ);
      return {
         networkService: networkService,
         network: await this._getOrCreateNetworkNode(spinalModel.network.get(), networkService)
      };
   }


   public static async initSpinalBacnetValueModel(spinalModel: SpinalBacnetValueModel): Promise<{
      networkService: NetworkService;
      network?: any;
      device: any;
      organ: any;
      node: SpinalNode<any>
   }> {

      const { node, context, graph, network, organ } = await (<any>spinalModel.getAllItem());


      (<any>SpinalGraphService)._addNode(node);
      (<any>SpinalGraphService)._addNode(context);
      (<any>SpinalGraphService)._addNode(graph);
      (<any>SpinalGraphService)._addNode(network);


      const networkService: NetworkService = new NetworkService(false);
      const organNetwork = {
         contextName: context.getName().get(),
         contextType: context.getType().get(),
         networkType: network.getType().get(),
         networkName: network.getName().get()
      };

      await networkService.init(graph, organNetwork);

      const device = node.info.get();

      return {
         networkService,
         device,
         organ,
         node
      }
   }


   public static async initSpinalListenerModel(spinalModel: SpinalListenerModel): Promise<{ interval: number; id: string; func: Function }> {
      const saveTimeSeries = spinalModel.saveTimeSeries?.get() || false;
      const networkService: NetworkService = new NetworkService(saveTimeSeries);

      const [graph, device, network, context, organ, profil] = await Promise.all([
         this.loadPtrValue(spinalModel.graph),
         this.loadPtrValue(spinalModel.device),
         this.loadPtrValue(spinalModel.network),
         this.loadPtrValue(spinalModel.context),
         this.loadPtrValue(spinalModel.organ),
         this.loadPtrValue(spinalModel.monitor.profil)
      ]);


      (<any>SpinalGraphService)._addNode(graph);
      (<any>SpinalGraphService)._addNode(device);
      (<any>SpinalGraphService)._addNode(network);
      (<any>SpinalGraphService)._addNode(context);

      console.log(graph, device, context, network, organ);


      const spinalDevice: SpinalDevice = new SpinalDevice(device.info.get());


      await networkService.init(graph, {
         contextName: context.getName().get(),
         contextType: context.getType().get(),
         networkType: organ.type.get(),
         networkName: organ.name.get()
      })

      spinalModel.saveTimeSeries?.bind(() => {
         networkService.useTimeseries = spinalModel.saveTimeSeries?.get() || false;
      })

      const monitors = spinalModel.monitor.getMonitoringData();

      return monitors.map(({ interval, children }) => {
         let init = false;
         return {
            interval,
            id: device.info.id.get(),
            func: async () => {
               if (spinalModel.listen.get()) {
                  if (!init) {
                     await spinalDevice.checkAndCreateIfNotExist(networkService, children);
                     init = true;
                  }
                  await spinalDevice.updateEndpoints(networkService, network, children);
               }

               // if (typeof callback === "function") callback(networkService, spinalDevice, spinalModel, children);
            }
         }
      })




      // return {
      //    networkService,
      //    spinalDevice,
      //    spinalModel,
      //    network,
      //    profil,
      //    monitor: 
      // }

   }


   /////////////////////////////////////////////////////////////
   ////              GET NETWORK SERVICE DATA                 //
   /////////////////////////////////////////////////////////////

   private static async _getSpinalDiscoverModel(discoverModel: SpinalDisoverModel): Promise<{
      graph: SpinalGraph<any>;
      organ: { contextName: string; contextType: string; networkType: string; networkName: string; }
   }> {
      const graph = await this.loadPtrValue(discoverModel.graph);

      const organ = {
         contextName: discoverModel.context.name.get(),
         contextType: discoverModel.context.type.get(),
         networkType: discoverModel.organ.type.get(),
         networkName: discoverModel.organ.name.get()
      };

      return {
         graph,
         organ
      }

   }

   private static async _getOrCreateNetworkNode(networkInfo: any, networkService: NetworkService) {
      const organId = (<any>networkService).networkId;
      const contextId = (<any>networkService).contextId;

      const children = await SpinalGraphService.getChildrenInContext(organId, contextId);

      for (const child of children) {
         if (child.name.get() === networkInfo.name) {
            return child;
         }
      }

      return networkService.createNewBmsNetwork(organId, networkInfo.type, networkInfo.name);
   }

   private static loadPtrValue(ptrModel): Promise<SpinalGraph<any>> {
      return new Promise((resolve, reject) => {
         ptrModel.load((data) => {
            resolve(data);
         });
      });

   }
}