const express = require("express");
const { requireIngestKey } = require("../middleware/requireIngestKey");

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

// Reads stay open; the two write routes are behind the key.
router.post("/ingest", requireIngestKey, receiveTelemetry);
router.post("/batch", requireIngestKey, receiveTelemetryBatch);
router.get("/latest", getLatestTelemetry);
router.get("/stats", getTelemetryStats);

// History and export are read-only views over the same collection.
router.get("/history", getTelemetryHistory);
router.get("/device-status", getDeviceStatus);
router.get("/export", exportTelemetryCSV);

module.exports = router;
