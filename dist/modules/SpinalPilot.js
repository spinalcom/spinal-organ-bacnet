"use strict";
/*
 * Copyright 2022 SpinalCom - www.spinalcom.com
 *
 * This file is part of SpinalCore.
 *
 * Please read all of the following terms and conditions
 * of the Free Software license Agreement ("Agreement")
 * carefully.
 *
 * This Agreement is a legally binding contract between
 * the Licensee (as defined below) and SpinalCom that
 * sets forth the terms and conditions that govern your
 * use of the Program. By installing and/or using the
 * Program, you agree to abide by all the terms and
 * conditions stated or referenced herein.
 *
 * If you do not agree to abide by these terms and
 * conditions, do not demonstrate your acceptance and do
 * not install or use the Program.
 * You should have received a copy of the license along
 * with this file. If not, see
 * <http://resources.spinalcom.com/licenses.pdf>.
 */
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
exports.spinalPilot = void 0;
const spinal_connector_service_1 = require("spinal-connector-service");
const GlobalVariables_1 = require("../utilities/GlobalVariables");
const BacnetUtilities_1 = require("../utilities/BacnetUtilities");
class SpinalPilot {
    constructor() {
        this.queue = new spinal_connector_service_1.SpinalQueue();
        this.isProcessing = false;
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new SpinalPilot();
            this.instance.init();
        }
        return this.instance;
    }
    init() {
        this.queue.on("start", () => {
            console.log("start pilot...");
            this.pilot();
        });
    }
    addToPilotList(spinalPilotModel) {
        return __awaiter(this, void 0, void 0, function* () {
            this.queue.addToQueue(spinalPilotModel);
        });
    }
    pilot() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isProcessing)
                return;
            this.isProcessing = true;
            try {
                while (!this.queue.isEmpty()) {
                    const pilot = this.queue.dequeue();
                    if (!pilot) {
                        continue;
                    }
                    yield this._handlePilot(pilot);
                }
            }
            finally {
                this.isProcessing = false;
            }
        });
    }
    _handlePilot(pilot) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!pilot.isNormal()) {
                console.log("remove");
                yield pilot.removeFromGraph();
                return;
            }
            pilot.changeState(spinal_connector_service_1.PILOT_STATES.processing);
            try {
                yield this.writeProperties(pilot.requests.get());
                console.log("success");
                pilot.changeState(spinal_connector_service_1.PILOT_STATES.success);
            }
            catch (error) {
                console.error(error.message);
                pilot.changeState(spinal_connector_service_1.PILOT_STATES.error);
            }
            yield pilot.removeFromGraph();
        });
    }
    writeProperties() {
        return __awaiter(this, arguments, void 0, function* (requests = []) {
            for (let index = 0; index < requests.length; index++) {
                const req = requests[index];
                try {
                    yield this.writeProperty(req);
                }
                catch (error) {
                    throw error;
                }
            }
        });
    }
    writeProperty(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const types = this.getDataTypes(req.objectId.type);
            let success = false;
            while (types.length > 0 && !success) {
                const type = types.shift();
                try {
                    if (!type)
                        throw new Error("error");
                    yield this.useDataType(req, type);
                    success = true;
                }
                catch (error) {
                    // throw error;
                }
            }
            if (!success) {
                throw new Error("error");
            }
        });
    }
    useDataType(req, dataType) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const client = yield BacnetUtilities_1.default.getClient();
            const value = dataType === GlobalVariables_1.APPLICATION_TAGS.BACNET_APPLICATION_TAG_ENUMERATED ? (req.value ? 1 : 0) : req.value;
            const priority = process.env.BACNET_PRIORITY && (!isNaN(process.env.BACNET_PRIORITY) && parseInt(process.env.BACNET_PRIORITY)) || 16;
            if (!req.SADR || typeof req.SADR === "object" && Object.keys(req.SADR).length === 0)
                req.SADR = null;
            client.writeProperty(req.address, req.SADR, req.objectId, GlobalVariables_1.PropertyIds.PROP_PRESENT_VALUE, [{ type: dataType, value: value }], { priority }, (err, value) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(value);
            });
        }));
    }
    getDataTypes(type) {
        const analogTypes = new Set([
            GlobalVariables_1.ObjectTypes.OBJECT_ANALOG_INPUT,
            GlobalVariables_1.ObjectTypes.OBJECT_ANALOG_OUTPUT,
            GlobalVariables_1.ObjectTypes.OBJECT_ANALOG_VALUE,
            GlobalVariables_1.ObjectTypes.OBJECT_MULTI_STATE_INPUT,
            GlobalVariables_1.ObjectTypes.OBJECT_MULTI_STATE_OUTPUT,
            GlobalVariables_1.ObjectTypes.OBJECT_MULTI_STATE_VALUE
        ]);
        const binaryTypes = new Set([
            GlobalVariables_1.ObjectTypes.OBJECT_BINARY_INPUT,
            GlobalVariables_1.ObjectTypes.OBJECT_BINARY_OUTPUT,
            GlobalVariables_1.ObjectTypes.OBJECT_BINARY_VALUE,
            GlobalVariables_1.ObjectTypes.OBJECT_BINARY_LIGHTING_OUTPUT
        ]);
        if (analogTypes.has(type)) {
            return [
                GlobalVariables_1.APPLICATION_TAGS.BACNET_APPLICATION_TAG_UNSIGNED_INT, GlobalVariables_1.APPLICATION_TAGS.BACNET_APPLICATION_TAG_SIGNED_INT,
                GlobalVariables_1.APPLICATION_TAGS.BACNET_APPLICATION_TAG_REAL, GlobalVariables_1.APPLICATION_TAGS.BACNET_APPLICATION_TAG_DOUBLE
            ];
        }
        if (binaryTypes.has(type))
            return [GlobalVariables_1.APPLICATION_TAGS.BACNET_APPLICATION_TAG_ENUMERATED, GlobalVariables_1.APPLICATION_TAGS.BACNET_APPLICATION_TAG_BOOLEAN];
        return [
            GlobalVariables_1.APPLICATION_TAGS.BACNET_APPLICATION_TAG_OCTET_STRING,
            GlobalVariables_1.APPLICATION_TAGS.BACNET_APPLICATION_TAG_CHARACTER_STRING,
            GlobalVariables_1.APPLICATION_TAGS.BACNET_APPLICATION_TAG_BIT_STRING
        ];
    }
}
const spinalPilot = SpinalPilot.getInstance();
exports.spinalPilot = spinalPilot;
exports.default = spinalPilot;
//# sourceMappingURL=SpinalPilot.js.map