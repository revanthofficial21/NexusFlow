import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const MAX_POINTS = 60;

/**
 * Live readings for one device.
 *
 * The server broadcasts each stored point into a `device:<id>` room, so the hook
 * joins that room on connect and keeps the last 60 points for the chart. The
 * device filter is repeated client-side as a guard against a stale room.
 */
export function useTelemetry({ deviceId } = {}) {
  // The device id travels with the buffer, so switching devices shows an empty
  // chart without a setState in the effect body (which causes cascading renders).
  const [buffer, setBuffer] = useState({ deviceId: null, points: [] });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!deviceId) return undefined;

    const socket = io(BASE_URL, { transports: ["websocket"] });

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("subscribe:device", { deviceId });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("telemetry", (event) => {
      if (event?.deviceId !== deviceId) return;

      const point = {
        time: new Date(event.timestamp).toLocaleTimeString(),
        value: event.value,
      };

      setBuffer((previous) =>
        previous.deviceId === deviceId
          ? { deviceId, points: [...previous.points.slice(-MAX_POINTS + 1), point] }
          : { deviceId, points: [point] }
      );
    });

    return () => socket.disconnect();
  }, [deviceId]);

  const points = buffer.deviceId === deviceId ? buffer.points : [];

  return { points, connected };
}
