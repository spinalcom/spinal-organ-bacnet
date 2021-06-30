import { SpinalListenerModel } from "spinal-model-bacnet";
declare class SpinalMonitoring {
    private queue;
    private priorityQueue;
    private isProcessing;
    private intervalTimesMap;
    constructor();
    init(): void;
    addToMonitoringList(spinalListenerModel: SpinalListenerModel): Promise<void>;
    startDeviceInitialisation(): Promise<void>;
    startMonitoring(): Promise<void>;
    private execFunc;
    private _addToMaps;
    private waitFct;
}
declare const spinalMonitoring: SpinalMonitoring;
export default spinalMonitoring;
export { spinalMonitoring };
