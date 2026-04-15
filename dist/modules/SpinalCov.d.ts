import { ICovData } from "../Interfaces";
import { COV_EVENTS_NAMES } from "../utilities/GlobalVariables";
import EventEmitter from "events";
export type EventPayload = {
    error?: {
        message: string;
    };
    key?: string;
    data?: any;
    eventName: string;
};
declare class SpinalCov extends EventEmitter {
    private static _instance;
    private itemToWatchQueue;
    private itemsToStopQueue;
    private _lastCovNotification;
    private itemMonitored;
    private constructor();
    static getInstance(): SpinalCov;
    updateLastCovNotificationTime(): void;
    startCovProcessing(): void;
    stopAllCovSubscriptions(): ICovData[];
    restartAllCovSubscriptions(): void;
    addToCovQueue(data: ICovData | ICovData[]): Promise<void>;
    addToStopCovQueue(data: ICovData | ICovData[]): void;
    processToDataTreatment(list: ICovData[], eventName: typeof COV_EVENTS_NAMES[keyof typeof COV_EVENTS_NAMES]): Promise<void>;
    private _checkCovStatus;
    private formatChildren;
    _updateDeviceValue(address: string, request: any): Promise<boolean[]>;
    private _listenEvents;
}
export { SpinalCov };
