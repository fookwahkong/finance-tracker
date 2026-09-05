import axios from "axios";
import logger from "../lib/logger";
import { supabase } from "../lib/supabase";

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
    // Call sites read `err.response.data.detail` to show the server's own
    // message. Dropping `response` here silently replaced every real error
    // ("Amount cannot be zero.", an FX 502) with each catch block's generic
    // "check the API connection" fallback, which is a lie about the cause.
    response,
    original: error,
  };
}

const http = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "",
});

http.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const norm = normalizeError(error);
    if (norm.status === 401) {
      supabase.auth.signOut();
    }
    logger.error("api_error", norm.message, norm.requestId);
    return Promise.reject(norm);
  }
);

export default http;
