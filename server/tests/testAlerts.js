/**
 * Alert emission and persistence wiring, without a database.
 */
const assert = require("node:assert");
const { of } = require("rxjs");
const { compileGraph } = require("../src/compiler/graphCompiler");

const graph = {
  nodes: [
    { id: "1", type: "sensor", data: { deviceId: "turbine-01" } },
    { id: "2", type: "threshold", data: { threshold: 80, operator: "greaterThan" } },
    { id: "3", type: "alert", data: { label: "Turbine overheat" } },
  ],
  edges: [
    { id: "a", source: "1", target: "2" },
    { id: "b", source: "2", target: "3" },
  ],
};

// 1. A matched value is reported through the onAlert hook.
const captured = [];
compileGraph(graph, of(70, 90, 60, 95), {
  onAlert: (alert) => captured.push(alert),
}).subscribe();

assert.strictEqual(captured.length, 2);
assert.deepStrictEqual(captured.map((alert) => alert.value), [90, 95]);
assert.strictEqual(captured[0].nodeId, "3");
assert.strictEqual(captured[0].message, "Turbine overheat: 90");
console.log("Test 1 passed: matched values are reported through onAlert");

// 2. Without a handler nothing is reported - this is what keeps the dry-run
// endpoint from persisting alerts.
const dryRun = [];
compileGraph(graph, of(90, 95)).subscribe((value) => dryRun.push(value));

assert.deepStrictEqual(dryRun, [90, 95]);
console.log("Test 2 passed: a dry run still emits values but reports no alerts");

// 3. No match, no alert.
const none = [];
compileGraph(graph, of(10, 20), { onAlert: (alert) => none.push(alert) }).subscribe();

assert.deepStrictEqual(none, []);
console.log("Test 3 passed: values below the threshold raise no alert");

// 4. The registry attaches rule identity to the alert it forwards.
const { RuleRegistry } = require("../src/streams/ruleRegistry");
const { Subject } = require("rxjs");
const silent = { log() {}, warn() {}, error() {} };

(async () => {
  const bus = new Subject();
  const registry = new RuleRegistry({ bus, logger: silent });
  const forwarded = [];

  registry.setAlertHandler(async (alert) => forwarded.push(alert));
  registry.compile({ _id: "rule-1", name: "Turbine overheat", ...graph });

  const point = (temperature) => ({
    timestamp: new Date(),
    metadata: { deviceId: "turbine-01" },
    readings: { temperature },
  });

  bus.next(point(90));
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.strictEqual(forwarded.length, 1);
  assert.strictEqual(forwarded[0].ruleId, "rule-1");
  assert.strictEqual(forwarded[0].ruleName, "Turbine overheat");
  assert.strictEqual(forwarded[0].deviceId, "turbine-01");
  console.log("Test 4 passed: live pipeline alerts carry rule id, name and device");

  // 5. A failing handler must not kill the pipeline.
  registry.setAlertHandler(async () => {
    throw new Error("database down");
  });
  bus.next(point(95));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.strictEqual(bus.observers.length, 1);
  console.log("Test 5 passed: a failing alert handler does not break the pipeline");

  console.log("\nAll alert tests passed!");
})().catch((error) => {
  console.error("Alert test failed:", error.message);
  process.exitCode = 1;
});
