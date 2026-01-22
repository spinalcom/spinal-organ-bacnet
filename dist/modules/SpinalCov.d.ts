import NetworkService from "spinal-model-bmsnetwork";
import { ICovData } from "../Interfaces";
import SpinalQueuing from "../utilities/SpinalQueuing";
import { SpinalDevice } from "./SpinalDevice";
import { COV_EVENTS_NAMES } from "../utilities/GlobalVariables";
import { SpinalNode } from "spinal-env-viewer-graph-service";
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
    stopAllCovSubscriptions(): {
        networkService: NetworkService;
        network: SpinalNode;
        spinalDevice: SpinalDevice;
        children: any[];
    }[];
    restartAllCovSubscriptions(): void;
    addToCovQueue(data: ICovData | ICovData[]): Promise<void>;
    addToStopCovQueue(data: ICovData | ICovData[]): void;
    processToQueueTreatment(queue: SpinalQueuing<ICovData>, eventName: typeof COV_EVENTS_NAMES[keyof typeof COV_EVENTS_NAMES]): Promise<void>;
    private _checkCovStatus;
    private formatChildren;
    private createForkedProcess;
    _updateDeviceValue(address: string, request: any): Promise<void>;
}
export { SpinalCov };
