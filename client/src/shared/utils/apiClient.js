// apiClient.js
import axios from "axios";
import { logClientError } from "./safeDiagnostics.js";

export const createApiClient = (jwt, onUnauthorized) => {
  const instance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        logClientError("auth.request_unauthorized", err);
        try { onUnauthorized?.(); } catch { /* Keep the original HTTP failure. */ }
      }
      return Promise.reject(err);
    },
  );

  return instance;
};
