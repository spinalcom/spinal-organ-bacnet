/// <reference types="node" />
import { EventEmitter } from "events";
export declare class SpinalDeviceListener extends EventEmitter {
    private listenerModel;
    private children;
    private client;
    private networkService;
    private networkNode;
    private device;
    private contextNode;
    private organ;
    private spinalMonitors;
    constructor(listenerModel: any);
    init(): Promise<void>;
    private _bindListen;
    private _updateEndpoints;
    private _getChildrenNewValue;
    private _getObjValue;
    private _formatCurrentValue;
    private _groupByType;
    private _getGraph;
    private _getNetworkNode;
    private _getContextNode;
    private _getDeviceInfo;
    private _getOrganInfo;
}