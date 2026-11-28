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
    // Fan-out is valid now, so this uses a genuinely broken node instead.
    const brokenOperator = {
      nodes: [
        { id: "1", type: "sensor", data: {} },
        { id: "2", type: "threshold", data: { threshold: 5, operator: "roughly" } },
        { id: "3", type: "alert", data: {} },
      ],
      edges: [
        { id: "a", source: "1", target: "2" },
        { id: "b", source: "2", target: "3" },
      ],
    };

    res = await fetch(`${base}/api/compiler/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph: brokenOperator, sensorData: [1, 2] }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /Unsupported threshold operator/);
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

    // 13. Date range validation happens before the database is touched.
    res = await fetch(`${base}/api/telemetry/latest?startDate=not-a-date`);
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /startDate is not a valid date/);
    console.log("Test 16 passed: an invalid startDate is rejected with 400");

    res = await fetch(
      `${base}/api/telemetry/latest?startDate=2026-11-17T10:00:00Z&endDate=2026-11-17T09:00:00Z`
    );
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /before endDate/);
    console.log("Test 17 passed: an inverted date range is rejected with 400");

    // 14. Stats are database-backed.
    res = await fetch(`${base}/api/telemetry/stats`);

    assert.strictEqual(res.status, 503);
    console.log("Test 18 passed: /api/telemetry/stats returns 503 without a database");

    // 15. Alert filter validation happens before the database is touched.
    res = await fetch(`${base}/api/alerts?acknowledged=yes`);
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /acknowledged must be/);
    console.log("Test 19 passed: an invalid acknowledged filter is rejected with 400");

    // 16. A branching graph executes both branches over HTTP.
    res = await fetch(`${base}/api/compiler/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        graph: {
          nodes: [
            { id: "1", type: "sensor", data: {} },
            { id: "2", type: "average", data: { windowSize: 2 } },
            { id: "3", type: "alert", data: {} },
            { id: "4", type: "alert", data: {} },
          ],
          edges: [
            { id: "a", source: "1", target: "2" },
            { id: "b", source: "2", target: "3" },
            { id: "c", source: "1", target: "4" },
          ],
        },
        sensorData: [10, 20],
      }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 200);
    // leaf order follows the topological sort: the direct branch and the average
    assert.deepStrictEqual([...body.results].sort((a, b) => a - b), [10, 15, 20]);
    console.log("Test 20 passed: a branching graph executes both branches");

    // 17. Parse applies the same parameter rules as execute.
    res = await fetch(`${base}/api/compiler/parse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        graph: {
          nodes: [
            { id: "1", type: "sensor", data: {} },
            { id: "2", type: "average", data: { windowSize: 50000 } },
            { id: "3", type: "alert", data: {} },
          ],
          edges: [
            { id: "a", source: "1", target: "2" },
            { id: "b", source: "2", target: "3" },
          ],
        },
      }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /Window size must be between/);
    console.log("Test 21 passed: parse rejects an out-of-range window, like execute does");

    // 18. The sms node is accepted, and its phone number is validated on parse.
    res = await fetch(`${base}/api/compiler/parse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        graph: {
          nodes: [
            { id: "1", type: "sensor", data: { deviceId: "turbine-01" } },
            { id: "2", type: "sms", data: { to: "+919876543210", template: "Hot {{deviceId}}: {{value}}" } },
          ],
          edges: [{ id: "a", source: "1", target: "2" }],
        },
      }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.plan[1].to, "+919876543210");
    console.log("Test 22 passed: parse accepts an sms node and reports its recipient");

    res = await fetch(`${base}/api/compiler/parse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        graph: {
          nodes: [
            { id: "1", type: "sensor", data: {} },
            { id: "2", type: "sms", data: { to: "call-me" } },
          ],
          edges: [{ id: "a", source: "1", target: "2" }],
        },
      }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /valid phone number/);
    console.log("Test 23 passed: parse rejects an sms node with an invalid number");

    // 19. enabled must be a boolean, checked before the database is touched.
    res = await fetch(`${base}/api/pipelines/64b7f0c2f1a2b3c4d5e6f7a8`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: "yes" }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /enabled must be true or false/);
    console.log("Test 24 passed: a non-boolean enabled value is rejected with 400");

    // 20. The read-only views are wired and fail closed without a database.
    for (const path of ["/api/telemetry/history", "/api/telemetry/device-status", "/api/telemetry/export"]) {
      res = await fetch(`${base}${path}`);
      assert.strictEqual(res.status, 503, `${path} should be 503 without a database`);
    }
    console.log("Test 25 passed: history, device-status and export return 503 without a database");

    // 21. Export validates its dates before touching the database.
    res = await fetch(`${base}/api/telemetry/export?startDate=nope`);
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /startDate is not a valid date/);
    console.log("Test 26 passed: export rejects an invalid date with 400");

    // 22. An array query param would silently match nothing, so it is rejected.
    res = await fetch(`${base}/api/alerts?ruleId=a&ruleId=b`);
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /ruleId must be a single value/);
    console.log("Test 27 passed: a repeated ruleId filter is rejected with 400");

    // 23. The ingest key guards writes only.
    const point = { deviceId: "turbine-01", deviceType: "temperature", temperature: 20 };
    const write = (headers = {}) =>
      fetch(`${base}/api/telemetry/ingest`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(point),
      });

    delete process.env.INGEST_API_KEY;
    res = await write();
    assert.notStrictEqual(res.status, 401, "with no key configured, writes are open");
    console.log("Test 28 passed: with no INGEST_API_KEY configured, writes are open");

    process.env.INGEST_API_KEY = "secret-123";

    res = await write();
    body = await res.json();
    assert.strictEqual(res.status, 401);
    assert.match(body.message, /x-api-key/);

    res = await write({ "x-api-key": "wrong" });
    assert.strictEqual(res.status, 401);
    console.log("Test 29 passed: a missing or wrong key is 401");

    res = await write({ "x-api-key": "secret-123" });
    assert.notStrictEqual(res.status, 401, "the right key gets past the guard");
    console.log("Test 30 passed: the right key gets past the guard");

    res = await fetch(`${base}/api/telemetry/latest`);
    assert.notStrictEqual(res.status, 401, "reads stay open");
    console.log("Test 31 passed: reads stay open while writes are protected");

    delete process.env.INGEST_API_KEY;

    // 24. A mistyped limit falls back to the default instead of vanishing.
    // The cap is read at module load, so this asserts the default of 2000 is in
    // force; testEnv.js covers the parsing itself.
    res = await fetch(`${base}/api/telemetry/batch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        Array.from({ length: 2500 }, (_, index) => ({
          deviceId: "turbine-01",
          deviceType: "temperature",
          temperature: index,
        }))
      ),
    });
    body = await res.json();

    assert.strictEqual(res.status, 413);
    assert.match(body.message, /limit of 2000/);
    console.log("Test 32 passed: the batch cap is enforced, not silently dropped");

    // 25. Device registry: validation happens before the database is touched.
    res = await fetch(`${base}/api/devices`);
    assert.strictEqual(res.status, 503, "the list needs a database");
    console.log("Test 33 passed: GET /api/devices fails closed without a database");

    res = await fetch(`${base}/api/devices/turbine-01`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /at least one of/);
    console.log("Test 34 passed: an empty device update is rejected");

    res = await fetch(`${base}/api/devices/turbine-01`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: 42 }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /name must be a string/);
    console.log("Test 35 passed: a non-string device name is rejected");

    res = await fetch(`${base}/api/devices/turbine-01`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x".repeat(200) }),
    });
    body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /at most 120/);
    console.log("Test 36 passed: an over-long device name is rejected");

    res = await fetch(`${base}/api/devices/turbine-01`);
    assert.strictEqual(res.status, 503, "a single read needs a database too");
    console.log("Test 37 passed: GET /api/devices/:id fails closed without a database");

    console.log("\nAll HTTP tests passed!");
  } catch (error) {
    console.error("HTTP test failed:", error.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
