import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const MAX_ALERTS = 20;

/**
 * Alert history plus live pushes.
 *
 * `acknowledged` filters the history query ("true" / "false" / undefined for all).
 * Live alerts are appended regardless of the filter - a new match is never
 * unacknowledged, so it always belongs in view.
 */
export function useAlerts({ deviceId, acknowledged } = {}) {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(MAX_ALERTS) });

    if (acknowledged) params.set("acknowledged", acknowledged);

    try {
      const response = await fetch(`${BASE_URL}/api/alerts?${params}`);

      if (!response.ok) return;

      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch {
      // History is a nicety; the live socket is what matters.
    }
  }, [acknowledged]);

  // State is set only after the await, never synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;

    const fetchHistory = async () => {
      const params = new URLSearchParams({ limit: String(MAX_ALERTS) });

      if (acknowledged) params.set("acknowledged", acknowledged);

      try {
        const response = await fetch(`${BASE_URL}/api/alerts?${params}`);

        if (cancelled || !response.ok) return;

        const data = await response.json();

        if (!cancelled) setAlerts(data.alerts || []);
      } catch {
        // History is a nicety; the live socket is what matters.
      }
    };

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [acknowledged]);

  useEffect(() => {
    const socket = io(BASE_URL, { transports: ["websocket"] });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("alert", (alert) => {
      // A new alert is unacknowledged, so it does not belong in an
      // "acknowledged only" view.
      if (acknowledged === "true") return;

      setAlerts((previous) => [alert, ...previous].slice(0, MAX_ALERTS));
    });

    if (deviceId) socket.emit("subscribe:device", { deviceId });

    return () => socket.disconnect();
  }, [deviceId, acknowledged]);

  /** Marks one alert acknowledged on the server, then locally. */
  const acknowledge = useCallback(
    async (alert) => {
      const id = alert._id || alert.id;

      if (!id) return;

      try {
        const response = await fetch(`${BASE_URL}/api/alerts/${id}/ack`, {
          method: "PATCH",
        });

        if (!response.ok) return;

        setAlerts((previous) => {
          // Under the "unacknowledged" filter the row no longer belongs in view.
          if (acknowledged === "false") {
            return previous.filter((item) => (item._id || item.id) !== id);
          }

          return previous.map((item) =>
            (item._id || item.id) === id ? { ...item, acknowledged: true } : item
          );
        });
      } catch {
        // Leave the row as it was; the next refresh will correct it.
      }
    },
    [acknowledged]
  );

  return { alerts, connected, acknowledge, refresh: load };
}
