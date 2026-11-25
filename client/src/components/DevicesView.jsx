import { useEffect, useState } from "react";
import DevicesPanel from "./DevicesPanel";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const timeAgo = (timestamp) => {
  if (!timestamp) return "never";

  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

/**
 * Devices view: the per-device rollup as cards, plus who is actually reporting.
 * `onSelect` switches the live chart in the rule builder to that device.
 */
export default function DevicesView({ onSelect }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/telemetry/device-status`);

        if (!response.ok) {
          throw new Error(`the API answered ${response.status}`);
        }

        const data = await response.json();

        if (!cancelled) {
          setDevices(data.devices || []);
          setError("");
        }
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

  const online = devices.filter((device) => device.status === "online").length;

  return (
    <div className="dashboard-page">
      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <h2>Reporting devices</h2>
          <span className="muted">
            {devices.length} total, {online} online
          </span>
        </div>

        {loading && <p className="muted">Loading devices…</p>}
        {error && <p className="muted">Device status unavailable: {error}</p>}

        {!loading && !error && devices.length === 0 && (
          <p className="muted">
            No device has sent a reading yet. Ingest one with{" "}
            <code>POST /api/telemetry/ingest</code>.
          </p>
        )}

        {devices.length > 0 && (
          <table className="device-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Type</th>
                <th>Location</th>
                <th>Readings</th>
                <th>Last seen</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device._id}>
                  <td>
                    <button className="link-button" onClick={() => onSelect?.(device._id)}>
                      {device._id}
                    </button>
                  </td>
                  <td>{device.deviceType || "-"}</td>
                  <td>{device.location || "-"}</td>
                  <td>{device.totalReadings ?? 0}</td>
                  <td>{timeAgo(device.lastSeen)}</td>
                  <td>
                    <span
                      className={
                        device.status === "online"
                          ? "dashboard-status running"
                          : "dashboard-status paused"
                      }
                    >
                      {device.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <h2>Device summary</h2>
          <span className="muted">pick one to chart it</span>
        </div>

        <DevicesPanel onSelect={onSelect} />
      </section>
    </div>
  );
}
