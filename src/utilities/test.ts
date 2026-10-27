import bacnet from "bacstack";

// Create BACnet client
const client = new bacnet({
	port: 47808, // Your local port (can be any unused UDP port)
});

// Target device information
const targetIp = "10.10.126.13";

// Read the 'objectName' property of the Device object
client.readProperty(targetIp, null, { type: 2, instance: 1208 }, 85, (err, value) => {
	if (err) {
		console.error("[readPropertyCallback] Error reading property:", err.message);
		return;
	}

	console.log("[readPropertyCallback] ", JSON.stringify(value, null, 2));
	const result = value?.values?.[0]?.value;
});
