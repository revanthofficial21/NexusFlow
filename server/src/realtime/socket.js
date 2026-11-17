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
      if (!deviceId) return;

      io.to(`device:${deviceId}`).emit("telemetry", {
        deviceId,
        metric: "temperature",
        value: document.readings?.temperature ?? null,
        timestamp: document.timestamp,
      });
    },
    broadcastAlert(alert) {
      // Alerts go to everyone: a manager watching one device still needs to know
      // a rule fired elsewhere.
      io.emit("alert", alert);
    },
  };
}

module.exports = { initSocket };
