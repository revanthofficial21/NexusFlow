import { useEffect, useState } from "react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const format = (value, digits = 1) =>
  typeof value === "number" ? value.toFixed(digits) : "-";

const timeAgo = (timestamp) => {
  if (!timestamp) return "never";

  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

/**
 * Device rollup straight from GET /api/telemetry/stats - reading counts, average
 * and peak temperature, and when each device was last heard from.
 */
export default function DevicesPanel({ onSelect, refreshKey = 0 }) {
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // "last seen 40s ago" needs a re-render to stay true, otherwise it freezes at
  // whatever it said when the list loaded.
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 15000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(`${BASE_URL}/api/telemetry/stats`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        setDevices(data?.devices || []);
        setLoading(false);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(cause.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) return <p className="muted">Loading devices…</p>;

  if (error) return <p className="muted">Device stats unavailable: {error}</p>;

  if (devices.length === 0) {
    return <p className="muted">No devices have reported yet.</p>;
  }

  return (
    <div className="device-grid">
      {devices.map((device) => (
        <button
          key={device._id}
          className="device-card"
          onClick={() => onSelect?.(device._id)}
        >
          <div className="device-card__head">
            <strong>{device._id}</strong>
            <span className="muted">{device.location || "-"}</span>
          </div>

          <div className="device-card__stats">
            <span>
              <em>avg</em> {format(device.avgTemperature)}°
            </span>
            <span>
              <em>max</em> {format(device.maxTemperature)}°
            </span>
            <span>
              <em>readings</em> {device.totalReadings}
            </span>
          </div>

          <small className="muted">last seen {timeAgo(device.latestTimestamp)}</small>
        </button>
      ))}
    </div>
  );
}
