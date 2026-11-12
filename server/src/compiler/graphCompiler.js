
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

    const nextEdge = edges.find(
      (edge) => edge.source === currentNode.id
    );

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
          bufferCount(windowSize, 1),

          // Ignore incomplete windows
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
        const threshold = Number(settings.threshold ?? 80);
        const operator = settings.operator || "greaterThan";

        operators.push(
          filter((value) => {
            switch (operator) {
              case "greaterThan":
                return value > threshold;

              case "lessThan":
                return value < threshold;

              case "equal":
                return value === threshold;

              default:
                throw new Error(
                  `Unsupported threshold operator: ${operator}`
                );
            }
          })
        );

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
  const source = sensorData$ || of();

  return source.pipe(...operators);
}

module.exports = { compileGraph };
