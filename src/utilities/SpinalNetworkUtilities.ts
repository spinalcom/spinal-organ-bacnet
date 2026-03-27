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

import { InputDataDevice, InputDataEndpoint, InputDataEndpointGroup, SpinalServiceTimeseries, SpinalBmsDevice, SpinalBmsEndpoint, SpinalBmsEndpointGroup, SpinalBmsNetwork } from "spinal-model-bmsnetwork";
import { SpinalBacnetValueModel, SpinalDiscoverModel, SpinalListenerModel } from "spinal-model-bacnet";
import { SpinalContext, SpinalGraph, SpinalNode, SPINAL_RELATION_PTR_LST_TYPE } from "spinal-model-graph";
import { serviceDocumentation } from "spinal-env-viewer-plugin-documentation-service";
import { SpinalAttribute } from "spinal-models-documentation";
import { SpinalDevice } from "../modules/SpinalDevice";
import { IDataDiscover } from "../Interfaces/IDataDiscover";
import { IDataBacnetValue } from "../Interfaces/IDataBacnetValue";
import { ObjectTypes } from "./GlobalVariables";
import { SpinalGraphService } from "spinal-env-viewer-graph-service";

const bmsTypeNames = [SpinalBmsNetwork.nodeTypeName, SpinalBmsDevice.nodeTypeName, SpinalBmsEndpointGroup.nodeTypeName, SpinalBmsEndpoint.nodeTypeName] as const;
type BmsNodeType = typeof bmsTypeNames[number];

type InputDataTypes = ({ name: string; type: string; } | InputDataDevice | InputDataEndpointGroup | InputDataEndpoint) & { [key: string]: any };


class SpinalNetworkUtilitiesClass {
   private static _instance: SpinalNetworkUtilitiesClass
   private _timeSeriesService: SpinalServiceTimeseries | null = null;

   private constructor() { }

   public static getIntance(): SpinalNetworkUtilitiesClass {
      if (!this._instance) this._instance = new SpinalNetworkUtilitiesClass();
      return this._instance;
   }


   ////////////////////////////////////////////////////////////////////////
   ////              INITIALIZATION FUNCTIONS FOR MODELS              ////
   ////////////////////////////////////////////////////////////////////////

   public async initSpinalDiscoverNetwork(spinalModel: SpinalDiscoverModel): Promise<IDataDiscover> {
      const { graph, organ, context } = await this._getSpinalDiscoverModel(spinalModel);
      const network = await this._getOrCreateNetworkNode(context, organ, spinalModel.network.get());

      return { graph, context, organ, network };
   }

   public getTimeSeriesInstance(): SpinalServiceTimeseries {
      if (!this._timeSeriesService) this._timeSeriesService = new SpinalServiceTimeseries();
      return this._timeSeriesService;
   }


   public async initSpinalBacnetValueModel(spinalModel: SpinalBacnetValueModel): Promise<IDataBacnetValue> {
      const { node, context, network, organ } = await spinalModel.getAllItem();

      // if (node) SpinalGraphService._addNode(node);
      // if (context) SpinalGraphService._addNode(context);
      // if (graph) SpinalGraphService._addNode(graph);
      // if (network) SpinalGraphService._addNode(network);



      // const networkService: NetworkService = new NetworkService(false);
      // const organNetwork = {
      //    contextName: context.getName().get(),
      //    contextType: context.getType().get(),
      //    networkType: network.getType().get(),
      //    networkName: network.getName().get()
      // };

      // await networkService.init(graph, organNetwork);

      return { device: node, context, network, organ };
   }

   public async initSpinalListenerModel(spinalModel: SpinalListenerModel): Promise<SpinalDevice> {

      const spinalDevice = new SpinalDevice();
      await spinalDevice.initExistingDevice(spinalModel);
      return spinalDevice;
   }

   /////////////////////////////////////////////////////////////
   //                BMS NETWORK FUNCTIONS                    //
   /////////////////////////////////////////////////////////////

   public async updateEndpointInGraph(deviceNode: SpinalNode, children: { id: string | number; type: string | number; currentValue: any }[], saveTimeSeries = false): Promise<boolean[]> {
      const endpointsObj = await this._getAllEndpointsInGraph(deviceNode);
      const promises = [];

      for (const child of children) {
         const endpointKey = `${child.type}_${child.id}`;
         const endpointNode = endpointsObj[endpointKey];
         if (endpointNode) promises.push(this._updateEndpointNodeValue(endpointNode, child.currentValue, saveTimeSeries));
      }

      return Promise.all(promises);
   }

