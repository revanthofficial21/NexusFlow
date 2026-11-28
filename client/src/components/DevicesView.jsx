import { useCallback, useEffect, useState } from "react";
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
 * Devices view: who is reporting, and what they are called.
 *
 * The telemetry only carries a device id, so names come from the registry
 * (GET /api/devices) and are editable here. Renaming writes to the registry, never
 * to history.
 */
export default function DevicesView({ onSelect }) {
  const [devices, setDevices] = useState([]);
  const [registry, setRegistry] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statusRes, registryRes] = await Promise.all([
        fetch(`${BASE_URL}/api/telemetry/device-status`),
        fetch(`${BASE_URL}/api/devices`),
      ]);

      if (!statusRes.ok) {
        throw new Error(`the API answered ${statusRes.status}`);
      }

      const statusBody = await statusRes.json();
      const registryBody = registryRes.ok ? await registryRes.json() : { devices: [] };

      setDevices(statusBody.devices || []);
      setRegistry(
        Object.fromEntries(
          (registryBody.devices || []).map((entry) => [entry.deviceId, entry])
        )
      );
      setError("");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!cancelled) await load();
    };

    run();

    const timer = setInterval(run, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [load]);

  const startEditing = (deviceId) => {
    setEditing(deviceId);
    setDraft(registry[deviceId]?.name || "");
  };

  const saveName = async (deviceId) => {
    setSaving(true);

    try {
      const response = await fetch(
        `${BASE_URL}/api/devices/${encodeURIComponent(deviceId)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: draft }),
        }
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.message || `the API answered ${response.status}`);
      }

      setRegistry((previous) => ({ ...previous, [deviceId]: body.device }));
      setEditing(null);
      setError("");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  };

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
        {error && <p className="muted">Devices unavailable: {error}</p>}

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
                <th />
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                const entry = registry[device._id] || {};

                return (
                  <tr key={device._id}>
                    <td>
                      {editing === device._id ? (
                        <span className="rename-cell">
                          <input
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder="Name this device"
                            aria-label={`name for ${device._id}`}
                            maxLength={120}
                          />
                          <button
                            className="ack-button"
                            disabled={saving}
                            onClick={() => saveName(device._id)}
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button
                            className="link-button"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <>
                          <button
                            className="link-button"
                            onClick={() => onSelect?.(device._id)}
                            title="Chart this device"
                          >
                            {entry.name || device._id}
                          </button>
                          {entry.name && (
                            <p className="muted device-id">{device._id}</p>
                          )}
                        </>
                      )}
                    </td>
                    <td>{entry.deviceType || device.deviceType || "-"}</td>
                    <td>{entry.location || device.location || "-"}</td>
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
                    <td>
                      {editing !== device._id && (
                        <button
                          className="link-button"
                          onClick={() => startEditing(device._id)}
                        >
                          Rename
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
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
