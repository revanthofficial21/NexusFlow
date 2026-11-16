/**
 * React Flow state -> the graph contract the backend validates.
 *
 * Only id, type and the parameters the compiler reads are sent. Positions,
 * `measured`, `selected` and `dragging` are React Flow bookkeeping: they mean
 * nothing to the server and bloat every stored pipeline.
 */
const NODE_FIELDS = {
  sensor: ["deviceId", "label", "value"],
  average: ["windowSize", "label"],
  threshold: ["operator", "threshold", "label", "condition"],
  alert: ["label"],
  webhook: ["url", "method", "label"],
};

export function serializeGraph(nodes = [], edges = []) {
  return {
    nodes: nodes.map((node) => {
      const allowed = NODE_FIELDS[node.type] || ["label"];
      const data = {};

      for (const field of allowed) {
        if (node.data?.[field] !== undefined && node.data[field] !== null) {
          data[field] = node.data[field];
        }
      }

      return { id: node.id, type: node.type, data };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

/** True when the graph has at least one node and one connection. */
export function isSerializable(nodes = [], edges = []) {
  return nodes.length > 0 && edges.length > 0;
}
