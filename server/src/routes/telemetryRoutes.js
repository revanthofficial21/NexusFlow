const express = require("express");

const {
  receiveTelemetry,
  receiveTelemetryBatch,
  getLatestTelemetry,
  getTelemetryStats,
  getTelemetryHistory,
  getDeviceStatus,
  exportTelemetryCSV,
} = require("../controllers/telemetryController");

const router = express.Router();

router.post("/ingest", receiveTelemetry);
router.post("/batch", receiveTelemetryBatch);
router.get("/latest", getLatestTelemetry);
router.get("/stats", getTelemetryStats);

// History and export are read-only views over the same collection.
router.get("/history", getTelemetryHistory);
router.get("/device-status", getDeviceStatus);
router.get("/export", exportTelemetryCSV);

module.exports = router;
