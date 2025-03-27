import { ICovData } from "../Interfaces";
declare class SpinalCov {
    private static _instance;
    private queue;
    private itemMonitored;
    private constructor();
    static getInstance(): SpinalCov;
    addToQueue(data: ICovData | ICovData[]): Promise<void>;
    monitorQueue(): Promise<void>;
}
declare const spinalCov: SpinalCov;
export default spinalCov;
export { spinalCov };
