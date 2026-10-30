const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { getDevicePingIntervalMs, getPingHost } = require("../../dist/indicators/DevicePingMonitor");
const { configureLogging, debugLog } = require("../../dist/utilities/debugLog");
const BacnetUtilities = require("../../dist/utilities/BacnetUtilities").default;
const { MESSAGE_EVENT_NAME, RESPONSE_EVENT_NAME } = require("spinal-bacnet-service");

test("prints diagnostic logs only when DEBUG_LOGS is enabled", () => {
	const previousValue = process.env.DEBUG_LOGS;
	const previousDebug = console.debug;
	const messages = [];
	console.debug = (...args) => messages.push(args);

	try {
		delete process.env.DEBUG_LOGS;
		debugLog("hidden");
		assert.equal(messages.length, 0);

		process.env.DEBUG_LOGS = "true";
		debugLog("visible");
		assert.deepEqual(messages, [["visible"]]);
	} finally {
		if (typeof previousValue === "undefined") delete process.env.DEBUG_LOGS;
		else process.env.DEBUG_LOGS = previousValue;
		console.debug = previousDebug;
	}
});

test("suppresses informational console output unless DEBUG_LOGS is enabled", () => {
	const previousValue = process.env.DEBUG_LOGS;
	const previousLog = console.log;
	const previousDebug = console.debug;
	const previousInfo = console.info;
	const messages = [];
	console.log = (...args) => messages.push(args);
	console.debug = (...args) => messages.push(args);
	console.info = (...args) => messages.push(args);

	try {
		delete process.env.DEBUG_LOGS;
		configureLogging();
		console.log("hidden");
		console.debug("hidden");
		console.info("hidden");
		assert.equal(messages.length, 0);
	} finally {
		if (typeof previousValue === "undefined") delete process.env.DEBUG_LOGS;
		else process.env.DEBUG_LOGS = previousValue;
		console.log = previousLog;
		console.debug = previousDebug;
		console.info = previousInfo;
	}
});

test("reads a positive ping interval in seconds", () => {
	assert.equal(getDevicePingIntervalMs("60"), 60_000);
	assert.equal(getDevicePingIntervalMs("0.5"), 500);
	assert.equal(getDevicePingIntervalMs(undefined), 60_000);
	assert.throws(() => getDevicePingIntervalMs("0"), /positive number/);
	assert.throws(() => getDevicePingIntervalMs("invalid"), /positive number/);
});

test("extracts a ping host from BACnet IPv4 and bracketed IPv6 addresses", () => {
	assert.equal(getPingHost("192.168.1.20:47808"), "192.168.1.20");
	assert.equal(getPingHost("[2001:db8::1]:47808"), "2001:db8::1");
	assert.equal(getPingHost("2001:db8::1"), "2001:db8::1");
});

test("sends ping requests through the BACnet service and returns its response", async () => {
	const previousClient = BacnetUtilities._ipcClient;
	const client = new EventEmitter();
	const emit = client.emit.bind(client);
	const pingResult = { reachable: true, responseTimeMs: 12 };

	client.emit = (eventName, request) => {
		if (eventName === MESSAGE_EVENT_NAME) {
			assert.equal(request.name, "pingDevice");
			assert.deepEqual(request.parameters, ["192.168.1.20"]);
			process.nextTick(() => emit(`${RESPONSE_EVENT_NAME}_${request.id}`, { status: "success", data: pingResult }));
		}

		return emit(eventName, request);
	};
	BacnetUtilities._ipcClient = client;

	try {
		assert.deepEqual(await BacnetUtilities.pingDevice("192.168.1.20"), pingResult);
	} finally {
		BacnetUtilities._ipcClient = previousClient;
	}
});
