const express = require("express");

const { listAlerts, acknowledgeAlert } = require("../controllers/alertController");

const router = express.Router();

router.get("/", listAlerts);
router.patch("/:id/ack", acknowledgeAlert);

module.exports = router;
