/**
 * Per-rule alert throttle.
 *
 * Without it a rule fires on every matching point, so a 5,000 writes/sec stream
 * above the threshold writes 5,000 alert documents per second and floods the
 * socket. The throttle allows one alert per rule per cooldown window and counts
 * what it suppressed, so the drop is visible rather than silent.
 */
function createAlertThrottle({ cooldownMs = 30000 } = {}) {
  // null rather than 0: a zero start would suppress the very first alert
  // whenever `now` is small, which is exactly the case in tests.
  let lastAllowedAt = null;
  let suppressed = 0;

  return {
    /** `now` is injectable so the behaviour is testable without timers. */
    allow(now = Date.now()) {
      if (lastAllowedAt !== null && now - lastAllowedAt < cooldownMs) {
        suppressed += 1;
        return false;
      }

      lastAllowedAt = now;
      return true;
    },

    get suppressedCount() {
      return suppressed;
    },

    reset() {
      lastAllowedAt = null;
      suppressed = 0;
    },
  };
}

module.exports = { createAlertThrottle };
