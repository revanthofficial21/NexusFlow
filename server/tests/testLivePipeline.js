/**
 * The live pipeline path: telemetry bus -> compiled rule. No database needed.
 */
const assert = require("node:assert");
const { Subject } = require("rxjs");
const { RuleRegistry, liveSourceFor } = require("../src/streams/ruleRegistry");

const silentLogger = { log() {}, warn() {}, error() {} };

const document = {
  _id: "64b7f0c2f1a2b3c4d5e6f7a8",
  name: "Turbine overheat",
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

const point = (deviceId, temperature) => ({
  timestamp: new Date(),
  metadata: { deviceId, deviceType: "temperature" },
  readings: { temperature, humidity: null },
});

async function main() {
  // 1. The live source only carries the configured device's readings.
  const bus = new Subject();
  const seen = [];
  liveSourceFor(bus, "turbine-01").subscribe((value) => seen.push(value));

  bus.next(point("turbine-01", 90));
  bus.next(point("pump-07", 200)); // different device
  bus.next({ ...point("turbine-01", null), readings: { temperature: null } }); // humidity-only
  bus.next(point("turbine-01", 95));

  assert.deepStrictEqual(seen, [90, 95]);
  console.log("Test 1 passed: live source filters by device and numeric temperature");

  // 2. A rule compiles against the bus and subscribes to it.
  const registryBus = new Subject();
  const registry = new RuleRegistry({ bus: registryBus, logger: silentLogger });
  const status = registry.compile(document);

  assert.strictEqual(status.running, true);
  assert.strictEqual(status.deviceId, "turbine-01");
  assert.strictEqual(registryBus.observers.length, 1);
  console.log("Test 2 passed: a saved pipeline compiles into a live subscription");

  // 3. Publishing telemetry does not throw, and the subscription survives.
  registryBus.next(point("turbine-01", 90));
  registryBus.next(point("turbine-01", 100));
  assert.strictEqual(registryBus.observers.length, 1);
  console.log("Test 3 passed: telemetry flows through the compiled rule");

  // 4. Recompiling replaces the subscription instead of leaking another one.
  registry.compile(document);
  assert.strictEqual(registryBus.observers.length, 1);
  console.log("Test 4 passed: recompiling does not leak a second subscription");

  // 5. stop() detaches the pipeline.
  registry.stop(document._id);
  assert.strictEqual(registryBus.observers.length, 0);
  assert.deepStrictEqual(registry.statuses(), []);
  console.log("Test 5 passed: stop() unsubscribes the pipeline");

  // 6. An invalid pipeline is reported, not thrown.
  const broken = registry.compile({ _id: "bad", name: "broken", nodes: [], edges: [] });
  assert.strictEqual(broken.running, false);
  assert.match(broken.error, /invalid graph|sensor node/i);
  console.log("Test 6 passed: an invalid pipeline reports an error instead of throwing");

  // 7. bootstrap compiles everything a fake collection returns.
  const fakeCollection = { find: () => ({ lean: async () => [document] }) };
  const bootRegistry = new RuleRegistry({ bus: new Subject(), logger: silentLogger });
  const result = await bootRegistry.bootstrap(fakeCollection);

  assert.deepStrictEqual(result, { total: 1, running: 1, paused: 0 });
  console.log("Test 7 passed: bootstrap compiles the saved pipelines");

  // 8. A paused rule holds no subscription and evaluates nothing.
  const pauseBus = new Subject();
  const pauseRegistry = new RuleRegistry({ bus: pauseBus, logger: silentLogger });
  const pausedAlerts = [];

  pauseRegistry.setAlertHandler(async (alert) => pausedAlerts.push(alert.value));

  const paused = pauseRegistry.compile({ ...document, _id: "rule-paused", name: "Paused", enabled: false });

  assert.strictEqual(paused.running, false);
  assert.strictEqual(paused.enabled, false);
  assert.strictEqual(paused.reason, "paused");

  pauseBus.next(point("turbine-01", 95));
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.strictEqual(pausedAlerts.length, 0, "a paused rule must not evaluate");
  console.log("Test 8 passed: a paused rule holds no subscription and fires nothing");

  // 9. Resuming compiles it and it starts evaluating again.
  const resumed = pauseRegistry.compile({ ...document, _id: "rule-paused", name: "Paused", enabled: true });

  assert.strictEqual(resumed.running, true);

  // The chain averages pairs, so it needs two readings before the threshold sees
  // anything: (96 + 97) / 2 = 96.5.
  pauseBus.next(point("turbine-01", 96));
  pauseBus.next(point("turbine-01", 97));
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.deepStrictEqual(pausedAlerts, [96.5], "the resumed rule evaluates again");
  console.log("Test 9 passed: resuming a paused rule compiles it again");

  // 10. Bootstrap reports how many were paused rather than running.
  const summary = await pauseRegistry.bootstrap({
    find: () => ({
      lean: async () => [
        { ...document, _id: "rule-a", name: "A", enabled: true },
        { ...document, _id: "rule-b", name: "B", enabled: false },
      ],
    }),
  });

  assert.deepStrictEqual(summary, { total: 2, running: 1, paused: 1 });
  console.log("Test 10 passed: bootstrap separates running from paused rules");

  console.log("\nAll live pipeline tests passed!");
}

main().catch((error) => {
  console.error("Live pipeline test failed:", error.message);
  process.exitCode = 1;
});
