"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listenEventMessage = listenEventMessage;
exports.sendEvent = sendEvent;
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const stream_1 = require("stream");
const SpinalCov_1 = require("./SpinalCov");
// import { SpinalCov } from "./SpinalCov";
const eventEmitter = new stream_1.EventEmitter();
// const eventEmitter = process
function listenEventMessage() {
    eventEmitter.on("message", (result) => __awaiter(this, void 0, void 0, function* () {
        switch (result.eventName) {
            case GlobalVariables_1.COV_EVENTS_NAMES.subscribe:
                for (const d of result.data) {
                    yield subscribe(d);
                }
                break;
            case GlobalVariables_1.COV_EVENTS_NAMES.unsubscribe:
                for (const d of result.data) {
                    yield unsubscribe(d);
                }
                break;
            case GlobalVariables_1.COV_EVENTS_NAMES.subscribed:
                console.log("[COV] - Subscribed to", result.key);
                break;
            case GlobalVariables_1.COV_EVENTS_NAMES.error:
                BacnetUtilities_1.default.incrementState("failed");
                console.error(`[COV] - Failed  due to", `, result.error.message);
                // forked.kill();
                break;
            case GlobalVariables_1.COV_EVENTS_NAMES.changed:
                SpinalCov_1.SpinalCov.getInstance().updateLastCovNotificationTime();
                yield SpinalCov_1.SpinalCov.getInstance()._updateDeviceValue(result.data.address, result.data.request);
                break;
        }
    }));
}
function subscribe(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield BacnetUtilities_1.default.getClient();
        const key = `${data.ip}_${data.object.type}_${data.object.instance}`;
        listenChangeEvent(client);
        try {
            yield subscribeProperty(client, data.ip, data.object);
            sendEvent({ key, eventName: GlobalVariables_1.COV_EVENTS_NAMES.subscribed });
        }
        catch (error) {
            sendEvent({ key, eventName: GlobalVariables_1.COV_EVENTS_NAMES.error, error: { message: error.message } });
        }
    });
}
function unsubscribe(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield BacnetUtilities_1.default.getClient();
        const key = `${data.ip}_${data.object.type}_${data.object.instance}`;
        try {
            const cancel = true;
            yield subscribeProperty(client, data.ip, data.object, cancel);
            sendEvent({ key, eventName: GlobalVariables_1.COV_EVENTS_NAMES.unsubscribed });
        }
        catch (error) {
            sendEvent({ key, eventName: GlobalVariables_1.COV_EVENTS_NAMES.error, error: { message: error.message } });
        }
    });
}
function subscribeProperty(client, ip, object, cancel = false) {
    return new Promise((resolve, reject) => {
        try {
            const subscribe_id = `${ip}_${object.type}_${object.instance}`;
            client.subscribeCOV(ip, object, subscribe_id, cancel, false, 0, (err, value) => {
                if (err)
                    return reject(err);
                resolve(subscribe_id);
            });
        }
        catch (error) {
            return reject(error);
        }
    });
}
function listenChangeEvent(client) {
    // client.on("covNotifyUnconfirmed", (data) => {
    if (client.listenerCount("covNotifyUnconfirmed") > 0)
        return; // already listening
    client.on("covNotifyUnconfirmed", (data) => {
        // SpinalCov.getInstance().setLastCovNotificationTime(); // update last notification time
        sendEvent({ key: data.address, eventName: GlobalVariables_1.COV_EVENTS_NAMES.changed, data });
    });
}
function sendEvent(data) {
    // process.send(data);
    eventEmitter.emit("message", data);
}
//# sourceMappingURL=cov.js.map