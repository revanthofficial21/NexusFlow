import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Live temperature line for one device. No animation: re-animating on every point
 * makes a fast stream look like it is stuttering.
 */
export default function TelemetryChart({ points, height = 260 }) {
  if (points.length === 0) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        Waiting for telemetry. Ingest a reading for this device to see the line.
      </p>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <CartesianGrid stroke="rgba(148,163,184,0.15)" />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={40} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={44} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              background: "#111a2b",
              border: "1px solid rgba(148,163,184,0.3)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
