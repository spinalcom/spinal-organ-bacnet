import { EventEmitter } from "events";
import { SpinalContext, SpinalNode } from "spinal-model-graph";
import { SpinalBacnetValueModel, SpinalListenerModel } from "spinal-model-bacnet";
import { IDevice, IObjectId } from "../Interfaces";
import { IProfileData } from "../utilities/profileManager";
export declare class SpinalDevice extends EventEmitter {
    device: IDevice | undefined;
    private info;
    covData: IObjectId[];
    private _listenerModel;
    private _graph;
    private _context;
    private _network;
    private _organ;
    private _bmsDevice;
    private _profile;
    private _profileData;
    constructor(device?: IDevice);
    /** use this function only if device is not created yet */
    init(): Promise<boolean>;
    initExistingDevice(listenerModel: SpinalListenerModel): Promise<boolean>;
    get Id(): string | number;
    get Name(): string;
    getBmsDeviceNode(): SpinalNode<any>;
    getListenerModel(): SpinalListenerModel;
    getProfileData(): Promise<IProfileData[]>;
    getAllIntervals(): string[];
    getProfileDataByInterval(interval: number): IObjectId[];
    /**  add item to covList */
    pushToCovList(children: IObjectId[] | IObjectId): IObjectId[];
    /** clear covList */
    clearCovList(): void;
    createDeviceNodeInGraph(context: SpinalContext, network: SpinalNode, deviceNode?: SpinalNode): Promise<SpinalNode>;
    /** create device item list in graph */
    createDeviceItemList(context: SpinalContext, deviceNode: SpinalNode, spinalBacnetValueModel: SpinalBacnetValueModel): Promise<void>;
    private fetchAndFormatAllBacnetObjectList;
    /** Check and create endpoints if they do not exist */
    checkAndCreateEndpointsIfNotExist(endpointsToCreate: IObjectId[]): Promise<SpinalNode[]>;
    updateEndpoints(interval: number): Promise<void | boolean[]>;
    shoulSaveTimeSeries(): boolean;
    private _getDeviceInfo;
    private _groupAndFormatItems;
    private _getDataValue;
    private _getSensors;
    private _getObjectListDetails;
    private _getDeviceId;
    private _createEndpointGroupWithChildren;
    private _getDeviceStructureFromGraph;
    private _classifyChildrenByInterval;
}
export declare function addToGetAllBacnetValuesQueue(device: IDevice, node: SpinalNode, context: SpinalContext, spinalBacnetValueModel: SpinalBacnetValueModel): void;
