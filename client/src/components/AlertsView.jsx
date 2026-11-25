import { useState } from "react";
import { useAlerts } from "../hooks/useAlerts";

const when = (timestamp) =>
  timestamp ? new Date(timestamp).toLocaleString() : "-";

/**
 * Alerts view: the full history, filterable and acknowledgeable. The sidebar
 * panel shows the newest few; this is the page you work through.
 */
export default function AlertsView() {
  const [filter, setFilter] = useState("");
  const { alerts, connected, acknowledge } = useAlerts({
    acknowledged: filter || undefined,
  });

  return (
    <div className="dashboard-page">
      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <h2>Alert history</h2>
          <span className="muted">
            <span className={connected ? "dot-on" : "dot-off"} /> live
          </span>
        </div>

        <div className="alert-filters">
          <button className={filter === "" ? "active" : ""} onClick={() => setFilter("")}>
            All
          </button>
          <button
            className={filter === "false" ? "active" : ""}
            onClick={() => setFilter("false")}
          >
            Unacknowledged
          </button>
          <button
            className={filter === "true" ? "active" : ""}
            onClick={() => setFilter("true")}
          >
            Acknowledged
          </button>
        </div>

        {alerts.length === 0 ? (
          <p className="muted">No alerts match this filter.</p>
        ) : (
          <table className="device-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Rule</th>
                <th>Message</th>
                <th>Channel</th>
                <th>Value</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert._id || `${alert.ruleId}-${alert.at}`}>
                  <td>{when(alert.at)}</td>
                  <td>{alert.ruleName || "-"}</td>
                  <td>{alert.message}</td>
                  <td>{alert.channel || "socket"}</td>
                  <td>{alert.value ?? "-"}</td>
                  <td>
                    {alert.acknowledged ? (
                      <span className="muted">acknowledged</span>
                    ) : (
                      <button className="ack-button" onClick={() => acknowledge(alert)}>
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
