import axios from "axios";
import logger from "../lib/logger";

export function normalizeError(error) {
  const response = error.response;
  const data = response?.data;
  const requestId =
    data?.request_id || response?.headers?.["x-request-id"] || null;
  const message = data?.detail || error.message || "Unexpected error";
  return {
    message,
    requestId,
    status: response?.status ?? null,
    original: error,
  };
}

const http = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "",
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const norm = normalizeError(error);
    logger.error("api_error", norm.message, norm.requestId);
    return Promise.reject(norm);
  }
);

export default http;
