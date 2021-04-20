export default class SpinalMonitoring {
    private monitorModel;
    private intervalId;
    private monitoringProcess;
    private intervalProcess;
    private updateFunc;
    constructor(model: any, callback: Function);
    start(): void;
    stop(): void;
}
