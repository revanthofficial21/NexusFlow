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
// sensor -> average -> alert, and sensor -> alert directly
const fanOut = {
  nodes: [
    node("1", "sensor"),
    node("2", "average", { windowSize: 2 }),
    node("3", "alert"),
    node("4", "alert"),
  ],
  edges: [
    { id: "a", source: "1", target: "2" },
    { id: "b", source: "2", target: "3" },
    { id: "c", source: "1", target: "4" },
  ],
};

// Fan-out is supported: one sensor feeding two branches. The average branch
// filters down to a single value; the direct branch sees every reading.
const branches = [];
compileGraph(fanOut, of(10, 20), {
  onAlert: (alert) => branches.push(`${alert.nodeId}:${alert.value}`),
}).subscribe();

// node 3 is the average branch (one value: 15), node 4 the direct branch (10, 20)
assert.deepStrictEqual(branches.sort(), ["3:15", "4:10", "4:20"], "both branches should fire");
console.log("Test 2 passed: one sensor feeds two branches, each independently");

// 3. Nodes outside the sensor chain are reported -----------------------------
const orphan = {
  nodes: [
    node("1", "sensor"),
    node("2", "average", { windowSize: 2 }),
    node("3", "alert"),
  ],
  edges: [{ id: "a", source: "1", target: "2" }],
};

// A node with no incoming edge is a plan error, reported before anything runs.
expectThrow(() => run(orphan, [10, 20]), /has no input/, "orphan node is reported");

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

// 9. An absurd window size is rejected instead of buffering forever ----------
const hugeWindow = {
  nodes: [node("1", "sensor"), node("2", "average", { windowSize: 50000000 }), node("3", "alert")],
  edges: chain(node("1", "sensor"), node("2", "average"), node("3", "alert")),
};

expectThrow(
  () => run(hugeWindow, [1, 2, 3]),
  /Window size must be between 1 and 1000/,
  "an unbounded window size is rejected"
);

// 10. Webhook action node -----------------------------------------------------
const webhookGraph = (data) => ({
  nodes: [node("1", "sensor"), node("2", "webhook", data)],
  edges: chain(node("1", "sensor"), node("2", "webhook")),
});

assert.strictEqual(
  validateGraph({
    nodes: [node("1", "sensor"), node("2", "webhook", { url: "https://example.com/hook" })],
    edges: [{ id: "a", source: "1", target: "2" }],
  }).valid,
  true
);
console.log("Test 15 passed: the validator accepts a webhook node");

expectThrow(
  () => run(webhookGraph({ url: "" }), [1]),
  /needs an http\(s\) URL/,
  "webhook without a URL is rejected"
);

expectThrow(
  () => run(webhookGraph({ url: "https://example.com/hook", method: "DELETE" }), [1]),
  /Webhook method must be one of/,
  "unsupported webhook method is rejected"
);

// Delivery is fire-and-forget: the stream must not block or break when the
// endpoint is unreachable.
assert.deepStrictEqual(
  run(webhookGraph({ url: "http://127.0.0.1:9/hook" }), [10, 20]),
  [10, 20]
);
console.log("Test 16 passed: an unreachable webhook does not break the stream");

// 10b. Parse and execute must agree on parameters ----------------------------
const { describeGraph } = require("../src/compiler/graphCompiler");

const withWindow = (windowSize) => ({
  nodes: [node("1", "sensor"), node("2", "average", { windowSize }), node("3", "alert")],
  edges: chain(node("1", "sensor"), node("2", "average"), node("3", "alert")),
});

expectThrow(
  () => describeGraph(withWindow(50000)),
  /Window size must be between/,
  "parse rejects an out-of-range window"
);
expectThrow(
  () => run(withWindow(50000), [1]),
  /Window size must be between/,
  "execute rejects the same window"
);

const badOperatorGraph = {
  nodes: [node("1", "sensor"), node("2", "threshold", { threshold: 5, operator: "roughly" }), node("3", "alert")],
  edges: chain(node("1", "sensor"), node("2", "threshold"), node("3", "alert")),
};
expectThrow(
  () => describeGraph(badOperatorGraph),
  /Unsupported threshold operator/,
  "parse rejects an unknown operator"
);

const badUrlGraph = {
  nodes: [node("1", "sensor"), node("2", "webhook", { url: "not-a-url" })],
  edges: chain(node("1", "sensor"), node("2", "webhook")),
};
expectThrow(
  () => describeGraph(badUrlGraph),
  /needs an http\(s\) URL/,
  "parse rejects an invalid webhook URL"
);

// 10c. Two sensors would each read the same stream and duplicate every reading --
const twoSensors = {
  nodes: [node("1", "sensor", { deviceId: "a" }), node("2", "sensor", { deviceId: "b" }), node("3", "alert")],
  edges: [
    { id: "a", source: "1", target: "3" },
    { id: "b", source: "2", target: "3" },
  ],
};
expectThrow(
  () => run(twoSensors, [1, 2]),
  /exactly one sensor node/,
  "two sensors are rejected rather than duplicating readings"
);

// 10d. Pressure is a first-class reading now --------------------------------
const withPressure = validatePoint({
  deviceId: "turbine-01",
  deviceType: "temperature",
  pressure: 101.3,
});

assert.deepStrictEqual(withPressure.errors, []);
assert.strictEqual(withPressure.point.readings.pressure, 101.3);
console.log("Test 10d passed: a pressure reading is accepted and stored");

const badPressure = validatePoint({
  deviceId: "turbine-01",
  deviceType: "temperature",
  pressure: "high",
});

assert.ok(badPressure.errors.some((message) => message.includes("pressure")));
console.log("Test 10e passed: a non-numeric pressure is rejected");

// 11. The compiler needs a real stream --------------------------------------
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

const badLocation = validatePoint({
  deviceId: "sensor-001",
  deviceType: "temperature",
  location: 42,
  temperature: 20,
});
assert.ok(badLocation.errors.some((e) => /location must be a string/.test(e)));
console.log("Test 13 passed: a non string location is rejected");

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
console.log("Test 14 passed: a valid point is normalised into a document");

console.log("\nAll regression tests passed!");
