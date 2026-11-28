import { useEffect, useState } from "react";
import { useAlerts } from "../hooks/useAlerts";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const when = (timestamp) =>
  timestamp ? new Date(timestamp).toLocaleString() : "-";

/**
 * Alerts view: the full history, filterable by state and by rule, acknowledgeable
 * per row. The sidebar panel shows the newest few; this is the page you work
 * through after an incident.
 */
export default function AlertsView() {
  const [stateFilter, setStateFilter] = useState("");
  const [ruleFilter, setRuleFilter] = useState("");
  const [rules, setRules] = useState([]);

  const { alerts, connected, acknowledge } = useAlerts({
    acknowledged: stateFilter || undefined,
    ruleId: ruleFilter || undefined,
  });

  // Rule names come from the pipeline list; alerts only carry the id.
  useEffect(() => {
    let cancelled = false;

    fetch(`${BASE_URL}/api/pipelines`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        setRules(data?.pipelines || []);
      })
      .catch(() => {
        // The filter is a convenience; without it the list still works.
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
          <button
            className={stateFilter === "" ? "active" : ""}
            onClick={() => setStateFilter("")}
          >
            All
          </button>
          <button
            className={stateFilter === "false" ? "active" : ""}
            onClick={() => setStateFilter("false")}
          >
            Unacknowledged
          </button>
          <button
            className={stateFilter === "true" ? "active" : ""}
            onClick={() => setStateFilter("true")}
          >
            Acknowledged
          </button>

          <select
            className="rule-filter"
            value={ruleFilter}
            onChange={(event) => setRuleFilter(event.target.value)}
            aria-label="filter by rule"
          >
            <option value="">Every rule</option>
            {rules.map((rule) => (
              <option key={rule._id} value={rule._id}>
                {rule.name}
              </option>
            ))}
          </select>
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
                      <button
                        className="ack-button"
                        onClick={() => acknowledge(alert)}
                      >
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
