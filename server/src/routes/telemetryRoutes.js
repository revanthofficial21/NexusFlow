const express = require("express");

const {
  receiveTelemetry,
  receiveTelemetryBatch,
  getLatestTelemetry,
  getTelemetryStats,
} = require("../controllers/telemetryController");

const router = express.Router();

router.post("/ingest", receiveTelemetry);
router.post("/batch", receiveTelemetryBatch);
router.get("/latest", getLatestTelemetry);
router.get("/stats", getTelemetryStats);

module.exports = router;
