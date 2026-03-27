"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpinalNetworkUtilities = void 0;
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const spinal_model_graph_1 = require("spinal-model-graph");
const spinal_env_viewer_plugin_documentation_service_1 = require("spinal-env-viewer-plugin-documentation-service");
const spinal_models_documentation_1 = require("spinal-models-documentation");
const SpinalDevice_1 = require("../modules/SpinalDevice");
const GlobalVariables_1 = require("./GlobalVariables");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const bmsTypeNames = [spinal_model_bmsnetwork_1.SpinalBmsNetwork.nodeTypeName, spinal_model_bmsnetwork_1.SpinalBmsDevice.nodeTypeName, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.nodeTypeName, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.nodeTypeName];
class SpinalNetworkUtilitiesClass {
    constructor() {
        this._timeSeriesService = null;
    }
    static getIntance() {
        if (!this._instance)
            this._instance = new SpinalNetworkUtilitiesClass();
        return this._instance;
    }
    ////////////////////////////////////////////////////////////////////////
    ////              INITIALIZATION FUNCTIONS FOR MODELS              ////
    ////////////////////////////////////////////////////////////////////////
    initSpinalDiscoverNetwork(spinalModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const { graph, organ, context } = yield this._getSpinalDiscoverModel(spinalModel);
            const network = yield this._getOrCreateNetworkNode(context, organ, spinalModel.network.get());
            return { graph, context, organ, network };
        });
    }
    getTimeSeriesInstance() {
        if (!this._timeSeriesService)
            this._timeSeriesService = new spinal_model_bmsnetwork_1.SpinalServiceTimeseries();
        return this._timeSeriesService;
    }
    initSpinalBacnetValueModel(spinalModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const { node, context, network, organ } = yield spinalModel.getAllItem();
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
        });
    }
    initSpinalListenerModel(spinalModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const spinalDevice = new SpinalDevice_1.SpinalDevice();
            yield spinalDevice.initExistingDevice(spinalModel);
            return spinalDevice;
        });
    }
    /////////////////////////////////////////////////////////////
    //                BMS NETWORK FUNCTIONS                    //
    /////////////////////////////////////////////////////////////
    updateEndpointInGraph(deviceNode_1, children_1) {
        return __awaiter(this, arguments, void 0, function* (deviceNode, children, saveTimeSeries = false) {
            const endpointsObj = yield this._getAllEndpointsInGraph(deviceNode);
            const promises = [];
            for (const child of children) {
                const endpointKey = `${child.type}_${child.id}`;
                const endpointNode = endpointsObj[endpointKey];
                if (endpointNode)
                    promises.push(this._updateEndpointNodeValue(endpointNode, child.currentValue, saveTimeSeries));
            }
            return Promise.all(promises);
        });
    }
    _updateEndpointNodeValue(endpointNode_1, newValue_1) {
        return __awaiter(this, arguments, void 0, function* (endpointNode, newValue, saveTimeSeries = false) {
            const element = yield endpointNode.getElement(true);
            if (!element)
                return false;
            if (element.currentValue)
                element.currentValue.set(newValue);
            if (endpointNode.info.currentValue)
                endpointNode.info.currentValue.set(newValue);
            if (saveTimeSeries && (typeof newValue === "number" || typeof newValue === "boolean")) {
                spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(endpointNode);
                const timeSeriesService = this.getTimeSeriesInstance();
                return timeSeriesService.pushFromEndpoint(endpointNode.getId().get(), newValue);
            }
            return false;
        });
    }
    _getAllEndpointsInGraph(deviceNode) {
        return __awaiter(this, void 0, void 0, function* () {
            const endpointGroups = yield deviceNode.getChildren([spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.relationName]);
            const promises = endpointGroups.map((group) => __awaiter(this, void 0, void 0, function* () {
                const endpointsObj = {};
                const typeId = group.info.idNetwork.get();
                const children = yield group.getChildren([spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName]);
                children.forEach((child) => endpointsObj[`${typeId}_${child.info.idNetwork.get()}`] = child);
                return endpointsObj;
            }));
            return Promise.all(promises).then((result) => {
                return result.reduce((acc, curr) => (Object.assign(Object.assign({}, acc), curr)), {});
            });
        });
    }
    createEndpointsInGroup(context, device, endpointGroupName, endpointArray) {
        return __awaiter(this, void 0, void 0, function* () {
            const endpointGroup = yield this._createEndpointsGroup(context, device, endpointGroupName);
            // const groupId = endpointGroup.id.get();
            return this._createEndpointByArray(context, endpointGroup, endpointArray);
        });
    }
    _createEndpointsGroup(context, deviceNode, endpointGroupName) {
        return __awaiter(this, void 0, void 0, function* () {
            const groupNetworkId = GlobalVariables_1.ObjectTypes[`object_${endpointGroupName}`.toUpperCase()];
            const alreadyExist = yield this._itemExistInChild(deviceNode, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.relationName, groupNetworkId);
            const groupInfo = {
                name: endpointGroupName,
                id: groupNetworkId,
                type: spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.nodeTypeName,
                path: "",
                children: [],
            };
            if (alreadyExist)
                return this.updateNetworkElementNode(alreadyExist, groupInfo);
            const endpointGroup = yield this.createNetworkElementNode(groupInfo, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.nodeTypeName);
            return deviceNode.addChildInContext(endpointGroup, spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.relationName, spinal_model_graph_1.SPINAL_RELATION_PTR_LST_TYPE, context);
        });
    }
    _createEndpointByArray(context, groupNode, endpointArray) {
        return __awaiter(this, void 0, void 0, function* () {
            const endpointAlreadyCreated = yield this._getChildrenAsObj(groupNode, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName);
            const promises = endpointArray.map((endpointInfo) => __awaiter(this, void 0, void 0, function* () {
                const existingEndpoint = endpointAlreadyCreated[endpointInfo.id];
                endpointInfo.type = spinal_model_bmsnetwork_1.SpinalBmsEndpoint.nodeTypeName;
                if (existingEndpoint)
                    return this.updateNetworkElementNode(existingEndpoint, endpointInfo);
                const node = yield this.createNetworkElementNode(endpointInfo, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.nodeTypeName);
                return groupNode.addChildInContext(node, spinal_model_bmsnetwork_1.SpinalBmsEndpoint.relationName, spinal_model_graph_1.SPINAL_RELATION_PTR_LST_TYPE, context);
            }));
            return Promise.all(promises);
        });
    }
    updateNetworkElementNode(node, newInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const element = yield node.getElement(true);
            this._updateElementInfo(element, newInfo);
            this._modifyNodeInfo(node, element);
            yield this._createOrUpdateAttributesFromElement(node, element);
            return node;
        });
    }
    createNetworkElementNode(nodeInfo, type) {
        return __awaiter(this, void 0, void 0, function* () {
            const element = this._createBmsElementFromType(nodeInfo, type);
            if (!element)
                throw new Error(`Unsupported BMS node type: ${type}`);
            return this._createBmsNodeFromElement(element);
        });
    }
    _updateElementInfo(element, newInfo) {
        for (const key in newInfo) {
            const value = newInfo[key];
            if (element[key])
                element[key].set(value);
            else
                element.add_attr({ [key]: value });
        }
    }
    _createBmsElementFromType(nodeInfo, type) {
        switch (type) {
            case spinal_model_bmsnetwork_1.SpinalBmsNetwork.nodeTypeName:
                return new spinal_model_bmsnetwork_1.SpinalBmsNetwork(nodeInfo.name, type);
            case spinal_model_bmsnetwork_1.SpinalBmsDevice.nodeTypeName:
                return new spinal_model_bmsnetwork_1.SpinalBmsDevice(nodeInfo);
            case spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup.nodeTypeName:
                return new spinal_model_bmsnetwork_1.SpinalBmsEndpointGroup(nodeInfo);
            case spinal_model_bmsnetwork_1.SpinalBmsEndpoint.nodeTypeName:
                return new spinal_model_bmsnetwork_1.SpinalBmsEndpoint(nodeInfo);
        }
    }
    _createBmsNodeFromElement(element) {
        return __awaiter(this, void 0, void 0, function* () {
            const name = element.getName();
            const type = element.getType();
            const node = new spinal_model_graph_1.SpinalNode(name, type, element);
            this._modifyNodeInfo(node, element);
            yield this._createOrUpdateAttributesFromElement(node, element);
            return node;
        });
    }
    _modifyNodeInfo(node, element) {
        const attribuesToMod = element._attribute_names;
        for (let attr of attribuesToMod) {
            const value = element[attr];
            if (attr === 'id')
                attr = 'idNetwork';
            if (node.info[attr])
                node.info.mod_attr(attr, value);
            else
                node.info.add_attr({ [attr]: value });
        }
    }
    _createOrUpdateAttributesFromElement(node, nodeElement) {
        return __awaiter(this, void 0, void 0, function* () {
            const attributes = nodeElement._attribute_names;
            const { element } = yield spinal_env_viewer_plugin_documentation_service_1.serviceDocumentation.addCategoryAttribute(node, "default");
            const existingAttributes = _convertSpinalAttributeListToObj(element);
            for (const attr of attributes) {
                let spinalAttr = existingAttributes[attr];
                if (!spinalAttr) {
                    // use .get because attributeService need a string as value 
                    spinalAttr = new spinal_models_documentation_1.SpinalAttribute(attr, nodeElement[attr].get());
                    element.push(spinalAttr);
                }
                spinalAttr.mod('value', nodeElement[attr].get());
            }
            function _convertSpinalAttributeListToObj(element) {
                const obj = {};
                for (let i = 0; i < element.length; i++) {
                    const attrName = element[i].name.get();
                    obj[attrName] = element[i];
                }
                return obj;
            }
        });
    }
    _getSpinalDiscoverModel(discoverModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = [discoverModel.getGraph(), discoverModel.getContext(), discoverModel.getOrgan()];
            const [graph, context, organ] = yield Promise.all(promises);
            // const organ = {
            //    contextName: context.getName().get(),
            //    contextType: context.getType().get(),
            //    networkType: organNode.getType().get(),
            //    networkName: organNode.getName().get()
            // };
            return { graph, organ, context };
        });
    }
    _getOrCreateNetworkNode(context, organ, networkInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const children = yield organ.getChildrenInContext(context);
            for (const child of children) {
                if (child.getName().get() === networkInfo.name) {
                    return child;
                }
            }
            const name = networkInfo.name;
            const type = networkInfo.type || spinal_model_bmsnetwork_1.SpinalBmsNetwork.nodeTypeName;
            const element = new spinal_model_bmsnetwork_1.SpinalBmsNetwork(name, type);
            const networkNode = new spinal_model_graph_1.SpinalNode(name, type, element);
            return organ.addChildInContext(networkNode, spinal_model_bmsnetwork_1.SpinalBmsNetwork.relationName, spinal_model_graph_1.SPINAL_RELATION_PTR_LST_TYPE, context);
        });
    }
    _itemExistInChild(parentNode, relationName, childNetworkId) {
        return __awaiter(this, void 0, void 0, function* () {
            const children = yield parentNode.getChildren([relationName]);
            const found = children.find(el => el.info.idNetwork.get() == childNetworkId);
            return found;
        });
    }
    _getChildrenAsObj(parentNode, relationName) {
        return __awaiter(this, void 0, void 0, function* () {
            const children = yield parentNode.getChildren([relationName]);
            const childObj = {};
            for (const child of children) {
                const networkId = child.idNetwork.get();
                childObj[networkId] = child;
            }
            return childObj;
        });
    }
    loadPtrValue(ptrModel) {
        return new Promise((resolve) => {
            ptrModel.load((data) => resolve(data));
        });
    }
}
const SpinalNetworkUtilities = SpinalNetworkUtilitiesClass.getIntance();
exports.SpinalNetworkUtilities = SpinalNetworkUtilities;
//# sourceMappingURL=SpinalNetworkUtilities.js.map