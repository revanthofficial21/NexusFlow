const { Server } = require("socket.io");

/**
 * Socket.IO layer. Clients subscribe to a device room and receive that device's
 * telemetry plus every alert the rules fire.
 */
function initSocket(httpServer, { origin }) {
  const io = new Server(httpServer, {
    cors: { origin, methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    socket.on("subscribe:device", ({ deviceId } = {}) => {
      if (deviceId) socket.join(`device:${deviceId}`);
    });

    socket.on("unsubscribe:device", ({ deviceId } = {}) => {
      if (deviceId) socket.leave(`device:${deviceId}`);
    });
  });

  return {
    io,
    broadcastTelemetry(document) {
      const deviceId = document?.metadata?.deviceId;
      const temperature = document?.readings?.temperature;

      // Humidity-only points have no temperature. Emitting value: null put a hole
      // in the chart, so they are not broadcast at all.
      if (!deviceId || typeof temperature !== "number") return;

      io.to(`device:${deviceId}`).emit("telemetry", {
        deviceId,
        metric: "temperature",
        value: temperature,
        timestamp: document.timestamp,
      });
    },
    broadcastEdgeActivity(activity) {
      io.emit("edge:activity", activity);
    },
    broadcastAlert(alert) {
      // Alerts go to everyone: a manager watching one device still needs to know
      // a rule fired elsewhere.
      io.emit("alert", alert);
    },
  };
}

module.exports = { initSocket };
