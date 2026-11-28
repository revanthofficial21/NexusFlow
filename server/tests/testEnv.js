/**
 * Numeric env vars: a typo must fall back, not silently disable a limit.
 */
const assert = require("node:assert");
const { envInt } = require("../src/config/env");

// 1. A number is used.
process.env.NEXUS_TEST_INT = "250";
assert.strictEqual(envInt("NEXUS_TEST_INT", 10), 250);
console.log("Test 1 passed: a valid number is used as-is");

// 2. Garbage falls back instead of becoming NaN. NaN is the dangerous case: it
// makes every comparison false, which turns a cap into no cap.
process.env.NEXUS_TEST_INT = "two thousand";
assert.strictEqual(envInt("NEXUS_TEST_INT", 2000), 2000);
console.log("Test 2 passed: a non-numeric value falls back to the default");

// 3. Empty and unset behave like unset, not like zero.
process.env.NEXUS_TEST_INT = "";
assert.strictEqual(envInt("NEXUS_TEST_INT", 42), 42);
delete process.env.NEXUS_TEST_INT;
assert.strictEqual(envInt("NEXUS_TEST_INT", 42), 42);
console.log("Test 3 passed: empty and unset use the default");

// 4. Out-of-range values are clamped, not accepted.
process.env.NEXUS_TEST_INT = "999999";
assert.strictEqual(envInt("NEXUS_TEST_INT", 10, { max: 100 }), 100);

process.env.NEXUS_TEST_INT = "-5";
assert.strictEqual(envInt("NEXUS_TEST_INT", 10, { min: 1 }), 1);
console.log("Test 4 passed: out-of-range values are clamped to the bounds");

// 5. Fractions are truncated to whole numbers.
process.env.NEXUS_TEST_INT = "12.9";
assert.strictEqual(envInt("NEXUS_TEST_INT", 10), 12);
console.log("Test 5 passed: fractions are truncated");

delete process.env.NEXUS_TEST_INT;
console.log("\nAll env tests passed!");
