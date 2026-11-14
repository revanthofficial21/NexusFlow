const assert = require("node:assert");
const { of } = require("rxjs");

const { compileGraph } = require("../src/compiler/graphCompiler");
const { validateGraph } = require("../src/compiler/validateGraph");
const { validatePoint } = require("../src/controllers/telemetryController");

// Helpers -------------------------------------------------------------------
const node = (id, type, data = {}) => ({ id, type, data });
const chain = (...nodes) =>
  nodes.slice(1).map((n, i) => ({
    id: `e${i}`,
    source: nodes[i].id,
    target: n.id,
  }));

const run = (graph, data) => {
  const out = [];
  compileGraph(graph, of(...data)).subscribe((value) => out.push(value));
  return out;
};

const expectThrow = (fn, pattern, label) => {
  try {
    fn();
  } catch (error) {
    assert.match(error.message, pattern, label);
    console.log(`  ok: ${label}`);
    return;
  }
  assert.fail(`${label} - expected a throw`);
};

// 1. A cycle is a validation error, not a compiler surprise -------------------
const cyclic = {
  nodes: [node("1", "sensor"), node("2", "average", { windowSize: 2 })],
  edges: [
    { id: "a", source: "1", target: "2" },
    { id: "b", source: "2", target: "1" },
  ],
};

const cycleResult = validateGraph(cyclic);
assert.strictEqual(cycleResult.valid, false);
assert.match(cycleResult.errors.join(" "), /cycle/i);
console.log("Test 1 passed: cyclic graph rejected by the validator");

// 2. Fan-out fails loudly instead of dropping the branch ---------------------
const fanOut = {
  nodes: [node("1", "sensor"), node("2", "average", { windowSize: 2 }), node("3", "alert")],
  edges: [
    { id: "a", source: "1", target: "2" },
    { id: "b", source: "1", target: "3" },
  ],
};

expectThrow(() => run(fanOut, [10, 20]), /outgoing connections/, "fan-out is rejected");

// 3. Nodes outside the sensor chain are reported -----------------------------
const orphan = {
  nodes: [
    node("1", "sensor"),
    node("2", "average", { windowSize: 2 }),
    node("3", "alert"),
  ],
  edges: [{ id: "a", source: "1", target: "2" }],
};

expectThrow(() => run(orphan, [10, 20]), /not connected/, "orphan node is reported");

// 4. A cleared threshold falls back to 80 ------------------------------------
const cleared = {
  nodes: [node("1", "sensor"), node("2", "threshold", { threshold: null, operator: "greaterThan" }), node("3", "alert")],
  edges: chain(node("1", "sensor"), node("2", "threshold"), node("3", "alert")),
};

assert.deepStrictEqual(run(cleared, [70, 95]), [95]);
console.log("Test 4 passed: null threshold falls back to 80");

// 5. An explicit zero is still a real threshold ------------------------------
const zero = {
  nodes: [node("1", "sensor"), node("2", "threshold", { threshold: 0, operator: "greaterThan" }), node("3", "alert")],
  edges: chain(node("1", "sensor"), node("2", "threshold"), node("3", "alert")),
};

assert.deepStrictEqual(run(zero, [-5, 0, 5]), [5]);
console.log("Test 5 passed: an explicit threshold of 0 is honoured");

// 6. A non numeric threshold is rejected at compile time ---------------------
const junk = {
  nodes: [node("1", "sensor"), node("2", "threshold", { threshold: "abc", operator: "greaterThan" }), node("3", "alert")],
  edges: chain(node("1", "sensor"), node("2", "threshold"), node("3", "alert")),
};

expectThrow(() => run(junk, [1]), /must be a number/, "non numeric threshold is rejected");

// 7. An unknown operator is rejected at compile time -------------------------
const badOperator = {
  nodes: [node("1", "sensor"), node("2", "threshold", { threshold: 5, operator: "roughly" }), node("3", "alert")],
  edges: chain(node("1", "sensor"), node("2", "threshold"), node("3", "alert")),
};

expectThrow(() => run(badOperator, [1]), /Unsupported threshold operator/, "unknown operator is rejected");

// 8. equal compares floats with an epsilon ----------------------------------
const floatEqual = {
  nodes: [
    node("1", "sensor"),
    node("2", "average", { windowSize: 3 }),
    node("3", "threshold", { threshold: 20.333333333333332, operator: "equal" }),
    node("4", "alert"),
  ],
  edges: chain(node("1", "sensor"), node("2", "average"), node("3", "threshold"), node("4", "alert")),
};

assert.strictEqual(run(floatEqual, [10, 20, 31]).length, 1);
console.log("Test 8 passed: equal matches a float average");

// 9. The compiler needs a real stream ---------------------------------------
expectThrow(
  () => compileGraph(cleared),
  /sensorData\$ stream is required/,
  "missing stream is rejected"
);

// 10. Telemetry validation ---------------------------------------------------
const missingDevice = validatePoint({ deviceType: "temperature", temperature: 20 });
assert.ok(missingDevice.errors.some((e) => /deviceId/.test(e)));
console.log("Test 10 passed: telemetry without deviceId is rejected");

const stringTemperature = validatePoint({
  deviceId: "sensor-001",
  deviceType: "temperature",
  temperature: "hot",
});
assert.ok(stringTemperature.errors.some((e) => /temperature must be/.test(e)));
console.log("Test 11 passed: non numeric temperature is rejected");

const noReadings = validatePoint({ deviceId: "sensor-001", deviceType: "temperature" });
assert.ok(noReadings.errors.some((e) => /at least one/.test(e)));
console.log("Test 12 passed: a point with no readings is rejected");

const goodPoint = validatePoint({
  deviceId: "sensor-001",
  deviceType: "temperature",
  location: "Room-1",
  temperature: "28.5",
});

assert.deepStrictEqual(goodPoint.errors, []);
assert.strictEqual(goodPoint.point.readings.temperature, 28.5);
assert.strictEqual(goodPoint.point.metadata.location, "Room-1");
assert.ok(goodPoint.point.timestamp instanceof Date);
console.log("Test 13 passed: a valid point is normalised into a document");

console.log("\nAll regression tests passed!");
