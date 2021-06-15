import { SpinalBmsEndpointGroup, NetworkService, SpinalBmsEndpoint } from "spinal-model-bmsnetwork";
import { SpinalBacnetValueModel, SpinalDisoverModel } from "spinal-model-bacnet";
import { SpinalContext, SpinalGraph, SpinalGraphService, SpinalNode, SpinalNodeRef } from "spinal-env-viewer-graph-service";


export class SpinalNetworkServiceUtilities {
   constructor() { }

   public static async init(spinalModel: SpinalDisoverModel | SpinalBacnetValueModel) {
      if (spinalModel instanceof SpinalDisoverModel) {
         return this.initSpinalDiscoverNetwork(spinalModel);
      } else if (spinalModel instanceof SpinalBacnetValueModel) {
         return this.initSpinalBacnetValueModel(spinalModel);
      }
   }

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
         contextName: (<any>context).getName().get(),
         contextType: (<any>context).getType().get(),
         networkType: (<any>network).getType().get(),
         networkName: (<any>network).getName().get()
      };

      await networkService.init((<any>graph), organNetwork);
      const device = { address: (<any>node).info.address.get(), deviceId: (<any>node).info.idNetwork.get() }

      return {
         networkService,
         device,
         organ,
         node
      }
   }


   /////////////////////////////////////////////////////////////
   ////              GET NETWORK SERVICE DATA                 //
   /////////////////////////////////////////////////////////////

   private static async _getSpinalDiscoverModel(discoverModel: SpinalDisoverModel): Promise<{
      graph: SpinalGraph<any>;
      organ: { contextName: string; contextType: string; networkType: string; networkName: string; }
   }> {
      const graph = await this.getGraph(discoverModel.graph);

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

   private static getGraph(graphPtr): Promise<SpinalGraph<any>> {
      return new Promise((resolve, reject) => {
         graphPtr.load((graph) => {
            resolve(graph);
         });
      });

   }
}