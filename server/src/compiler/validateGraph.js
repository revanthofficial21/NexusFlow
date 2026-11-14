
const SUPPORTED_NODE_TYPES = [
  "sensor",
  "average",
  "threshold",
  "alert",
];

function validateGraph(graph) {
  const errors = [];

  if (!graph || typeof graph !== "object") {
    return {
      valid: false,
      errors: ["Graph must be a valid object"],
    };
  }

  const { nodes, edges } = graph;

  if (!Array.isArray(nodes)) {
    errors.push("Graph nodes must be an array");
  }

  if (!Array.isArray(edges)) {
    errors.push("Graph edges must be an array");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const nodeIds = new Set();

  nodes.forEach((node, index) => {
    if (!node.id) {
      errors.push(`Node at index ${index} is missing an ID`);
      return;
    }

    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node ID: ${node.id}`);
    }

    nodeIds.add(node.id);

    if (!SUPPORTED_NODE_TYPES.includes(node.type)) {
      errors.push(
        `Unsupported node type: ${node.type}`
      );
    }
  });

  edges.forEach((edge, index) => {
    if (!edge.source || !edge.target) {
      errors.push(`Edge at index ${index} needs source and target`);
      return;
    }

    if (!nodeIds.has(edge.source)) {
      errors.push(`Source node not found: ${edge.source}`);
    }

    if (!nodeIds.has(edge.target)) {
      errors.push(`Target node not found: ${edge.target}`);
    }

    if (edge.source === edge.target) {
      errors.push(`Node cannot connect to itself: ${edge.source}`);
    }
  });

  // A cycle is a validation failure, not something the compiler should discover
  // halfway through building a pipeline.
  if (errors.length === 0 && hasCycle(nodes, edges)) {
    errors.push("Graph contains a cycle; connections must form a DAG");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function hasCycle(nodes, edges) {
  const outgoing = new Map(nodes.map((node) => [node.id, []]));

  edges.forEach((edge) => {
    if (outgoing.has(edge.source)) {
      outgoing.get(edge.source).push(edge.target);
    }
  });

  const state = new Map(); // undefined = unvisited, 1 = in stack, 2 = done

  const visit = (id) => {
    const current = state.get(id) || 0;
    if (current === 1) return true;
    if (current === 2) return false;

    state.set(id, 1);

    for (const next of outgoing.get(id) || []) {
      if (visit(next)) return true;
    }

    state.set(id, 2);
    return false;
  };

  return nodes.some((node) => visit(node.id));
}

module.exports = { validateGraph };
