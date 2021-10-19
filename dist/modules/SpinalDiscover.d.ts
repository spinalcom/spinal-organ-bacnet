/// <reference types="node" />
import { EventEmitter } from "events";
import { SpinalDisoverModel } from 'spinal-model-bacnet';
export declare const DiscoverQueing: {
    addToQueue: (model: SpinalDisoverModel) => void;
};
export declare class SpinalDiscover extends EventEmitter {
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
