import { SpinalListenerModel } from "spinal-model-bacnet";
declare class SpinalMonitoring {
    private queue;
    private priorityQueue;
    private isProcessing;
    private intervalTimesMap;
    private devices;
    constructor();
    init(): void;
    addToMonitoringList(spinalListenerModel: SpinalListenerModel): Promise<void>;
    startDeviceInitialisation(): Promise<void>;
    private _addToMaps;
    private removeToMaps;
    startMonitoring(): Promise<void>;
    private execFunc;
    private waitFct;
}
declare const spinalMonitoring: SpinalMonitoring;
export default spinalMonitoring;
export { spinalMonitoring };
