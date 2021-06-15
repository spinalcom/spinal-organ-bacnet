/// <reference types="node" />
import { NetworkService } from "spinal-model-bmsnetwork";
import { EventEmitter } from "events";
export declare class SpinalBacnet extends EventEmitter {
    private CONNECTION_TIME_OUT;
    private client;
    private devices;
    count: number;
    private config;
    constructor(config: any);
    discoverDevices(): Promise<void>;
    createDevicesNodes(networkService: NetworkService, network: {
        id: string;
        name: string;
        type: string;
    }): Promise<void>;
    useBroadcast(): void;
    useUnicast(): void;
    closeClient(): void;
    private createDeviceRecursively;
    private getDeviceInformation;
    private discoverRecursively;
    private getDevices;
    private convertListToIterator;
}
