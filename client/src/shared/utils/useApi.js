import { useMemo } from "react";
import { useAuth } from "../hooks/AuthContext.jsx";
import { createApiClient } from "./apiClient";

export function useApi() {
  const { jwt, logout } = useAuth();

  const api = useMemo(() => {
    return createApiClient(jwt, logout);
  }, [jwt, logout]);

  return api;
}
