/**
 * Ingestion benchmark - the mid-project review number.
 *
 *   node scripts/benchmarkIngestion.js
 *   RATE=5000 DURATION=10 BATCH=500 node scripts/benchmarkIngestion.js
 *
 * Measures the HTTP ingest path: achieved writes/sec and batch latency
 * percentiles. Storage footprint is a separate measurement - run
 * db.telemetry.stats() in mongosh after this finishes.
 */
const BASE = process.env.BASE_URL || "http://localhost:5000";
const RATE = Number(process.env.RATE || 5000);
const DURATION = Number(process.env.DURATION || 10);
const BATCH = Number(process.env.BATCH || 500);
const DEVICES = (process.env.DEVICES || "bench-01,bench-02,bench-03,bench-04").split(",");

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

const point = (index) => ({
  deviceId: DEVICES[index % DEVICES.length],
  deviceType: "temperature",
  location: "Benchmark rig",
  temperature: Number((60 + Math.random() * 40).toFixed(2)),
});

async function main() {
  const total = RATE * DURATION;
  const latencies = [];
  let sent = 0;
  let failures = 0;
  const startedAt = Date.now();

  console.log(`Target: ${RATE} writes/sec for ${DURATION}s (${total} points, batches of ${BATCH})\n`);

  while (sent < total) {
    const size = Math.min(BATCH, total - sent);
    const body = JSON.stringify(Array.from({ length: size }, (_, i) => point(sent + i)));

    const t0 = process.hrtime.bigint();
    const response = await fetch(`${BASE}/api/telemetry/batch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    latencies.push(ms);

    if (!response.ok) {
      failures += 1;
      const text = await response.text();
      console.error(`  batch rejected ${response.status}: ${text.slice(0, 120)}`);
      if (failures > 3) throw new Error("too many rejected batches, stopping");
    } else {
      await response.text();
    }

    sent += size;
    process.stdout.write(`\r  sent ${sent}/${total}`);
  }

  const seconds = (Date.now() - startedAt) / 1000;

  console.log("\n\n--- ingestion benchmark ---");
  console.log(`points sent     : ${sent}`);
  console.log(`elapsed         : ${seconds.toFixed(2)} s`);
  console.log(`achieved        : ${Math.round(sent / seconds)} writes/sec`);
  console.log(`target          : ${RATE} writes/sec`);
  console.log(`batch latency   : p50 ${percentile(latencies, 50).toFixed(1)} ms | p95 ${percentile(latencies, 95).toFixed(1)} ms`);
  console.log(`rejected batches: ${failures}`);
  console.log(`\nStorage: run  db.telemetry.stats()  in mongosh to record size vs storageSize.`);

  if (sent / seconds < RATE) {
    console.log(`\nResult: below target (${Math.round(sent / seconds)} of ${RATE} writes/sec).`);
    process.exitCode = 1;
  } else {
    console.log(`\nResult: target met.`);
  }
}

main().catch((error) => {
  console.error(`\nBenchmark could not run: ${error.message}`);
  console.error(`Is the server running at ${BASE}?`);
  process.exitCode = 1;
});
