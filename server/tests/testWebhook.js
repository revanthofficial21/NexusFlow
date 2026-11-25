/**
 * Webhook delivery: success stays quiet, failure is recorded.
 */
const assert = require("node:assert");
const http = require("node:http");
const { of } = require("rxjs");
const { compileGraph } = require("../src/compiler/graphCompiler");

const graph = (url) => ({
  nodes: [
    { id: "1", type: "sensor", data: { deviceId: "turbine-01" } },
    { id: "2", type: "threshold", data: { threshold: 80, operator: "greaterThan" } },
    { id: "3", type: "webhook", data: { url, method: "POST" } },
  ],
  edges: [
    { id: "a", source: "1", target: "2" },
    { id: "b", source: "2", target: "3" },
  ],
});

const wait = (ms = 800) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  // A receiver that records what arrives.
  const received = [];
  const receiver = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ method: req.method, body: JSON.parse(body || "{}") });
      res.writeHead(204).end();
    });
  });

  await new Promise((resolve) => receiver.listen(0, resolve));
  const port = receiver.address().port;

  // 1. A reachable endpoint receives the matched value, and no alert is raised.
  const okAlerts = [];
  compileGraph(graph(`http://127.0.0.1:${port}/hook`), of(92), {
    live: true,
    onAlert: (alert) => okAlerts.push(alert),
  }).subscribe();

  await wait();

  assert.strictEqual(received.length, 1);
  assert.strictEqual(received[0].method, "POST");
  assert.strictEqual(received[0].body.value, 92);
  assert.deepStrictEqual(okAlerts, [], "a successful delivery is not an alert");
  console.log("Test 1 passed: a reachable webhook receives the value and stays quiet");

  // fetch keeps its socket alive, so close() alone would wait forever.
  receiver.closeAllConnections();
  await new Promise((resolve) => receiver.close(resolve));

  // 2. An unreachable endpoint produces a critical alert carrying the reason.
  const failed = [];
  compileGraph(graph("http://127.0.0.1:9/dead"), of(92), {
    live: true,
    onAlert: (alert) => failed.push(alert),
  }).subscribe();

  await wait(800);

  assert.strictEqual(failed.length, 1);
  assert.strictEqual(failed[0].channel, "webhook");
  assert.strictEqual(failed[0].level, "critical");
  assert.strictEqual(failed[0].delivery.delivered, false);
  assert.match(failed[0].message, /failed/i);
  console.log("Test 2 passed: a failed webhook is recorded as a critical alert");

  // 3. A dry run still posts nothing.
  const dry = [];
  compileGraph(graph(`http://127.0.0.1:${port}/hook`), of(92), {
    onAlert: (alert) => dry.push(alert),
  }).subscribe();

  await wait();

  assert.deepStrictEqual(dry, []);
  console.log("Test 3 passed: a dry run posts nothing");

  console.log("\nAll webhook tests passed!");
}

main().catch((error) => {
  console.error("Webhook test failed:", error.message);
  process.exitCode = 1;
});
