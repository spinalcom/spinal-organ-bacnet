"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpinalEndpoint = void 0;
const globalVariables_1 = require("../utilities/globalVariables");
class SpinalEndpoint {
    constructor(client, deviceAddress, objectId, currentValue) {
        this.client = client;
        this.objectId = objectId;
        this.id = objectId.instance.toString();
        this.deviceAddress = deviceAddress;
        this.currentValue = currentValue;
    }
    checkAndUpdateCurrentValue() {
        return new Promise((resolve, reject) => {
            this.client.readProperty(this.deviceAddress, this.objectId, globalVariables_1.PropertyIds.PROP_PRESENT_VALUE, (err, res) => {
                if (err) {
                    resolve(this.currentValue);
                    return;
                }
                this.currentValue = res.values[0].value;
                resolve(this.currentValue);
            });
        });
    }
}
exports.SpinalEndpoint = SpinalEndpoint;
//# sourceMappingURL=SpinalEndpoint.js.map