
const express = require("express");
const cors = require("cors");

const compilerRoutes = require("./routes/compilerRoutes");
const pipelineRoutes = require("./routes/pipelineRoutes");
// Telemetry ingestion lives in the flat server/ tree. Mounting it here is the
// minimal fix for "the ingest endpoint 404s on the running app"; the follow-up is
// to move the controller under src/ and delete the duplicate entry point.
const telemetryRoutes = require("../routes/telemetryRoutes");

const app = express();

// Middleware
// Vite prints both loopback spellings; the browser sends whichever one is in the
// address bar, so both have to be allowed.
const allowedOrigins = (
  process.env.CLIENT_ORIGIN ||
  "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));

app.use(express.json());

// Telemetry ingestion
app.use("/api/telemetry", telemetryRoutes);

// Compiler API
app.use("/api/compiler", compilerRoutes);

// Pipeline Management API
app.use("/api/pipelines", pipelineRoutes);

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "NexusFlow Backend is running",
    project: "NexusFlow",
    version: "1.0.0",
  });
});

// API health route. Reports degraded (503) when Mongo is not connected, so a
// monitor can actually use it.
const CONNECTION_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

app.get("/api/health", (req, res) => {
  const mongoose = require("mongoose");
  const state = mongoose.connection.readyState;
  const healthy = state === 1;

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? "healthy" : "degraded",
    service: "NexusFlow API",
    database: CONNECTION_STATES[state] || "unknown",
  });
});

// Unknown route handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

module.exports = app;
