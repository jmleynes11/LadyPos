import { useRef, useState } from "react";
import { EmptyState, Modal, Notice } from "../../shared/components/BookstoreUI.jsx";
import { formatCentavos } from "./money.js";
import "./cashier-order-queue.css";

export default function CashierOrderQueue({ orders, accountId, canClaim, canComplete, disabled, busy, message, onClaim, onReview, onRemove }) {
  const [selected, setSelected] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [notification, setNotification] = useState(null);
  const inFlight = useRef(false);
  const confirm = async () => {
    if (!selected || disabled || busy || inFlight.current) return;
    inFlight.current = true; setRemoving(true); setNotification(null);
    try {
      if ((await onRemove(selected.orderId, selected.orderStatus))?.queueRemoved) { setSelected(null); setNotification({ error: false, text: "Order deleted successfully." }); }
      else setNotification({ error: true, text: "Order deletion was not confirmed. Check the operation status before retrying." });
    } catch (error) { setNotification({ error: true, text: error.message || "Unable to delete order." }); }
    finally { inFlight.current = false; setRemoving(false); }
  };
  return <div className="cashier-order-queue">
    {notification && !selected && <Notice error={notification.error}>{notification.text}</Notice>}
    {orders.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Order reference</th><th>Items</th><th>Total at submission</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {orders.map(order => <tr key={order.orderId}>
        <td><strong>{order.reference}</strong><small>{order.orderStatus === "cancelled" ? "Cancelled order" : order.assignedTo ? order.assignedTo === accountId ? "Assigned to you" : "Assigned to a cashier" : "Awaiting cashier"}</small></td>
        <td>{order.items.map(item => `${item.name}${item.size ? ` (${item.size})` : ""} × ${item.quantity}`).join(", ")}</td>
        <td>{formatCentavos(order.total)}</td>
        <td><span className={`status-pill ${order.orderStatus}`}>{order.orderStatus === "pending" ? "Unpaid" : order.orderStatus === "cancelled" ? "Cancelled" : order.orderStatus}</span></td>
        <td><div className="table-actions">
          {order.orderStatus === "pending" && canClaim(order.orderId) && !order.assignedTo && <button type="button" className="secondary-action" disabled={disabled} onClick={() => onClaim(order.orderId)}>Claim order</button>}
          {order.orderStatus === "pending" && canComplete(order.orderId) && order.assignedTo === accountId && <button type="button" className="secondary-action" disabled={disabled} onClick={() => onReview(order.orderId)}>Review payment</button>}
          {["pending", "cancelled"].includes(order.orderStatus) && canClaim(order.orderId) && <button type="button" className="secondary-action cashier-queue-delete" disabled={disabled || removing} onClick={() => { setNotification(null); setSelected(order); }}>Delete</button>}
        </div></td>
      </tr>)}
    </tbody></table></div> : <EmptyState title="The order queue is clear" icon="queue">Submitted unpaid orders appear here. Stock is checked when payment is reviewed.</EmptyState>}
    {selected && <Modal title="Delete Order?" busy={busy || removing} onClose={() => setSelected(null)}>
      <p>Are you sure you want to delete this order? It will also be removed from the customer's My Orders page.</p>
      <p className="helper-text">{selected.reference}</p>
      {notification && <Notice error={notification.error}>{notification.text}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="modal-actions"><button type="button" className="secondary-action" disabled={busy || removing} onClick={() => setSelected(null)}>Cancel</button><button type="button" className="primary-action" disabled={disabled || busy || removing} onClick={confirm}>Confirm Delete</button></div>
    </Modal>}
  </div>;
}
