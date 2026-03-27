import { ICovData } from "../Interfaces";
import { SpinalQueue } from "spinal-connector-service";
import { COV_EVENTS_NAMES } from "../utilities/GlobalVariables";
declare class SpinalCov {
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
    processToQueueTreatment(queue: SpinalQueue<ICovData>, eventName: typeof COV_EVENTS_NAMES[keyof typeof COV_EVENTS_NAMES]): Promise<void>;
    private _checkCovStatus;
    private formatChildren;
    private createForkedProcess;
    _updateDeviceValue(address: string, request: any): Promise<boolean[]>;
}
export { SpinalCov };
