/**
 * Socket.IO layer: room subscriptions, telemetry routing, alert broadcast.
 * Boots a real HTTP server on an ephemeral port and talks to it as a client.
 */
const assert = require("node:assert");
const http = require("node:http");
const { io } = require("socket.io-client");
const { initSocket } = require("../src/realtime/socket");

const point = (deviceId, temperature) => ({
  timestamp: new Date().toISOString(),
  metadata: { deviceId, deviceType: "temperature" },
  readings: { temperature },
});

const waitFor = (socket, event, timeoutMs = 2000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

async function main() {
  const server = http.createServer();
  const realtime = initSocket(server, { origin: "*" });

  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  const client = io(url, { transports: ["websocket"] });
  await waitFor(client, "connect");
  console.log("Test 1 passed: a client connects to the socket server");

  // 1. Telemetry goes only to subscribers of that device's room.
  client.emit("subscribe:device", { deviceId: "turbine-01" });
  await new Promise((resolve) => setTimeout(resolve, 50));

  const received = waitFor(client, "telemetry");
  realtime.broadcastTelemetry(point("turbine-01", 92.5));
  const event = await received;

  assert.strictEqual(event.deviceId, "turbine-01");
  assert.strictEqual(event.value, 92.5);
  console.log("Test 2 passed: subscribed device receives its telemetry");

  // 2. A different device's point is not delivered to this room.
  let leaked = false;
  const onAny = (payload) => {
    if (payload?.deviceId === "pump-07") leaked = true;
  };
  client.on("telemetry", onAny);
  realtime.broadcastTelemetry(point("pump-07", 12));
  await new Promise((resolve) => setTimeout(resolve, 100));
  client.off("telemetry", onAny);

  assert.strictEqual(leaked, false);
  console.log("Test 3 passed: another device's telemetry is not delivered");

  // 2b. A humidity-only point has no temperature and must not be broadcast, or
  // the chart gets a null point.
  let nullPoint = false;
  const onNull = (payload) => {
    if (payload?.value === null || payload?.value === undefined) nullPoint = true;
  };
  client.on("telemetry", onNull);
  realtime.broadcastTelemetry({
    timestamp: new Date().toISOString(),
    metadata: { deviceId: "turbine-01", deviceType: "temperature" },
    readings: { temperature: null, humidity: 61 },
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  client.off("telemetry", onNull);

  assert.strictEqual(nullPoint, false);
  console.log("Test 3 passed: a humidity-only point is not broadcast as null");

  // 3. Alerts are broadcast to everyone.
  const alertReceived = waitFor(client, "alert");
  realtime.broadcastAlert({ ruleName: "Turbine overheat", message: "hot", value: 92.5 });
  const alert = await alertReceived;

  assert.strictEqual(alert.ruleName, "Turbine overheat");
  console.log("Test 4 passed: alerts reach the client");

  // 4. Unsubscribing stops delivery.
  client.emit("unsubscribe:device", { deviceId: "turbine-01" });
  await new Promise((resolve) => setTimeout(resolve, 50));

  let afterUnsubscribe = false;
  const onTelemetry = () => {
    afterUnsubscribe = true;
  };
  client.on("telemetry", onTelemetry);
  realtime.broadcastTelemetry(point("turbine-01", 99));
  await new Promise((resolve) => setTimeout(resolve, 100));
  client.off("telemetry", onTelemetry);

  assert.strictEqual(afterUnsubscribe, false);
  console.log("Test 5 passed: unsubscribing stops telemetry delivery");

  client.disconnect();
  realtime.io.close();
  await new Promise((resolve) => server.close(resolve));

  console.log("\nAll socket tests passed!");
}

main().catch((error) => {
  console.error("Socket test failed:", error.message);
  process.exitCode = 1;
});
