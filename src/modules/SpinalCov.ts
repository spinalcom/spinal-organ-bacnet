import NetworkService from "spinal-model-bmsnetwork";
import { ICovData, ICovSubscribeReq } from "../Interfaces";
import SpinalQueuing from "../utilities/SpinalQueuing";
import { SpinalDevice } from "./SpinalDevice";
import BacnetUtilities from "../utilities/BacnetUtilities";
import { ChildProcess, fork } from "child_process";
import { COV_EVENTS_NAMES, PropertyIds } from "../utilities/GlobalVariables";
import { SpinalNode } from "spinal-env-viewer-graph-service";
import { listenEventMessage, sendEvent } from "./cov";


class SpinalCov {
    private static _instance: SpinalCov;

    private itemToWatchQueue: SpinalQueuing<ICovData> = new SpinalQueuing(false);
    private itemsToStopQueue: SpinalQueuing<ICovData> = new SpinalQueuing();

    // private forkedProcess: ChildProcess | null = null; // process handling COV subscriptions 
    private _lastCovNotification: number = null;
    private itemMonitored: Map<string, { networkService: NetworkService, network: SpinalNode, spinalDevice: SpinalDevice, children: any[] }> = new Map();

    private constructor() {

        listenEventMessage(); // start listening to messages from cov process

        this._checkCovStatus(); // Check COV status every 1 minute


        this.itemToWatchQueue.on("start", this.processToQueueTreatment.bind(this, this.itemToWatchQueue, COV_EVENTS_NAMES.subscribe));
        this.itemsToStopQueue.on("start", this.processToQueueTreatment.bind(this, this.itemsToStopQueue, COV_EVENTS_NAMES.unsubscribe));
    }


    static getInstance(): SpinalCov {
        if (!this._instance) this._instance = new SpinalCov();
        return this._instance;
    }

    updateLastCovNotificationTime() {
        this._lastCovNotification = Date.now();
    }

    startCovProcessing() {
        console.log("Hello from startCovProcessing", this.itemMonitored.size);
        this.itemToWatchQueue.start();
    }

    stopAllCovSubscriptions() {
        const allItems = Array.from(this.itemMonitored.values());
        this.addToStopCovQueue(allItems as ICovData[]);
        return allItems;
    }

    restartAllCovSubscriptions() {
        console.log("[COV] - Restarting all COV subscriptions after client reset");
        const allItems = Array.from(this.itemMonitored.values());
        this.addToCovQueue(allItems as ICovData[]);

        setTimeout(() => {
            this.startCovProcessing();
        }, 4000);
    }

    // resetAllSubscriptions() {
    //     const allItems = Array.from(this.itemMonitored.values());
    //     console.log("[COV] - Resetting all subscriptions", allItems.length);
    //     this.itemsToStopQueue.setQueue(allItems as ICovData[]); // stop all first

    //     // then 4s later, re-subscribe all
    //     setTimeout(() => {
    //         console.log("[COV] - Re-subscribing all subscriptions", allItems.length);
    //         this.itemToWatchQueue.setQueue(allItems as ICovData[]);
    //         this.itemToWatchQueue.start();
    //     }, 4000);
    // }

    public async addToCovQueue(data: ICovData | ICovData[]): Promise<void> {
        if (!Array.isArray(data)) data = [data];
        for (const obj of data) {
            this.itemToWatchQueue.addToQueue(obj);
        }
    }

    public addToStopCovQueue(data: ICovData | ICovData[]) {
        if (!Array.isArray(data)) data = [data];
        for (const obj of data) {
            this.itemsToStopQueue.addToQueue(obj);
        }
    }

    public async processToQueueTreatment(queue: SpinalQueuing<ICovData>, eventName: typeof COV_EVENTS_NAMES[keyof typeof COV_EVENTS_NAMES]) {
        // init process before starting cov, initialization
        // if (!this.forkedProcess) {
        //     this.forkedProcess = this.createForkedProcess();
        // }

        const list = queue.getQueue();
        queue.refresh();

        const formatted = list.reduce((l: ICovSubscribeReq[], { networkService, network, spinalDevice, children }) => {
            const ip = spinalDevice.device.address;

            if (eventName === COV_EVENTS_NAMES.subscribe) {
                this.itemMonitored.set(ip, { networkService, network, spinalDevice, children }); // Store the device
            } else if (eventName === COV_EVENTS_NAMES.unsubscribe && this.itemMonitored.has(ip)) {
                console.log(`[COV] - Unsubscribing from device ${ip}`);
                this.itemMonitored.delete(ip); // Remove the device
            }

            return l.concat(this.formatChildren(ip, children));
        }, []);

        sendEvent({ eventName, data: formatted });
        // this.forkedProcess.send({ eventName, data: formatted });

    }


    private _checkCovStatus() {
        setInterval(() => {
            if (this.itemMonitored.size > 0) {
                const sinceNow = this._lastCovNotification ? (Date.now() - this._lastCovNotification) : -1;
                const alertTime = 60 * 1000; // 1 minute without COV notification;

                const tooLong = sinceNow > alertTime; // more than 1 minute
                if (tooLong) {
                    console.log(`[COV] - No COV notification received for more than ${alertTime / 1000}s , restarting all subscriptions`);
                    this.restartAllCovSubscriptions();
                }
            }
        }, 60 * 1000);
    }

    private formatChildren(ip: string, children: ICovData["children"]): ICovSubscribeReq[] {
        return children.map((child) => {
            return { ip, object: child };
        });

    }

    private createForkedProcess(): ChildProcess {

        const path = require.resolve("./cov");
        const forked = fork(path);

        forked.on("message", async (result: { key: string, eventName: string, error?: Error, data: any }) => {
            switch (result.eventName) {
                case COV_EVENTS_NAMES.subscribed:
                    console.log("[COV] - Subscribed to", result.key);
                    break;
                case COV_EVENTS_NAMES.error:
                    BacnetUtilities.incrementState("failed");
                    console.error(`[COV] - Failed  due to", `, result.error.message);
                    // forked.kill();
                    break;
                case COV_EVENTS_NAMES.changed:
                    this.updateLastCovNotificationTime();
                    await this._updateDeviceValue(result.data.address, result.data.request);
                    break;

            }

        });

        forked.on("error", (err) => { });

        forked.on("exit", (code) => {
            // console.log("child process exited with code", code);
        });

        return forked;
    }

    async _updateDeviceValue(address: string, request: any) {
        const currentValue = request.values.find((v: any) => v.property?.id === PropertyIds.PROP_PRESENT_VALUE);
        if (!currentValue) return;

        const value = BacnetUtilities._getObjValue(currentValue.value); // extract value

        const object = request.monitoredObjectId;
        const { networkService, network, spinalDevice } = this.itemMonitored.get(address);

        const obj: any = {
            id: spinalDevice.device?.deviceId,
            children: [{ id: object.type, children: [{ id: object.instance, currentValue: value }] }],
        }

        console.log(`[COV] - Updating ${address}_${object.type}_${object.instance}`, value);
        return spinalDevice.updateEndpointInGraph(obj, networkService, network);
    }



}


export { SpinalCov }