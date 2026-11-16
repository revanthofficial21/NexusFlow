const { Subject } = require("rxjs");

/**
 * The single live telemetry stream.
 *
 * Ingestion publishes here after a point is stored; every compiled rule
 * subscribes to it. One Subject for the whole process means fifty saved rules
 * cost one subscription to the ingest path, not fifty.
 *
 * A module-level singleton rather than injected, because both the controller that
 * publishes and the registry that subscribes need the same instance and neither
 * creates the other.
 */
const telemetrySubject = new Subject();

function publishTelemetry(document) {
  telemetrySubject.next(document);
}

function telemetryStream() {
  return telemetrySubject.asObservable();
}

function subscriberCount() {
  return telemetrySubject.observers.length;
}

module.exports = { publishTelemetry, telemetryStream, subscriberCount };
