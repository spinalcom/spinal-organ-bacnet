"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const bacnet = __importStar(require("bacstack"));
// Create BACnet client
const client = new bacnet({
    port: 47808, // Your local port (can be any unused UDP port)
});
// Target device information
const targetIp = '192.168.162.113';
const targetPort = 47808;
const deviceInstance = 168; // Replace with actual device instance if known
// Build the target address
const targetAddress = `${targetIp}:${targetPort}`;
// Read the 'objectName' property of the Device object
client.readProperty(targetAddress, { type: 0, instance: deviceInstance }, 77, (err, value) => {
    var _a, _b;
    if (err) {
        console.error('Error reading property:', err.message);
        return;
    }
    console.log(JSON.stringify(value, null, 2));
    const result = (_b = (_a = value === null || value === void 0 ? void 0 : value.values) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.value;
});
//# sourceMappingURL=test.js.map