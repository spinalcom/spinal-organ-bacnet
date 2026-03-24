/*
 * Copyright 2022 SpinalCom - www.spinalcom.com
 * 
 * This file is part of SpinalCore.
 * 
 * Please read all of the following terms and conditions
 * of the Free Software license Agreement ("Agreement")
 * carefully.
 * 
 * This Agreement is a legally binding contract between
 * the Licensee (as defined below) and SpinalCom that
 * sets forth the terms and conditions that govern your
 * use of the Program. By installing and/or using the
 * Program, you agree to abide by all the terms and
 * conditions stated or referenced herein.
 * 
 * If you do not agree to abide by these terms and
 * conditions, do not demonstrate your acceptance and do
 * not install or use the Program.
 * You should have received a copy of the license along
 * with this file. If not, see
 * <http://resources.spinalcom.com/licenses.pdf>.
 */

import { NetworkService } from "spinal-model-bmsnetwork";
import { SpinalBacnetValueModel, SpinalDiscoverModel, SpinalListenerModel } from "spinal-model-bacnet";
import { SpinalGraph, SpinalGraphService, SpinalNode, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { SpinalDevice } from "../modules/SpinalDevice";
import { IDataMonitor } from "../Interfaces/IDataMonitor";
import { IDataDiscover } from "../Interfaces/IDataDiscover";
import { IDataBacnetValue } from "../Interfaces/IDataBacnetValue";
import ProfileManager, { IProfileData } from "./profileManager";

export class SpinalNetworkUtilities {

   constructor() { }


   public static async initSpinalDiscoverNetwork(spinalModel: SpinalDiscoverModel): Promise<IDataDiscover> {
      const data = await this._getSpinalDiscoverModel(spinalModel);
      const networkService = new NetworkService(false);
      await networkService.init(data.graph, data.organ);
      const network = await this._getOrCreateNetworkNode(spinalModel.network.get(), networkService)
      return { networkService, network };
   }


   public static async initSpinalBacnetValueModel(spinalModel: SpinalBacnetValueModel): Promise<IDataBacnetValue> {
      const { node, context, graph, network, organ } = await spinalModel.getAllItem();

      if (node) SpinalGraphService._addNode(node);
      if (context) SpinalGraphService._addNode(context);
      if (graph) SpinalGraphService._addNode(graph);
      if (network) SpinalGraphService._addNode(network);



      const networkService: NetworkService = new NetworkService(false);
      const organNetwork = {
         contextName: context.getName().get(),
         contextType: context.getType().get(),
         networkType: network.getType().get(),
         networkName: network.getName().get()
      };

      await networkService.init(graph, organNetwork);

      const device = node.info.get();

      return { networkService, device, organ, node };
   }


   public static async initSpinalListenerModel(spinalModel: SpinalListenerModel): Promise<SpinalDevice> {

      const spinalDevice = new SpinalDevice();
      await spinalDevice.initExistingDevice(spinalModel);
      return spinalDevice;

      // try {
      //    const saveTimeSeries = spinalModel.saveTimeSeries?.get() || false;
      //    const networkService: NetworkService = new NetworkService(saveTimeSeries);
      //    const promises = [
      //       spinalModel.graph,
      //       spinalModel.bmsDevice,
      //       spinalModel.network,
      //       spinalModel.context,
      //       spinalModel.organ,
      //       spinalModel.profile
      //    ].map(ptr => this.loadPtrValue(ptr));

      //    const [graph, device, network, context, organ, profile] = await Promise.all(promises);

      //    if (graph) SpinalGraphService._addNode(graph);
      //    if (device) SpinalGraphService._addNode(device);
      //    if (network) SpinalGraphService._addNode(network);
      //    if (context) SpinalGraphService._addNode(context);

      //    const spinalDevice: SpinalDevice = new SpinalDevice(device.info.get());

      //    await networkService.init(graph, {
      //       contextName: context.getName().get(),
      //       contextType: context.getType().get(),
      //       networkType: organ.getType().get(),
      //       networkName: organ.getName().get()
      //    })

      //    spinalModel.saveTimeSeries?.bind(() => {
      //       networkService.useTimeseries = spinalModel.saveTimeSeries?.get() || false;
      //    })

      //    return { id: device.getId().get(), spinalModel, spinalDevice, networkService, network, profile };

      // } catch (error) {
      //    return;
      // }





      // // return {
      // //    networkService,
      // //    spinalDevice,
      // //    spinalModel,
      // //    network,
      // //    profil,
      // //    monitor: 
      // // }

   }

   public static async getProfileData(profileSpinalNode: SpinalNode): Promise<IProfileData[]> {
      return ProfileManager.getInstance().getProfileData(profileSpinalNode);
   }

   /////////////////////////////////////////////////////////////
   ////              GET NETWORK SERVICE DATA                 //
   /////////////////////////////////////////////////////////////

   private static async _getSpinalDiscoverModel(discoverModel: SpinalDiscoverModel): Promise<{ graph: SpinalGraph<any>; organ: { contextName: string; contextType: string; networkType: string; networkName: string; } }> {
      const graph = await discoverModel.getGraph();
      const context = await discoverModel.getContext();
      const organNode = await discoverModel.getOrgan();

      const organ = {
         contextName: context.getName().get(),
         contextType: context.getType().get(),
         networkType: organNode.getType().get(),
         networkName: organNode.getName().get()
      };

      return { graph, organ }
   }

   private static async _getOrCreateNetworkNode(networkInfo: any, networkService: NetworkService): Promise<SpinalNodeRef> {
      const organId = (networkService as any).networkId;
      const contextId = (networkService as any).contextId;

      const children = await SpinalGraphService.getChildrenInContext(organId, contextId);

      for (const child of children) {
         if (child.name.get() === networkInfo.name) {
            return child;
         }
      }

      return networkService.createNewBmsNetwork(organId, networkInfo.type, networkInfo.name);
   }

   private static loadPtrValue(ptrModel: spinal.Ptr): Promise<SpinalGraph> {
      return new Promise((resolve) => {
         ptrModel.load((data) => resolve(data));
      });
   }
}
