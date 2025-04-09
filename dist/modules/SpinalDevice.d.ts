/// <reference types="node" />
import * as bacnet from "bacstack";
import { InputDataDevice, NetworkService } from "spinal-model-bmsnetwork";
import { EventEmitter } from "events";
import { SpinalNode, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { SpinalBacnetValueModel } from "spinal-model-bacnet";
import { IDevice } from "../Interfaces";
export declare class SpinalDevice extends EventEmitter {
    device: IDevice;
    private info;
    constructor(device: IDevice, client?: bacnet);
    init(): Promise<void | boolean>;
    createStructureNodes(networkService: NetworkService, node: SpinalNodeRef, parentId: string): Promise<SpinalNodeRef>;
    createDeviceItemList(networkService: NetworkService, node: SpinalNodeRef, spinalBacnetValueModel: SpinalBacnetValueModel): Promise<void>;
    checkAndCreateIfNotExist(networkService: NetworkService, objectIds: Array<{
        instance: number;
        type: string;
    }>): Promise<SpinalNodeRef[][]>;
    updateEndpoints(networkService: NetworkService, networkNode: SpinalNode<any>, children: Array<{
        instance: number;
        type: number;
    }>): Promise<void>;
    updateEndpointInGraph(obj: InputDataDevice, networkService: NetworkService, networkNode: SpinalNode<any>): void;
    private _createDevice;
    private _getDeviceInfo;
    private _groupByType;
    private _getDataValue;
    private _getSensors;
    private _getObjecListDetails;
    private _getDeviceId;
}
export declare function addToGetAllBacnetValuesQueue(device: IDevice, node: SpinalNodeRef, networkService: NetworkService, spinalBacnetValueModel: SpinalBacnetValueModel): void;
