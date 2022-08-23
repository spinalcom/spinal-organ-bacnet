import { SpinalBacnetValueModel, SpinalDisoverModel, SpinalListenerModel } from "spinal-model-bacnet";
import { IDataMonitor } from "../Interfaces/IDataMonitor";
import { IDataDiscover } from "../Interfaces/IDataDiscover";
import { IDataBacnetValue } from "../Interfaces/IDataBacnetValue";
export declare class SpinalNetworkServiceUtilities {
    static profilDataStore: Map<string, any>;
    constructor();
    static initSpinalDiscoverNetwork(spinalModel: SpinalDisoverModel): Promise<IDataDiscover>;
    static initSpinalBacnetValueModel(spinalModel: SpinalBacnetValueModel): Promise<IDataBacnetValue>;
    static initSpinalListenerModel(spinalModel: SpinalListenerModel): Promise<IDataMonitor>;
    static getSupervisionDetails(profileId: string): any;
    private static _getSpinalDiscoverModel;
    private static _getOrCreateNetworkNode;
    private static loadPtrValue;
    private static _addProfileToMap;
}
