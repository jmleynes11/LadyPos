import { useCallback, useEffect, useRef, useState } from "react";

export const CASHIER_QUEUE_REFRESH_MS = 15000;

// Read the existing authorized queue. No notification or order state is persisted.
export function useCashierQueue(context, api, jwt, selectedStoreId) {
  const enabled = context?.role === "cashier" && Boolean(context.capabilities?.["order.fulfill"] || context.capabilities?.["order.oversee"]);
  const storeId = enabled ? context.stores.find(store => store.id === selectedStoreId)?.id || context.stores[0]?.id || "" : "";
  const identity = enabled && storeId ? `${jwt}:${context.accountId}:${storeId}` : "";
  const [snapshot, setSnapshot] = useState(null);
  const request = useRef(null);
  const refresh = useCallback(async () => {
    if (!identity) return null;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await api.get("/bookstore/orders/queue", { params: { storeId, includeCancelled: true }, signal: controller.signal, timeout: 10000 });
      if (!controller.signal.aborted) setSnapshot({ identity, orders: response.data.data.orders, error: "" });
      return controller.signal.aborted ? null : response;
    } catch (error) {
      if (!controller.signal.aborted) setSnapshot({ identity, orders: null, error: error.response?.data?.message || "Order queue unavailable. Refresh to retry." });
      return null;
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [api, identity, storeId]);

  useEffect(() => {
    if (!identity) return;
    const update = () => { if (document.visibilityState !== "hidden") void refresh(); };
    void refresh();
    const timer = window.setInterval(() => { if (!request.current) update(); }, CASHIER_QUEUE_REFRESH_MS);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      request.current?.abort();
      request.current = null;
    };
  }, [identity, refresh]);

  const current = identity && snapshot?.identity === identity ? snapshot : null;
  return { storeId, orders: current?.orders ?? null, count: current?.orders?.filter(order => order.orderStatus === "pending").length ?? null, error: current?.error || "", refresh };
}
