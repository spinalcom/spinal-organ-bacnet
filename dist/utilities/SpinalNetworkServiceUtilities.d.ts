import { SpinalBacnetValueModel, SpinalDiscoverModel, SpinalListenerModel } from "spinal-model-bacnet";
import { IDataMonitor } from "../Interfaces/IDataMonitor";
import { IDataDiscover } from "../Interfaces/IDataDiscover";
import { IDataBacnetValue } from "../Interfaces/IDataBacnetValue";
export declare class SpinalNetworkServiceUtilities {
    constructor();
    static initSpinalDiscoverNetwork(spinalModel: SpinalDiscoverModel): Promise<IDataDiscover>;
    static initSpinalBacnetValueModel(spinalModel: SpinalBacnetValueModel): Promise<IDataBacnetValue>;
    static initSpinalListenerModel(spinalModel: SpinalListenerModel): Promise<IDataMonitor | undefined>;
    private static _getSpinalDiscoverModel;
    private static _getOrCreateNetworkNode;
    private static loadPtrValue;
}
