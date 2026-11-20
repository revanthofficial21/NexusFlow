/**
 * Mock SMS provider.
 *
 * The brief asks for a mock SMS service rather than a paid one, so this stands in
 * for Twilio/MSG91 behind a single function. Swapping in a real provider means
 * changing only this file: sendSms keeps the same signature and result shape.
 *
 * SMS_PROVIDER=log  (default) - records the message and succeeds
 * SMS_PROVIDER=fail           - simulates a provider outage, for testing the
 *                               failure path without unplugging anything
 */
const PROVIDER = process.env.SMS_PROVIDER || "log";

const E164 = /^\+?[1-9]\d{6,14}$/;

function isValidPhoneNumber(value) {
  return typeof value === "string" && E164.test(value.replace(/[\s-]/g, ""));
}

async function sendSms({ to, message }) {
  if (!isValidPhoneNumber(to)) {
    return {
      delivered: false,
      provider: PROVIDER,
      error: `"${to}" is not a valid phone number`,
    };
  }

  if (PROVIDER === "fail") {
    return {
      delivered: false,
      provider: PROVIDER,
      error: "provider unavailable",
    };
  }

  // The log provider is the whole implementation: no network, no credentials.
  console.log(`[sms] to ${to}: ${message}`);

  return {
    delivered: true,
    provider: PROVIDER,
    messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

/** Fills {{deviceId}}, {{value}}, {{metric}} and {{time}} in a template. */
function renderTemplate(template, point = {}) {
  return String(template || "Anomaly on {{deviceId}}: {{value}}")
    .replaceAll("{{deviceId}}", point.deviceId ?? "device")
    .replaceAll("{{metric}}", point.metric ?? "reading")
    .replaceAll("{{value}}", point.value === undefined ? "" : String(point.value))
    .replaceAll("{{time}}", new Date().toISOString());
}

module.exports = { sendSms, renderTemplate, isValidPhoneNumber };
