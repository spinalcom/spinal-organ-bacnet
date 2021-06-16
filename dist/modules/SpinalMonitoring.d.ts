import { SpinalListenerModel } from "spinal-model-bacnet";
declare class SpinalMonitoring {
    private queue;
    private devices;
    constructor();
    init(): void;
    addToMonitoringList(spinalListenerModel: SpinalListenerModel): Promise<void>;
    startDeviceInitialisation(): Promise<void>;
    startMonitoring(): Promise<void>;
    private monitDevice;
    private _stopMonitors;
    private _getItemLists;
}
declare const spinalMonitoring: SpinalMonitoring;
export default spinalMonitoring;
export { spinalMonitoring };
