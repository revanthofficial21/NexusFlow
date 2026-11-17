/**
 * HTTP-level checks that do not need MongoDB: the error envelope, the 404 route,
 * health reporting and request validation. Boots the app on an ephemeral port.
 */
const assert = require("node:assert");

process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27099/nexusflow-test";

const app = require("../src/app");

const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. Malformed JSON must come back as JSON, not an HTML error page.
    let res = await fetch(`${base}/api/telemetry/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"deviceId":',
    });
    let body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(res.headers.get("content-type"), /application\/json/);
    assert.strictEqual(body.message, "Malformed JSON body");
    console.log("Test 1 passed: malformed JSON returns a JSON 400");

    // 2. Unknown route
    res = await fetch(`${base}/api/does-not-exist`);
    body = await res.json();

    assert.strictEqual(res.status, 404);
    assert.match(body.message, /not found/i);
    console.log("Test 2 passed: unknown route returns a JSON 404");

    // 3. Health reflects the database state instead of always claiming healthy.
    res = await fetch(`${base}/api/health`);
    body = await res.json();

    assert.strictEqual(res.status, 503);
    assert.strictEqual(body.status, "degraded");
    assert.strictEqual(body.database, "disconnected");
    console.log("Test 3 passed: health reports 503 when the database is down");

    // 4. Telemetry validation happens before the database is touched.
    res = await fetch(`${base}/api/telemetry/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceType: "temperature", temperature: 20 }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /deviceId/);
    console.log("Test 4 passed: ingest rejects a missing deviceId with 400");

    res = await fetch(`${base}/api/telemetry/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deviceId: "sensor-001",
        deviceType: "temperature",
        location: 42,
        temperature: 20,
      }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /location must be a string/);
    console.log("Test 5 passed: a non string location is rejected");

    // 5. A batch over the limit is refused without parsing every point.
    res = await fetch(`${base}/api/telemetry/batch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        Array.from({ length: 2001 }, () => ({
          deviceId: "sensor-001",
          deviceType: "temperature",
          temperature: 20,
        }))
      ),
    });

    assert.strictEqual(res.status, 413);
    console.log("Test 6 passed: an oversized batch returns 413");

    // 6. Compiler: graph errors keep their 400 status through the controller.
    const graph = {
      nodes: [
        { id: "1", type: "sensor", data: {} },
        { id: "2", type: "alert", data: {} },
        { id: "3", type: "alert", data: {} },
      ],
      edges: [
        { id: "a", source: "1", target: "2" },
        { id: "b", source: "1", target: "3" },
      ],
    };

    res = await fetch(`${base}/api/compiler/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph, sensorData: [1, 2] }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /outgoing connections/);
    console.log("Test 7 passed: compiler graph errors return 400, not 500");

    // 7. Pipeline validation happens before the database is touched.
    res = await fetch(`${base}/api/pipelines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "bad", nodes: [{ id: "1", type: "nope" }], edges: [] }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /Invalid pipeline graph/);
    console.log("Test 8 passed: an invalid graph is rejected before saving");

    // 8. A valid request with the database down fails fast with 503, instead of
    // parking for the 10s mongoose buffer timeout.
    const startedAt = Date.now();
    res = await fetch(`${base}/api/telemetry/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deviceId: "sensor-001",
        deviceType: "temperature",
        temperature: 20,
      }),
    });
    body = await res.json();
    const elapsed = Date.now() - startedAt;

    assert.strictEqual(res.status, 503);
    assert.strictEqual(body.message, "Database unavailable");
    assert.ok(elapsed < 2000, `expected a fast failure, took ${elapsed}ms`);
    console.log(`Test 9 passed: ingest fails fast with 503 when the DB is down (${elapsed}ms)`);

    res = await fetch(`${base}/api/pipelines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "valid",
        nodes: [
          { id: "1", type: "sensor", data: {} },
          { id: "2", type: "alert", data: {} },
        ],
        edges: [{ id: "a", source: "1", target: "2" }],
      }),
    });

    assert.strictEqual(res.status, 503);
    console.log("Test 10 passed: pipeline save returns 503 when the DB is down");

    // 9. The compiler needs no database, so it keeps working.
    res = await fetch(`${base}/api/compiler/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        graph: {
          nodes: [
            { id: "1", type: "sensor", data: {} },
            { id: "2", type: "average", data: { windowSize: 2 } },
            { id: "3", type: "threshold", data: { threshold: 80, operator: "greaterThan" } },
            { id: "4", type: "alert", data: {} },
          ],
          edges: [
            { id: "a", source: "1", target: "2" },
            { id: "b", source: "2", target: "3" },
            { id: "c", source: "3", target: "4" },
          ],
        },
        sensorData: [90, 100, 110, 120],
      }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(body.results, [95, 105, 115]);
    console.log("Test 11 passed: the compiler still runs without a database");

    // 10. An update with nothing to update is a client error, not a success.
    res = await fetch(`${base}/api/pipelines/507f1f77bcf86cd799439011`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /No updatable fields/);
    console.log("Test 12 passed: an empty update is rejected");

    // 11. Parse-only endpoint: reports the plan without executing.
    res = await fetch(`${base}/api/compiler/parse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        graph: {
          nodes: [
            { id: "1", type: "sensor", data: { deviceId: "turbine-01" } },
            { id: "2", type: "average", data: { windowSize: 3 } },
            { id: "3", type: "threshold", data: { threshold: 105, operator: "greaterThan" } },
            { id: "4", type: "alert", data: {} },
          ],
          edges: [
            { id: "a", source: "1", target: "2" },
            { id: "b", source: "2", target: "3" },
            { id: "c", source: "3", target: "4" },
          ],
        },
      }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(body.executionOrder, ["1", "2", "3", "4"]);
    assert.strictEqual(body.plan[0].deviceId, "turbine-01");
    assert.strictEqual(body.plan[2].threshold, 105);
    console.log("Test 13 passed: /api/compiler/parse reports the plan without executing");

    res = await fetch(`${base}/api/compiler/parse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        graph: { nodes: [{ id: "1", type: "nope" }], edges: [] },
      }),
    });

    assert.strictEqual(res.status, 400);
    console.log("Test 14 passed: parse rejects an invalid graph with 400");

    // 12. Alerts are database-backed, so they report 503 without a database.
    res = await fetch(`${base}/api/alerts?limit=5`);
    body = await res.json();

    assert.strictEqual(res.status, 503);
    assert.strictEqual(body.message, "Database unavailable");
    console.log("Test 15 passed: GET /api/alerts returns 503 when the DB is down");

    console.log("\nAll HTTP tests passed!");
  } catch (error) {
    console.error("HTTP test failed:", error.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
