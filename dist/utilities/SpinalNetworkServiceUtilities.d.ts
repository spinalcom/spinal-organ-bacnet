import { NetworkService } from "spinal-model-bmsnetwork";
import { SpinalBacnetValueModel, SpinalDisoverModel, SpinalListenerModel } from "spinal-model-bacnet";
import { SpinalNode } from "spinal-env-viewer-graph-service";
import { SpinalDevice } from "../modules/SpinalDevice";
export declare class SpinalNetworkServiceUtilities {
    constructor();
    static initSpinalDiscoverNetwork(spinalModel: SpinalDisoverModel): Promise<{
        networkService: NetworkService;
        network: any;
    }>;
    static initSpinalBacnetValueModel(spinalModel: SpinalBacnetValueModel): Promise<{
        networkService: NetworkService;
        network?: any;
        device: any;
        organ: any;
        node: SpinalNode<any>;
    }>;
    static initSpinalListenerModel(spinalModel: SpinalListenerModel): Promise<{
        networkService: NetworkService;
        spinalDevice: SpinalDevice;
        spinalModel: SpinalListenerModel;
        network: SpinalNode<any>;
    }>;
    private static _getSpinalDiscoverModel;
    private static _getOrCreateNetworkNode;
    private static loadPtrValue;
}
