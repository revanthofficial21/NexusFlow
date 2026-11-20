const express = require("express");
const router = express.Router();

const {
  receiveTelemetry,
  getLatestTelemetry,
  getTelemetryStats,
  bulkReceiveTelemetry,
  getTelemetryHistory,
  getDeviceStatus,
  getTelemetryAlerts
} = require("../controllers/telemetryController");

router.post("/ingest", receiveTelemetry);
router.post("/bulk", bulkReceiveTelemetry);
router.get("/latest", getLatestTelemetry);
router.get("/stats", getTelemetryStats);
router.get("/history", getTelemetryHistory);

router.get("/device-status", getDeviceStatus);
router.get("/alerts", getTelemetryAlerts);
module.exports = router;







