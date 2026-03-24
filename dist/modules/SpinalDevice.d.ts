import { InputDataDevice, NetworkService } from "spinal-model-bmsnetwork";
import { EventEmitter } from "events";
import { SpinalNode, SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { SpinalBacnetValueModel, SpinalListenerModel } from "spinal-model-bacnet";
import { ICovData, IDevice, IObjectId } from "../Interfaces";
import { IProfileData } from "../utilities/profileManager";
export declare class SpinalDevice extends EventEmitter {
    device: IDevice | undefined;
    private info;
    covData: ICovData[];
    private _listenerModel;
    private _graph;
    private _context;
    private _network;
    private _organ;
    private _bmsDevice;
    private _profile;
    private _networkService;
    private _profileData;
    constructor(device?: IDevice);
    /** use this function only if device is not created yet */
    init(): Promise<boolean>;
    initExistingDevice(listenerModel: SpinalListenerModel): Promise<boolean>;
    get Id(): string | number;
    get Name(): string;
    getNetworkService(): NetworkService;
    getListenerModel(): SpinalListenerModel;
    getProfileData(): Promise<IProfileData[]>;
    getAllIntervals(): string[];
    getProfileDataByInterval(interval: number | string): IObjectId[];
    /**  add item to covList */
    pushToCovList(children: IObjectId[] | IObjectId): ICovData;
    /** clear covList */
    clearCovList(): void;
    createDeviceNodeInGraph(networkService: NetworkService, parentId: string): Promise<SpinalNodeRef | undefined>;
    /** create device item list in graph */
    createDeviceItemList(networkService: NetworkService, node: SpinalNodeRef, spinalBacnetValueModel: SpinalBacnetValueModel): Promise<void>;
    /** Check and create endpoints if they do not exist */
    checkAndCreateEndpointsIfNotExist(endpointsToCreate: IObjectId[]): Promise<SpinalNodeRef[]>;
    updateEndpoints(interval: number | string): Promise<void>;
    updateEndpointInGraph(obj: InputDataDevice, networkService: NetworkService, networkNode: SpinalNode): Promise<void>;
    private _getDeviceInfo;
    private _groupAndFormatItems;
    private _groupByType;
    private _getDataValue;
    private _getSensors;
    private _getObjecListDetails;
    private _getDeviceId;
    private _createEndpointGroupWithChildren;
    private _getDeviceStructureFromGraph;
    private _initNetworkService;
    private _classifyChildrenByInterval;
}
export declare function addToGetAllBacnetValuesQueue(device: IDevice, node: SpinalNodeRef, networkService: NetworkService, spinalBacnetValueModel: SpinalBacnetValueModel): void;
