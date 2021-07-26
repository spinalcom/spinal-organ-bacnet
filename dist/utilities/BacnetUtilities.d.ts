import * as bacnet from "bacstack";
import { NetworkService } from "spinal-model-bmsnetwork";
import { IDevice, IObjectId, IReadPropertyMultiple, IRequestArray, IReadProperty } from "../Interfaces";
export default class BacnetUtilities {
    constructor();
    static readPropertyMutltiple(address: string, requestArray: IRequestArray | IRequestArray[], argClient?: bacnet): Promise<IReadPropertyMultiple>;
    static readProperty(address: string, objectId: IObjectId, propertyId: number | string, argClient?: bacnet): Promise<IReadProperty>;
    static _getDeviceObjectList(device: IDevice, SENSOR_TYPES: Array<number>, argClient?: bacnet): Promise<Array<IObjectId>>;
    static _getObjectDetail(device: IDevice, objects: Array<IObjectId>, argClient?: any): Promise<Array<{
        [key: string]: string | boolean | number;
    }>>;
    static _getObjectDetailWithReadPropertyMultiple(device: IDevice, objects: Array<IObjectId>, argClient?: any): Promise<Array<any>>;
    static _getObjectDetailWithReadProperty(device: IDevice, objectId: IObjectId, argClient?: any): Promise<any>;
    static _getChildrenNewValue(device: IDevice, children: Array<IObjectId>, argClient?: bacnet): Promise<Array<{
        id: string | number;
        type: string | number;
        currentValue: any;
    }>>;
    private static getChildrenNewValueWithReadPropertyMultiple;
    private static getChildrenNewValueWithReadProperty;
    static createEndpointsInGroup(networkService: NetworkService, deviceId: string, groupName: string, endpointArray: any): Promise<[unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]>;
    static _createEndpointsGroup(networkService: NetworkService, deviceId: string, groupName: string): Promise<any>;
    static _createEndpointByArray(networkService: NetworkService, groupId: string, endpointArray: any): Promise<[unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown]>;
    static _createEndpoint(networkService: NetworkService, groupId: string, endpointObj: any): Promise<any>;
    static _itemExistInChild(parentId: string, relationName: string, childNetworkId: string | number): Promise<import("spinal-env-viewer-graph-service/declarations/GraphManagerService").SpinalNodeRef>;
    static _getPropertyValue(address: string, objectId: IObjectId, propertyId: number | string, argClient?: bacnet): Promise<any>;
    static _formatProperty(object: any): any;
    static _getObjValue(value: any): any;
    static _formatCurrentValue(value: any, type: number | string): any;
    static _getPropertyNameByCode(type: number): any;
    static _getObjectTypeByCode(typeCode: number | string): any;
    static _getUnitsByCode(typeCode: number): string;
}
export { BacnetUtilities };
