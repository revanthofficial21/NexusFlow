/**
 * Mongoose signals "I cannot reach the database" in a few different ways
 * depending on whether it is buffering, selecting a server, or already given up.
 * Controllers use this to answer 503 instead of a generic 500.
 */
const UNAVAILABLE_PATTERNS =
  /Client must be connected|before initial connection is complete|buffering timed out|server selection|topology is closed|connection .* closed|bufferCommands/i;

function isDatabaseUnavailable(error) {
  if (!error) return false;

  if (
    error.name === "MongooseServerSelectionError" ||
    error.name === "MongoNetworkError" ||
    error.name === "MongoNotConnectedError"
  ) {
    return true;
  }

  return UNAVAILABLE_PATTERNS.test(String(error.message || ""));
}

function respondDatabaseUnavailable(res) {
  return res.status(503).json({
    success: false,
    message: "Database unavailable",
  });
}

module.exports = { isDatabaseUnavailable, respondDatabaseUnavailable };
