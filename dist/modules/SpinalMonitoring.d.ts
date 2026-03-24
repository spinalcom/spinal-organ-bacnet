import { SpinalListenerModel } from "spinal-model-bacnet";
declare class SpinalMonitoring {
    private queue;
    private priorityQueue;
    private initIsProcessing;
    private intervalTimesMap;
    private binded;
    private devices;
    private _itemToAddToMap;
    private _endpointsCreationQueue;
    private static instance;
    private constructor();
    static getInstance(): SpinalMonitoring;
    addToMonitoringList(spinalListenerModel: SpinalListenerModel): Promise<void>;
    private init;
    private processToEndpointsCreation;
    private _processToAddItemToMap;
    startDeviceInitialisation(): Promise<void>;
    startMonitoring(): Promise<void>;
    private requeueIfNotReady;
    private triggerIntervalUpdate;
    private _initListenerModels;
    private _initAllDevices;
    private _initDevice;
    private _bindDeviceListener;
    private _handleMonitoredDevice;
    private _handleStoppedDevice;
    private _addToCovQueue;
    private _addToIntervalQueue;
    /**
     *  Add an item to the monitoring map and priority queue
     * @param id
     * @param interval
     * @param func
     */
    private _addDeviceIntervalsToMonitoringMap;
    private _addToPriorityQueue;
    private removeFromMonitoringMaps;
    private launchUpdating;
    private _addToEndpointCreationQueue;
    private waitFct;
    private _waitEndpointCreation;
}
declare const spinalMonitoring: SpinalMonitoring;
export default spinalMonitoring;
export { spinalMonitoring };
