
const express = require("express");
const cors = require("cors");

const compilerRoutes = require("./routes/compilerRoutes");
const pipelineRoutes = require("./routes/pipelineRoutes");

const app = express();

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

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

// API health route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    service: "NexusFlow API",
    database: "MongoDB Atlas",
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
