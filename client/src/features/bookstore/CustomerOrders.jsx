import { useEffect, useRef, useState } from "react";
import { EmptyState, Modal, Notice, Panel, ProductVisual } from "../../shared/components/BookstoreUI.jsx";
import { formatCentavos } from "./money.js";
import "./customer-orders.css";

const statusLabel = status => status === "pending" ? "Unpaid" : status;
export default function CustomerOrders({ orders, api, storeId }) {
  const [details, setDetails] = useState(null);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const close = () => { request.current?.abort(); setDetails(null); };
  const viewOrder = async orderId => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setDetails({ loading: true });
    try {
      const response = await api.get(`/bookstore/orders/own/${orderId}`, { params: { storeId }, signal: controller.signal });
      const order = response.data.data.order;
      if (!order || order.orderId !== orderId || !Array.isArray(order.items)) throw new Error("Order details unavailable.");
      if (!controller.signal.aborted) setDetails({ order });
    } catch (error) {
      if (!controller.signal.aborted) setDetails({ error: error.response?.data?.message || error.message || "Unable to load order details." });
    }
  };
  const order = details?.order;
  return <div className="customer-orders">
    <Panel title="My orders" subtitle="Your authenticated student orders">{orders.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Public order reference</th><th>Status</th><th>Actions</th></tr></thead><tbody>{orders.map(row => <tr key={row.orderId}><td>{row.reference}</td><td><span className={`status-pill ${row.orderStatus}`}>{statusLabel(row.orderStatus)}</span></td><td><button type="button" className="secondary-action" onClick={() => viewOrder(row.orderId)}>View Order</button></td></tr>)}</tbody></table></div> : <EmptyState title="No orders yet" icon="bag">Browse the catalog and submit your first order.</EmptyState>}</Panel>
    {details && <Modal title="Order Details" onClose={close}>
      {details.loading && <Notice>Loading order details…</Notice>}
      {details.error && <Notice error>{details.error}</Notice>}
      {order && <>
        <dl className="customer-order-information"><div><dt>Order Reference</dt><dd>{order.reference}</dd></div><div><dt>Status</dt><dd><span className={`status-pill ${order.orderStatus}`}>{statusLabel(order.orderStatus)}</span></dd></div><div><dt>Order Submission Date</dt><dd>{order.submittedAt ? new Date(order.submittedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "Unavailable"}</dd></div><div><dt>Store / Branch</dt><dd>{order.storeName}</dd></div></dl>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>Size</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={`${item.productId}:${item.size || ""}:${index}`}><td><div className="customer-order-product"><ProductVisual product={item} /><strong>{item.name || "Product name unavailable"}</strong></div></td><td>{item.size || "—"}</td><td>{item.quantity}</td><td>{formatCentavos(item.unitPrice)}</td><td>{formatCentavos(item.subtotal)}</td></tr>)}</tbody></table></div>
        <div className="customer-order-summary"><p>Total quantity: <strong>{order.totalQuantity}</strong></p><div className="cart-total"><span>Total</span><strong>{formatCentavos(order.total)}</strong></div><p>Payment status: <strong>{order.paymentStatus}</strong></p></div>
      </>}
      <div className="modal-actions"><button type="button" className="secondary-action" onClick={close}>Close</button></div>
    </Modal>}
  </div>;
}
