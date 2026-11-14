const express = require("express");

const {
  receiveTelemetry,
  receiveTelemetryBatch,
  getLatestTelemetry,
} = require("../controllers/telemetryController");

const router = express.Router();

router.post("/ingest", receiveTelemetry);
router.post("/batch", receiveTelemetryBatch);
router.get("/latest", getLatestTelemetry);

module.exports = router;
