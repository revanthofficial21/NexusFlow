/**
 * Mock sensor generator - the piece that makes the demo move.
 *
 *   node scripts/generateTelemetry.js
 *   RATE=20 DEVICE=pump-07 node scripts/generateTelemetry.js
 *
 * Posts readings to /api/telemetry/batch on a timer, so the chart, the devices
 * view, the stats and any compiled rule all have live data. The temperature is a
 * slow sine wave with an occasional spike: steady enough to look like a sensor,
 * spiky enough to trip a threshold rule every so often.
 *
 *   RATE      readings per second      (default 5)
 *   DEVICE    device id                (default turbine-01)
 *   DURATION  seconds, 0 = until Ctrl+C (default 0)
 *   SPIKE     chance per reading, 0-1  (default 0.02)
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

const RATE = Math.max(Number(process.env.RATE) || 5, 1);
const DEVICE = process.env.DEVICE || "turbine-01";
const DURATION = Number(process.env.DURATION) || 0;
const SPIKE = process.env.SPIKE === undefined ? 0.02 : Number(process.env.SPIKE);
const BATCH_SIZE = Math.max(Number(process.env.BATCH) || Math.ceil(RATE / 2), 1);

const started = Date.now();
let sent = 0;
let phase = 0;
let failures = 0;

/** Slow wave, plus a spike now and then. */
function nextReading() {
  phase += 0.12;

  const base = 72 + Math.sin(phase) * 9;
  const noise = (Math.random() - 0.5) * 1.5;
  const spike = Math.random() < SPIKE ? 12 + Math.random() * 10 : 0;
  const temperature = Number((base + noise + spike).toFixed(2));

  return {
    deviceId: DEVICE,
    deviceType: "temperature",
    location: process.env.LOCATION || "Plant A",
    temperature,
    humidity: Number((48 + Math.sin(phase / 3) * 6).toFixed(1)),
    pressure: Number((101.3 + Math.cos(phase / 4) * 0.8).toFixed(2)),
  };
}

async function flush() {
  const points = Array.from({ length: BATCH_SIZE }, nextReading);

  try {
    const response = await fetch(`${BASE_URL}/api/telemetry/batch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(points),
    });

    if (!response.ok) {
      const text = await response.text();
      failures += 1;
      console.error(`batch rejected (${response.status}): ${text.slice(0, 120)}`);
      return;
    }

    sent += points.length;
    process.stdout.write(
      `\r${DEVICE}: ${sent} readings sent, last ${points.at(-1).temperature}°C   `
    );
  } catch (error) {
    failures += 1;
    console.error(`\nbatch failed: ${error.message} - is the server running at ${BASE_URL}?`);
  }
}

console.log(
  `Generating ${RATE}/sec for ${DEVICE} to ${BASE_URL} ` +
    `(batches of ${BATCH_SIZE}${DURATION ? `, ${DURATION}s` : ", until Ctrl+C"})`
);

const timer = setInterval(flush, Math.round(1000 / Math.max(RATE / BATCH_SIZE, 1)));

const stop = () => {
  clearInterval(timer);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\nStopped after ${seconds}s: ${sent} readings sent, ${failures} failed batch(es).`);
  process.exit(failures > 0 && sent === 0 ? 1 : 0);
};

process.on("SIGINT", stop);

if (DURATION > 0) {
  setTimeout(stop, DURATION * 1000);
}