   private async _updateEndpointNodeValue(endpointNode: SpinalNode, newValue: any, saveTimeSeries = false): Promise<boolean> {
      const element = await endpointNode.getElement(true);
      if (!element) return false;

      if (element.currentValue) element.currentValue.set(newValue);
      if (endpointNode.info.currentValue) endpointNode.info.currentValue.set(newValue);

      if (saveTimeSeries && (typeof newValue === "number" || typeof newValue === "boolean")) {
         SpinalGraphService._addNode(endpointNode);
         const timeSeriesService = this.getTimeSeriesInstance();
         return timeSeriesService.pushFromEndpoint(endpointNode.getId().get(), newValue);
      }

      return false;
   }

   public async _getAllEndpointsInGraph(deviceNode: SpinalNode): Promise<{ [key: string]: SpinalNode }> {
      const endpointGroups = await deviceNode.getChildren([SpinalBmsEndpointGroup.relationName]);

      const promises = endpointGroups.map(async (group) => {
         const endpointsObj: { [key: string]: SpinalNode } = {};
         const typeId = group.info.idNetwork.get();
         const children = await group.getChildren([SpinalBmsEndpoint.relationName]);
         children.forEach((child) => endpointsObj[`${typeId}_${child.info.idNetwork.get()}`] = child);
         return endpointsObj;
      });

      return Promise.all(promises).then((result) => {
         return result.reduce((acc: {}, curr) => ({ ...acc, ...curr }), {});
      })
   }

   public async createEndpointsInGroup(context: SpinalContext, device: SpinalNode, endpointGroupName: string, endpointArray: InputDataEndpoint[]): Promise<SpinalNode[]> {
      const endpointGroup = await this._createEndpointsGroup(context, device, endpointGroupName);
      // const groupId = endpointGroup.id.get();
      return this._createEndpointByArray(context, endpointGroup, endpointArray);
   }

   public async _createEndpointsGroup(context: SpinalContext, deviceNode: SpinalNode, endpointGroupName: string): Promise<SpinalNode> {
      const groupNetworkId = ObjectTypes[`object_${endpointGroupName}`.toUpperCase()]

      const alreadyExist = await this._itemExistInChild(deviceNode, SpinalBmsEndpointGroup.relationName, groupNetworkId);


      const groupInfo: any = {
         name: endpointGroupName,
         id: groupNetworkId,
         type: SpinalBmsEndpointGroup.nodeTypeName,
         path: "",
         children: [],
      };

      if (alreadyExist) return this.updateNetworkElementNode(alreadyExist, groupInfo);

      const endpointGroup = await this.createNetworkElementNode(groupInfo, SpinalBmsEndpointGroup.nodeTypeName);
      return deviceNode.addChildInContext(endpointGroup, SpinalBmsEndpointGroup.relationName, SPINAL_RELATION_PTR_LST_TYPE, context);
   }

   public async _createEndpointByArray(context: SpinalContext, groupNode: SpinalNode, endpointArray: InputDataEndpoint[]): Promise<SpinalNode[]> {
      const endpointAlreadyCreated = await this._getChildrenAsObj(groupNode, SpinalBmsEndpoint.relationName);

      const promises = endpointArray.map(async (endpointInfo) => {
         const existingEndpoint = endpointAlreadyCreated[endpointInfo.id];
         endpointInfo.type = SpinalBmsEndpoint.nodeTypeName;
         if (existingEndpoint) return this.updateNetworkElementNode(existingEndpoint, endpointInfo);

         const node = await this.createNetworkElementNode(endpointInfo, SpinalBmsEndpoint.nodeTypeName);
         return groupNode.addChildInContext(node, SpinalBmsEndpoint.relationName, SPINAL_RELATION_PTR_LST_TYPE, context);
      });

      return Promise.all(promises);
   }

   public async updateNetworkElementNode(node: SpinalNode, newInfo: InputDataTypes): Promise<SpinalNode> {
      const element = await node.getElement(true);
      this._updateElementInfo(element, newInfo);
      this._modifyNodeInfo(node, element);
      await this._createOrUpdateAttributesFromElement(node, element);

      return node;
   }

   public async createNetworkElementNode(nodeInfo: InputDataTypes, type: BmsNodeType): Promise<SpinalNode> {
      const element = this._createBmsElementFromType(nodeInfo, type);

      if (!element) throw new Error(`Unsupported BMS node type: ${type}`);

      return this._createBmsNodeFromElement(element);
   }

   private _updateElementInfo(element: spinal.Model, newInfo: InputDataTypes): void {
      for (const key in newInfo) {
         const value = newInfo[key];
         if (element[key]) element[key].set(value);
         else element.add_attr({ [key]: value });
      }
   }


