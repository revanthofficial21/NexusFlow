const express = require("express");
const router = express.Router();

const {
  receiveTelemetry,
  getLatestTelemetry,
  getTelemetryStats
} = require("../controllers/telemetryController");

router.post("/ingest", receiveTelemetry);
router.get("/latest", getLatestTelemetry);
router.get("/stats", getTelemetryStats);

module.exports = router;
