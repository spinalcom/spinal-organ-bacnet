import { ICovData, ICovSubscribeReq } from "../Interfaces";
import { SpinalQueue } from "spinal-connector-service";
import BacnetUtilities from "../utilities/BacnetUtilities";
import { COV_EVENTS_NAMES, PropertyIds } from "../utilities/GlobalVariables";
import { SpinalNetworkUtilities } from "../utilities/SpinalNetworkUtilities";
import EventEmitter from "events";

export type EventPayload = {
    error?: { message: string };
    key?: string;
    data?: any;
    eventName: string;
};

class SpinalCov extends EventEmitter {
    private static _instance: SpinalCov;

    private itemToWatchQueue: SpinalQueue<ICovData> = new SpinalQueue(10000); // 5s delay before start item treatment, no auto start
    private itemsToStopQueue: SpinalQueue<ICovData> = new SpinalQueue();

    // private forkedProcess: ChildProcess | null = null; // process handling COV subscriptions 
    private _lastCovNotification: number | null = null;
    private itemMonitored: Map<string, ICovData> = new Map();

    private constructor() {
        super();

        this._listenEvents(); // start listening to messages from cov process

        this.itemToWatchQueue.on("start", () => {
            const list = this.itemToWatchQueue.toArray();
            this.itemToWatchQueue.clear(); // clear queue to avoid duplicate processing
            this.processToDataTreatment(list, COV_EVENTS_NAMES.subscribe);
        });

        this.itemsToStopQueue.on("start", () => {
            const list = this.itemsToStopQueue.toArray();
            this.itemsToStopQueue.clear(); // clear queue to avoid duplicate processing
            this.processToDataTreatment(list, COV_EVENTS_NAMES.unsubscribe);
        });

    }


    static getInstance(): SpinalCov {
        if (!this._instance) this._instance = new SpinalCov();
        return this._instance;
    }

    public updateLastCovNotificationTime() {
        this._lastCovNotification = Date.now();
    }

    public startCovProcessing() {
        console.log("start cov proccessing with", this.itemToWatchQueue.toArray().length, "items to monitor");
        this.itemToWatchQueue.start();
    }

    public stopAllCovSubscriptions() {
        const allItems = Array.from(this.itemMonitored.values());
        this.addToStopCovQueue(allItems as ICovData[]);
        return allItems;
    }

    public restartAllCovSubscriptions() {
        console.log("[COV] - Restarting all COV subscriptions after client reset");
        const allItems = Array.from(this.itemMonitored.values());
        this.addToCovQueue(allItems as ICovData[]);

        setTimeout(() => {
            this.startCovProcessing();
        }, 4000);
    }

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

    public async processToDataTreatment(list: ICovData[], eventName: typeof COV_EVENTS_NAMES[keyof typeof COV_EVENTS_NAMES]) {

        const formatted: ICovSubscribeReq[] = [];

        for (const { spinalDevice, children } of list) {
            const ip = spinalDevice?.device?.address;
            if (!ip) continue; // skip if no ip

            if (eventName === COV_EVENTS_NAMES.subscribe)
                this.itemMonitored.set(ip, { spinalDevice, children }); // Store the device

            else if (eventName === COV_EVENTS_NAMES.unsubscribe && this.itemMonitored.has(ip)) {
                console.log(`[COV] - Unsubscribing from device ${ip}`);
                this.itemMonitored.delete(ip); // Remove the device
            }

            formatted.push(...this.formatChildren(ip, children));
        }

        BacnetUtilities.sendCovRequest({ eventName, data: formatted });
        // sendEvent({ eventName, data: formatted });
    }


    private _checkCovStatus() {

        setInterval(() => {
            if (this.itemMonitored.size === 0) return; // no subscription, skip check

            const sinceNow = this._lastCovNotification ? (Date.now() - this._lastCovNotification) : -1;
            const alertTime = 60 * 1000; // 1 minute without COV notification;

            const tooLong = sinceNow > alertTime; // more than 1 minute

            if (tooLong) {
                console.log(`[COV] - No COV notification received for more than ${alertTime / 1000}s , restarting all subscriptions`);
                this.restartAllCovSubscriptions();
            }

        }, 60 * 1000);
    }

    private formatChildren(ip: string, children: ICovData["children"]): ICovSubscribeReq[] {
        return children.map((child) => ({ ip, object: { instance: child.instance, type: child.type } }));
    }

    /*
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
                    console.error(`[COV] - Failed  due to", "${result.error?.message}"`);
                    // forked.kill();
                    break;
                case COV_EVENTS_NAMES.changed:
                    this.updateLastCovNotificationTime();
                    await this._updateDeviceValue(result.data.address, result.data.request);
                    break;

            }

        });

        forked.on("error", (err: Error) => { });

        forked.on("exit", (code: number) => { });

        return forked;
    }
    */
    public async _updateDeviceValue(address: string, request: any) {
        const currentValue = request.values.find((v: any) => v.property?.id === PropertyIds.PROP_PRESENT_VALUE);
        if (!currentValue) return;

        const value = BacnetUtilities._getObjValue(currentValue.value); // extract value

        const object = request.monitoredObjectId;
        const monitoredData = this.itemMonitored.get(address);

        if (!monitoredData) return;

        const { spinalDevice } = monitoredData;
        const key = `${object.type}_${object.instance}`;


        const children = [{ id: object.instance, currentValue: value, type: object.type }]; // format children to update


        console.log(`[COV] - Updating item (${object}) from device ${address} with value ${value}`);

        const node = spinalDevice.getBmsDeviceNode();

        if (node) return SpinalNetworkUtilities.updateEndpointInGraph(spinalDevice, children);
    }

    private _listenEvents() {

        this.on(COV_EVENTS_NAMES.subscribed, async (data: any) => {
            console.log("[COV] - Subscribed to", data?.key);
        });

        this.on(COV_EVENTS_NAMES.error, async (data: any) => {
            console.error(`[COV] - Failed to subscribe to ${data?.key} due to", "${data?.error?.message}"`);
        });

        this.on(COV_EVENTS_NAMES.changed, async ({ data }: any) => {
            console.log("[COV] - Change event received from", data?.address);
            // SpinalCov.getInstance().updateLastCovNotificationTime();
            await SpinalCov.getInstance()._updateDeviceValue(data.address, data.request);

        });

    }




}


export { SpinalCov }