   private _createBmsElementFromType(nodeInfo: InputDataTypes, type: BmsNodeType): SpinalBmsNetwork | SpinalBmsDevice | SpinalBmsEndpointGroup | SpinalBmsEndpoint | undefined {
      switch (type) {
         case SpinalBmsNetwork.nodeTypeName:
            return new SpinalBmsNetwork(nodeInfo.name, type);

         case SpinalBmsDevice.nodeTypeName:
            return new SpinalBmsDevice(nodeInfo as InputDataDevice);

         case SpinalBmsEndpointGroup.nodeTypeName:
            return new SpinalBmsEndpointGroup(nodeInfo as InputDataEndpointGroup);

         case SpinalBmsEndpoint.nodeTypeName:
            return new SpinalBmsEndpoint(nodeInfo as InputDataEndpoint);
      }
   }

   private async _createBmsNodeFromElement(element: SpinalBmsNetwork | SpinalBmsDevice | SpinalBmsEndpointGroup | SpinalBmsEndpoint): Promise<SpinalNode> {
      const name = element.getName();
      const type = element.getType();

      const node = new SpinalNode(name, type, element);

      this._modifyNodeInfo(node, element);
      await this._createOrUpdateAttributesFromElement(node, element);

      return node;
   }

   private _modifyNodeInfo(node: SpinalNode, element: spinal.Model): void {
      const attribuesToMod = element._attribute_names;

      for (let attr of attribuesToMod) {
         const value = element[attr];
         if (attr === 'id') attr = 'idNetwork';

         if (node.info[attr]) node.info.mod_attr(attr, value);
         else node.info.add_attr({ [attr]: value });
      }
   }

   private async _createOrUpdateAttributesFromElement(node: SpinalNode, nodeElement: SpinalBmsNetwork | SpinalBmsDevice | SpinalBmsEndpointGroup | SpinalBmsEndpoint): Promise<void> {
      const attributes = nodeElement._attribute_names;

      const { element } = await serviceDocumentation.addCategoryAttribute(node, "default");
      const existingAttributes = _convertSpinalAttributeListToObj(element);

      for (const attr of attributes) {
         let spinalAttr = existingAttributes[attr];
         if (!spinalAttr) {
            // use .get because attributeService need a string as value 
            spinalAttr = new SpinalAttribute(attr, nodeElement[attr].get());
            element.push(spinalAttr);
         }

         spinalAttr.mod('value', nodeElement[attr].get());
      }

      function _convertSpinalAttributeListToObj(element: spinal.Lst<SpinalAttribute>): { [key: string]: SpinalAttribute } {
         const obj: { [key: string]: SpinalAttribute } = {};

         for (let i = 0; i < element.length; i++) {
            const attrName = element[i].name.get();
            obj[attrName] = element[i];
         }
         return obj;
      }
   }

   private async _getSpinalDiscoverModel(discoverModel: SpinalDiscoverModel): Promise<{ graph: SpinalGraph; organ: SpinalNode, context: SpinalContext }> {

      const promises = [discoverModel.getGraph(), discoverModel.getContext(), discoverModel.getOrgan()];
      const [graph, context, organ] = await Promise.all(promises);

      // const organ = {
      //    contextName: context.getName().get(),
      //    contextType: context.getType().get(),
      //    networkType: organNode.getType().get(),
      //    networkName: organNode.getName().get()
      // };

      return { graph, organ, context };
   }

   private async _getOrCreateNetworkNode(context: SpinalContext, organ: SpinalNode, networkInfo: any): Promise<SpinalNode> {

      const children = await organ.getChildrenInContext(context);

      for (const child of children) {
         if (child.getName().get() === networkInfo.name) {
            return child;
         }
      }

      const name = networkInfo.name;
      const type = networkInfo.type || SpinalBmsNetwork.nodeTypeName;

      const element = new SpinalBmsNetwork(name, type);
      const networkNode = new SpinalNode(name, type, element);

      return organ.addChildInContext(networkNode, SpinalBmsNetwork.relationName, SPINAL_RELATION_PTR_LST_TYPE, context);
   }

   private async _itemExistInChild(parentNode: SpinalNode, relationName: string, childNetworkId: string | number): Promise<SpinalNode | undefined> {
      const children = await parentNode.getChildren([relationName]);

      const found = children.find(el => el.info.idNetwork.get() == childNetworkId);

      return found;
   }

   private async _getChildrenAsObj(parentNode: SpinalNode, relationName: string): Promise<{ [key: string]: SpinalNode }> {
      const children = await parentNode.getChildren([relationName]);
      const childObj: { [key: string]: SpinalNode } = {};

      for (const child of children) {
         const networkId = child.idNetwork.get();
         childObj[networkId] = child;
      }
      return childObj;
   }

   private loadPtrValue(ptrModel: spinal.Ptr): Promise<SpinalGraph> {
      return new Promise((resolve) => {
         ptrModel.load((data) => resolve(data));
      });
   }
}


const SpinalNetworkUtilities = SpinalNetworkUtilitiesClass.getIntance();
export { SpinalNetworkUtilities }