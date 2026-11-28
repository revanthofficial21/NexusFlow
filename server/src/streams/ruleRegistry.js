const { filter, map } = require("rxjs");
const { compileGraph, analyseGraph } = require("../compiler/graphCompiler");
const { telemetryStream } = require("./telemetryBus");
const { createAlertThrottle } = require("./alertThrottle");
const { createActivityGate } = require("./activityGate");

const { envInt } = require("../config/env");

const ALERT_COOLDOWN_MS = envInt("ALERT_COOLDOWN_MS", 30000, { min: 0, max: 3600000 });
const EDGE_ACTIVITY_INTERVAL_MS = envInt("EDGE_ACTIVITY_INTERVAL_MS", 100, {
  min: 0,
  max: 60000,
});

/**
 * Live pipelines: one subscription per saved rule, fed by the telemetry bus.
 *
 * This is the piece that turns the compiler from a per-request dry run into a
 * running engine. compileGraph itself is unchanged - it receives the bus as its
 * source instead of a fixed array.
 */

/**
 * The readings a rule should see: one device, numeric temperature only.
 * Exported so it can be tested without a database.
 */
function liveSourceFor(bus, deviceId) {
  return bus.asObservable().pipe(
    filter((point) => !deviceId || point?.metadata?.deviceId === deviceId),
    filter((point) => typeof point?.readings?.temperature === "number"),
    map((point) => point.readings.temperature)
  );
}

class RuleRegistry {
  constructor({ bus, logger = console } = {}) {
    this.bus = bus || { asObservable: telemetryStream };
    this.logger = logger;
    this.pipelines = new Map();
    this.alertHandler = null;
    this.edgeHandler = null;
    this.activityGate = createActivityGate({
      minIntervalMs: EDGE_ACTIVITY_INTERVAL_MS,
    });
  }

  /** Wired at boot: persists the alert and broadcasts it. */
  setAlertHandler(handler) {
    this.alertHandler = handler || null;
  }

  /** Wired at boot: pushes edge activity to the canvas. */
  setEdgeHandler(handler) {
    this.edgeHandler = handler || null;
  }

  async handleAlert(alert) {
    if (!this.alertHandler) return;

    const entry = this.pipelines.get(String(alert.ruleId));

    // One alert per rule per cooldown window. Suppressed matches are counted, not
    // silently discarded.
    if (entry && !entry.throttle.allow()) {
      return;
    }

    try {
      await this.alertHandler(alert);
    } catch (error) {
      this.logger.error(`[registry] alert not recorded: ${error.message}`);
    }
  }

  /** Compiles one saved pipeline document, replacing any previous subscription. */
  compile(document) {
    const id = String(document._id || document.id);
    const graph = { nodes: document.nodes || [], edges: document.edges || [] };

    this.stop(id);

    // A paused rule is saved but silent: no subscription, no evaluation.
    if (document.enabled === false) {
      return { id, running: false, enabled: false, reason: "paused" };
    }

    try {
      const { sensorNode } = analyseGraph(graph);
      const deviceId = sensorNode?.data?.deviceId || null;

      const subscription = compileGraph(
        graph,
        liveSourceFor(this.bus, deviceId),
        {
          live: true,
          onAlert: (alert) =>
            this.handleAlert({
              ...alert,
              ruleId: id,
              ruleName: document.name,
              deviceId,
            }),
          onEdgeActivity: (activity) => {
            if (!this.edgeHandler) return;

            // Keyed by rule as well as edge: two graphs both name their wires
            // "e1", and a shared key let one rule silence the other's canvas.
            if (!this.activityGate.allow(`${id}:${activity.edgeId}`)) return;

            this.edgeHandler({ ...activity, ruleId: id });
          },
        }
      ).subscribe({
        error: (error) =>
          this.logger.error(`[registry] pipeline ${id} failed: ${error.message}`),
      });

      this.pipelines.set(id, {
        subscription,
        deviceId,
        name: document.name,
        compiledAt: new Date().toISOString(),
        throttle: createAlertThrottle({ cooldownMs: ALERT_COOLDOWN_MS }),
      });

      this.logger.log(
        `[registry] compiled "${document.name}" (device: ${deviceId || "any"})`
      );

      return this.status(id);
    } catch (error) {
      this.logger.warn(`[registry] ${document.name} not compiled: ${error.message}`);

      return { id, running: false, error: error.message };
    }
  }

  stop(id) {
    const entry = this.pipelines.get(String(id));

    if (!entry) return false;

    entry.subscription.unsubscribe();
    this.pipelines.delete(String(id));

    return true;
  }

  stopAll() {
    for (const id of [...this.pipelines.keys()]) this.stop(id);
  }

  status(id) {
    const entry = this.pipelines.get(String(id));

    if (!entry) return { id: String(id), running: false };

    return {
      id: String(id),
      running: true,
      enabled: true,
      name: entry.name,
      deviceId: entry.deviceId,
      compiledAt: entry.compiledAt,
      suppressedAlerts: entry.throttle.suppressedCount,
      alertCooldownMs: ALERT_COOLDOWN_MS,
    };
  }

  statuses() {
    return [...this.pipelines.keys()].map((id) => this.status(id));
  }

  /** Compiles every stored pipeline. Called once at boot. */
  async bootstrap(Pipeline) {
    const documents = await Pipeline.find().lean();

    const results = documents.map((document) => this.compile(document));
    const running = results.filter((result) => result.running).length;
    const paused = results.filter((result) => result.enabled === false).length;

    this.logger.log(
      `[registry] ${running}/${documents.length} saved pipeline(s) running, ${paused} paused`
    );

    return { total: documents.length, running, paused };
  }
}

let instance = null;

/**
 * The process-wide registry. Controllers compile on save and stop on delete
 * through this, so a saved rule is live without a restart.
 */
function getRegistry() {
  if (!instance) instance = new RuleRegistry();
  return instance;
}

module.exports = { RuleRegistry, liveSourceFor, getRegistry };
