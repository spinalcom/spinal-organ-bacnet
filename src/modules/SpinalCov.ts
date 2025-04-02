import NetworkService from "spinal-model-bmsnetwork";
import { ICovData, ICovSubscribeReq } from "../Interfaces";
import SpinalQueuing from "../utilities/SpinalQueuing";
import { SpinalDevice } from "./SpinalDevice";
import * as bacnet from "bacstack";
import BacnetUtilities from "../utilities/BacnetUtilities";
import { ChildProcess, fork } from "child_process";
import { error } from "console";
import { COV_EVENTS_NAMES } from "../utilities/GlobalVariables";




class SpinalCov {
    private static _instance: SpinalCov;
    private queue: SpinalQueuing<ICovData> = new SpinalQueuing();
    private itemMonitored: Map<string, { networkService: NetworkService, spinalDevice: SpinalDevice }> = new Map();
    private _bacnetClient: bacnet = BacnetUtilities.createNewBacnetClient();
    private forkedProcess: ChildProcess | null = null;

    private constructor() {
        this.queue.on("start", this.monitorQueue.bind(this));
        this._bacnetClient.on('covNotifyUnconfirmed', (data) => {
            console.log(data);
        });
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

        // init process before starting cov, initialization
        if (!this.forkedProcess) {
            this.forkedProcess = this.createForkedProcess();
        }

        const list = this.queue.getQueue();
        this.queue.refresh();

        const formatted = list.reduce((l: ICovSubscribeReq[], { networkService, spinalDevice, children }) => {
            const ip = spinalDevice.device.address;
            this.itemMonitored.set(ip, { networkService, spinalDevice }); // Store the device

            return l.concat(this.formatChildren(ip, children));
        }, []);

        this.forkedProcess.send({ eventName: COV_EVENTS_NAMES.subscribe, data: formatted });

        // for (const { spinalDevice, networkService, children } of list) {
        //     const ip = spinalDevice.device.address;
        //     this.itemMonitored.set(ip, { networkService, spinalDevice }); // Store the device

        //     await this.subscribeCov(spinalDevice, children);
        // }
    }


    private formatChildren(ip: string, children: ICovData["children"]): ICovSubscribeReq[] {
        return children.map((child) => {
            return { ip, object: child };
        });

    }

    // private async subscribeCov(spinalDevice: SpinalDevice, children: ICovData["children"]) {
    //     const ip = spinalDevice.device.address;

    // }


    private createForkedProcess(): ChildProcess {

        const path = require.resolve("./cov");
        const forked = fork(path);

        forked.on("message", (result: { key: string, eventName: string, error?: Error, data: any }) => {
            switch (result.eventName) {
                case COV_EVENTS_NAMES.subscribed:
                    console.log("[COV] - Subscribed to", result.key);
                    break;
                case COV_EVENTS_NAMES.error:
                    console.error("[COV] - Failed to subscribe due to", result.error.message);
                    forked.kill();
                    break;
                case COV_EVENTS_NAMES.changed:
                    const [ip, type, instance] = result.key.split("_");
                    const device = this.itemMonitored.get(ip);
                    console.log("[COV] - Data changed", result.data);
            }


        });

        forked.on("error", (err) => { });

        forked.on("exit", (code) => {
            console.log("child process exited with code", code);
        });

        return forked;
    }





}


const spinalCov = SpinalCov.getInstance();

export default spinalCov;
export { spinalCov };