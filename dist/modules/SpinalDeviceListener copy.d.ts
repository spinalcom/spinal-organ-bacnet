/// <reference types="node" />
import { EventEmitter } from "events";
export declare class SpinalDeviceListener extends EventEmitter {
    private listenerModel;
    private children;
    private device;
    private client;
    private networkService;
    private timeIntervalId;
    private timeIntervalDebounced;
    private networkNode;
    constructor(listenerModel: any);
    init(): Promise<void>;
    private _bindListen;
    private _bindTimeInterval;
    private _createTimeInterval;
    private _updateEndpoints;
    private _getChildrenNewValue;
    private _getObjValue;
    private _formatCurrentValue;
    private _groupByType;
    private _getGraph;
}
