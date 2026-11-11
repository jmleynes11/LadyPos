import { useApi } from "../../../shared/utils/useApi";

export function useOrderApi() {
  const api = useApi();
  const unwrap = (res) => ({ ...res, data: res.data?.data ?? res.data });

  const getOrders = async (params = {}) => {
    const res = await api.get("/orders", { params });
    return unwrap(res);
  };

  const getOrderById = async (orderId) => {
    if (!orderId) throw new Error("orderId is required");

    const res = await api.get(`/orders/${orderId}`);
    return unwrap(res);
  };

  const createOrder = async (data) => {
    const res = await api.post("/orders", data);
    return unwrap(res);
  };

  const updateOrder = async (orderId, data) => {
    const res = await api.put(`/orders/${orderId}`, data);
    return unwrap(res);
  };

  const deleteOrder = async (orderId) => {
    const res = await api.delete(`/orders/${orderId}`);
    return unwrap(res);
  };

  const markOrderPaid = async (orderId, data = {}) => {
    const res = await api.patch(`/orders/${orderId}/pay`, data);
    return unwrap(res);
  };

  const markOrderCompleted = async (orderId, data = {}) => {
    const res = await api.patch(`/orders/${orderId}/complete`, data);
    return unwrap(res);
  };

  return {
    getOrders,
    getOrderById,
    createOrder,
    updateOrder,
    deleteOrder,
    markOrderPaid,
    markOrderCompleted,
  };
}
