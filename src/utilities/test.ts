import * as bacnet from 'bacstack';

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
    if (err) {
        console.error('Error reading property:', err.message);
        return;
    }

    console.log(JSON.stringify(value, null, 2));
    const result = value?.values?.[0]?.value;
});