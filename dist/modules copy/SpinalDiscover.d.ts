export declare class SpinalDiscover {
    private bindSateProcess;
    private bindDevicesProcess;
    private bacnet;
    private networkService;
    private discoverModel;
    constructor(model: any);
    init(): void;
    private bindItem;
    private bindDevices;
    private binFunc;
    private listenEvents;
    /**
     * Methods
     */
    private discover;
    private createNodes;
    private getOrCreateNetNode;
    private addDeviceFound;
    private timeOutEvent;
    private getGraph;
}
