import * as bacnet from "bacstack";
import BacnetUtilities from "../utilities/BacnetUtilities";
import { ICovData, ICovSubscribeReq } from "../Interfaces";
import { COV_EVENTS_NAMES } from "../utilities/GlobalVariables";
import { EventEmitter } from "stream";
import { SpinalCov } from "./SpinalCov";
// import { SpinalCov } from "./SpinalCov";

const eventEmitter = new EventEmitter();
// const eventEmitter = process


export function listenEventMessage() {
    eventEmitter.on("message", async (result: { error?: Error, key: string, data: any, eventName: string }) => {

        switch (result.eventName) {
            case COV_EVENTS_NAMES.subscribe:
                for (const d of result.data) {
                    await subscribe(d);
                }
                break;

            case COV_EVENTS_NAMES.unsubscribe:
                for (const d of result.data) {
                    await unsubscribe(d);
                }
                break;

            case COV_EVENTS_NAMES.subscribed:
                console.log("[COV] - Subscribed to", result.key);
                break;
            case COV_EVENTS_NAMES.error:
                BacnetUtilities.incrementState("failed");
                console.error(`[COV] - Failed  due to", `, result.error.message);
                // forked.kill();
                break;
            case COV_EVENTS_NAMES.changed:
                SpinalCov.getInstance().updateLastCovNotificationTime();
                await SpinalCov.getInstance()._updateDeviceValue(result.data.address, result.data.request);
                break;
        }

    });
}

async function subscribe(data: ICovSubscribeReq) {
    const client = await BacnetUtilities.getClient();
    const key = `${data.ip}_${data.object.type}_${data.object.instance}`;

    listenChangeEvent(client);


    try {
        await subscribeProperty(client, data.ip, data.object);
        sendEvent({ key, eventName: COV_EVENTS_NAMES.subscribed });
    } catch (error) {
        sendEvent({ key, eventName: COV_EVENTS_NAMES.error, error: { message: error.message } });
    }
}

async function unsubscribe(data: ICovSubscribeReq) {
    const client = await BacnetUtilities.getClient();
    const key = `${data.ip}_${data.object.type}_${data.object.instance}`;
    try {
        const cancel = true;
        await subscribeProperty(client, data.ip, data.object, cancel);
        sendEvent({ key, eventName: COV_EVENTS_NAMES.unsubscribed });
    } catch (error) {
        sendEvent({ key, eventName: COV_EVENTS_NAMES.error, error: { message: error.message } });
    }
}


function subscribeProperty(client: bacnet, ip: string, object: ICovData["children"][0], cancel = false) {

    return new Promise((resolve, reject) => {
        try {
            const subscribe_id = `${ip}_${object.type}_${object.instance}`;

            client.subscribeCOV(ip, object, subscribe_id, cancel, false, 0, (err, value) => {
                if (err) return reject(err);
                resolve(subscribe_id);
            });

        } catch (error) {
            return reject(error);
        }

    });

}

function listenChangeEvent(client: bacnet) {
    // client.on("covNotifyUnconfirmed", (data) => {
    if (client.listenerCount("covNotifyUnconfirmed") > 0) return; // already listening

    client.on("covNotifyUnconfirmed", (data) => {
        // SpinalCov.getInstance().setLastCovNotificationTime(); // update last notification time
        sendEvent({ key: data.address, eventName: COV_EVENTS_NAMES.changed, data });
    });

}

export function sendEvent(data) {
    // process.send(data);
    eventEmitter.emit("message", data);
}