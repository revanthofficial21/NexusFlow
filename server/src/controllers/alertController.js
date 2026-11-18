const { AlertService } = require("../services/alertService");
const {
  isDatabaseUnavailable,
  respondDatabaseUnavailable,
} = require("../utils/dbError");

const alerts = new AlertService();

async function listAlerts(req, res) {
  const { limit, ruleId, acknowledged } = req.query;

  // A typo like ?acknowledged=yes would otherwise filter on nothing and quietly
  // return every alert.
  if (acknowledged !== undefined && !["true", "false"].includes(acknowledged)) {
    return res.status(400).json({
      success: false,
      message: 'acknowledged must be "true" or "false"',
    });
  }

  try {
    const records = await alerts.list({ limit, ruleId, acknowledged });

    return res.status(200).json({
      success: true,
      count: records.length,
      alerts: records,
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) return respondDatabaseUnavailable(res);

    console.error("Alert read error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to read alerts",
    });
  }
}

async function acknowledgeAlert(req, res) {
  try {
    const alert = await alerts.acknowledge(req.params.id);

    if (!alert) {
      return res.status(404).json({ success: false, message: "Alert not found" });
    }

    return res.status(200).json({ success: true, alert });
  } catch (error) {
    if (isDatabaseUnavailable(error)) return respondDatabaseUnavailable(res);

    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid alert ID" });
    }

    console.error("Alert update error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update alert",
    });
  }
}

module.exports = { listAlerts, acknowledgeAlert };
