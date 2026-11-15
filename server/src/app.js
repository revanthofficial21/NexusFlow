
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const compilerRoutes = require("./routes/compilerRoutes");
const pipelineRoutes = require("./routes/pipelineRoutes");
const telemetryRoutes = require("./routes/telemetryRoutes");

// Applies to every model, including when the app is mounted without a database
// (tests). Set here rather than only on connect(), because a model created before
// the connection exists would otherwise fall back to the 10s buffer timeout.
mongoose.set("bufferCommands", false);

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

// Batch telemetry bodies exceed the 100kb default.
app.use(express.json({ limit: "5mb" }));

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

/**
 * JSON error handler. Must be registered last and take four arguments.
 *
 * Without this, a malformed request body was answered by Express's default
 * handler with an HTML page containing a stack trace - unparseable for the client
 * and a leak of internal paths.
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({
      success: false,
      message: "Malformed JSON body",
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request body too large",
    });
  }

  console.error("Unhandled error:", err.message);

  const status = err.status || err.statusCode || 500;

  return res.status(status).json({
    success: false,
    message: status >= 500 ? "Internal server error" : err.message,
  });
});

module.exports = app;
