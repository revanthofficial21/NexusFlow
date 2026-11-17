import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const MAX_ALERTS = 20;

/**
 * Live alerts: history from the API on mount, then every new match pushed over
 * Socket.IO. The socket disconnects on unmount.
 */
export function useAlerts({ deviceId } = {}) {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`${BASE_URL}/api/alerts?limit=${MAX_ALERTS}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.alerts) setAlerts(data.alerts);
      })
      .catch(() => {
        // History is a nicety; the live socket is what matters.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const socket = io(BASE_URL, { transports: ["websocket"] });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("alert", (alert) =>
      setAlerts((previous) => [alert, ...previous].slice(0, MAX_ALERTS))
    );

    if (deviceId) socket.emit("subscribe:device", { deviceId });

    return () => socket.disconnect();
  }, [deviceId]);

  return { alerts, connected };
}
