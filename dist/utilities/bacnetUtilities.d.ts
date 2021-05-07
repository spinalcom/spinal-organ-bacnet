import { NetworkService } from "spinal-model-bmsnetwork";
export default class BacnetUtilities {
    constructor();
    static _getObjectDetail(client: any, device: any, objects: Array<{
        type: string;
        instance: number;
    }>): Promise<unknown>;
    static _formatProperty(deviceId: any, object: any): {
        objectId: any;
        id: any;
        typeId: any;
        type: any;
        instance: any;
        deviceId: any;
    };
    static _getObjValue(value: any): any;
    static _formatCurrentValue(value: any, type: number): any;
    static _getPropertyNameByCode(type: number): any;
    static _getObjectTypeByCode(typeCode: number): any;
    static _getUnitsByCode(typeCode: number): string;
    static _itemExistInChild(parentId: string, relationName: string, childNetworkId: string | number): Promise<import("spinal-env-viewer-graph-service/declarations/GraphManagerService").SpinalNodeRef>;
    static _createEndpointsGroup(networkService: NetworkService, deviceId: string, groupName: string): Promise<any>;
    static _createEndpointByArray(networkService: NetworkService, groupId: string, endpointArray: any): Promise<[unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]>;
    static _createEndpoint(networkService: NetworkService, groupId: string, endpointObj: any): Promise<any>;
}
export { BacnetUtilities };