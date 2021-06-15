"use strict";
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
exports.SpinalNetworkServiceUtilities = void 0;
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const spinal_model_bacnet_1 = require("spinal-model-bacnet");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
class SpinalNetworkServiceUtilities {
    constructor() { }
    static init(spinalModel) {
        return __awaiter(this, void 0, void 0, function* () {
            if (spinalModel instanceof spinal_model_bacnet_1.SpinalDisoverModel) {
                return this.initSpinalDiscoverNetwork(spinalModel);
            }
        });
    }
    static initSpinalDiscoverNetwork(spinalModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield this._getSpinalDiscoverModel(spinalModel);
            const networkService = new spinal_model_bmsnetwork_1.NetworkService(false);
            yield networkService.init(data.graph, data.organ);
            return {
                networkService: networkService,
                network: yield this._getOrCreateNetworkNode(spinalModel.network.get(), networkService)
            };
        });
    }
    /////////////////////////////////////////////////////////////
    ////              GET NETWORK SERVICE DATA                 //
    /////////////////////////////////////////////////////////////
    static _getSpinalDiscoverModel(discoverModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const graph = yield this.getGraph(discoverModel.graph);
            const organ = {
                contextName: discoverModel.context.name.get(),
                contextType: discoverModel.context.type.get(),
                networkType: discoverModel.organ.type.get(),
                networkName: discoverModel.organ.name.get()
            };
            return {
                graph,
                organ
            };
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
    static getGraph(graphPtr) {
        return new Promise((resolve, reject) => {
            graphPtr.load((graph) => {
                resolve(graph);
            });
        });
    }
}
exports.SpinalNetworkServiceUtilities = SpinalNetworkServiceUtilities;
//# sourceMappingURL=SpinalNetworkServiceUtilities.js.map