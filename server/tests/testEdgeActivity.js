/**
 * Edge activity: the events that make a wire glow on the canvas.
 */
const assert = require("node:assert");
const { of, Subject } = require("rxjs");
const { compileGraph } = require("../src/compiler/graphCompiler");
const { createActivityGate } = require("../src/streams/activityGate");
const { RuleRegistry } = require("../src/streams/ruleRegistry");

const silent = { log() {}, warn() {}, error() {} };

const graph = {
  nodes: [
    { id: "1", type: "sensor", data: { deviceId: "turbine-01" } },
    { id: "2", type: "average", data: { windowSize: 2 } },
    { id: "3", type: "threshold", data: { threshold: 80, operator: "greaterThan" } },
    { id: "4", type: "alert", data: {} },
  ],
  edges: [
    { id: "e1", source: "1", target: "2" },
    { id: "e2", source: "2", target: "3" },
    { id: "e3", source: "3", target: "4" },
  ],
};

async function main() {
  // 1. Activity is reported per wire, as values pass through each node.
  const events = [];
  compileGraph(graph, of(90, 100, 110, 120), {
    onEdgeActivity: (activity) => events.push(activity),
  }).subscribe();

  const byEdge = events.reduce((acc, event) => {
    acc[event.edgeId] = (acc[event.edgeId] || 0) + 1;
    return acc;
  }, {});

  // 4 readings cross e1; the moving average emits 3 values, so 3 cross e2; all
  // three clear the threshold, so 3 cross e3.
  assert.deepStrictEqual(byEdge, { e1: 4, e2: 3, e3: 3 });
  console.log("Test 1 passed: activity is reported per wire, in step with the values");

  // 2. No handler, no crash.
  const values = [];
  compileGraph(graph, of(90, 95)).subscribe((value) => values.push(value));
  // window 2 average of [90, 95] = 92.5, which clears the threshold of 80.
  assert.deepStrictEqual(values, [92.5]);
  console.log("Test 2 passed: a dry run reports no activity and still emits values");

  // 3. The gate lets one event per wire per interval through.
  const gate = createActivityGate({ minIntervalMs: 100 });

  assert.strictEqual(gate.allow("e1", 1000), true);
  assert.strictEqual(gate.allow("e1", 1050), false);
  assert.strictEqual(gate.allow("e2", 1050), true, "other wires are independent");
  assert.strictEqual(gate.allow("e1", 1101), true);
  console.log("Test 3 passed: the gate limits each wire independently");

  // 4. Through the registry: ruleId attached, and a burst is rate-limited.
  const bus = new Subject();
  const registry = new RuleRegistry({ bus, logger: silent });
  const forwarded = [];

  registry.setEdgeHandler((activity) => forwarded.push(activity));
  registry.compile({ _id: "rule-edge", name: "Edge", ...graph });

  const point = (temperature) => ({
    timestamp: new Date(),
    metadata: { deviceId: "turbine-01" },
    readings: { temperature },
  });

  for (const temperature of [90, 91, 92, 93, 94, 95]) bus.next(point(temperature));
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.ok(forwarded.length > 0, "expected some activity");
  assert.ok(forwarded.length < 18, `expected rate limiting, got ${forwarded.length}`);
  assert.ok(forwarded.every((activity) => activity.ruleId === "rule-edge"));
  console.log(
    `Test 4 passed: a burst of 18 wire crossings produced ${forwarded.length} events, all tagged with the rule id`
  );

  // 5. Two rules whose graphs both name their wires "e1" must not silence each
  // other: the gate is keyed by rule + edge.
  const sharedBus = new Subject();
  const sharedRegistry = new RuleRegistry({ bus: sharedBus, logger: silent });
  const perRule = {};

  sharedRegistry.setEdgeHandler((activity) => {
    perRule[activity.ruleId] = (perRule[activity.ruleId] || 0) + 1;
  });

  sharedRegistry.compile({ _id: "rule-a", name: "A", ...graph });
  sharedRegistry.compile({ _id: "rule-b", name: "B", ...graph });

  sharedBus.next(point(90));
  sharedBus.next(point(95));
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.ok(perRule["rule-a"] > 0, "rule A should report activity");
  assert.ok(perRule["rule-b"] > 0, "rule B should report activity despite sharing edge ids");
  console.log(
    `Test 5 passed: rules with identical edge ids both report (A=${perRule["rule-a"]}, B=${perRule["rule-b"]})`
  );

  console.log("\nAll edge activity tests passed!");
}

main().catch((error) => {
  console.error("Edge activity test failed:", error.message);
  process.exitCode = 1;
});
