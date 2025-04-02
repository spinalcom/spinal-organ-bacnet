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
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
const GlobalVariables_1 = require("../utilities/GlobalVariables");
process.on("message", (event) => __awaiter(void 0, void 0, void 0, function* () {
    if (GlobalVariables_1.COV_EVENTS_NAMES.subscribe === event.eventName) {
        for (const d of event.data) {
            yield subscribe(d);
        }
    }
}));
function subscribe(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const client = BacnetUtilities_1.default.createNewBacnetClient();
        const key = `${data.ip}_${data.object.type}_${data.object.instance}`;
        listenChangeEvent(client, key);
        try {
            yield subscribeProperty(client, data.ip, data.object);
            process.send({ key, eventName: GlobalVariables_1.COV_EVENTS_NAMES.subscribed });
        }
        catch (error) {
            process.send({ key, eventName: GlobalVariables_1.COV_EVENTS_NAMES.error, error: error });
        }
    });
}
function subscribeProperty(client, ip, object) {
    return new Promise((resolve, reject) => {
        const subscribe_id = `${ip}_${object.type}_${object.instance}`;
        client.subscribeCOV(ip, object, subscribe_id, false, false, 0, (err, value) => {
            if (err)
                return reject(err);
            resolve(subscribe_id);
        });
    });
}
function listenChangeEvent(client, key) {
    client.on("covNotifyUnconfirmed", (data) => {
        process.send({ key, eventName: GlobalVariables_1.COV_EVENTS_NAMES.changed, data });
    });
}
//# sourceMappingURL=cov.js.map