import * as bacnet from "bacstack";
import { IDevice, IObjectId } from "../Interfaces";
import { EventPayload } from "../modules/SpinalCov";
declare class BacnetUtilitiesClass {
    private static instance;
    private _client;
    private _ipcClient;
    private _clientId;
    private constructor();
    private clientState;
    static getInstance(): BacnetUtilitiesClass;
    initAndConnect(): Promise<void>;
    private _connectToServer;
    createNewBacnetClient(): bacnet;
    getClient(): Promise<bacnet>;
    sendCovRequest(data: EventPayload): void;
    _getDeviceObjectList(device: IDevice, SENSOR_TYPES: Array<number>, getListUsingFragment?: boolean): Promise<IObjectId[]>;
    getItemListByFragment(device: IDevice, objectId: IObjectId): Promise<IObjectId[]>;
    _getObjectDetail(device: IDevice, objects: Array<IObjectId>): Promise<{
        [key: string]: string | boolean | number;
    }[]>;
    _getObjectDetailWithReadPropertyMultiple(device: IDevice, objects: IObjectId[]): Promise<any[]>;
    _getObjectDetailWithReadProperty(device: IDevice, objectId: IObjectId): Promise<any>;
    _getChildrenNewValue(device: IDevice, children: Array<IObjectId>): Promise<Array<{
        id: string | number;
        type: string | number;
        currentValue: any;
    }> | undefined>;
    _getPropertyValue(address: string, sadr: any, objectId: IObjectId, propertyId: number | string): Promise<any>;
    getDeviceId(address: string, sadr: any): Promise<number>;
    sendPilotRequest(request: any): Promise<any>;
    _getObjValue(value: any): boolean | string | number;
    _getPropertyNameByCode(type: number): string | undefined;
    _getObjectTypeByCode(typeCode: number | string): string | undefined;
    private _sendDataToBacnetServer;
}
declare const BacnetUtilities: BacnetUtilitiesClass;
export default BacnetUtilities;
export { BacnetUtilities };
