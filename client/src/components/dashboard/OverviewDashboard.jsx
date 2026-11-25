import { useEffect, useState } from "react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Workspace overview: how many rules exist and how many are running, which
 * devices are reporting, how much data has arrived, and what has alerted.
 *
 * Every figure comes from the API. The layout follows Janakirani's dashboard
 * component; her version shipped hardcoded strings ("1 draft pipeline",
 * "Backend: Pending") which would have replaced live numbers with fiction.
 */
function OverviewDashboard({ nodeTypes = [] }) {
  const [pipelines, setPipelines] = useState([]);
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [pipelinesRes, statusRes, statsRes, alertsRes] = await Promise.all([
          fetch(`${BASE_URL}/api/pipelines`),
          fetch(`${BASE_URL}/api/telemetry/device-status`),
          fetch(`${BASE_URL}/api/telemetry/stats`),
          fetch(`${BASE_URL}/api/alerts?limit=5`),
        ]);

        if (cancelled) return;

        const [pipelinesBody, statusBody, statsBody, alertsBody] = await Promise.all([
          pipelinesRes.ok ? pipelinesRes.json() : null,
          statusRes.ok ? statusRes.json() : null,
          statsRes.ok ? statsRes.json() : null,
          alertsRes.ok ? alertsRes.json() : null,
        ]);

        if (cancelled) return;

        setPipelines(pipelinesBody?.pipelines || []);
        setDevices(statusBody?.devices || []);
        setStats(statsBody?.devices || []);
        setAlerts(alertsBody?.alerts || []);
        setError("");
      } catch (cause) {
        if (!cancelled) setError(cause.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    const timer = setInterval(load, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const running = pipelines.filter((pipeline) => pipeline.running).length;
  const paused = pipelines.filter((pipeline) => pipeline.enabled === false).length;
  const online = devices.filter((device) => device.status === "online").length;
  const readings = stats.reduce((total, device) => total + (device.totalReadings || 0), 0);
  const unacknowledged = alerts.filter((alert) => !alert.acknowledged).length;

  const cards = [
    {
      title: "Pipelines",
      value: String(pipelines.length),
      detail: `${running} running, ${paused} paused`,
    },
    {
      title: "Devices",
      value: String(devices.length),
      detail: `${online} online, ${devices.length - online} offline`,
    },
    {
      title: "Readings stored",
      value: readings.toLocaleString(),
      detail: "across all devices",
    },
    {
      title: "Alerts",
      value: String(alerts.length),
      detail: `${unacknowledged} unacknowledged in the last 5`,
    },
  ];

  return (
    <div className="dashboard-page">
      {error && <p className="muted">Some figures are unavailable: {error}</p>}

      {loading ? (
        <p className="muted">Loading overview…</p>
      ) : (
        <>
          <div className="dashboard-cards">
            {cards.map((card) => (
              <div className="dashboard-card" key={card.title}>
                <p className="dashboard-card-title">{card.title}</p>
                <h2>{card.value}</h2>
                <p className="dashboard-card-description">{card.detail}</p>
              </div>
            ))}
          </div>

          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <h2>Recent pipelines</h2>
              <span className="muted">{pipelines.length} saved</span>
            </div>

            {pipelines.length === 0 ? (
              <p className="muted">No pipelines saved yet.</p>
            ) : (
              <ul className="dashboard-list">
                {pipelines.slice(0, 5).map((pipeline) => (
                  <li key={pipeline._id}>
                    <div>
                      <strong>{pipeline.name}</strong>
                      <p className="muted">{pipeline.description || "No description"}</p>
                    </div>
                    <span
                      className={
                        pipeline.enabled === false
                          ? "dashboard-status paused"
                          : "dashboard-status running"
                      }
                    >
                      {pipeline.enabled === false ? "Paused" : "Running"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dashboard-section">
            <h2>Node library</h2>
            <p className="dashboard-section-description">
              The building blocks available on the canvas.
            </p>

            <div className="node-library-grid">
              {nodeTypes.map((node) => (
                <div className="node-library-item" key={node.type}>
                  <span className="node-library-dot" style={{ background: node.color }} />
                  {node.name}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default OverviewDashboard;
