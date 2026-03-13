import { InputDataDevice, NetworkService } from "spinal-model-bmsnetwork";
import { EventEmitter } from "events";
import { SpinalNode, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { SpinalBacnetValueModel } from "spinal-model-bacnet";
import { ICovData, IDevice } from "../Interfaces";
export declare class SpinalDevice extends EventEmitter {
    device: IDevice | undefined;
    private info;
    covData: ICovData[];
    constructor(device: IDevice);
    /** Initialize the device */
    init(): Promise<boolean>;
    /**  add item to covList */
    pushToCovList(argCovData: ICovData | ICovData[]): number;
    /** clear covList */
    clearCovList(): void;
    /** create device node in graph if not exist */
    createStructureNodes(networkService: NetworkService, node: SpinalNodeRef, parentId: string): Promise<SpinalNodeRef | undefined>;
    /** create device item list in graph */
    createDeviceItemList(networkService: NetworkService, node: SpinalNodeRef, spinalBacnetValueModel: SpinalBacnetValueModel): Promise<void>;
    /** Check and create endpoints if they do not exist */
    checkAndCreateIfNotExist(networkService: NetworkService, objectIds: Array<{
        instance: number;
        type: string;
    }>): Promise<SpinalNodeRef[][]>;
    updateEndpoints(networkService: NetworkService, networkNode: SpinalNode<any>, children: Array<{
        instance: number;
        type: number;
    }>): Promise<void>;
    updateEndpointInGraph(obj: InputDataDevice, networkService: NetworkService, networkNode: SpinalNode): Promise<void>;
    private _createDevice;
    private _getDeviceInfo;
    private _groupAndFormatItems;
    private _groupByType;
    private _getDataValue;
    private _getSensors;
    private _getObjecListDetails;
    private _getDeviceId;
    private _createEndpointGroupWithChildren;
}
export declare function addToGetAllBacnetValuesQueue(device: IDevice, node: SpinalNodeRef, networkService: NetworkService, spinalBacnetValueModel: SpinalBacnetValueModel): void;
