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
exports.ProfileManager = void 0;
const spinal_env_viewer_plugin_network_tree_service_1 = require("spinal-env-viewer-plugin-network-tree-service");
const spinal_env_viewer_graph_service_1 = require("spinal-env-viewer-graph-service");
const spinal_env_viewer_plugin_documentation_service_1 = require("spinal-env-viewer-plugin-documentation-service");
const bacnetEnum_1 = require("./bacnetEnum");
class ProfileManager {
    constructor() {
        this._isProcessingQueue = false;
        this._profiles = new Map();
    }
    static getInstance() {
        if (!ProfileManager.instance) {
            ProfileManager.instance = new ProfileManager();
        }
        return ProfileManager.instance;
    }
    getProfileData(profileSpinalNode) {
        return __awaiter(this, void 0, void 0, function* () {
            // Wait if another process is currently processing the queue
            // This ensures that we don't have multiple processes trying to access the same profile data at the same time
            yield this._waitIfProcessing();
            const profileId = profileSpinalNode.getId().get();
            const profileData = this._profiles.get(profileId);
            if (profileData)
                return profileData;
            this._isProcessingQueue = true;
            const data = yield this._fetchProfileData(profileSpinalNode);
            this._profiles.set(profileId, data);
            this._isProcessingQueue = false;
            return data;
        });
    }
    _waitIfProcessing() {
        return __awaiter(this, void 0, void 0, function* () {
            while (this._isProcessingQueue) {
                yield new Promise(resolve => setTimeout(resolve, 500));
            }
        });
    }
    _fetchProfileData(profileNode) {
        return __awaiter(this, void 0, void 0, function* () {
            spinal_env_viewer_graph_service_1.SpinalGraphService._addNode(profileNode);
            const profileId = profileNode.getId().get();
            const intervalsNodes = yield spinal_env_viewer_plugin_network_tree_service_1.DeviceProfileUtilities.getIntervalNodes(profileId);
            const promises = intervalsNodes.map((intervalNode) => this._getIntervalInfo(intervalNode));
            return Promise.all(promises).then((result) => this._filterIntervals(result));
        });
    }
    _filterIntervals(monitors) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = [];
            for (const monitor of monitors) {
                if (!monitor || monitor.monitoring.IntervalTime <= 0 || monitor.children.length <= 0)
                    continue;
                const { monitoring, children } = monitor;
                res.push({
                    interval: monitoring.IntervalTime,
                    monitoring: monitoring.Monitoring,
                    children
                });
            }
            return res;
        });
    }
    _getIntervalInfo(intervalNodeRef) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.all([this._getSharedAttributes(intervalNodeRef), this._getEndpointsObjectIds(intervalNodeRef)])
                .then(([monitoring, children]) => {
                return { monitoring, children };
            });
        });
    }
    _getSharedAttributes(intervalNode) {
        return __awaiter(this, void 0, void 0, function* () {
            const attributeCategory = "Supervision";
            const realNode = spinal_env_viewer_graph_service_1.SpinalGraphService.getRealNode(intervalNode.id.get());
            const attributes = yield spinal_env_viewer_plugin_documentation_service_1.serviceDocumentation.getAttributesByCategory(realNode, attributeCategory);
            return attributes.reduce((obj, attribute) => {
                const label = attribute.label.get();
                const value = attribute.value.get();
                if (label === "Monitoring")
                    obj.Monitoring = value;
                else if (label === "IntervalTime")
                    obj.IntervalTime = Number(value);
                return obj;
            }, { Monitoring: "", IntervalTime: 0 });
        });
    }
    _getEndpointsObjectIds(intervalNode) {
        return __awaiter(this, void 0, void 0, function* () {
            const intervalRealNode = spinal_env_viewer_graph_service_1.SpinalGraphService.getRealNode(intervalNode.id.get());
            const profileItems = yield intervalRealNode.getChildren(["hasIntervalTime"]);
            const promises = profileItems.map((item) => __awaiter(this, void 0, void 0, function* () { return ({ instance: yield this._getIDX(item), type: this._getBacnetObjectType(item) }); }));
            return Promise.all(promises).then((result) => {
                return result.filter(item => item.instance !== undefined);
            });
        });
    }
    _getIDX(item) {
        return __awaiter(this, void 0, void 0, function* () {
            const attributes = yield spinal_env_viewer_plugin_documentation_service_1.serviceDocumentation.getAttributesByCategory(item, "default");
            const foundAttribute = attributes.find(attr => attr.label.get() === "IDX");
            // +1 because profile is 1 indexed and bacnet is 0 indexed;
            if (foundAttribute)
                return parseInt(foundAttribute.value.get()) + 1;
        });
    }
    _getBacnetObjectType(item) {
        const type = item.getType().get();
        const typeToKebabCase = type.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`); // convert camelCase to kebab-case
        const objectName = `object_${typeToKebabCase}`.toUpperCase(); // convert to uppercase
        return bacnetEnum_1.BacnetEnum.ObjectTypes[objectName]; // convert type to bacnet object type enum
    }
}
exports.default = ProfileManager;
exports.ProfileManager = ProfileManager;
// async getIntervalsModel(profilId) {
//     return utilities
//         .getProfilIntervals(profilId)
//         .then((result) => {
//             const data = result.map(({ monitoring, children }) => {
//                 return {
//                     monitoring: monitoring.Monitoring,
//                     interval: monitoring.IntervalTime,
//                     children,
//                 };
//             });
//             const profilNode = SpinalGraphService.getRealNode(profilId);
//             return new SpinalMonitorInfoModel(profilNode, data);
//         })
//         .catch((err) => {
//             console.error(err);
//             return;
//         });
// }
//# sourceMappingURL=profileManager.js.map