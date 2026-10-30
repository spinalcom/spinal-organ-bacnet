export type BacnetReadErrorCategory = "bacnetError" | "reject" | "abort" | "timeout" | "localError";
export interface BacnetReadTelemetry {
    requestedPoints: number;
    firstAttemptSuccesses: number;
    finalSuccesses: number;
    retries: number;
    timedOutPoints: number;
    errorsByCategory: Record<BacnetReadErrorCategory, number>;
    successfulRequestDurationsMs: number[];
}
export interface BacnetReadOutcome {
    values: Array<{
        id: string | number;
        type: string | number;
        currentValue: any;
    }> | undefined;
    telemetry: BacnetReadTelemetry;
    error?: string;
}
export type CovSubscriptionOperation = "subscribe" | "renewal" | "unsubscribe";
export interface DeviceCommunicationIndicatorsSnapshot {
    communicationStatus: "stopped" | "unknown" | "online" | "degraded" | "offline";
    pingStatus: "unknown" | "online" | "offline";
    pingLastCheckAt: number | null;
    pingResponseTimeMs: number | null;
    requestsLaunched: number;
    firstAttemptSuccesses: number;
    finalSuccesses: number;
    lastReadCycleRequestedPoints: number;
    lastReadCycleSuccessfulPoints: number;
    lastReadCycleFailedPoints: number;
    lastReadCycleSuccessRatePercent: number | null;
    lastReadCycleFailureRatePercent: number | null;
    lastReadCycleResponseTimeP50Ms: number | null;
    timeouts: number;
    firstAttemptSuccessRatePercent: number | null;
    finalSuccessRatePercent: number | null;
    responseTimeP50Ms: number | null;
    responseTimeP95Ms: number | null;
    timeoutRatePercent: number | null;
    retriesTotal: number;
    retriesAveragePerRequest: number | null;
    consecutiveFailures: number;
    lastSuccessfulExchangeAt: number | null;
    secondsSinceLastSuccessfulExchange: number | null;
    errorsByCategory: Record<BacnetReadErrorCategory, number>;
    cov: {
        trackedSubscriptions: number;
        activeSubscriptions: number;
        successfulRenewals: number;
        failedSubscriptions: number;
        failedRenewals: number;
        expirations: null;
        expirationTrackingAvailable: false;
    };
}
