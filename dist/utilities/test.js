"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bacnet = require("bacstack");
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