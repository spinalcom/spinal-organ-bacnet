"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bacstack_1 = __importDefault(require("bacstack"));
// Create BACnet client
const client = new bacstack_1.default({
    port: 47808, // Your local port (can be any unused UDP port)
});
// Target device information
const targetIp = "10.10.126.13";
// Read the 'objectName' property of the Device object
client.readProperty(targetIp, null, { type: 2, instance: 1208 }, 85, (err, value) => {
    var _a, _b;
    if (err) {
        console.error("[readPropertyCallback] Error reading property:", err.message);
        return;
    }
    console.log("[readPropertyCallback] ", JSON.stringify(value, null, 2));
    const result = (_b = (_a = value === null || value === void 0 ? void 0 : value.values) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.value;
});
//# sourceMappingURL=test.js.map