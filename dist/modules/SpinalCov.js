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
exports.spinalCov = void 0;
const SpinalQueuing_1 = require("../utilities/SpinalQueuing");
class SpinalCov {
    constructor() {
        this.queue = new SpinalQueuing_1.default();
        this.itemMonitored = new Map();
        this.queue.on("start", this.monitorQueue.bind(this));
    }
    static getInstance() {
        if (!this._instance)
            this._instance = new SpinalCov();
        return this._instance;
    }
    addToQueue(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(data))
                data = [data];
            for (const obj of data) {
                this.queue.addToQueue(obj);
            }
        });
    }
    monitorQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            const list = this.queue.getQueue();
        });
    }
}
const spinalCov = SpinalCov.getInstance();
exports.spinalCov = spinalCov;
exports.default = spinalCov;
//# sourceMappingURL=SpinalCov.js.map