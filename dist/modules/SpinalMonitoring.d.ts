import { SpinalListenerModel } from "spinal-model-bacnet";
declare class SpinalMonitoring {
    private queue;
    private priorityQueue;
    private isProcessing;
    private intervalTimesMap;
    private initializedMap;
    private devices;
    constructor();
    init(): void;
    addToMonitoringList(spinalListenerModel: SpinalListenerModel): Promise<void>;
    startDeviceInitialisation(): Promise<void>;
    private _addToMaps;
    private addToQueue;
    private removeToMaps;
    startMonitoring(): Promise<void>;
    private execFunc;
    private waitFct;
    private createDataIfNotExist;
    private funcToExecute;
}
declare const spinalMonitoring: SpinalMonitoring;
export default spinalMonitoring;
export { spinalMonitoring };
