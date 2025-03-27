import { ICovData } from "../Interfaces";
import SpinalQueuing from "../utilities/SpinalQueuing";


class SpinalCov {
    private static _instance: SpinalCov;
    private queue: SpinalQueuing<ICovData> = new SpinalQueuing();
    private itemMonitored: Map<string, ICovData> = new Map();

    private constructor() {
        this.queue.on("start", this.monitorQueue.bind(this));
    }

    static getInstance(): SpinalCov {
        if (!this._instance) this._instance = new SpinalCov();
        return this._instance;
    }

    public async addToQueue(data: ICovData | ICovData[]): Promise<void> {
        if (!Array.isArray(data)) data = [data];
        for (const obj of data) {
            this.queue.addToQueue(obj);
        }
    }


    public async monitorQueue() {
        const list = this.queue.getQueue();

    }




}


const spinalCov = SpinalCov.getInstance();

export default spinalCov;
export { spinalCov };