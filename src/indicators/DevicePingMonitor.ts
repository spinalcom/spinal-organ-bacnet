import BacnetUtilities from "../utilities/BacnetUtilities";
import { debugLog } from "../utilities/debugLog";

export interface DevicePingSnapshot {
	pingStatus: "unknown" | "online" | "offline";
	pingLastCheckAt: number | null;
	pingResponseTimeMs: number | null;
}

interface PingResult {
	reachable: boolean;
	responseTimeMs: number | null;
}

export function getDevicePingIntervalMs(value = process.env.DEVICE_PING_INTERVAL_SECONDS): number {
	if (typeof value === "undefined" || value.trim() === "") return 60000;

	const seconds = Number(value);
	if (!Number.isFinite(seconds) || seconds <= 0) {
		throw new Error("DEVICE_PING_INTERVAL_SECONDS must be a positive number");
	}

	return seconds * 1000;
}

export function getPingHost(address: string): string {
	const trimmedAddress = address.trim();
	const bracketedIpv6 = trimmedAddress.match(/^\[([^\]]+)\](?::\d+)?$/);
	if (bracketedIpv6) return bracketedIpv6[1];

	const ipv4WithPort = trimmedAddress.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
	if (ipv4WithPort) return ipv4WithPort[1];

	return trimmedAddress;
}

export class DevicePingMonitor {
	private _timer: ReturnType<typeof setInterval> | null = null;
	private _isChecking = false;
	private _host: string | null = null;
	private _onUpdate: (() => void) | null = null;
	private _snapshot: DevicePingSnapshot = {
		pingStatus: "unknown",
		pingLastCheckAt: null,
		pingResponseTimeMs: null,
	};

	public start(address: string | undefined, onUpdate: () => void): void {
		if (this._timer) return;
		if (!address?.trim()) {
			console.error("[DevicePingMonitor] Cannot start ICMP ping without a device address");
			return;
		}

		this._host = getPingHost(address);
		this._onUpdate = onUpdate;
		const intervalMs = getDevicePingIntervalMs();
		// console.log(`[DevicePingMonitor] Started ICMP checks for ${this._host} every ${intervalMs}ms`);
		void this._check();
		this._timer = setInterval(() => void this._check(), intervalMs);
		this._timer.unref();
	}

	public fetchCurrentIndicators(): DevicePingSnapshot {
		return { ...this._snapshot };
	}

	private async _check(): Promise<void> {
		if (!this._host || this._isChecking) return;
		this._isChecking = true;

		try {
			const result = await BacnetUtilities.pingDevice(this._host);
			this._snapshot = {
				pingStatus: result.reachable ? "online" : "offline",
				pingLastCheckAt: Date.now(),
				pingResponseTimeMs: result.responseTimeMs,
			};
			debugLog(`[DevicePingMonitor] ${this._host} is ${this._snapshot.pingStatus}; response time: ${this._snapshot.pingResponseTimeMs ?? "n/a"}ms`);
		} catch (error) {
			this._snapshot = {
				pingStatus: "offline",
				pingLastCheckAt: Date.now(),
				pingResponseTimeMs: null,
			};
			debugLog(`[DevicePingMonitor] ICMP ping failed for ${this._host}:`, error);
		} finally {
			this._isChecking = false;
			this._onUpdate?.();
		}
	}
}
