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

  // 6. The throttle allows one alert per cooldown window and counts the rest.
  const { createAlertThrottle } = require("../src/streams/alertThrottle");
  const throttle = createAlertThrottle({ cooldownMs: 30000 });

  assert.strictEqual(throttle.allow(1000), true);
  assert.strictEqual(throttle.allow(2000), false);
  assert.strictEqual(throttle.allow(30000), false);
  assert.strictEqual(throttle.allow(31001), true);
  assert.strictEqual(throttle.suppressedCount, 2);
  console.log("Test 6 passed: the throttle allows one alert per cooldown window");

  // 7. End to end through the registry: a burst of matching points produces one
  // alert, and the suppression is visible in the status.
  const burstBus = new Subject();
  const burstRegistry = new RuleRegistry({ bus: burstBus, logger: silent });
  const recorded = [];

  burstRegistry.setAlertHandler(async (alert) => recorded.push(alert));
  burstRegistry.compile({ _id: "rule-burst", name: "Burst", ...graph });

  for (const temperature of [90, 91, 92, 93, 94]) burstBus.next(point(temperature));
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.strictEqual(recorded.length, 1);
  assert.strictEqual(burstRegistry.status("rule-burst").suppressedAlerts, 4);
  console.log("Test 7 passed: five matching points in a burst record one alert and report 4 suppressed");

  console.log("\nAll alert tests passed!");
})().catch((error) => {
  console.error("Alert test failed:", error.message);
  process.exitCode = 1;
});
