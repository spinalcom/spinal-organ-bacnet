"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceCommunicationIndicators = void 0;
const ERROR_CATEGORIES = ["bacnetError", "reject", "abort", "timeout", "localError"];
const MAX_RESPONSE_TIME_SAMPLES = 512;
class DeviceCommunicationIndicators {
    constructor() {
        this._requestsLaunched = 0;
        this._firstAttemptSuccesses = 0;
        this._finalSuccesses = 0;
        this._lastReadCycleRequestedPoints = 0;
        this._lastReadCycleSuccessfulPoints = 0;
        this._lastReadCycleFailedPoints = 0;
        this._lastReadCycleSuccessRatePercent = null;
        this._lastReadCycleFailureRatePercent = null;
        this._lastReadCycleResponseTimeP50Ms = null;
        this._timeouts = 0;
        this._monitoringActive = false;
        this._hasReadCycleSinceMonitoringStarted = false;
        this._retries = 0;
        this._consecutiveFailures = 0;
        this._lastSuccessfulExchangeAt = null;
        this._successfulRequestDurationsMs = [];
        this._errorsByCategory = {
            bacnetError: 0,
            reject: 0,
            abort: 0,
            timeout: 0,
            localError: 0,
        };
        this._covSubscriptionStates = new Map();
        this._successfulRenewals = 0;
        this._failedSubscriptions = 0;
        this._failedRenewals = 0;
    }
    setMonitoringActive(active) {
        if (active && !this._monitoringActive) {
            this._consecutiveFailures = 0;
            this._hasReadCycleSinceMonitoringStarted = false;
        }
        this._monitoringActive = active;
    }
    recordReadCycle(telemetry) {
        const requestedPoints = Math.max(0, telemetry.requestedPoints);
        const firstAttemptSuccesses = Math.min(requestedPoints, Math.max(0, telemetry.firstAttemptSuccesses));
        const finalSuccesses = Math.min(requestedPoints, Math.max(0, telemetry.finalSuccesses));
        this._lastReadCycleRequestedPoints = requestedPoints;
        this._lastReadCycleSuccessfulPoints = finalSuccesses;
        this._lastReadCycleFailedPoints = requestedPoints - finalSuccesses;
        this._lastReadCycleSuccessRatePercent = this._percentage(finalSuccesses, requestedPoints);
        this._lastReadCycleFailureRatePercent = this._percentage(this._lastReadCycleFailedPoints, requestedPoints);
        this._requestsLaunched += requestedPoints;
        this._firstAttemptSuccesses += firstAttemptSuccesses;
        this._finalSuccesses += finalSuccesses;
        this._timeouts += Math.min(requestedPoints, Math.max(0, telemetry.timedOutPoints));
        this._retries += Math.max(0, telemetry.retries);
        for (const category of ERROR_CATEGORIES) {
            this._errorsByCategory[category] += Math.max(0, telemetry.errorsByCategory[category] || 0);
        }
        const readCycleDurations = [];
        for (const duration of telemetry.successfulRequestDurationsMs) {
            if (!Number.isFinite(duration) || duration < 0)
                continue;
            readCycleDurations.push(duration);
            this._successfulRequestDurationsMs.push(duration);
            if (this._successfulRequestDurationsMs.length > MAX_RESPONSE_TIME_SAMPLES)
                this._successfulRequestDurationsMs.shift();
        }
        this._lastReadCycleResponseTimeP50Ms = this._getPercentile(readCycleDurations, 0.5);
        if (requestedPoints > 0) {
            this._hasReadCycleSinceMonitoringStarted = true;
            if (finalSuccesses === requestedPoints) {
                this._consecutiveFailures = 0;
            }
            else {
                this._consecutiveFailures++;
            }
        }
        if (finalSuccesses > 0)
            this.recordSuccessfulExchange();
    }
    recordRequestFailure(requestedPoints, error) {
        const category = DeviceCommunicationIndicators.classifyError(error);
        const count = Math.max(0, requestedPoints);
        const errorsByCategory = { bacnetError: 0, reject: 0, abort: 0, timeout: 0, localError: 0 };
        errorsByCategory[category] = 1;
        this.recordReadCycle({
            requestedPoints: count,
            firstAttemptSuccesses: 0,
            finalSuccesses: 0,
            retries: 0,
            timedOutPoints: category === "timeout" ? count : 0,
            errorsByCategory,
            successfulRequestDurationsMs: [],
        });
    }
    recordSuccessfulExchange(timestamp = Date.now()) {
        this._lastSuccessfulExchangeAt = timestamp;
    }
    trackCovSubscription(key) {
        if (!this._covSubscriptionStates.has(key))
            this._covSubscriptionStates.set(key, false);
    }
    startCovRenewal(key) {
        this.trackCovSubscription(key);
        this._covSubscriptionStates.set(key, false);
    }
    recordCovSubscriptionSuccess(key, operation) {
        this.trackCovSubscription(key);
        this._covSubscriptionStates.set(key, true);
        if (operation === "renewal")
            this._successfulRenewals++;
        this.recordSuccessfulExchange();
    }
    recordCovSubscriptionFailure(key, operation) {
        this.trackCovSubscription(key);
        if (operation === "renewal") {
            this._failedRenewals++;
            this._covSubscriptionStates.set(key, false);
        }
        else if (operation === "subscribe") {
            this._failedSubscriptions++;
            this._covSubscriptionStates.set(key, false);
        }
    }
    recordCovUnsubscribed(key) {
        this.trackCovSubscription(key);
        this._covSubscriptionStates.set(key, false);
    }
    fetchCurrentIndicators(now = Date.now()) {
        return {
            communicationStatus: this._getCommunicationStatus(),
            pingStatus: "unknown",
            pingLastCheckAt: null,
            pingResponseTimeMs: null,
            requestsLaunched: this._requestsLaunched,
            firstAttemptSuccesses: this._firstAttemptSuccesses,
            finalSuccesses: this._finalSuccesses,
            lastReadCycleRequestedPoints: this._lastReadCycleRequestedPoints,
            lastReadCycleSuccessfulPoints: this._lastReadCycleSuccessfulPoints,
            lastReadCycleFailedPoints: this._lastReadCycleFailedPoints,
            lastReadCycleSuccessRatePercent: this._lastReadCycleSuccessRatePercent,
            lastReadCycleFailureRatePercent: this._lastReadCycleFailureRatePercent,
            lastReadCycleResponseTimeP50Ms: this._lastReadCycleResponseTimeP50Ms,
            timeouts: this._timeouts,
            firstAttemptSuccessRatePercent: this._percentage(this._firstAttemptSuccesses, this._requestsLaunched),
            finalSuccessRatePercent: this._percentage(this._finalSuccesses, this._requestsLaunched),
            responseTimeP50Ms: this._percentile(0.5),
            responseTimeP95Ms: this._percentile(0.95),
            timeoutRatePercent: this._percentage(this._timeouts, this._requestsLaunched),
            retriesTotal: this._retries,
            retriesAveragePerRequest: this._requestsLaunched ? this._retries / this._requestsLaunched : null,
            consecutiveFailures: this._consecutiveFailures,
            lastSuccessfulExchangeAt: this._lastSuccessfulExchangeAt,
            secondsSinceLastSuccessfulExchange: this._lastSuccessfulExchangeAt === null ? null : Math.max(0, (now - this._lastSuccessfulExchangeAt) / 1000),
            errorsByCategory: Object.assign({}, this._errorsByCategory),
            cov: {
                trackedSubscriptions: this._covSubscriptionStates.size,
                activeSubscriptions: Array.from(this._covSubscriptionStates.values()).filter(Boolean).length,
                successfulRenewals: this._successfulRenewals,
                failedSubscriptions: this._failedSubscriptions,
                failedRenewals: this._failedRenewals,
                expirations: null,
                expirationTrackingAvailable: false,
            },
        };
    }
    _getCommunicationStatus() {
        if (!this._monitoringActive)
            return "stopped";
        if (!this._hasReadCycleSinceMonitoringStarted)
            return "unknown";
        if (this._consecutiveFailures >= 3)
            return "offline";
        if (this._consecutiveFailures > 0)
            return "degraded";
        return "online";
    }
    static classifyError(error) {
        const value = error;
        const message = [value === null || value === void 0 ? void 0 : value.name, value === null || value === void 0 ? void 0 : value.message, value === null || value === void 0 ? void 0 : value.code, value === null || value === void 0 ? void 0 : value.errorClass, value === null || value === void 0 ? void 0 : value.errorCode, value === null || value === void 0 ? void 0 : value.errClass, value === null || value === void 0 ? void 0 : value.errCode]
            .filter((part) => typeof part !== "undefined" && part !== null)
            .join(" ")
            .toLowerCase();
        if (/err_?timeout|timeout/.test(message))
            return "timeout";
        if (/\breject\b|reject[-_ ]?pdu/.test(message))
            return "reject";
        if (/\babort\b|abort[-_ ]?pdu/.test(message))
            return "abort";
        if ((value === null || value === void 0 ? void 0 : value.errorClass) || (value === null || value === void 0 ? void 0 : value.errorCode) || (value === null || value === void 0 ? void 0 : value.errClass) || (value === null || value === void 0 ? void 0 : value.errCode) || /bacnet error|error class|error code/.test(message))
            return "bacnetError";
        return "localError";
    }
    _percentage(value, total) {
        return total ? (value / total) * 100 : null;
    }
    _percentile(percentile) {
        return this._getPercentile(this._successfulRequestDurationsMs, percentile);
    }
    _getPercentile(samples, percentile) {
        if (samples.length === 0)
            return null;
        const sorted = [...samples].sort((a, b) => a - b);
        return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)];
    }
}
exports.DeviceCommunicationIndicators = DeviceCommunicationIndicators;
//# sourceMappingURL=DeviceCommunicationIndicators.js.map