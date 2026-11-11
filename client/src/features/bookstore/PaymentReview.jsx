import { Modal, Notice } from "../../shared/components/BookstoreUI.jsx";
import { formatCentavos as money } from "./money.js";

// Show the original QR area plus a four-module white margin. Crop the display
// with CSS so the source image and every QR pixel remain unchanged.
const gcashQrCrop = { x: 170, y: 268, size: 488, sourceWidth: 828 };

export default function PaymentReview({ quote, message, busy, disabled, method, setMethod, paymentReference, setPaymentReference, paid, setPaid, pricesConfirmed, setPricesConfirmed, onClose, onRefresh, onComplete }) {
  const awaitingPriceConfirmation = quote.directCheckout && quote.pricesChanged && !pricesConfirmed;
  return <Modal title={quote.directCheckout ? "Review Order / Payment" : "Review payment"} busy={busy} onClose={onClose}>
    {message && <Notice error>{message}</Notice>}
    <p className="helper-text">Order {quote.reference} · Current server-side quote</p>
    {quote.pricesChanged && <Notice>Prices changed. Previous total: {money(quote.previousTotal)}. Confirm the revised total below before accepting payment.</Notice>}
    <div className="quote-total">{money(quote.total)}</div>
    {quote.items.map(item => <div className="receipt-line" key={`${item.productId}:${item.size || ""}`}><span>{item.name}{item.size ? ` (${item.size})` : ""} × {item.quantity}</span><strong>{money(item.subtotal)}</strong></div>)}
    <div className="form-stack mt-5">
      {quote.directCheckout && quote.pricesChanged && <label className="checkbox-row"><input type="checkbox" disabled={busy || disabled} checked={pricesConfirmed} onChange={event => { setPricesConfirmed(event.target.checked); setPaid(false); }} />I confirm the revised total of {money(quote.total)} before accepting payment.</label>}
      <label>Payment method<select className="input min-h-11" disabled={Boolean(awaitingPriceConfirmation)} value={method} onChange={event => { setMethod(event.target.value); setPaymentReference(""); setPaid(false); }}><option value="cash">Cash</option><option value="gcash">GCash</option></select></label>
      {method === "gcash" && <><section aria-label="GCash payment" className="text-center">
        <h3 className="font-semibold text-primary">GCash Payment</h3>
        <p className="helper-text mt-3">Scan this QR code using your GCash application to complete your payment.</p>
        <p className="helper-text mt-3">Exact amount to pay</p><p className="quote-total">{money(quote.total)}</p>
        <div className="relative overflow-hidden mx-auto mt-3 w-full max-w-[320px] aspect-square" aria-label="GCash QR code">
          <img src="/gcash-payment-qr.jpg" alt="Provided GCash payment QR code" className="absolute h-auto" style={{ width: `${gcashQrCrop.sourceWidth / gcashQrCrop.size * 100}%`, maxWidth: "none", left: `${-gcashQrCrop.x / gcashQrCrop.size * 100}%`, top: `${-gcashQrCrop.y / gcashQrCrop.size * 100}%` }} />
        </div>
      </section><Notice>Verify full payment in the authorized GCash account. A screenshot is not payment confirmation.</Notice><label>Verified GCash payment reference<input className="input min-h-11" disabled={Boolean(awaitingPriceConfirmation)} value={paymentReference} onChange={event => { setPaymentReference(event.target.value); setPaid(false); }} /></label></>}
      <label className="checkbox-row"><input type="checkbox" disabled={Boolean(awaitingPriceConfirmation)} checked={paid} onChange={event => setPaid(event.target.checked)} />I verified full {method === "cash" ? "cash payment received" : "GCash payment in the authorized account"} and confirmed the current total of {money(quote.total)}.</label>
    </div>
    <div className="modal-actions"><button className="secondary-action" disabled={busy} onClick={onRefresh}>Refresh quote</button><button className="primary-action" disabled={disabled || busy || awaitingPriceConfirmation || !paid || (method === "gcash" && !paymentReference.trim())} onClick={onComplete}>Complete sale</button></div>
  </Modal>;
}
