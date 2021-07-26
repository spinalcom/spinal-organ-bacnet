/// <reference types="node" />
import { NetworkService } from "spinal-model-bmsnetwork";
import { EventEmitter } from "events";
import { SpinalNode, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { SpinalBacnetValueModel } from "spinal-model-bacnet";
import { IDevice } from "../Interfaces";
export declare class SpinalDevice extends EventEmitter {
    private device;
    private info;
    private client;
    constructor(device: IDevice, client?: any, networkService?: NetworkService);
    init(): Promise<boolean | void>;
    createStructureNodes(networkService: NetworkService, node: SpinalNodeRef, parentId: string): Promise<any>;
    createDeviceItemList(networkService: NetworkService, node: SpinalNodeRef, spinalBacnetValueModel: SpinalBacnetValueModel): Promise<any>;
    checkAndCreateIfNotExist(networkService: NetworkService, objectIds: Array<{
        instance: number;
        type: string;
    }>): Promise<[unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown][]>;
    updateEndpoints(networkService: NetworkService, networkNode: SpinalNode<any>, children: Array<{
        instance: number;
        type: number;
    }>): Promise<void>;
    private _createDevice;
    private _getDeviceInfo;
    private _groupByType;
}
