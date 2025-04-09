import * as bacnet from "bacstack";
import { SpinalNodeRef } from "spinal-env-viewer-graph-service";
import { NetworkService } from "spinal-model-bmsnetwork";
import { IDevice, IObjectId, IReadPropertyMultiple, IRequestArray, IReadProperty } from "../Interfaces";
declare class BacnetUtilitiesClass {
    private static instance;
    private _client;
    private constructor();
    static getInstance(): BacnetUtilitiesClass;
    createNewBacnetClient(): bacnet;
    getClient(): Promise<bacnet>;
    private _listenClientErrorEvent;
    readPropertyMultiple(address: string, sadr: any, requestArray: IRequestArray | IRequestArray[], argClient?: bacnet): Promise<IReadPropertyMultiple>;
    readProperty(address: string, sadr: any, objectId: IObjectId, propertyId: number | string, argClient?: bacnet, clientOptions?: any): Promise<IReadProperty>;
    _getDeviceObjectList(device: IDevice, SENSOR_TYPES: Array<number>, argClient?: bacnet): Promise<IObjectId[]>;
    getItemListByFragment(device: IDevice, objectId: IObjectId, argClient?: bacnet): Promise<IObjectId[]>;
    _getObjectDetail(device: IDevice, objects: Array<IObjectId>, argClient?: any): Promise<{
        [key: string]: string | boolean | number;
    }[]>;
    _getObjectDetailWithReadPropertyMultiple(device: IDevice, objects: Array<IObjectId>, argClient?: any): Promise<any[]>;
    _getObjectDetailWithReadProperty(device: IDevice, objectId: IObjectId, argClient?: any): Promise<any>;
    _getChildrenNewValue(device: IDevice, children: Array<IObjectId>, argClient?: bacnet): Promise<Array<{
        id: string | number;
        type: string | number;
        currentValue: any;
    }>>;
    private getChildrenNewValueWithReadPropertyMultiple;
    private getChildrenNewValueWithReadProperty;
    createEndpointsInGroup(networkService: NetworkService, deviceId: string, groupName: string, endpointArray: any, deviceName?: string): Promise<SpinalNodeRef[]>;
    _createEndpointsGroup(networkService: NetworkService, deviceId: string, groupName: string): Promise<SpinalNodeRef>;
    _createEndpointByArray(networkService: NetworkService, groupId: string, endpointArray: any, deviceName?: string): Promise<SpinalNodeRef[]>;
    _createEndpoint(networkService: NetworkService, groupId: string, endpointObj: any): Promise<void | SpinalNodeRef>;
    _itemExistInChild(parentId: string, relationName: string, childNetworkId: string | number): Promise<SpinalNodeRef>;
    _getPropertyValue(address: string, sadr: any, objectId: IObjectId, propertyId: number | string, argClient?: bacnet): Promise<any>;
    getDeviceId(address: string, sadr: any, client?: bacnet): Promise<number>;
    _formatProperty(object: any): {
        [key: string]: boolean | string | number;
    };
    _getObjValue(value: any): boolean | string | number;
    _formatCurrentValue(value: any, type: number | string): boolean | string | number;
    _getPropertyNameByCode(type: number): string;
    _getObjectTypeByCode(typeCode: number | string): string;
    _getUnitsByCode(typeCode: number): string;
    private getChildrenObj;
}
declare const BacnetUtilities: BacnetUtilitiesClass;
export default BacnetUtilities;
export { BacnetUtilities };
