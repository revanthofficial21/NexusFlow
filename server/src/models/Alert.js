const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    ruleId: { type: String, required: true },
    ruleName: { type: String },
    nodeId: { type: String },
    deviceId: { type: String },
    value: { type: Number },
    message: { type: String, required: true },
    level: {
      type: String,
      enum: ["info", "warn", "critical"],
      default: "warn",
    },
    channel: { type: String, default: "socket" },
    acknowledged: { type: Boolean, default: false },
    at: { type: Date, default: () => new Date(), required: true },
  },
  { versionKey: false }
);

// The alert feed is always newest-first.
alertSchema.index({ at: -1 });
alertSchema.index({ ruleId: 1, at: -1 });

module.exports = mongoose.model("Alert", alertSchema, "alerts");
