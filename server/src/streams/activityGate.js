/**
 * Rate limit for edge activity events.
 *
 * The canvas only needs to know "data is flowing on this wire", not every value
 * that crossed it. Without a gate, a 5,000 writes/sec stream would emit 5,000
 * socket messages per second per edge.
 */
function createActivityGate({ minIntervalMs = 100 } = {}) {
  const lastSentAt = new Map();

  return {
    allow(edgeId, now = Date.now()) {
      const key = String(edgeId);
      const previous = lastSentAt.get(key);

      if (previous !== undefined && now - previous < minIntervalMs) {
        return false;
      }

      lastSentAt.set(key, now);
      return true;
    },

    reset() {
      lastSentAt.clear();
    },

    get size() {
      return lastSentAt.size;
    },
  };
}

module.exports = { createActivityGate };
