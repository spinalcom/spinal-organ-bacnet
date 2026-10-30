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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicePingMonitor = void 0;
exports.getDevicePingIntervalMs = getDevicePingIntervalMs;
exports.getPingHost = getPingHost;
const BacnetUtilities_1 = __importDefault(require("../utilities/BacnetUtilities"));
const debugLog_1 = require("../utilities/debugLog");
function getDevicePingIntervalMs(value = process.env.DEVICE_PING_INTERVAL_SECONDS) {
    if (typeof value === "undefined" || value.trim() === "")
        return 60000;
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) {
        throw new Error("DEVICE_PING_INTERVAL_SECONDS must be a positive number");
    }
    return seconds * 1000;
}
function getPingHost(address) {
    const trimmedAddress = address.trim();
    const bracketedIpv6 = trimmedAddress.match(/^\[([^\]]+)\](?::\d+)?$/);
    if (bracketedIpv6)
        return bracketedIpv6[1];
    const ipv4WithPort = trimmedAddress.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
    if (ipv4WithPort)
        return ipv4WithPort[1];
    return trimmedAddress;
}
class DevicePingMonitor {
    constructor() {
        this._timer = null;
        this._isChecking = false;
        this._host = null;
        this._onUpdate = null;
        this._snapshot = {
            pingStatus: "unknown",
            pingLastCheckAt: null,
            pingResponseTimeMs: null,
        };
    }
    start(address, onUpdate) {
        if (this._timer)
            return;
        if (!(address === null || address === void 0 ? void 0 : address.trim())) {
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
    fetchCurrentIndicators() {
        return Object.assign({}, this._snapshot);
    }
    _check() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!this._host || this._isChecking)
                return;
            this._isChecking = true;
            try {
                const result = yield BacnetUtilities_1.default.pingDevice(this._host);
                this._snapshot = {
                    pingStatus: result.reachable ? "online" : "offline",
                    pingLastCheckAt: Date.now(),
                    pingResponseTimeMs: result.responseTimeMs,
                };
                (0, debugLog_1.debugLog)(`[DevicePingMonitor] ${this._host} is ${this._snapshot.pingStatus}; response time: ${(_a = this._snapshot.pingResponseTimeMs) !== null && _a !== void 0 ? _a : "n/a"}ms`);
            }
            catch (error) {
                this._snapshot = {
                    pingStatus: "offline",
                    pingLastCheckAt: Date.now(),
                    pingResponseTimeMs: null,
                };
                (0, debugLog_1.debugLog)(`[DevicePingMonitor] ICMP ping failed for ${this._host}:`, error);
            }
            finally {
                this._isChecking = false;
                (_b = this._onUpdate) === null || _b === void 0 ? void 0 : _b.call(this);
            }
        });
    }
}
exports.DevicePingMonitor = DevicePingMonitor;
//# sourceMappingURL=DevicePingMonitor.js.map