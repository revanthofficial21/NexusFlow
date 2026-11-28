const express = require("express");
const router = express.Router();

const {
  receiveTelemetry,
  getDeviceSummary,
  getDeviceAnalytics,
} = require("../controllers/telemetryController");

router.post("/ingest", receiveTelemetry);
router.get("/summary", getDeviceSummary);
router.get("/device/:deviceId/analytics", getDeviceAnalytics);

module.exports = router;
