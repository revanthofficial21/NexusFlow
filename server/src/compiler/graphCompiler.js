
const { of } = require("rxjs");
const {
  bufferCount,
  map,
  filter,
  tap,
} = require("rxjs/operators");

const { validateGraph } = require("./validateGraph");

function compileGraph(graph, sensorData$) {
  // Step 1: Validate the graph
  const validation = validateGraph(graph);

  if (!validation.valid) {
    throw new Error(
      `Invalid graph: ${validation.errors.join(", ")}`
    );
  }

  const nodes = graph.nodes;
  const edges = graph.edges;

  // Step 2: Find the starting sensor node
  const sensorNode = nodes.find(
    (node) => node.type === "sensor"
  );

  if (!sensorNode) {
    throw new Error("Graph must contain a sensor node");
  }

  // Step 3: Follow graph connections
  const orderedNodes = [];
  let currentNode = sensorNode;

  while (currentNode) {
    orderedNodes.push(currentNode);

    const outgoing = edges.filter(
      (edge) => edge.source === currentNode.id
    );

    // This compiler executes a single chain. Failing loudly beats silently
    // dropping a branch, which is what the old edges.find() did.
    if (outgoing.length > 1) {
      throw new Error(
        `Node "${currentNode.id}" has ${outgoing.length} outgoing connections; ` +
          "the compiler executes one chain per graph. Remove the extra branch."
      );
    }

    const nextEdge = outgoing[0];

    if (!nextEdge) {
      break;
    }

    const nextNode = nodes.find(
      (node) => node.id === nextEdge.target
    );

    if (!nextNode) {
      break;
    }

    if (orderedNodes.some((node) => node.id === nextNode.id)) {
      throw new Error("Cycle detected in graph");
    }

    currentNode = nextNode;
  }

  // Step 3b: every node has to be part of the chain that starts at the sensor,
  // otherwise it silently does nothing.
  const unreachable = nodes.filter(
    (node) => !orderedNodes.some((ordered) => ordered.id === node.id)
  );

  if (unreachable.length > 0) {
    throw new Error(
      `Graph contains nodes not connected to the sensor chain: ${unreachable
        .map((node) => node.id)
        .join(", ")}`
    );
  }

  // Step 4: Build RxJS operators
  const operators = [];

  for (const node of orderedNodes) {
    const settings = node.data || {};

    switch (node.type) {
      case "sensor": {
        // Sensor values enter through sensorData$
        break;
      }

      case "average": {
        const windowSize = Math.max(
          1,
          Number(settings.windowSize) || 5
        );

        operators.push(
          // startBufferEvery = 1 gives a sliding window. bufferCount also flushes
          // the trailing partial windows when the source completes, and those
          // must be dropped or the average is computed over too few samples.
          bufferCount(windowSize, 1),

          filter((values) => values.length === windowSize),

          // Calculate moving average
          map((values) => {
            const total = values.reduce(
              (sum, value) => sum + Number(value),
              0
            );

            return total / values.length;
          })
        );

        break;
      }

      case "threshold": {
        // null/undefined/"" means "not configured" and falls back to 80. An
        // explicit 0 is a real threshold and is kept.
        const raw = settings.threshold;
        const configured =
          raw === null || raw === undefined || raw === "" ? 80 : Number(raw);

        if (!Number.isFinite(configured)) {
          throw new Error(
            `Threshold value must be a number, received "${raw}"`
          );
        }

        const threshold = configured;
        const operator = settings.operator || "greaterThan";

        // Averages are floats: 20.333333333333332 === 20.333 is false, so exact
        // equality would almost never fire.
        const comparators = {
          greaterThan: (value) => value > threshold,
          lessThan: (value) => value < threshold,
          equal: (value) => Math.abs(value - threshold) < 1e-9,
        };

        const compare = comparators[operator];

        // Validated while compiling: an unknown operator used to throw inside the
        // filter callback, once per value.
        if (!compare) {
          throw new Error(
            `Unsupported threshold operator: ${operator}`
          );
        }

        operators.push(filter((value) => compare(value)));

        break;
      }

      case "alert": {
        operators.push(
          tap((value) => {
            console.log("NEXUSFLOW ALERT:", value);
          })
        );

        break;
      }

      default: {
        throw new Error(
          `Unsupported node type: ${node.type}`
        );
      }
    }
  }

  // Step 5: Connect the input stream
  if (!sensorData$ || typeof sensorData$.subscribe !== "function") {
    throw new Error("A sensorData$ stream is required");
  }

  return sensorData$.pipe(...operators);
}

module.exports = { compileGraph };
