"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMUNICATION_CONTROL_ENDPOINT_PROFILE = exports.COMMUNICATION_CONTROL_ENDPOINT_GROUP_RELATION = exports.COMMUNICATION_CONTROL_ENDPOINT_GROUP_NAME = exports.COMMUNICATION_CONTROL_ENDPOINT_GROUP_ID = exports.COMMUNICATION_CONTROL_PROFILES = void 0;
exports.getCommunicationControlEndpoints = getCommunicationControlEndpoints;
exports.getCommunicationControlEndpointTimeSeriesValue = getCommunicationControlEndpointTimeSeriesValue;
const spinal_model_bmsnetwork_1 = require("spinal-model-bmsnetwork");
const ControlPointProfiles_1 = require("./ControlPointProfiles");
const ENDPOINT_TYPE_ID = "BACnetCommunicationIndicator";
const ENDPOINT_NODE_TYPE = spinal_model_bmsnetwork_1.SpinalBmsEndpoint.nodeTypeName;
exports.COMMUNICATION_CONTROL_PROFILES = Object.values(ControlPointProfiles_1.Profiles);
const defaultProfile = ControlPointProfiles_1.Profiles.bacnet;
exports.COMMUNICATION_CONTROL_ENDPOINT_GROUP_ID = defaultProfile.id;
exports.COMMUNICATION_CONTROL_ENDPOINT_GROUP_NAME = defaultProfile.name;
exports.COMMUNICATION_CONTROL_ENDPOINT_GROUP_RELATION = defaultProfile.relation;
exports.COMMUNICATION_CONTROL_ENDPOINT_PROFILE = defaultProfile.indicatorProfile;
function getEndpointValue(endpoint, snapshot) {
    var _a;
    const value = snapshot[endpoint.snapshotProperty];
    if (endpoint.timeSeriesFormat === "date" && typeof value === "number") {
        return new Date(value).toISOString();
    }
    if (endpoint.timeSeriesFormat === "status") {
        const status = (_a = endpoint.timeSeriesStatusMap) === null || _a === void 0 ? void 0 : _a[String(value)];
        if (typeof status !== "number")
            throw new Error(`Control point "${endpoint.id}" has an unmapped status: "${String(value)}"`);
        return status;
    }
    if (value === null)
        return "";
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        throw new Error(`Control point "${endpoint.id}" is not a scalar value`);
    }
    return value;
}
function getCommunicationControlEndpoints(snapshot, profile = defaultProfile) {
    return profile.endpoints.map((endpoint) => ({
        id: endpoint.id,
        typeId: ENDPOINT_TYPE_ID,
        name: endpoint.name,
        path: endpoint.path,
        currentValue: getEndpointValue(endpoint, snapshot),
        unit: endpoint.unit || "",
        dataType: endpoint.dataType,
        type: ENDPOINT_NODE_TYPE,
        nodeTypeName: ENDPOINT_NODE_TYPE,
    }));
}
function getCommunicationControlEndpointTimeSeriesValue(endpointId, value, profile) {
    const endpoint = (profile ? [profile] : exports.COMMUNICATION_CONTROL_PROFILES).flatMap((item) => item.endpoints).find((item) => item.id === endpointId);
    if (!endpoint)
        return undefined;
    if (endpoint.timeSeriesFormat === "status") {
        if (typeof value === "number" && Number.isFinite(value))
            return value;
        if (endpoint.timeSeriesStatusMap) {
            const status = endpoint.timeSeriesStatusMap[String(value)];
            return typeof status === "number" ? status : undefined;
        }
        switch (value) {
            case "stopped":
                return -1;
            case "unknown":
                return -2;
            case "online":
                return 1;
            case "degraded":
                return 2;
            case "offline":
                return 0;
        }
    }
    if (endpoint.timeSeriesFormat === "date" && typeof value === "string") {
        const timestamp = Date.parse(value);
        return Number.isFinite(timestamp) ? timestamp : undefined;
    }
    if (endpoint.timeSeriesFormat === "number" && typeof value === "number" && Number.isFinite(value))
        return value;
}
//# sourceMappingURL=communicationControlEndpoints.js.map