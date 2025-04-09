import { ICovData } from "../Interfaces";
declare class SpinalCov {
    private static _instance;
    private queue;
    private itemMonitored;
    private _bacnetClient;
    private forkedProcess;
    private constructor();
    static getInstance(): SpinalCov;
    listenBacnetEvent(): Promise<void>;
    addToQueue(data: ICovData | ICovData[]): Promise<void>;
    monitorQueue(): Promise<void>;
    private formatChildren;
    private createForkedProcess;
    _updateDeviceValue(address: string, request: any): Promise<void>;
}
declare const spinalCov: SpinalCov;
export default spinalCov;
export { spinalCov };
