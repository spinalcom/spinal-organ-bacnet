import { InputDataEndpoint } from "spinal-model-bmsnetwork";
import { DeviceCommunicationIndicatorsSnapshot } from "./DeviceCommunicationIndicators";

export const COMMUNICATION_CONTROL_ENDPOINT_GROUP_ID = "bacnet_indicators_BACnet device indicators";
export const COMMUNICATION_CONTROL_ENDPOINT_GROUP_NAME = "BACnet device indicators";
export const COMMUNICATION_CONTROL_ENDPOINT_GROUP_RELATION = "hasControlPoints";
export const COMMUNICATION_CONTROL_ENDPOINT_PROFILE = "BACnet device indicators";

const ENDPOINT_TYPE_ID = "BACnetCommunicationIndicator";
const ENDPOINT_NODE_TYPE = "BmsEndpoint";

export function getCommunicationControlEndpoints(snapshot: DeviceCommunicationIndicatorsSnapshot): InputDataEndpoint[] {
	const endpoint = (
		id: string,
		name: string,
		path: string,
		currentValue: string | number | boolean | null,
		dataType: string,
		unit = "",
	): InputDataEndpoint => ({
		id,
		typeId: ENDPOINT_TYPE_ID,
		name,
		path,
		currentValue: currentValue ?? "",
		unit,
		dataType,
		type: ENDPOINT_NODE_TYPE,
		nodeTypeName: ENDPOINT_NODE_TYPE,
	});

	return [
		endpoint("bacnet_indicator_communication", "Communication status", "indicators.communication", snapshot.communicationStatus, "String"),
		endpoint(
			"bacnet_indicator_last_response",
			"Last successful response",
			"indicators.lastResponseAt",
			snapshot.lastSuccessfulExchangeAt === null ? null : new Date(snapshot.lastSuccessfulExchangeAt).toISOString(),
			"DateTime",
		),
		endpoint(
			"bacnet_indicator_response_time",
			"Response time p50 (last request)",
			"indicators.lastReadCycleResponseTimeP50Ms",
			snapshot.lastReadCycleResponseTimeP50Ms,
			"Double",
			"ms",
		),
		endpoint(
			"bacnet_indicator_read_success_rate",
			"Success rate (last request)",
			"indicators.lastReadCycleSuccessRatePercent",
			snapshot.lastReadCycleSuccessRatePercent,
			"Double",
			"%",
		),
		endpoint(
			"bacnet_indicator_read_failure_rate",
			"Failure rate (last request)",
			"indicators.lastReadCycleFailureRatePercent",
			snapshot.lastReadCycleFailureRatePercent,
			"Double",
			"%",
		),
		endpoint(
			"bacnet_indicator_read_successes",
			"Successful points (last request)",
			"indicators.lastReadCycleSuccessfulPoints",
			snapshot.lastReadCycleSuccessfulPoints,
			"Long",
		),
		endpoint(
			"bacnet_indicator_read_failures",
			"Failed points (last request)",
			"indicators.lastReadCycleFailedPoints",
			snapshot.lastReadCycleFailedPoints,
			"Long",
		),
	];
}

export function getCommunicationControlEndpointTimeSeriesValue(endpointId: string, value: InputDataEndpoint["currentValue"]): number | undefined {
	if (endpointId === "bacnet_indicator_communication") {
		switch (value) {
			case "stopped":
				return 0;
			case "unknown":
				return 1;
			case "online":
				return 2;
			case "degraded":
				return 3;
			case "offline":
				return 4;
		}
	}

	if (endpointId === "bacnet_indicator_last_response" && typeof value === "string") {
		const timestamp = Date.parse(value);
		return Number.isFinite(timestamp) ? timestamp : undefined;
	}

	if (
		(endpointId === "bacnet_indicator_response_time" ||
			endpointId === "bacnet_indicator_read_success_rate" ||
			endpointId === "bacnet_indicator_read_failure_rate" ||
			endpointId === "bacnet_indicator_read_successes" ||
			endpointId === "bacnet_indicator_read_failures") &&
		typeof value === "number" &&
		Number.isFinite(value)
	) {
		return value;
	}
}
