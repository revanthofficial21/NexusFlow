const express = require("express");
const router = express.Router();

const {
  receiveTelemetry,
  getDeviceSummary,
} = require("../controllers/telemetryController");

router.post("/ingest", receiveTelemetry);
router.get("/summary", getDeviceSummary);

module.exports = router;
