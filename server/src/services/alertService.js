const Alert = require("../models/Alert");

/**
 * Records rule matches and hands them to the socket layer.
 *
 * Unlike telemetry, an alert that is lost is a bug rather than a trade-off, so
 * this uses the default write concern and lets failures surface to the caller.
 */
class AlertService {
  constructor() {
    this.broadcast = () => {};
  }

  /** Wired at boot, once the socket server exists. */
  setBroadcast(broadcast) {
    this.broadcast = broadcast || (() => {});
  }

  async record(alert) {
    const document = await Alert.create({
      ruleId: String(alert.ruleId),
      ruleName: alert.ruleName,
      nodeId: alert.nodeId,
      deviceId: alert.deviceId,
      value: alert.value,
      message: alert.message,
      level: alert.level || "warn",
      channel: alert.channel || "socket",
      at: alert.at || new Date(),
    });

    const plain = document.toObject();
    this.broadcast(plain);

    return plain;
  }

  async list({ limit = 50 } = {}) {
    const requested = Number(limit);
    const capped = Number.isFinite(requested)
      ? Math.min(Math.max(Math.trunc(requested), 1), 500)
      : 50;

    return Alert.find().sort({ at: -1 }).limit(capped).lean();
  }

  async acknowledge(id) {
    return Alert.findByIdAndUpdate(
      id,
      { acknowledged: true },
      { new: true }
    ).lean();
  }
}

module.exports = { AlertService };
