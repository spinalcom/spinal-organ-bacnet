/// <reference types="node" />
import { EventEmitter } from "events";
import { SpinalDisoverModel } from 'spinal-model-bacnet';
declare class Discover extends EventEmitter {
    private _discoverQueue;
    private _isProcess;
    constructor();
    addToQueue(model: SpinalDisoverModel): void;
    private _listenEvent;
    private _discoverNext;
}
export declare const discover: Discover;
export declare class SpinalDiscover {
    private bindSateProcess;
    private client;
    private CONNECTION_TIME_OUT;
    private devices;
    private discoverModel;
    constructor(model: SpinalDisoverModel);
    init(): void;
    private _bindState;
    private _discover;
    private _getDevicesQueue;
    private _createSpinalDevice;
    private _addDeviceFound;
    private _createNodes;
    private _getDevicesNodes;
    private _getDevicesSelected;
}
export {};
