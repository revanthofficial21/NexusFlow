const mongoose = require("mongoose");

/**
 * A device people can recognise.
 *
 * Telemetry carries a deviceId and nothing else that is stable: the type and
 * location arrive with each reading, so they are whatever the last payload said.
 * This is the registry that gives a device a name, and the place to correct a
 * location without editing history.
 *
 * deviceId is the key the telemetry uses, so it is the primary key here too.
 */
const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 120,
    },

    name: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    location: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    deviceType: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Device || mongoose.model("Device", deviceSchema);
