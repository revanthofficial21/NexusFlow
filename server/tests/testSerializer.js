/**
 * Proves the client serializer output is exactly what the backend accepts.
 * The serializer is ESM in client/, so it is imported dynamically from here.
 */
const assert = require("node:assert");
const { validateGraph } = require("../src/compiler/validateGraph");

async function main() {
  const { serializeGraph, isSerializable } = await import(
    "../../client/src/services/graphService.js"
  );

  // A React Flow graph as the canvas actually holds it: positions, measured,
  // selected and dragging are all present.
  const nodes = [
    {
      id: "1",
      type: "sensor",
      position: { x: 50, y: 150 },
      selected: true,
      dragging: false,
      measured: { width: 165, height: 80 },
      data: { label: "Turbine Sensor", value: "Temperature: 85°C", deviceId: "turbine-01" },
    },
    {
      id: "2",
      type: "average",
      position: { x: 310, y: 150 },
      measured: { width: 165, height: 80 },
      data: { label: "Window: 3 samples", windowSize: 3 },
    },
    {
      id: "3",
      type: "threshold",
      position: { x: 570, y: 150 },
      data: { label: "Temperature", condition: "Greater than 105°C", threshold: 105, operator: "greaterThan" },
    },
    {
      id: "4",
      type: "alert",
      position: { x: 830, y: 150 },
      data: { label: "Manager Notification" },
    },
  ];

  const edges = [
    { id: "e1", source: "1", target: "2", animated: true, selected: false },
    { id: "e2", source: "2", target: "3", animated: true },
    { id: "e3", source: "3", target: "4", animated: true },
  ];

  const serialized = serializeGraph(nodes, edges);

  // 1. UI bookkeeping is gone
  const leaked = serialized.nodes.filter(
    (node) =>
      node.position !== undefined ||
      node.measured !== undefined ||
      node.selected !== undefined ||
      node.dragging !== undefined
  );

  assert.deepStrictEqual(leaked, []);
  assert.ok(serialized.edges.every((edge) => edge.animated === undefined));
  console.log("Test 1 passed: positions, measured, selected and dragging are stripped");

  // 2. The parameters the compiler needs survive
  assert.strictEqual(serialized.nodes[0].data.deviceId, "turbine-01");
  assert.strictEqual(serialized.nodes[1].data.windowSize, 3);
  assert.strictEqual(serialized.nodes[2].data.threshold, 105);
  assert.strictEqual(serialized.nodes[2].data.operator, "greaterThan");
  console.log("Test 2 passed: deviceId, windowSize, threshold and operator survive");

  // 3. The backend accepts the result
  const validation = validateGraph(serialized);
  assert.deepStrictEqual(validation.errors, []);
  assert.strictEqual(validation.valid, true);
  console.log("Test 3 passed: serialized graph passes validateGraph");

  // 4. Round trip through JSON, as it will travel over HTTP
  const overTheWire = JSON.parse(JSON.stringify(serialized));
  assert.strictEqual(validateGraph(overTheWire).valid, true);
  console.log("Test 4 passed: serialized graph still validates after a JSON round trip");

  // 5. Payload is materially smaller than raw React Flow state
  const rawSize = JSON.stringify({ nodes, edges }).length;
  const cleanSize = JSON.stringify(serialized).length;
  assert.ok(cleanSize < rawSize, `expected ${cleanSize} < ${rawSize}`);
  console.log(`Test 5 passed: payload shrank from ${rawSize} to ${cleanSize} bytes`);

  // 6. A webhook node keeps its url and method
  const webhook = serializeGraph(
    [{ id: "9", type: "webhook", position: { x: 0, y: 0 }, data: { url: "https://example.com/hook", method: "PUT", label: "hook" } }],
    []
  );
  assert.strictEqual(webhook.nodes[0].data.url, "https://example.com/hook");
  assert.strictEqual(webhook.nodes[0].data.method, "PUT");
  console.log("Test 6 passed: webhook url and method are preserved");

  // 7. Empty canvas is reported as not serializable
  assert.strictEqual(isSerializable([], []), false);
  assert.strictEqual(isSerializable(nodes, []), false);
  console.log("Test 7 passed: an incomplete graph is not reported as serializable");

  console.log("\nAll serializer tests passed!");
}

main().catch((error) => {
  console.error("Serializer test failed:", error.message);
  process.exitCode = 1;
});
