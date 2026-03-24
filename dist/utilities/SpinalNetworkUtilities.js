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
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const SpinalDevice_1 = require("../modules/SpinalDevice");
const profileManager_1 = require("./profileManager");
class SpinalNetworkUtilities {
    constructor() { }
    static initSpinalDiscoverNetwork(spinalModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield this._getSpinalDiscoverModel(spinalModel);
            const networkService = new spinal_model_bmsnetwork_1.NetworkService(false);
            yield networkService.init(data.graph, data.organ);
            const network = yield this._getOrCreateNetworkNode(spinalModel.network.get(), networkService);
            return { networkService, network };
        });
    }
    static initSpinalBacnetValueModel(spinalModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const { node, context, graph, network, organ } = yield spinalModel.getAllItem();
            if (node)
                spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(node);
            if (context)
                spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(context);
            if (graph)
                spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(graph);
            if (network)
                spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(network);
            const networkService = new spinal_model_bmsnetwork_1.NetworkService(false);
            const organNetwork = {
                contextName: context.getName().get(),
                contextType: context.getType().get(),
                networkType: network.getType().get(),
                networkName: network.getName().get()
            };
            yield networkService.init(graph, organNetwork);
            const device = node.info.get();
            return { networkService, device, organ, node };
        });
    }
    static initSpinalListenerModel(spinalModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const spinalDevice = new SpinalDevice_1.SpinalDevice();
            yield spinalDevice.initExistingDevice(spinalModel);
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
        });
    }
    static getProfileData(profileSpinalNode) {
        return __awaiter(this, void 0, void 0, function* () {
            return profileManager_1.default.getInstance().getProfileData(profileSpinalNode);
        });
    }
    /////////////////////////////////////////////////////////////
    ////              GET NETWORK SERVICE DATA                 //
    /////////////////////////////////////////////////////////////
    static _getSpinalDiscoverModel(discoverModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const graph = yield discoverModel.getGraph();
            const context = yield discoverModel.getContext();
            const organNode = yield discoverModel.getOrgan();
            const organ = {
                contextName: context.getName().get(),
                contextType: context.getType().get(),
                networkType: organNode.getType().get(),
                networkName: organNode.getName().get()
            };
            return { graph, organ };
        });
    }
    static _getOrCreateNetworkNode(networkInfo, networkService) {
        return __awaiter(this, void 0, void 0, function* () {
            const organId = networkService.networkId;
            const contextId = networkService.contextId;
            const children = yield spinal_env_viewer_graph_service_1.SpinalGraphService.getChildrenInContext(organId, contextId);
            for (const child of children) {
                if (child.name.get() === networkInfo.name) {
                    return child;
                }
            }
            return networkService.createNewBmsNetwork(organId, networkInfo.type, networkInfo.name);
        });
    }
    static loadPtrValue(ptrModel) {
        return new Promise((resolve) => {
            ptrModel.load((data) => resolve(data));
        });
    }
}
exports.SpinalNetworkUtilities = SpinalNetworkUtilities;
//# sourceMappingURL=SpinalNetworkUtilities.js.map