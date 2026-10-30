export interface DevicePingSnapshot {
    pingStatus: "unknown" | "online" | "offline";
    pingLastCheckAt: number | null;
    pingResponseTimeMs: number | null;
}
export declare function getDevicePingIntervalMs(value?: string): number;
export declare function getPingHost(address: string): string;
export declare class DevicePingMonitor {
    private _timer;
    private _isChecking;
    private _host;
    private _onUpdate;
    private _snapshot;
    start(address: string | undefined, onUpdate: () => void): void;
    fetchCurrentIndicators(): DevicePingSnapshot;
    private _check;
}
