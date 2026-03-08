import axios from "axios";
// Removed unused Platform import

// Configuration for local testing
const getBaseUrl = () => {
  // Use host machine's IP because the app is running on a physical Android device
  return "http://121.155.230.160:8000/api/v1";
};

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;
