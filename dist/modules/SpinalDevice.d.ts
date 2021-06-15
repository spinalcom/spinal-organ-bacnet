/// <reference types="node" />
import { NetworkService } from "spinal-model-bmsnetwork";
import { EventEmitter } from "events";
import { SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { SpinalBacnetValueModel } from "spinal-model-bacnet";
export interface IDevice {
    address?: string;
    deviceId: number;
    maxApdu?: number;
    segmentation?: number;
    vendorId?: number;
}
export declare class SpinalDevice extends EventEmitter {
    private device;
    private info;
    private client;
    private chunkLength;
    private children;
    private node;
    private networkService;
    constructor(device: IDevice, client?: any);
    init(): Promise<boolean | void>;
    createStructureNodes(networkService: NetworkService, node: SpinalNodeRef, parentId: string): Promise<any>;
    createDeviceItemList(networkService: NetworkService, node: SpinalNodeRef, spinalBacnetValueModel: SpinalBacnetValueModel): Promise<any>;
    convertToString(): string;
    private createItemRecur;
    private _createDevice;
    private _getDeviceObjectList;
    private _getDeviceInfo;
    private _formatMultipleProperty;
    private _getAllObjectDetails;
}
