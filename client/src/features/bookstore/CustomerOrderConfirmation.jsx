import { useState } from "react";
import { Notice, Panel } from "../../shared/components/BookstoreUI.jsx";
import "./customer-order-confirmation.css";

async function copyReference(reference) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(reference); return; }
    catch { /* Use the existing browser copy fallback when permission is unavailable. */ }
  }
  const previousFocus = document.activeElement;
  const field = document.createElement("textarea");
  field.value = reference;
  field.readOnly = true;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  try {
    field.focus({ preventScroll: true }); field.select();
    if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
  } finally { field.remove(); previousFocus?.focus(); }
}

export default function CustomerOrderConfirmation({ order, loading, error }) {
  const [copyMessage, setCopyMessage] = useState("");
  if (!order || typeof order.reference !== "string" || !order.reference.trim() || !order.orderStatus) {
    return <Notice error={!loading}>{loading ? "Loading your order confirmation…" : error || "Order confirmation is unavailable. View your submitted orders in My Orders."}</Notice>;
  }
  const copy = async () => {
    try { await copyReference(order.reference); setCopyMessage("Order reference copied."); }
    catch { setCopyMessage("Unable to copy. Select the reference and copy it manually."); }
  };
  return <Panel title="ORDER SUBMITTED" className="customer-order-confirmation">
    <p className="helper-text customer-confirmation-message">Your order has been successfully submitted.</p>
    <div className="eyebrow">ORDER REFERENCE</div>
    <div className="customer-reference-row">
      <strong className="customer-order-reference">{order.reference}</strong>
      <button type="button" className="secondary-action customer-copy-reference" aria-label="Copy order reference" onClick={copy}>Copy</button>
    </div>
    <p className="helper-text customer-copy-feedback" role="status" aria-live="polite">{copyMessage}</p>
    <p className="helper-text customer-reference-reminder">Keep this reference for your order inquiries.</p>
    <span className={`status-pill ${order.orderStatus}`}>{order.orderStatus === "pending" ? "Unpaid · Proceed To Cashier" : order.orderStatus}</span>
  </Panel>;
}
