import { useEffect, useState, useCallback } from "react";
import { useApi } from "../../shared/utils/useApi.js";
import { useAuth } from "../../shared/hooks/AuthContext.jsx";
import { BookstoreState } from "./bookstoreContext.js";
import { useLocation } from "react-router-dom";
import { useCashierQueue } from "./useCashierQueue.js";
export function BookstoreProvider({ children }) {
  const api = useApi(), { jwt } = useAuth();
  const [state, setState] = useState({ jwt: null, value: null, error: "" });
  const refresh = useCallback(async () => {
    try {
      const result = await api.get("/bookstore/context");
      setState({ jwt, value: result.data.data, error: "" });
    } catch (error) { setState({ jwt, value: null, error: error.response?.data?.message || "Bookstore access unavailable" }); }
  }, [api, jwt]);
  useEffect(() => {
    let active = true;
    api.get("/bookstore/context").then(result => { if (active) setState({ jwt, value: result.data.data, error: "" }); })
      .catch(error => { if (active) setState({ jwt, value: null, error: error.response?.data?.message || "Bookstore access unavailable" }); });
    const focus = () => { if (active) refresh(); };
    window.addEventListener("focus", focus);
    return () => { active = false; window.removeEventListener("focus", focus); };
  }, [api, jwt, refresh]);
  const context = state.jwt === jwt ? state.value : null;
  const location = useLocation();
  const cashierQueue = useCashierQueue(context, api, jwt, new URLSearchParams(location.search).get("storeId"));
  return <BookstoreState.Provider value={{ context, error: state.jwt === jwt ? state.error : "", refresh, api, cashierQueue }}>{children}</BookstoreState.Provider>;
}
