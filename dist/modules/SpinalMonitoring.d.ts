import { SpinalListenerModel } from "spinal-model-bacnet";
declare class SpinalMonitoring {
    private queue;
    private priorityQueue;
    private isProcessing;
    private intervalTimesMap;
    private initializedMap;
    private devices;
    constructor();
    addToMonitoringList(spinalListenerModel: SpinalListenerModel): Promise<void>;
    init(): void;
    startDeviceInitialisation(): Promise<void>;
    startMonitoring(): Promise<void>;
    private _addToMaps;
    private removeToMaps;
    private execFunc;
    private createDataIfNotExist;
    private funcToExecute;
    private waitFct;
}
declare const spinalMonitoring: SpinalMonitoring;
export default spinalMonitoring;
export { spinalMonitoring };
