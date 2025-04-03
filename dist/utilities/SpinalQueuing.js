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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpinalQueuing = exports.Events = void 0;
const lodash = require("lodash");
const events_1 = require("events");
var Events;
(function (Events) {
    Events["FINISH"] = "finish";
    Events["START"] = "start";
})(Events || (exports.Events = Events = {}));
class SpinalQueuing extends events_1.EventEmitter {
    constructor() {
        super();
        this.processed = [];
        this.queueList = [];
        this.percent = 0;
        this.isProcessing = false;
        this._debounceStart = lodash.debounce(this._begin, 3000);
    }
    addToQueue(obj) {
        if (!Array.isArray(obj))
            obj = [obj];
        this.queueList = this.queueList.concat(obj);
        this.length = this.queueList.length;
        this._debounceStart();
        return this.length;
    }
    setQueue(queue) {
        this.queueList = queue;
        this.length = this.queueList.length;
        this._debounceStart();
        return this.length;
    }
    dequeue() {
        const item = this.queueList.shift();
        if (this.queueList.length === 0)
            this._finish();
        else
            this.processed.push(item);
        this.percent = Math.floor((100 * this.processed.length) / this.length);
        return item;
    }
    refresh() {
        this.queueList = [];
    }
    getQueue() {
        return [...this.queueList];
    }
    isEmpty() {
        return this.queueList.length === 0;
    }
    _begin() {
        if (!this.isProcessing) {
            this.isProcessing = true;
            this.emit(Events.START);
        }
    }
    _finish() {
        if (this.isProcessing) {
            this.isProcessing = false;
            this.emit(Events.FINISH);
        }
    }
}
exports.SpinalQueuing = SpinalQueuing;
exports.default = SpinalQueuing;
//# sourceMappingURL=SpinalQueuing.js.map