import bacnet from "bacstack";
import { IDevice, IObjectId } from "../Interfaces";
import { EventPayload } from "../modules/SpinalCov";
import type { BacnetReadOutcome } from "../Interfaces/IDeviceCommunicationIndicators";
declare class BacnetUtilitiesClass {
    private static instance;
    private _client;
    private _ipcClient;
    private _clientId;
    private _serverServiceName;
    private _reconnectPromise;
    private _reconnectTimer;
    private constructor();
    private clientState;
    static getInstance(): BacnetUtilitiesClass;
    initAndConnect(clientServiceName: string, serverServiceName: string, port: number): Promise<void>;
    private _attachIpcClientHandlers;
    private _reconnectToServer;
    private _connectToServer;
    createNewBacnetClient(): bacnet;
    getClient(): Promise<bacnet>;
    sendCovRequest(data: EventPayload): void;
    _getDeviceObjectList(device: IDevice, SENSOR_TYPES: Array<number>, getListUsingFragment?: boolean): Promise<IObjectId[]>;
    discoverDevices(networkInfo: any): Promise<IDevice[]>;
    getItemListByFragment(device: IDevice, objectId: IObjectId): Promise<IObjectId[]>;
    resetClient(): Promise<any>;
    pingDevice(host: string): Promise<{
        reachable: boolean;
        responseTimeMs: number | null;
    }>;
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
    _getChildrenNewValueWithMetrics(device: IDevice, children: Array<IObjectId>): Promise<BacnetReadOutcome>;
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
