
const { merge } = require("rxjs");
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
 * Kahn topological sort. validateGraph has already rejected cycles, so this only
 * fails if the two ever disagree - which they cannot, since both run on the same
 * edges.
 */
function topologicalOrder(nodes, edges) {
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);
  const order = [];

  while (queue.length > 0) {
    const id = queue.shift();
    order.push(id);

    for (const next of outgoing.get(id) ?? []) {
      const remaining = indegree.get(next) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  if (order.length !== nodes.length) throw graphError("Cycle detected in graph");

  return order;
}

/**
 * Validates the graph and resolves it into an execution plan: topological order
 * plus the incoming/outgoing edges per node. Shared by compileGraph (which builds
 * the pipeline) and describeGraph (which only reports it), so parsing and running
 * cannot disagree about what a graph means.
 *
 * A graph is a DAG, not a chain: one sensor can feed several branches, and a node
 * can combine several inputs.
 */
/**
 * Parameter resolution, shared by describeGraph and compileGraph.
 *
 * These live here rather than inside compileGraph because the parse endpoint used
 * to report a graph as valid - windowSize 50,000, operator "roughly", url
 * "not-a-url" - and then /execute rejected the same graph with a 400. Parsing and
 * executing have to agree on what a node's settings mean.
 */
function resolveWindow(settings = {}) {
  const raw = Number(settings.windowSize);
  const windowSize = Number.isFinite(raw) ? Math.trunc(raw) : 5;

  if (windowSize < 1 || windowSize > MAX_WINDOW) {
    throw graphError(
      `Window size must be between 1 and ${MAX_WINDOW}, received "${settings.windowSize}"`
    );
  }

  return windowSize;
}

function resolveThreshold(settings = {}) {
  const raw = settings.threshold;
  const threshold =
    raw === null || raw === undefined || raw === "" ? 80 : Number(raw);

  if (!Number.isFinite(threshold)) {
    throw graphError(`Threshold value must be a number, received "${raw}"`);
  }

  const operator = settings.operator || "greaterThan";
  const comparators = {
    greaterThan: (value) => value > threshold,
    lessThan: (value) => value < threshold,
    equal: (value) => Math.abs(value - threshold) < 1e-9,
  };

  const compare = comparators[operator];

  if (!compare) {
    throw graphError(`Unsupported threshold operator: ${operator}`);
  }

  return { threshold, operator, compare };
}

function resolveWebhook(settings = {}, nodeId = "?") {
  const url = String(settings.url || "").trim();

  if (!/^https?:\/\//i.test(url)) {
    throw graphError(
      `Webhook node ${nodeId} needs an http(s) URL, received "${settings.url ?? ""}"`
    );
  }

  const method = String(settings.method || "POST").toUpperCase();

  if (!WEBHOOK_METHODS.includes(method)) {
    throw graphError(
      `Webhook method must be one of ${WEBHOOK_METHODS.join(", ")}, received "${settings.method}"`
    );
  }

  return { url, method };
}

function analyseGraph(graph) {
  const validation = validateGraph(graph);

  if (!validation.valid) {
    throw graphError(`Invalid graph: ${validation.errors.join(", ")}`);
  }

  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const sensors = nodes.filter((node) => node.type === "sensor");

  if (sensors.length === 0) {
    throw graphError("Graph must contain a sensor node");
  }

  // Every sensor node reads the same input stream, so two of them silently
  // duplicated every reading (one point in, two alerts out). Reading two devices
  // in one rule is not supported yet, and guessing would be worse than saying so.
  if (sensors.length > 1) {
    throw graphError(
      `Graph must contain exactly one sensor node, found ${sensors.length}: ` +
        sensors.map((node) => node.id).join(", ")
    );
  }

  const order = topologicalOrder(nodes, edges);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map(nodes.map((node) => [node.id, []]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    incoming.get(edge.target)?.push(edge);
    outgoing.get(edge.source)?.push(edge);
  }

  const leaves = order.filter((id) => (outgoing.get(id) ?? []).length === 0);

  return {
    nodes,
    edges,
    order,
    nodeById,
    incoming,
    outgoing,
    leaves,
    sensors,
    sensorNode: sensors[0],
  };
}

/**
 * Parses a graph without executing it: the same validation and plan resolution
 * compileGraph performs, reported as data. Backs POST /api/compiler/parse.
 */
function describeGraph(graph) {
  const { order, nodeById, incoming, outgoing } = analyseGraph(graph);

  const plan = order.map((id) => {
    const node = nodeById.get(id);
    const settings = node.data || {};
    const wiring = {
      id,
      type: node.type,
      inputs: (incoming.get(id) ?? []).map((edge) => edge.source),
      outputs: (outgoing.get(id) ?? []).map((edge) => edge.target),
    };

    switch (node.type) {
      case "sensor":
        return { ...wiring, deviceId: settings.deviceId ?? null };

      case "average":
        return { ...wiring, windowSize: resolveWindow(settings) };

      case "threshold": {
        const { threshold, operator } = resolveThreshold(settings);
        return { ...wiring, operator, threshold };
      }

      case "webhook": {
        const { url, method } = resolveWebhook(settings, node.id);
        return { ...wiring, url, method };
      }

      default:
        return wiring;
    }
  });

  return {
    valid: true,
    nodeCount: plan.length,
    executionOrder: order,
    branches: plan.filter((step) => step.outputs.length > 1).map((step) => step.id),
    plan,
  };
}

/**
 * Builds the pipeline for a graph.
 *
 * Every node becomes an Observable, memoised by id. A node with several outgoing
 * edges is read by several downstream nodes, and each reads it through its own
 * subscription: the input can be a cold `of(...)` (each branch replays it) or the
 * live telemetry bus (a Subject, which multicasts). That is why no share() is
 * used - sharing would make the second branch of a cold source see nothing.
 *
 * Returns the merged stream of the graph's leaves, so callers can still subscribe
 * to "the output of the pipeline" as before.
 */
function compileGraph(graph, sensorData$, options = {}) {
  const analysis = analyseGraph(graph);
  const { nodeById, incoming, outgoing, leaves, order } = analysis;

  const onAlert = typeof options.onAlert === "function" ? options.onAlert : null;
  const onEdgeActivity =
    typeof options.onEdgeActivity === "function" ? options.onEdgeActivity : null;

  if (!sensorData$ || typeof sensorData$.subscribe !== "function") {
    throw graphError("A sensorData$ stream is required");
  }

  const streams = new Map();

  // Several inputs into one node are merged; a single input passes straight
  // through without the extra operator.
  const inputFor = (id) => {
    const upstream = (incoming.get(id) ?? []).map((edge) => streamFor(edge.source));

    if (upstream.length === 0) {
      throw graphError(`Node "${id}" has no input`);
    }

    return upstream.length === 1 ? upstream[0] : merge(...upstream);
  };

  const streamFor = (id) => {
    if (streams.has(id)) return streams.get(id);

    const node = nodeById.get(id);
    const settings = node.data || {};
    let stream;

    switch (node.type) {
      case "sensor":
        stream = sensorData$;
        break;

      case "average": {
        const windowSize = resolveWindow(settings);

        stream = inputFor(id).pipe(
          bufferCount(windowSize, 1),
          // bufferCount also flushes trailing partial windows on completion.
          filter((values) => values.length === windowSize),
          map((values) => {
            const total = values.reduce((sum, value) => sum + Number(value), 0);
            return total / values.length;
          })
        );
        break;
      }

      case "threshold": {
        const { compare } = resolveThreshold(settings);

        stream = inputFor(id).pipe(filter((value) => compare(value)));
        break;
      }

      case "webhook": {
        const { url, method } = resolveWebhook(settings, node.id);

        stream = inputFor(id).pipe(
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

      case "alert":
        stream = inputFor(id).pipe(
          tap((value) => {
            // Reporting is the caller's job: a dry run passes no handler.
            onAlert?.({
              nodeId: node.id,
              value,
              message: settings.label
                ? `${settings.label}: ${value}`
                : `Rule matched: ${value}`,
            });
          })
        );
        break;

      default:
        throw graphError(`Unsupported node type: ${node.type}`);
    }

    // Report every wire leaving this node once a value has passed through it.
    const outgoingEdges = outgoing.get(id) ?? [];

    if (onEdgeActivity && outgoingEdges.length > 0) {
      stream = stream.pipe(
        tap(() => {
          for (const edge of outgoingEdges) {
            onEdgeActivity({ edgeId: edge.id, nodeId: id });
          }
        })
      );
    }

    streams.set(id, stream);
    return stream;
  };

  // Build in dependency order so a bad node fails before anything subscribes.
  order.forEach((id) => streamFor(id));

  const outputs = leaves.map((id) => streams.get(id));
  const pipeline = outputs.length === 1 ? outputs[0] : merge(...outputs);

  pipeline.analysis = analysis;
  return pipeline;
}

module.exports = { compileGraph, describeGraph, analyseGraph };
