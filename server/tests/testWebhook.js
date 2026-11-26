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

/** Waits for a condition rather than guessing a sleep, so the suite is not timing-flaky. */
const until = async (predicate, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return false;
};

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

  assert.ok(await until(() => received.length >= 1), "the webhook should have been called");

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

  assert.ok(await until(() => failed.length >= 1), "a failed delivery should be reported");

  assert.strictEqual(failed.length, 1);
  assert.strictEqual(failed[0].delivery.attempts, 3);
  assert.strictEqual(failed[0].channel, "webhook");
  assert.strictEqual(failed[0].level, "critical");
  assert.strictEqual(failed[0].delivery.delivered, false);
  assert.match(failed[0].message, /failed/i);
  console.log("Test 2 passed: an unreachable endpoint is retried 3 times, then recorded as a critical alert");

  // 2b. A transient failure is retried and succeeds.
  const flaky = { hits: 0 };
  const flakyServer = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      flaky.hits += 1;
      // fail twice, then accept
      res.writeHead(flaky.hits < 3 ? 500 : 204).end();
    });
  });

  await new Promise((resolve) => flakyServer.listen(0, resolve));
  const flakyPort = flakyServer.address().port;

  const retried = [];
  compileGraph(graph(`http://127.0.0.1:${flakyPort}/hook`), of(92), {
    live: true,
    onAlert: (alert) => retried.push(alert),
  }).subscribe();

  assert.ok(await until(() => flaky.hits >= 3), `expected 3 attempts, got ${flaky.hits}`);

  assert.strictEqual(flaky.hits, 3, `expected 3 attempts, got ${flaky.hits}`);
  assert.deepStrictEqual(retried, [], "a delivery that eventually succeeds is not an alert");
  console.log("Test 3 passed: a 500 is retried and the delivery succeeds on the third attempt");

  flakyServer.closeAllConnections();
  await new Promise((resolve) => flakyServer.close(resolve));

  // 2c. A 4xx is not retried: repeating a malformed request cannot help.
  const rejecting = { hits: 0 };
  const rejectingServer = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      rejecting.hits += 1;
      res.writeHead(400).end();
    });
  });

  await new Promise((resolve) => rejectingServer.listen(0, resolve));
  const rejectingPort = rejectingServer.address().port;

  const rejected = [];
  compileGraph(graph(`http://127.0.0.1:${rejectingPort}/hook`), of(92), {
    live: true,
    onAlert: (alert) => rejected.push(alert),
  }).subscribe();

  assert.ok(await until(() => rejecting.hits >= 1), "the 400 should have been reported");

  assert.strictEqual(rejecting.hits, 1, `expected a single attempt, got ${rejecting.hits}`);
  assert.strictEqual(rejected.length, 1);
  assert.strictEqual(rejected[0].delivery.attempts, 1);
  console.log("Test 4 passed: a 400 is reported at once, without retrying");

  rejectingServer.closeAllConnections();
  await new Promise((resolve) => rejectingServer.close(resolve));

  // 3. A dry run still posts nothing.
  const dry = [];
  compileGraph(graph(`http://127.0.0.1:${port}/hook`), of(92), {
    onAlert: (alert) => dry.push(alert),
  }).subscribe();

  // Nothing should happen at all, so this one genuinely waits.
  await new Promise((resolve) => setTimeout(resolve, 500));

  assert.deepStrictEqual(dry, []);
  console.log("Test 5 passed: a dry run posts nothing");

  console.log("\nAll webhook tests passed!");
}

main().catch((error) => {
  console.error("Webhook test failed:", error.message);
  process.exitCode = 1;
});
