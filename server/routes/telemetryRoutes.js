
const express = require("express");
const router = express.Router();

const { receiveTelemetry } = require("../controllers/telemetryController");

router.post("/ingest", receiveTelemetry);

module.exports = router