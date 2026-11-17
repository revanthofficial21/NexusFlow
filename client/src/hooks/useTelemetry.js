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
  const [points, setPoints] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setPoints([]);

    if (!deviceId) return undefined;

    const socket = io(BASE_URL, { transports: ["websocket"] });

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("subscribe:device", { deviceId });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("telemetry", (event) => {
      if (event?.deviceId !== deviceId) return;

      setPoints((previous) => [
        ...previous.slice(-MAX_POINTS + 1),
        {
          time: new Date(event.timestamp).toLocaleTimeString(),
          value: event.value,
        },
      ]);
    });

    return () => socket.disconnect();
  }, [deviceId]);

  return { points, connected };
}
