/// <reference types="node" />
import { NetworkService } from "spinal-model-bmsnetwork";
import { EventEmitter } from "events";
export declare class SpinalBacnet extends EventEmitter {
    private CONNECTION_TIME_OUT;
    private client;
    private devices;
    private queueSize;
    private events;
    count: number;
    constructor(config: any);
    discoverDevices(): Promise<void>;
    createDevicesNodes(networkService: NetworkService): Promise<unknown[]>;
    private getDevices;
}
