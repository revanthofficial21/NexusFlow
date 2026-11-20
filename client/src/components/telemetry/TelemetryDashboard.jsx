
import { useEffect, useState } from "react";
import "./TelemetryDashboard.css";

const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

function TelemetryDashboard() {
  const [record, setRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const fetchTelemetry = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/telemetry/latest?deviceId=Turbine-Sensor-01&limit=8`
        );

        if (!response.ok) {
          throw new Error("Unable to fetch telemetry");
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "Telemetry request failed");
        }

        if (!active) return;

        const records = [...data.records].reverse();

        setRecord(records[records.length - 1] || null);

        setHistory(
          records
            .map((item) => item.readings?.temperature)
            .filter((value) => Number.isFinite(value))
        );

        setLastUpdated(new Date());
        setError("");
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchTelemetry();

    const interval = setInterval(fetchTelemetry, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const temperature = record?.readings?.temperature;
  const humidity = record?.readings?.humidity;
  const pressure = record?.readings?.pressure;
  const deviceOnline =
  record?.timestamp &&
  Date.now() - new Date(record.timestamp).getTime() <= 60000;

  const readings = [
    {
      name: "Temperature",
      value: temperature ?? "--",
      unit: "°C",
      icon: "🌡️",
      color: "#f97316",
    },
    {
      name: "Humidity",
      value: humidity ?? "--",
      unit: "%",
      icon: "💧",
      color: "#38bdf8",
    },
    {
      name: "Pressure",
      value: pressure ?? "--",
      unit: "kPa",
      icon: "⚙️",
      color: "#a78bfa",
    },
  ];

  return (
    <div className="telemetry-dashboard">
      <div className="telemetry-heading">
        <div>
          <h1>Live Telemetry</h1>
          <p>Monitor your IoT sensor readings in real time.</p>
        </div>
        <span className="live-indicator">● LIVE</span>
      </div>

      {loading && <p>Loading sensor readings...</p>}
      {error && <p className="telemetry-error">{error}</p>}

      <div className="telemetry-cards">
        {readings.map((item) => (
          <div className="telemetry-card" key={item.name}>
            <span className="telemetry-icon">{item.icon}</span>
            <p>{item.name}</p>
            <h2 style={{ color: item.color }}>
              {item.value} <small>{item.unit}</small>
            </h2>
            <span className="telemetry-subtitle">
              {item.value === "--"
                ? "No sensor data available"
                : "MongoDB sensor reading"}
            </span>
          </div>
        ))}
      </div>

      <div className="telemetry-chart-card">
        <div className="telemetry-chart-heading">
          <div>
            <h2>Sensor Activity</h2>
            <p>Recent temperature readings</p>
          </div>
          <span>
            Last updated:{" "}
            {lastUpdated ? lastUpdated.toLocaleTimeString() : "--"}
          </span>
        </div>

        <div className="telemetry-bars">
          {history.length > 0 ? (
            history.map((value, index) => (
              <div className="telemetry-bar-column" key={index}>
                <span>{value}</span>
                <div
                  className="telemetry-bar"
                  style={{
                    height: `${Math.max(5, Math.min(value, 100))}%`,
                  }}
                />
                <small>{index + 1}</small>
              </div>
            ))
          ) : (
            <p>No temperature history available.</p>
          )}
        </div>
      </div>

      <div className="telemetry-device-card">
        <h2>Device Status</h2>
        <div className="telemetry-device-row">
          <div>
            <strong>Turbine Sensor - 01</strong>
            <p>Industrial temperature monitoring</p>
            <p>
              {record?.metadata?.location || "Waiting for sensor data"}
            </p>
          </div>
          <span className={deviceOnline ? "device-online" : "device-offline"}>
  {deviceOnline ? "● Online" : "● Offline"}
</span>
        </div>
      </div>
    </div>
  );
}

export default TelemetryDashboard;
