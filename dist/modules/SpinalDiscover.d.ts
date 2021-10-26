/// <reference types="node" />
import { EventEmitter } from "events";
import { SpinalDisoverModel } from 'spinal-model-bacnet';
declare class Discover extends EventEmitter {
    private _discoverQueue;
    private _isProcess;
    constructor();
    private listenEvent;
    addToQueue(model: SpinalDisoverModel): void;
    private _discoverNext;
}
export declare const discover: Discover;
export declare class SpinalDiscover {
    private bindSateProcess;
    private client;
    private CONNECTION_TIME_OUT;
    private devices;
    private discoverModel;
    constructor(model: any);
    init(model: any): void;
    private bindState;
    private discover;
    private getDevicesQueue;
    private createSpinalDevice;
    private addDeviceFound;
    private createNodes;
    private getDevices;
}
export {};
