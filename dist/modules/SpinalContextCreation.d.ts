export declare class SpinalContextCreation {
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
    /**
     * Methods
     */
    private discover;
    private createNodes;
    private getOrCreateNetNode;
    private listenEvents;
    private addDeviceFound;
    private timeOutEvent;
    private getGraph;
}
