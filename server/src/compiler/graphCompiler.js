
const { of } = require("rxjs");
const {
  bufferCount,
  map,
  filter,
  tap,
} = require("rxjs/operators");

const { validateGraph } = require("./validateGraph");

const MAX_WINDOW = 1000;
const WEBHOOK_TIMEOUT_MS = 3000;
const WEBHOOK_METHODS = ["POST", "PUT", "PATCH"];

/**
 * Fire-and-forget delivery. A failing webhook must never break the pipeline, so
 * every failure is logged and swallowed.
 */
async function deliverWebhook(url, method, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[webhook] ${url} responded ${response.status}`);
    }
  } catch (error) {
    console.warn(`[webhook] ${url} failed: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Graph problems are the caller's fault, so they carry status 400 and the
 * controller can answer with it directly instead of pattern-matching messages.
 */
function graphError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

/**
 * Validates the graph and resolves the single chain that runs from the sensor to
 * its action node. Shared by compileGraph (which builds the pipeline) and
 * describeGraph (which only reports the plan), so parsing and executing cannot
 * disagree about what a graph means.
 */
function analyseGraph(graph) {
  const validation = validateGraph(graph);

  if (!validation.valid) {
    throw graphError(
      `Invalid graph: ${validation.errors.join(", ")}`
    );
  }

  const nodes = graph.nodes;
  const edges = graph.edges;

  const sensorNode = nodes.find(
    (node) => node.type === "sensor"
  );

  if (!sensorNode) {
    throw graphError("Graph must contain a sensor node");
  }

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
      throw graphError(
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
      throw graphError("Cycle detected in graph");
    }

    currentNode = nextNode;
  }

  // Step 3b: every node has to be part of the chain that starts at the sensor,
  // otherwise it silently does nothing.
  const unreachable = nodes.filter(
    (node) => !orderedNodes.some((ordered) => ordered.id === node.id)
  );

  if (unreachable.length > 0) {
    throw graphError(
      `Graph contains nodes not connected to the sensor chain: ${unreachable
        .map((node) => node.id)
        .join(", ")}`
    );
  }

  return { nodes, edges, sensorNode, orderedNodes };
}

/**
 * Parses a graph without executing it: the same validation and chain resolution
 * compileGraph performs, reported as data. Backs POST /api/compiler/parse, so the
 * mid-project review can show parsing and execution as separate steps.
 */
function describeGraph(graph) {
  const { orderedNodes } = analyseGraph(graph);

  const plan = orderedNodes.map((node) => {
    const settings = node.data || {};

    switch (node.type) {
      case "sensor":
        return { id: node.id, type: node.type, deviceId: settings.deviceId ?? null };

      case "average":
        return { id: node.id, type: node.type, windowSize: settings.windowSize ?? 5 };

      case "threshold":
        return {
          id: node.id,
          type: node.type,
          operator: settings.operator ?? "greaterThan",
          threshold: settings.threshold ?? 80,
        };

      case "webhook":
        return { id: node.id, type: node.type, url: settings.url ?? null, method: settings.method ?? "POST" };

      default:
        return { id: node.id, type: node.type };
    }
  });

  return {
    valid: true,
    nodeCount: plan.length,
    executionOrder: plan.map((step) => step.id),
    plan,
  };
}

function compileGraph(graph, sensorData$) {
  const { orderedNodes } = analyseGraph(graph);

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
        const rawWindow = Number(settings.windowSize);
        const windowSize = Number.isFinite(rawWindow)
          ? Math.trunc(rawWindow)
          : 5;

        // Uncapped, a window of 50,000,000 buffers the whole stream in memory and
        // never emits.
        if (windowSize < 1 || windowSize > MAX_WINDOW) {
          throw graphError(
            `Window size must be between 1 and ${MAX_WINDOW}, received "${settings.windowSize}"`
          );
        }

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
          throw graphError(
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
          throw graphError(
            `Unsupported threshold operator: ${operator}`
          );
        }

        operators.push(filter((value) => compare(value)));

        break;
      }

      case "webhook": {
        const url = String(settings.url || "").trim();

        if (!/^https?:\/\//i.test(url)) {
          throw graphError(
            `Webhook node ${node.id} needs an http(s) URL, received "${settings.url ?? ""}"`
          );
        }

        const method = String(settings.method || "POST").toUpperCase();

        if (!WEBHOOK_METHODS.includes(method)) {
          throw graphError(
            `Webhook method must be one of ${WEBHOOK_METHODS.join(", ")}, received "${settings.method}"`
          );
        }

        // tap, not mergeMap: the stream keeps flowing at sensor speed while the
        // HTTP call happens in the background.
        operators.push(
          tap((value) => {
            void deliverWebhook(url, method, {
              node: node.id,
              value,
              at: new Date().toISOString(),
            });
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
        throw graphError(
          `Unsupported node type: ${node.type}`
        );
      }
    }
  }

  // Step 5: Connect the input stream
  if (!sensorData$ || typeof sensorData$.subscribe !== "function") {
    throw graphError("A sensorData$ stream is required");
  }

  return sensorData$.pipe(...operators);
}

module.exports = { compileGraph, describeGraph, analyseGraph };
