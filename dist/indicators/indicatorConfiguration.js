"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.areIndicatorsEnabled = areIndicatorsEnabled;
function areIndicatorsEnabled() {
    var _a;
    const value = (_a = process.env.ADD_INDICATORS) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
    return value === "1" || value === "true";
}
//# sourceMappingURL=indicatorConfiguration.js.map