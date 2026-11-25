/**
 * Creates the demo rule the README and the screenshots use, through the API.
 *
 *   node scripts/seedDemo.js
 *
 * Turbine sensor -> moving average (3) -> threshold (> 85) -> SMS alert.
 * Run generateTelemetry.js afterwards and it starts firing.
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const DEVICE = process.env.DEVICE || "turbine-01";

const pipeline = {
  name: "Turbine Temperature Monitoring",
  description: "Rolling average above 85°C texts the manager",
  nodes: [
    { id: "1", type: "sensor", position: { x: 0, y: 120 }, data: { label: "Turbine Sensor", deviceId: DEVICE } },
    { id: "2", type: "average", position: { x: 260, y: 120 }, data: { label: "Moving Average", windowSize: 3 } },
    { id: "3", type: "threshold", position: { x: 520, y: 120 }, data: { label: "Over 85°C", threshold: 85, operator: "greaterThan" } },
    { id: "4", type: "sms", position: { x: 780, y: 120 }, data: { label: "Manager SMS", to: "+919876543210", template: "Turbine {{deviceId}} at {{value}}°C" } },
  ],
  edges: [
    { id: "e1", source: "1", target: "2", animated: true },
    { id: "e2", source: "2", target: "3", animated: true },
    { id: "e3", source: "3", target: "4", animated: true },
  ],
};

async function main() {
  const existing = await fetch(`${BASE_URL}/api/pipelines`);
  const list = existing.ok ? await existing.json() : { pipelines: [] };
  const already = (list.pipelines || []).find((item) => item.name === pipeline.name);

  if (already) {
    console.log(`"${pipeline.name}" already exists (${already._id}), leaving it alone.`);
    return;
  }

  const response = await fetch(`${BASE_URL}/api/pipelines`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(pipeline),
  });

  const body = await response.json();

  if (!response.ok) {
    console.error(`Could not create the rule (${response.status}): ${body.message}`);
    if (body.errors) console.error(`  ${body.errors.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Created "${pipeline.name}" (${body.pipeline._id}), running: ${body.status?.running ?? "?"}`);
  console.log("Start the generator to see it fire:  node scripts/generateTelemetry.js");
}

main().catch((error) => {
  console.error(`Seeding failed: ${error.message} - is the server running at ${BASE_URL}?`);
  process.exitCode = 1;
});
