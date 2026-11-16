
require("dotenv").config();

const mongoose = require("mongoose");

const app = require("./app");
const connectDB = require("./config/db");
const { ensureTelemetryCollection } = require("./config/timeseries");
const Pipeline = require("./models/Pipeline");
const { getRegistry } = require("./streams/ruleRegistry");

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

    const server = app.listen(PORT, () => {
      console.log(`NexusFlow server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
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
