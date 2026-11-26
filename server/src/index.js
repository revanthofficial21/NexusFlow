
require("dotenv").config();

const http = require("node:http");
const mongoose = require("mongoose");

const app = require("./app");
const connectDB = require("./config/db");
const { ensureTelemetryCollection } = require("./config/timeseries");
const Pipeline = require("./models/Pipeline");
const { getRegistry } = require("./streams/ruleRegistry");
const { telemetryStream } = require("./streams/telemetryBus");
const { initSocket } = require("./realtime/socket");
const { AlertService } = require("./services/alertService");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect MongoDB before starting the API
    await connectDB();

    // Creates the time-series collection on first boot; no-op afterwards.
    await ensureTelemetryCollection();

    // Compile every saved rule against the live telemetry bus, so rules survive
    // a restart without being re-saved.
    await getRegistry().bootstrap(Pipeline);

    // Socket.IO needs the raw HTTP server, not the Express app.
    const httpServer = http.createServer(app);
    const realtime = initSocket(httpServer, {
      origin: (process.env.CLIENT_ORIGIN ||
        "http://localhost:5173,http://127.0.0.1:5173")
        .split(",")
        .map((value) => value.trim()),
    });

    const alerts = new AlertService();
    alerts.setBroadcast(realtime.broadcastAlert);

    const registry = getRegistry();
    registry.setAlertHandler((alert) => alerts.record(alert));
    registry.setEdgeHandler((activity) => realtime.broadcastEdgeActivity(activity));

    // Live charts: every stored point goes out to the device's room.
    telemetryStream().subscribe((document) => realtime.broadcastTelemetry(document));

    const server = httpServer.listen(PORT, () => {
      if (!process.env.INGEST_API_KEY) {
        console.log(
          "  ingest: open (set INGEST_API_KEY to require x-api-key on writes)"
        );
      } else {
        console.log("  ingest: x-api-key required");
      }

      console.log(`NexusFlow server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`Socket.IO listening on the same port`);
    });

    // Without this, a restart leaves the Mongo connection and the listening
    // socket open until the process is killed.
    const shutdown = (signal) => {
      console.log(`\n${signal} received, shutting down`);

      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
