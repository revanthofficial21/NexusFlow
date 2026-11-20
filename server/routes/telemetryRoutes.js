const express = require("express");
const router = express.Router();

const {
  receiveTelemetry,
  getLatestTelemetry,
  getTelemetryStats,
  bulkReceiveTelemetry
} = require("../controllers/telemetryController");

router.post("/ingest", receiveTelemetry);
router.post("/bulk", bulkReceiveTelemetry);
router.get("/latest", getLatestTelemetry);
router.get("/stats", getTelemetryStats);

module.exports = router;


