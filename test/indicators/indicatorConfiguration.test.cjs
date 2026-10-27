const assert = require("node:assert/strict");
const test = require("node:test");
const { areIndicatorsEnabled } = require("../../dist/indicators/indicatorConfiguration");

test("enables indicators only for true or 1", () => {
	const originalValue = process.env.ADD_INDICATORS;
	try {
		delete process.env.ADD_INDICATORS;
		assert.equal(areIndicatorsEnabled(), false);
		process.env.ADD_INDICATORS = "false";
		assert.equal(areIndicatorsEnabled(), false);
		process.env.ADD_INDICATORS = " TRUE ";
		assert.equal(areIndicatorsEnabled(), true);
		process.env.ADD_INDICATORS = "1";
		assert.equal(areIndicatorsEnabled(), true);
	} finally {
		if (typeof originalValue === "undefined") delete process.env.ADD_INDICATORS;
		else process.env.ADD_INDICATORS = originalValue;
	}
});
