const assert = require("node:assert/strict");
const test = require("node:test");
const { DeviceCommunicationIndicators } = require("../../dist/indicators/DeviceCommunicationIndicators");

function telemetry(overrides = {}) {
	return {
		requestedPoints: 0,
		firstAttemptSuccesses: 0,
		finalSuccesses: 0,
		retries: 0,
		timedOutPoints: 0,
		errorsByCategory: { bacnetError: 0, reject: 0, abort: 0, timeout: 0, localError: 0 },
		successfulRequestDurationsMs: [],
		...overrides,
	};
}

test("aggregates read quality, latency, failures, and retry metrics", () => {
	const indicators = new DeviceCommunicationIndicators();

	indicators.recordReadCycle(
		telemetry({
			requestedPoints: 4,
			firstAttemptSuccesses: 2,
			finalSuccesses: 3,
			retries: 1,
			timedOutPoints: 1,
			errorsByCategory: { bacnetError: 0, reject: 0, abort: 0, timeout: 1, localError: 0 },
			successfulRequestDurationsMs: [10, 100],
		}),
	);
	assert.equal(indicators.fetchCurrentIndicators().consecutiveFailures, 1);

	indicators.recordReadCycle(
		telemetry({
			requestedPoints: 2,
			firstAttemptSuccesses: 2,
			finalSuccesses: 2,
			successfulRequestDurationsMs: [20],
		}),
	);

	const snapshot = indicators.fetchCurrentIndicators();
	assert.equal(snapshot.requestsLaunched, 6);
	assert.equal(snapshot.firstAttemptSuccessRatePercent, (4 / 6) * 100);
	assert.equal(snapshot.finalSuccessRatePercent, (5 / 6) * 100);
	assert.equal(snapshot.lastReadCycleSuccessfulPoints, 2);
	assert.equal(snapshot.lastReadCycleRequestedPoints, 2);
	assert.equal(snapshot.lastReadCycleFailedPoints, 0);
	assert.equal(snapshot.lastReadCycleSuccessRatePercent, 100);
	assert.equal(snapshot.lastReadCycleFailureRatePercent, 0);
	assert.equal(snapshot.lastReadCycleResponseTimeP50Ms, 20);
	assert.equal(snapshot.responseTimeP50Ms, 20);
	assert.equal(snapshot.responseTimeP95Ms, 100);
	assert.equal(snapshot.timeoutRatePercent, (1 / 6) * 100);
	assert.equal(snapshot.retriesTotal, 1);
	assert.equal(snapshot.retriesAveragePerRequest, 1 / 6);
	assert.equal(snapshot.consecutiveFailures, 0);
	assert.equal(snapshot.errorsByCategory.timeout, 1);
});

test("replaces the successful point count for every read cycle", () => {
	const indicators = new DeviceCommunicationIndicators();

	indicators.recordReadCycle(telemetry({ requestedPoints: 4, finalSuccesses: 3 }));
	assert.equal(indicators.fetchCurrentIndicators().lastReadCycleSuccessfulPoints, 3);

	indicators.recordReadCycle(telemetry({ requestedPoints: 2, finalSuccesses: 1 }));
	const nextCycle = indicators.fetchCurrentIndicators();
	assert.equal(nextCycle.lastReadCycleSuccessfulPoints, 1);
	assert.equal(nextCycle.lastReadCycleFailedPoints, 1);
	assert.equal(nextCycle.lastReadCycleSuccessRatePercent, 50);
	assert.equal(nextCycle.lastReadCycleFailureRatePercent, 50);

	indicators.recordRequestFailure(2, new Error("read failed"));
	const failedCycle = indicators.fetchCurrentIndicators();
	assert.equal(failedCycle.lastReadCycleSuccessfulPoints, 0);
	assert.equal(failedCycle.lastReadCycleFailedPoints, 2);
	assert.equal(failedCycle.lastReadCycleSuccessRatePercent, 0);
	assert.equal(failedCycle.lastReadCycleFailureRatePercent, 100);
});

test("tracks COV subscription acknowledgements and reports expiration tracking as unavailable", () => {
	const indicators = new DeviceCommunicationIndicators();

	indicators.trackCovSubscription("192.0.2.1_0_1");
	indicators.recordCovSubscriptionSuccess("192.0.2.1_0_1", "subscribe");
	indicators.startCovRenewal("192.0.2.1_0_1");
	indicators.recordCovSubscriptionFailure("192.0.2.1_0_1", "renewal");

	const snapshot = indicators.fetchCurrentIndicators();
	assert.equal(snapshot.cov.trackedSubscriptions, 1);
	assert.equal(snapshot.cov.activeSubscriptions, 0);
	assert.equal(snapshot.cov.successfulRenewals, 0);
	assert.equal(snapshot.cov.failedRenewals, 1);
	assert.equal(snapshot.cov.expirations, null);
	assert.equal(snapshot.cov.expirationTrackingAvailable, false);
});

test("reports communication status from supervision and consecutive read outcomes", () => {
	const indicators = new DeviceCommunicationIndicators();
	assert.equal(indicators.fetchCurrentIndicators().communicationStatus, "stopped");

	indicators.setMonitoringActive(true);
	assert.equal(indicators.fetchCurrentIndicators().communicationStatus, "unknown");

	indicators.recordReadCycle(telemetry({ requestedPoints: 1, firstAttemptSuccesses: 1, finalSuccesses: 1 }));
	assert.equal(indicators.fetchCurrentIndicators().communicationStatus, "online");

	indicators.recordReadCycle(telemetry({ requestedPoints: 1 }));
	assert.equal(indicators.fetchCurrentIndicators().communicationStatus, "degraded");
	indicators.recordReadCycle(telemetry({ requestedPoints: 1 }));
	indicators.recordReadCycle(telemetry({ requestedPoints: 1 }));
	assert.equal(indicators.fetchCurrentIndicators().communicationStatus, "offline");

	indicators.recordReadCycle(telemetry({ requestedPoints: 1, firstAttemptSuccesses: 1, finalSuccesses: 1 }));
	assert.equal(indicators.fetchCurrentIndicators().communicationStatus, "online");
	indicators.setMonitoringActive(false);
	assert.equal(indicators.fetchCurrentIndicators().communicationStatus, "stopped");
});
