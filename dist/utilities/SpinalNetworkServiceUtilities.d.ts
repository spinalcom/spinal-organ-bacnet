import { NetworkService } from "spinal-model-bmsnetwork";
import { SpinalDisoverModel } from "spinal-model-bacnet";
export declare class SpinalNetworkServiceUtilities {
    constructor();
    static init(spinalModel: SpinalDisoverModel): Promise<{
        networkService: NetworkService;
        network: any;
    }>;
    static initSpinalDiscoverNetwork(spinalModel: SpinalDisoverModel): Promise<{
        networkService: NetworkService;
        network: any;
    }>;
    private static _getSpinalDiscoverModel;
    private static _getOrCreateNetworkNode;
    private static getGraph;
}
