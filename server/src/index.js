
require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const { ensureTelemetryCollection } = require("./config/timeseries");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect MongoDB before starting the API
    await connectDB();

    // Creates the time-series collection on first boot; no-op afterwards.
    await ensureTelemetryCollection();

    app.listen(PORT, () => {
      console.log(`NexusFlow server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
