"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spinalStore = void 0;
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
class SpinalStore {
    constructor(store) {
        this.store = store;
    }
    set(key, value) {
        if (typeof key !== "string" || !(value instanceof spinal_env_viewer_graph_service_1.SpinalNode)) {
            throw new Error("invalid type the key must be a string and value a SpinalNode");
        }
        if (!(this.store.hasOwnProperty(key))) {
            this.store[key] = value;
        }
    }
    get(key) {
        if (typeof key !== "string")
            throw new Error("the key must be a string");
        return this.store[key];
    }
    remove(key) {
        if (typeof key !== "string")
            throw new Error("the key must be a string");
        return delete this.store[key];
    }
    clear() {
        this.store = {};
    }
}
const spinalStore = new SpinalStore({});
exports.spinalStore = spinalStore;
exports.default = spinalStore;
//# sourceMappingURL=store.js.map