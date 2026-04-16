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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.spinalPilot = void 0;
const spinal_connector_service_1 = require("spinal-connector-service");
const BacnetUtilities_1 = __importDefault(require("../utilities/BacnetUtilities"));
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
            const actualState = pilot.state.get();
            // if the pilot is already treated, we remove it from the graph and exit
            if (actualState === spinal_connector_service_1.PILOT_STATES.error || actualState === spinal_connector_service_1.PILOT_STATES.success) {
                console.log("pilot already treated with state:", actualState);
                yield pilot.removeFromGraph();
                return;
            }
            try {
                pilot.changeState(spinal_connector_service_1.PILOT_STATES.processing);
                // await this.writeProperties(pilot.requests.get());
                const request = pilot.requests.get();
                yield BacnetUtilities_1.default.sendPilotRequest(request[0]);
                console.log("pilot success");
                pilot.changeState(spinal_connector_service_1.PILOT_STATES.success);
            }
            catch (error) {
                console.error(`pilot failed due to: "${error.message}"`);
                pilot.changeState(spinal_connector_service_1.PILOT_STATES.error);
            }
            finally {
                yield pilot.removeFromGraph();
            }
        });
    }
}
const spinalPilot = SpinalPilot.getInstance();
exports.spinalPilot = spinalPilot;
exports.default = spinalPilot;
//# sourceMappingURL=SpinalPilot.js.map