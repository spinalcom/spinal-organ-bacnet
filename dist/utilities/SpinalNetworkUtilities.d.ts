import { SpinalBacnetValueModel, SpinalDiscoverModel, SpinalListenerModel } from "spinal-model-bacnet";
import { SpinalNode } from "spinal-env-viewer-graph-service";
import { SpinalDevice } from "../modules/SpinalDevice";
import { IDataDiscover } from "../Interfaces/IDataDiscover";
import { IDataBacnetValue } from "../Interfaces/IDataBacnetValue";
import { IProfileData } from "./profileManager";
export declare class SpinalNetworkUtilities {
    constructor();
    static initSpinalDiscoverNetwork(spinalModel: SpinalDiscoverModel): Promise<IDataDiscover>;
    static initSpinalBacnetValueModel(spinalModel: SpinalBacnetValueModel): Promise<IDataBacnetValue>;
    static initSpinalListenerModel(spinalModel: SpinalListenerModel): Promise<SpinalDevice>;
    static getProfileData(profileSpinalNode: SpinalNode): Promise<IProfileData[]>;
    private static _getSpinalDiscoverModel;
    private static _getOrCreateNetworkNode;
    private static loadPtrValue;
}
