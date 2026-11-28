/**
 * Reads an integer from the environment, without trusting it.
 *
 * `Number(process.env.X || fallback)` looks harmless and is not: a typo in .env
 * yields NaN, and NaN silently disables whatever the number controlled - a batch
 * cap becomes "no cap", a cooldown becomes "no cooldown", a TTL becomes an invalid
 * collection option. A bad value should fall back and say so, not quietly remove a
 * safety limit.
 */
function envInt(name, fallback, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
  const raw = process.env[name];

  if (raw === undefined || raw === "") return fallback;

  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    console.warn(`[env] ${name}="${raw}" is not a number, using ${fallback}`);
    return fallback;
  }

  const clamped = Math.min(Math.max(Math.trunc(parsed), min), max);

  if (clamped !== Math.trunc(parsed)) {
    console.warn(`[env] ${name}=${parsed} is outside ${min}..${max}, using ${clamped}`);
  }

  return clamped;
}

module.exports = { envInt };
