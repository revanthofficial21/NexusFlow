/**
 * End-to-end check against a running server and a real database.
 *
 *   cd server
 *   npm run dev                 # in one terminal, with MONGODB_URI set
 *   node scripts/smoke-test.js  # in another
 *
 * Covers telemetry ingestion and pipeline CRUD, which the unit tests cannot reach
 * because they never touch MongoDB. Exits non-zero if anything fails.
 */
const BASE = process.env.BASE_URL || "http://localhost:5000";

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` -> ${detail}` : ""}`);
    console.log(`  FAIL  ${label}${detail ? ` -> ${detail}` : ""}`);
  }
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  return { status: res.status, body: payload };
}

const deviceId = `smoke-${Date.now()}`;
const pipelineName = `smoke pipeline ${Date.now()}`;

async function main() {
  console.log(`NexusFlow smoke test against ${BASE}\n`);

  // ---------------------------------------------------------------- health
  console.log("Health");
  const health = await call("GET", "/api/health");
  check("GET /api/health returns 200", health.status === 200, `got ${health.status}`);
  check(
    "health reports the database as connected",
    health.body?.database === "connected",
    `got "${health.body?.database}"`
  );

  // ---------------------------------------------------------------- telemetry
  console.log("\nTelemetry ingestion");
  const single = await call("POST", "/api/telemetry/ingest", {
    deviceId,
    deviceType: "temperature",
    location: "Smoke room",
    temperature: 28.5,
    humidity: 61,
  });
  check("POST /api/telemetry/ingest returns 201", single.status === 201, `got ${single.status}`);
  check("ingest returns an insertedId", Boolean(single.body?.insertedId));

  const batch = await call("POST", "/api/telemetry/batch", [
    { deviceId, deviceType: "temperature", temperature: 30.1 },
    { deviceId, deviceType: "temperature", temperature: 31.4 },
    { deviceId, deviceType: "temperature", humidity: 58 },
  ]);
  check("POST /api/telemetry/batch returns 201", batch.status === 201, `got ${batch.status}`);
  check("batch reports 3 inserted", batch.body?.insertedCount === 3, `got ${batch.body?.insertedCount}`);

  const bad = await call("POST", "/api/telemetry/ingest", {
    deviceId,
    deviceType: "temperature",
    temperature: "hot",
  });
  check("non numeric reading is rejected with 400", bad.status === 400, `got ${bad.status}`);

  const latest = await call("GET", `/api/telemetry/latest?deviceId=${deviceId}&limit=10`);
  check("GET /api/telemetry/latest returns 200", latest.status === 200, `got ${latest.status}`);
  check(
    "latest returns the 4 points just written",
    latest.body?.count === 4,
    `got ${latest.body?.count}`
  );
  check(
    "latest points carry timestamp, metadata and readings",
    Boolean(latest.body?.records?.[0]?.timestamp) &&
      Boolean(latest.body?.records?.[0]?.metadata?.deviceId) &&
      latest.body?.records?.[0]?.readings !== undefined
  );

  // ---------------------------------------------------------------- pipelines
  console.log("\nPipeline CRUD");
  const graph = {
    nodes: [
      { id: "1", type: "sensor", data: { label: "Smoke sensor" } },
      { id: "2", type: "average", data: { windowSize: 3 } },
      { id: "3", type: "threshold", data: { threshold: 105, operator: "greaterThan" } },
      { id: "4", type: "alert", data: { label: "Smoke alert" } },
    ],
    edges: [
      { id: "e1", source: "1", target: "2" },
      { id: "e2", source: "2", target: "3" },
      { id: "e3", source: "3", target: "4" },
    ],
  };

  const created = await call("POST", "/api/pipelines", {
    name: pipelineName,
    description: "created by smoke-test.js",
    ...graph,
  });
  check("POST /api/pipelines returns 201", created.status === 201, `got ${created.status}`);

  const pipelineId = created.body?.pipeline?._id;
  check("save returns a pipeline id", Boolean(pipelineId));

  if (pipelineId) {
    const fetched = await call("GET", `/api/pipelines/${pipelineId}`);
    check("GET /api/pipelines/:id returns 200", fetched.status === 200, `got ${fetched.status}`);
    check(
      "loaded pipeline has the 4 nodes that were saved",
      fetched.body?.pipeline?.nodes?.length === 4,
      `got ${fetched.body?.pipeline?.nodes?.length}`
    );

    const listed = await call("GET", "/api/pipelines");
    check("GET /api/pipelines returns 200", listed.status === 200, `got ${listed.status}`);
    check(
      "list contains the saved pipeline",
      Boolean(listed.body?.pipelines?.some((p) => p._id === pipelineId))
    );

    const updated = await call("PUT", `/api/pipelines/${pipelineId}`, {
      name: `${pipelineName} (renamed)`,
      description: "updated by smoke-test.js",
    });
    check("PUT /api/pipelines/:id returns 200", updated.status === 200, `got ${updated.status}`);
    check(
      "update persisted the new name",
      updated.body?.pipeline?.name === `${pipelineName} (renamed)`,
      `got "${updated.body?.pipeline?.name}"`
    );

    const removed = await call("DELETE", `/api/pipelines/${pipelineId}`);
    check("DELETE /api/pipelines/:id returns 200", removed.status === 200, `got ${removed.status}`);

    const gone = await call("GET", `/api/pipelines/${pipelineId}`);
    check("deleted pipeline is gone (404)", gone.status === 404, `got ${gone.status}`);
  }

  const invalid = await call("POST", "/api/pipelines", {
    name: "invalid graph",
    nodes: [{ id: "1", type: "not-a-real-node" }],
    edges: [],
  });
  check("invalid graph is rejected with 400", invalid.status === 400, `got ${invalid.status}`);

  // ---------------------------------------------------------------- compiler
  console.log("\nCompiler");
  const executed = await call("POST", "/api/compiler/execute", {
    graph,
    sensorData: [90, 100, 110, 120],
  });
  check("POST /api/compiler/execute returns 200", executed.status === 200, `got ${executed.status}`);
  check(
    "compiler returns the expected readings",
    JSON.stringify(executed.body?.results) === JSON.stringify([110]),
    `got ${JSON.stringify(executed.body?.results)}`
  );

  // ---------------------------------------------------------------- summary
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    failures.forEach((failure) => console.log(`  - ${failure}`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\nSmoke test could not run: ${error.message}`);
  console.error(`Is the server running at ${BASE}?`);
  process.exitCode = 1;
});
