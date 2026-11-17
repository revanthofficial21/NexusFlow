import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TTL_MS = 1200;

/**
 * Which connections are carrying data right now.
 *
 * The server rate-limits these events (EDGE_ACTIVITY_INTERVAL_MS), so this keeps
 * a timestamp per edge and expires it after TTL_MS - that is what makes a wire
 * light up and fade instead of staying lit forever.
 */
export function useEdgeActivity({ ttlMs = TTL_MS } = {}) {
  const [activeEdges, setActiveEdges] = useState({});

  useEffect(() => {
    const socket = io(BASE_URL, { transports: ["websocket"] });

    socket.on("edge:activity", (event) => {
      if (!event?.edgeId) return;
      setActiveEdges((previous) => ({ ...previous, [event.edgeId]: Date.now() }));
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const cutoff = Date.now() - ttlMs;

      setActiveEdges((previous) => {
        const next = {};
        let changed = false;

        for (const [edgeId, at] of Object.entries(previous)) {
          if (at >= cutoff) next[edgeId] = at;
          else changed = true;
        }

        return changed ? next : previous;
      });
    }, 400);

    return () => clearInterval(timer);
  }, [ttlMs]);

  return { activeEdges };
}
