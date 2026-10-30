"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDebugLoggingEnabled = isDebugLoggingEnabled;
exports.configureLogging = configureLogging;
exports.debugLog = debugLog;
function isDebugLoggingEnabled() {
    var _a;
    const value = (_a = process.env.DEBUG_LOGS) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
    return value === "1" || value === "true";
}
function configureLogging() {
    if (isDebugLoggingEnabled())
        return;
    console.log = () => undefined;
    console.debug = () => undefined;
    console.info = () => undefined;
}
function debugLog(...messages) {
    if (isDebugLoggingEnabled())
        console.debug(...messages);
}
//# sourceMappingURL=debugLog.js.map