
import axios from "axios";

const API_URL = "http://localhost:5000/api/pipelines";

// Save a new pipeline
export const savePipeline = async (pipeline) => {
  const response = await axios.post(API_URL, pipeline);
  return response.data;
};

// Get all pipelines
export const getPipelines = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};

// Get one pipeline
export const getPipelineById = async (id) => {
  const response = await axios.get(`${API_URL}/${id}`);
  return response.data;
};

// Update pipeline
export const updatePipeline = async (id, pipeline) => {
  const response = await axios.put(
    `${API_URL}/${id}`,
    pipeline
  );
  return response.data;
};

// Delete pipeline
export const deletePipeline = async (id) => {
  const response = await axios.delete(`${API_URL}/${id}`);
  return response.data;
};
