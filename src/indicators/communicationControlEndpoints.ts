import { InputDataEndpoint, SpinalBmsEndpoint } from "spinal-model-bmsnetwork";
import type { DeviceCommunicationIndicatorsSnapshot } from "../Interfaces/IDeviceCommunicationIndicators";
import { Profiles } from "./ControlPointProfiles";
import type { CommunicationControlProfileConfig, ControlPointEndpointConfig } from "../Interfaces/IControlPointProfile";

const ENDPOINT_TYPE_ID = "BACnetCommunicationIndicator";
const ENDPOINT_NODE_TYPE = SpinalBmsEndpoint.nodeTypeName;

export type { CommunicationControlProfileConfig, ControlPointEndpointConfig, SnapshotProperty, TimeSeriesFormat } from "../Interfaces/IControlPointProfile";

export const COMMUNICATION_CONTROL_PROFILES = Object.values(Profiles);

const defaultProfile = Profiles.bacnet;
export const COMMUNICATION_CONTROL_ENDPOINT_GROUP_ID = defaultProfile.id;
export const COMMUNICATION_CONTROL_ENDPOINT_GROUP_NAME = defaultProfile.name;
export const COMMUNICATION_CONTROL_ENDPOINT_GROUP_RELATION = defaultProfile.relation;
export const COMMUNICATION_CONTROL_ENDPOINT_PROFILE = defaultProfile.indicatorProfile;

function getEndpointValue(endpoint: ControlPointEndpointConfig, snapshot: DeviceCommunicationIndicatorsSnapshot): InputDataEndpoint["currentValue"] {
	const value = snapshot[endpoint.snapshotProperty];
	if (endpoint.timeSeriesFormat === "date" && typeof value === "number") {
		return new Date(value).toISOString();
	}
	if (endpoint.timeSeriesFormat === "status") {
		const status = endpoint.timeSeriesStatusMap?.[String(value)];
		if (typeof status !== "number") throw new Error(`Control point "${endpoint.id}" has an unmapped status: "${String(value)}"`);
		return status;
	}
	if (value === null) return "";
	if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
		throw new Error(`Control point "${endpoint.id}" is not a scalar value`);
	}
	return value;
}

export function getCommunicationControlEndpoints(snapshot: DeviceCommunicationIndicatorsSnapshot, profile: CommunicationControlProfileConfig = defaultProfile): InputDataEndpoint[] {
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

export function getCommunicationControlEndpointTimeSeriesValue(endpointId: string, value: InputDataEndpoint["currentValue"], profile?: CommunicationControlProfileConfig): number | undefined {
	const endpoint = (profile ? [profile] : COMMUNICATION_CONTROL_PROFILES).flatMap((item) => item.endpoints).find((item) => item.id === endpointId);
	if (!endpoint) return undefined;

	if (endpoint.timeSeriesFormat === "status") {
		if (typeof value === "number" && Number.isFinite(value)) return value;
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

	if (endpoint.timeSeriesFormat === "number" && typeof value === "number" && Number.isFinite(value)) return value;
}
