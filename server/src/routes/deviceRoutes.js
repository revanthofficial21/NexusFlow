const express = require("express");
const {
  listDevices,
  getDevice,
  upsertDevice,
  deleteDevice,
} = require("../controllers/deviceController");

const router = express.Router();

router.get("/", listDevices);
router.get("/:deviceId", getDevice);
router.put("/:deviceId", upsertDevice);
router.delete("/:deviceId", deleteDevice);

module.exports = router;
