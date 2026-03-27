import { InputDataDevice, InputDataEndpoint, InputDataEndpointGroup, SpinalServiceTimeseries } from "spinal-model-bmsnetwork";
import { SpinalBacnetValueModel, SpinalDiscoverModel, SpinalListenerModel } from "spinal-model-bacnet";
import { SpinalContext, SpinalNode } from "spinal-model-graph";
import { SpinalDevice } from "../modules/SpinalDevice";
import { IDataDiscover } from "../Interfaces/IDataDiscover";
import { IDataBacnetValue } from "../Interfaces/IDataBacnetValue";
declare const bmsTypeNames: readonly [string, string, string, string];
type BmsNodeType = typeof bmsTypeNames[number];
type InputDataTypes = ({
    name: string;
    type: string;
} | InputDataDevice | InputDataEndpointGroup | InputDataEndpoint) & {
    [key: string]: any;
};
declare class SpinalNetworkUtilitiesClass {
    private static _instance;
    private _timeSeriesService;
    private constructor();
    static getIntance(): SpinalNetworkUtilitiesClass;
    initSpinalDiscoverNetwork(spinalModel: SpinalDiscoverModel): Promise<IDataDiscover>;
    getTimeSeriesInstance(): SpinalServiceTimeseries;
    initSpinalBacnetValueModel(spinalModel: SpinalBacnetValueModel): Promise<IDataBacnetValue>;
    initSpinalListenerModel(spinalModel: SpinalListenerModel): Promise<SpinalDevice>;
    updateEndpointInGraph(deviceNode: SpinalNode, children: {
        id: string | number;
        type: string | number;
        currentValue: any;
    }[], saveTimeSeries?: boolean): Promise<boolean[]>;
    private _updateEndpointNodeValue;
    _getAllEndpointsInGraph(deviceNode: SpinalNode): Promise<{
        [key: string]: SpinalNode;
    }>;
    createEndpointsInGroup(context: SpinalContext, device: SpinalNode, endpointGroupName: string, endpointArray: InputDataEndpoint[]): Promise<SpinalNode[]>;
    _createEndpointsGroup(context: SpinalContext, deviceNode: SpinalNode, endpointGroupName: string): Promise<SpinalNode>;
    _createEndpointByArray(context: SpinalContext, groupNode: SpinalNode, endpointArray: InputDataEndpoint[]): Promise<SpinalNode[]>;
    updateNetworkElementNode(node: SpinalNode, newInfo: InputDataTypes): Promise<SpinalNode>;
    createNetworkElementNode(nodeInfo: InputDataTypes, type: BmsNodeType): Promise<SpinalNode>;
    private _updateElementInfo;
    private _createBmsElementFromType;
    private _createBmsNodeFromElement;
    private _modifyNodeInfo;
    private _createOrUpdateAttributesFromElement;
    private _getSpinalDiscoverModel;
    private _getOrCreateNetworkNode;
    private _itemExistInChild;
    private _getChildrenAsObj;
    private loadPtrValue;
}
declare const SpinalNetworkUtilities: SpinalNetworkUtilitiesClass;
export { SpinalNetworkUtilities };
