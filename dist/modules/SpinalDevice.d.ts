/// <reference types="node" />
import { NetworkService } from "spinal-model-bmsnetwork";
import { EventEmitter } from "events";
import { SpinalNodeRef } from "spinal-env-viewer-graph-service";
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
    private endpointGroups;
    private children;
    private node;
    private networkService;
    private updateInterval;
    constructor(device: IDevice, client: any, updateTime?: number);
    init(): Promise<boolean | void>;
    createStructureNodes(networkService: NetworkService, node: SpinalNodeRef, parentId: string): Promise<any>;
    createDeviceItemList(networkService: NetworkService, node: SpinalNodeRef, sensors: Array<number>): Promise<any>;
    convertToString(): string;
    private _createDevice;
    private _createEndpointsGroup;
    private _createEndpointByArray;
    private _createEndpoint;
    private _getDeviceObjectList;
    private _getObjectDetail;
    private _getDeviceInfo;
    private _getPropertyNameByCode;
    private _getObjectTypeByCode;
    private _getUnitsByCode;
    private _formatProperty;
    private _getObjValue;
    private _formatCurrentValue;
    private _itemExistInChild;
}
