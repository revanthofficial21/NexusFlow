
import axios from "axios";

const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const API_URL = `${API_BASE}/api/compiler`;

// Execute a visual graph through the backend
export const executeGraph = async (nodes, edges, sensorData) => {
  try {
    const response = await axios.post(
      `${API_URL}/execute`,
      {
        graph: {
          nodes,
          edges,
        },
        sensorData,
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "NexusFlow compiler API error:",
      error.response?.data || error.message
    );

    throw error;
  }
};
