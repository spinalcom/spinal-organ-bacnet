import { SpinalNode } from "spinal-env-viewer-graph-service";
import NetworkService from "spinal-model-bmsnetwork";
import { SpinalDevice } from "../modules/SpinalDevice";
import { SpinalListenerModel } from "spinal-model-bacnet";
import { IObjectId } from "./IObjectId";

export interface ICovData {
    spinalDevice: SpinalDevice;
    networkService: NetworkService;
    spinalModel: SpinalListenerModel;
    network: SpinalNode;
    children: IObjectId[];
}


export interface ICovSubscribeReq {
    ip: string;
    object: ICovData["children"][0];
}