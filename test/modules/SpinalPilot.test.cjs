const assert = require("node:assert/strict");
const { test } = require("node:test");
const { spinalPilot } = require("../../dist/modules/SpinalPilot");
const BacnetUtilities = require("../../dist/utilities/BacnetUtilities").default;

test("processes every pilot request in order before marking the pilot successful", async () => {
	const requests = [{ id: 1 }, { id: 2 }, { id: 3 }];
	const completed = [];
	const states = [];
	let removed = false;
	const originalSendPilotRequest = BacnetUtilities.sendPilotRequest;

	BacnetUtilities.sendPilotRequest = async (request) => {
		if (request.id === 1) await new Promise((resolve) => setTimeout(resolve, 10));
		completed.push(request);
	};

	const pilot = {
		state: { get: () => "waiting" },
		requests: { get: () => requests },
		changeState: (state) => states.push(state),
		removeFromGraph: async () => {
			removed = true;
		},
	};

	try {
		await spinalPilot._handlePilot(pilot);
		assert.deepEqual(completed, requests);
		assert.equal(states.length, 2);
		assert.equal(removed, true);
	} finally {
		BacnetUtilities.sendPilotRequest = originalSendPilotRequest;
	}
});
