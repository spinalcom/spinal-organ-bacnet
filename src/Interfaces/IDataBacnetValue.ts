import { NetworkService } from "spinal-model-bmsnetwork";
import { SpinalNode, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { IDevice } from "./IDevice";

export interface IDataBacnetValue {
   networkService: NetworkService;
   network?: SpinalNode;
   device: IDevice;
   organ: SpinalNode;
   node: SpinalNodeRef;
}
