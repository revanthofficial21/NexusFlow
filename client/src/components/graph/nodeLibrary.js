/**
 * The nodes the canvas can create. Lives in its own module so both the canvas
 * and the overview can import it - a component file must only export components
 * for React fast refresh to work.
 */
export const NODE_LIBRARY = [
  {
    type: "sensor",
    name: "Data Source",
    description: "Receive IoT sensor data",
    icon: "🌡️",
    color: "#1d4ed8",
  },
  {
    type: "average",
    name: "Moving Average",
    description: "Calculate rolling average",
    icon: "📊",
    color: "#7c3aed",
  },
  {
    type: "threshold",
    name: "Threshold",
    description: "Compare sensor values",
    icon: "⚙️",
    color: "#b45309",
  },
  {
    type: "alert",
    name: "SMS Alert",
    description: "Trigger notifications",
    icon: "🚨",
    color: "#be123c",
  },
  {
    type: "webhook",
    name: "Webhook",
    description: "POST the value to a URL",
    icon: "🔗",
    color: "#9333ea",
  },
  {
    type: "sms",
    name: "SMS Alert",
    description: "Text a phone number",
    icon: "📱",
    color: "#047857",
  },
];
