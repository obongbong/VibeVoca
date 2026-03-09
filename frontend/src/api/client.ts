import axios from "axios";
// Removed unused Platform import

// Configuration for API
const getBaseUrl = () => {
  // Use environment variable for production, fallback to localhost for development
  const apiHost = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
  return `${apiHost}/api/v1`;
};

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;
