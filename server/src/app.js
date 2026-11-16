const express = require("express");
const cors = require("cors");

const compilerRoutes = require("./routes/compilerRoutes");
const pipelineRoutes = require("./routes/pipelineRoutes");
const telemetryRoutes = require("../routes/telemetryRoutes");

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/api/compiler", compilerRoutes);
app.use("/api/pipelines", pipelineRoutes);
app.use("/api/telemetry", telemetryRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "NexusFlow Backend is running",
    project: "NexusFlow",
    version: "1.0.0",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    service: "NexusFlow API",
    database: "MongoDB Atlas",
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

module.exports = app;
