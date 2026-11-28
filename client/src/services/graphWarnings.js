/**
 * Which nodes would fail validation, and why.
 *
 * The server rejects a graph for these reasons, but the canvas let you draw one and
 * find out only on save. Checking the same rules here means a broken wire is visible
 * while you build it.
 *
 * Kept apart from the canvas component so it can be tested without React.
 */
const ACTIONS = new Set(["alert", "sms", "webhook"]);

export function findNodeWarnings(nodes = [], edges = []) {
  const warnings = {};
  const incoming = new Set(edges.map((edge) => edge.target));
  const outgoing = new Set(edges.map((edge) => edge.source));

  for (const node of nodes) {
    const { id, type, data } = node;

    if (type === "sensor") {
      if (!outgoing.has(id)) warnings[id] = "Connect this source to a node";
      continue;
    }

    if (!incoming.has(id)) {
      warnings[id] = "This node needs an input connection";
      continue;
    }

    if (ACTIONS.has(type) && outgoing.has(id)) {
      warnings[id] = "Action nodes cannot have an output";
      continue;
    }

    if (type === "threshold") {
      const value = Number(data?.threshold);
      if (!Number.isFinite(value)) warnings[id] = "Set a threshold value";
    }

    if (type === "average") {
      const window = Number(data?.windowSize);
      if (!Number.isFinite(window) || window < 1 || window > 1000) {
        warnings[id] = "Window size must be between 1 and 1000";
      }
    }

    if (type === "webhook") {
      const url = String(data?.url || "");
      if (!/^https?:\/\//i.test(url)) {
        warnings[id] = "URL must start with http:// or https://";
      }
    }

    if (type === "sms") {
      const to = String(data?.to || "");
      if (to.replace(/[^0-9]/g, "").length < 8) {
        warnings[id] = "Phone number looks too short";
      }
    }
  }

  return warnings;
}
