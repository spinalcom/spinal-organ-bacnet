const assert = require("node:assert/strict");
const test = require("node:test");
const { DeviceCommunicationIndicators } = require("../../dist/indicators/DeviceCommunicationIndicators");
const { COMMUNICATION_CONTROL_PROFILES } = require("../../dist/indicators/communicationControlEndpoints");
const {
	COMMUNICATION_CONTROL_ENDPOINT_GROUP_ID,
	COMMUNICATION_CONTROL_ENDPOINT_GROUP_RELATION,
	getCommunicationControlEndpoints,
	getCommunicationControlEndpointTimeSeriesValue,
} = require("../../dist/indicators/communicationControlEndpoints");

test("builds stable control endpoints from communication indicators", () => {
	const indicators = new DeviceCommunicationIndicators();
	indicators.setMonitoringActive(true);
	indicators.recordReadCycle({
		requestedPoints: 4,
		firstAttemptSuccesses: 1,
		finalSuccesses: 3,
		retries: 1,
		timedOutPoints: 0,
		errorsByCategory: { bacnetError: 0, reject: 0, abort: 0, timeout: 0, localError: 0 },
		successfulRequestDurationsMs: [12, 24],
	});

	const snapshot = indicators.fetchCurrentIndicators(100_000);
	const endpoints = getCommunicationControlEndpoints(snapshot);
	const byId = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint]));

	assert.equal(COMMUNICATION_CONTROL_ENDPOINT_GROUP_RELATION, "hasControlPoints");
	assert.equal(COMMUNICATION_CONTROL_ENDPOINT_GROUP_ID, "bacnet_indicators_BACnet device indicators");
	assert.equal(endpoints.length, 7);
	assert.equal(byId.size, endpoints.length);
	assert.equal(byId.get("bacnet_indicator_communication").currentValue, 2);
	assert.equal(byId.get("bacnet_indicator_communication").dataType, "Long");
	assert.equal(byId.get("bacnet_indicator_read_attempts"), undefined);
	assert.equal(byId.get("bacnet_indicator_read_successes").currentValue, 3);
	assert.equal(byId.get("bacnet_indicator_read_success_rate").currentValue, 75);
	assert.equal(byId.get("bacnet_indicator_read_failure_rate").currentValue, 25);
	assert.equal(byId.get("bacnet_indicator_read_failures").currentValue, 1);
	assert.equal(byId.get("bacnet_indicator_response_time").currentValue, 12);
	assert.equal(byId.get("bacnet_indicator_last_response").currentValue, new Date(snapshot.lastSuccessfulExchangeAt).toISOString());
	assert.ok(endpoints.every((endpoint) => endpoint.type === endpoint.nodeTypeName));
	const communicationProfile = COMMUNICATION_CONTROL_PROFILES.find((profile) => profile.id === COMMUNICATION_CONTROL_ENDPOINT_GROUP_ID);
	const statusMap = communicationProfile.endpoints.find((endpoint) => endpoint.id === "bacnet_indicator_communication").timeSeriesStatusMap;
	assert.equal(
		getCommunicationControlEndpointTimeSeriesValue("bacnet_indicator_communication", "offline"),
		statusMap.offline,
	);
	assert.equal(getCommunicationControlEndpointTimeSeriesValue("bacnet_indicator_communication", 2), 2);
	assert.equal(getCommunicationControlEndpointTimeSeriesValue("bacnet_indicator_response_time", null), undefined);
	assert.equal(getCommunicationControlEndpointTimeSeriesValue("bacnet_indicator_read_success_rate", 75), 75);
	assert.equal(getCommunicationControlEndpointTimeSeriesValue("bacnet_indicator_read_failure_rate", 25), 25);
	assert.equal(getCommunicationControlEndpointTimeSeriesValue("bacnet_indicator_read_successes", 3), 3);
	assert.equal(getCommunicationControlEndpointTimeSeriesValue("bacnet_indicator_read_failures", 1), 1);
	assert.equal(
		getCommunicationControlEndpointTimeSeriesValue("bacnet_indicator_last_response", "1970-01-01T00:00:00.000Z"),
		0,
	);
});

test("builds the configured ping controlpoints and time-series values", () => {
	const profile = COMMUNICATION_CONTROL_PROFILES.find((item) => item.id === "bacnet_ping_BACnet device ping");
	assert.ok(profile);

	const snapshot = new DeviceCommunicationIndicators().fetchCurrentIndicators();
	snapshot.pingStatus = "online";
	snapshot.pingLastCheckAt = 100_000;
	snapshot.pingResponseTimeMs = 8.5;

	const endpoints = getCommunicationControlEndpoints(snapshot, profile);
	const byId = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint]));

	assert.equal(endpoints.length, 3);
	assert.equal(byId.get("bacnet_ping_status").currentValue, 1);
	assert.equal(byId.get("bacnet_ping_status").dataType, "Long");
	assert.equal(byId.get("bacnet_ping_last_check").currentValue, new Date(100_000).toISOString());
	assert.equal(byId.get("bacnet_ping_response_time").currentValue, 8.5);
	const statusMap = profile.endpoints.find((endpoint) => endpoint.id === "bacnet_ping_status").timeSeriesStatusMap;
	assert.equal(getCommunicationControlEndpointTimeSeriesValue("bacnet_ping_status", 1, profile), statusMap.online);
	assert.equal(getCommunicationControlEndpointTimeSeriesValue("bacnet_ping_status", 0, profile), statusMap.offline);
	assert.equal(getCommunicationControlEndpointTimeSeriesValue("bacnet_ping_response_time", 8.5, profile), 8.5);
});
