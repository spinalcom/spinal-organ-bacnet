import * as bacnet from "bacstack";
import BacnetUtilities from "../utilities/BacnetUtilities";
import { ICovData, ICovSubscribeReq } from "../Interfaces";
import { COV_EVENTS_NAMES } from "../utilities/GlobalVariables";


process.on("message", async (event: { data: ICovSubscribeReq[], eventName: string }) => {
    if (COV_EVENTS_NAMES.subscribe === event.eventName) {
        for (const d of event.data) {
            await subscribe(d);
        }
    }
});


async function subscribe(data: ICovSubscribeReq) {
    const client = await BacnetUtilities.getClient();
    const key = `${data.ip}_${data.object.type}_${data.object.instance}`;

    listenChangeEvent(client, key);

    try {
        await subscribeProperty(client, data.ip, data.object);
        process.send({ key, eventName: COV_EVENTS_NAMES.subscribed });
    } catch (error) {
        process.send({ key, eventName: COV_EVENTS_NAMES.error, error: error });
    }
}


function subscribeProperty(client: bacnet, ip: string, object: ICovData["children"][0]) {
    return new Promise((resolve, reject) => {
        const subscribe_id = `${ip}_${object.type}_${object.instance}`;
        client.subscribeCOV(ip, object, subscribe_id, false, false, 0, (err, value) => {
            if (err) return reject(err);
            resolve(subscribe_id);
        });
    });

}

function listenChangeEvent(client: bacnet, key: string) {
    client.on("covNotifyUnconfirmed", (data) => {
        process.send({ key, eventName: COV_EVENTS_NAMES.changed, data });
    });

}