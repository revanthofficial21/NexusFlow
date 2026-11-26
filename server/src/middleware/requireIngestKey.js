const { timingSafeEqual } = require("node:crypto");

/**
 * Guards the telemetry write path with a shared key.
 *
 * The ingest endpoints are how hardware (or a generator) writes into the
 * time-series collection, and they were open to anyone who could reach the port.
 * With INGEST_API_KEY set, a request must carry a matching x-api-key header.
 *
 * Unset means no key is required, so a local demo keeps working out of the box -
 * but the server says so at boot, because that is the wrong default for anything
 * reachable from outside your machine.
 */
function requireIngestKey(req, res, next) {
  const expected = process.env.INGEST_API_KEY;

  if (!expected) return next();

  const provided = req.get("x-api-key") || "";

  // Constant-time compare on equal-length buffers, so the check cannot be timed.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const matches = a.length === b.length && timingSafeEqual(a, b);

  if (!matches) {
    return res.status(401).json({
      success: false,
      message: "A valid x-api-key header is required to write telemetry",
    });
  }

  return next();
}

module.exports = { requireIngestKey };
