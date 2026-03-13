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
    private _covList;
    private static instance;
    private constructor();
    static getInstance(): SpinalMonitoring;
    addToMonitoringList(spinalListenerModel: SpinalListenerModel): Promise<void>;
    private init;
    private processToEndpointsCreation;
    private _processToAddItemToMap;
    startDeviceInitialisation(): Promise<void>;
    startMonitoring(): Promise<void>;
    private _initNetworkUtilities;
    private _createMaps;
    private _createDeviceMap;
    private _bindDeviceListener;
    private _handleMonitoredDevice;
    private _handleStoppedDevice;
    private _queueIntervals;
    /**
     *  Add an item to the monitoring map and priority queue
     * @param id
     * @param interval
     * @param func
     */
    private _addToMonitoringMap;
    private removeFromMonitoringMaps;
    private launchUpdating;
    private createDataIfNotExist;
    private funcToExecute;
    private getValidIntervals;
    private waitFct;
    private _waitEndpointCreation;
    private removeFromPriorityQueue;
}
declare const spinalMonitoring: SpinalMonitoring;
export default spinalMonitoring;
export { spinalMonitoring };
