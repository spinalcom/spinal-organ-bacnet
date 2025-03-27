import { SpinalNode } from "spinal-env-viewer-graph-service";
import NetworkService from "spinal-model-bmsnetwork";
import { SpinalDevice } from "../modules/SpinalDevice";
import { SpinalListenerModel } from "spinal-model-bacnet";

export interface ICovData {
    spinalDevice: SpinalDevice;
    networkService: NetworkService;
    spinalModel: SpinalListenerModel;
    network: SpinalNode;
    children: {}[]
}