export declare class SpinalDiscover {
    private bindSateProcess;
    private bindDevicesProcess;
    private client;
    private CONNECTION_TIME_OUT;
    private devices;
    private networkService;
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
