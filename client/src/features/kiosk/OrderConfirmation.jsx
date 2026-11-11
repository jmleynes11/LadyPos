import { useState } from "react";
import { Panel } from "../../shared/components/BookstoreUI.jsx";

async function copyReference(reference) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(reference); return; }
    catch { /* Support kiosk browsers without clipboard permission. */ }
  }
  const previousFocus = document.activeElement;
  const field = document.createElement("textarea");
  field.value = reference;
  field.readOnly = true;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  try {
    field.focus({ preventScroll: true });
    field.select();
    if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
  } finally { field.remove(); previousFocus?.focus(); }
}

export default function OrderConfirmation({ status }) {
  const [copyMessage, setCopyMessage] = useState("");
  const copy = async () => {
    try { await copyReference(status.reference); setCopyMessage("Reference copied!"); }
    catch { setCopyMessage("Unable to copy. Select the reference and copy it manually."); }
  };
  return <Panel title="ORDER SUBMITTED" className="guest-order-confirmation">
    <p className="helper-text guest-confirmation-message">Your order has been successfully submitted.</p>
    <div className="eyebrow">ORDER REFERENCE</div>
    <div className="guest-reference-row">
      <strong className="guest-order-reference">{status.reference}</strong>
      <button type="button" className="secondary-action guest-copy-reference" onClick={copy} aria-label="Copy order reference">Copy</button>
    </div>
    <p className="helper-text guest-copy-feedback" role="status" aria-live="polite">{copyMessage}</p>
    <p className="helper-text guest-reference-reminder">Keep this reference for your order inquiries.</p>
    <span className={`status-pill ${status.orderStatus}`}>{status.orderStatus === "pending" ? "Unpaid · Proceed To Cashier" : status.orderStatus}</span>
  </Panel>;
}
