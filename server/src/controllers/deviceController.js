const Device = require("../models/Device");
const { isDatabaseUnavailable, respondDatabaseUnavailable } = require("../utils/dbError");

const MAX_NAME = 120;

/** Rejects anything that is not a single, sane string. */
function readText(value, field, { max = MAX_NAME, required = false } = {}) {
  if (value === undefined) return { value: undefined };

  if (typeof value !== "string") {
    return { error: `${field} must be a string` };
  }

  const trimmed = value.trim();

  if (required && trimmed === "") {
    return { error: `${field} cannot be empty` };
  }

  if (trimmed.length > max) {
    return { error: `${field} must be at most ${max} characters` };
  }

  return { value: trimmed };
}

/** GET /api/devices - the registry, newest names first. */
async function listDevices(req, res) {
  try {
    const devices = await Device.find({}).sort({ deviceId: 1 }).lean();

    return res.status(200).json({
      success: true,
      count: devices.length,
      devices,
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) return respondDatabaseUnavailable(res);

    console.error("Device list error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to read devices",
    });
  }
}

/** GET /api/devices/:deviceId */
async function getDevice(req, res) {
  const { deviceId } = req.params;

  try {
    const device = await Device.findOne({ deviceId }).lean();

    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    return res.status(200).json({ success: true, device });
  } catch (error) {
    if (isDatabaseUnavailable(error)) return respondDatabaseUnavailable(res);

    console.error("Device read error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to read the device",
    });
  }
}

/**
 * PUT /api/devices/:deviceId - create or rename.
 *
 * An upsert, because a device that has started reporting should be nameable without
 * a separate create step, and because the id is the only thing the telemetry needs.
 */
async function upsertDevice(req, res) {
  const { deviceId } = req.params;

  if (!deviceId || typeof deviceId !== "string" || deviceId.trim() === "") {
    return res.status(400).json({ success: false, message: "deviceId is required" });
  }

  const body = req.body || {};
  const fields = {};

  for (const [key, options] of Object.entries({
    name: { required: false },
    location: { required: false },
    deviceType: { required: false },
    notes: { max: 500, required: false },
  })) {
    const result = readText(body[key], key, options);

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    if (result.value !== undefined) fields[key] = result.value;
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one of name, location, deviceType or notes",
    });
  }

  try {
    const device = await Device.findOneAndUpdate(
      { deviceId: deviceId.trim() },
      { $set: fields, $setOnInsert: { deviceId: deviceId.trim() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({ success: true, device });
  } catch (error) {
    if (isDatabaseUnavailable(error)) return respondDatabaseUnavailable(res);

    // Two simultaneous PUTs for the same id can both decide to insert, and one loses
    // the unique index. The caller wanted the device to exist with this name, and it
    // does - so answer with it rather than a 500.
    if (error.code === 11000) {
      const existing = await Device.findOne({ deviceId: deviceId.trim() }).lean();

      if (existing) {
        return res.status(200).json({ success: true, device: existing });
      }
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)[0]?.message || "Invalid device",
      });
    }

    console.error("Device update error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update the device",
    });
  }
}

/**
 * DELETE /api/devices/:deviceId - removes the registry entry only.
 *
 * Telemetry is history and is left alone; the retention policy owns that.
 */
async function deleteDevice(req, res) {
  const { deviceId } = req.params;

  try {
    const result = await Device.deleteOne({ deviceId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    return res.status(200).json({ success: true, message: "Device removed from the registry" });
  } catch (error) {
    if (isDatabaseUnavailable(error)) return respondDatabaseUnavailable(res);

    console.error("Device delete error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to remove the device",
    });
  }
}

module.exports = { listDevices, getDevice, upsertDevice, deleteDevice };
