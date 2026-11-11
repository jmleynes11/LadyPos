// Browser-only payment preview. No API, account, order or payment is created.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import PaymentReview from "../src/features/bookstore/PaymentReview.jsx";
import "../src/index.css";

const quote = { reference: "SYNTHETIC-QR-REVIEW", total: 44700, items: [
  { productId: "book", name: "Synthetic textbook", quantity: 1, subtotal: 42000 },
  { productId: "pen", name: "Synthetic pen", quantity: 1, subtotal: 1500 },
  { productId: "pencil", name: "Synthetic pencil", quantity: 1, subtotal: 1200 },
] };
function Preview() {
  const [method, setMethod] = useState("cash"), [paymentReference, setPaymentReference] = useState(""), [paid, setPaid] = useState(false), [message, setMessage] = useState("");
  return <><h1>Disposable GCash review preview · No payments are processed</h1><PaymentReview quote={quote} message={message} busy={false} disabled={false} method={method} setMethod={setMethod} paymentReference={paymentReference} setPaymentReference={setPaymentReference} paid={paid} setPaid={setPaid} pricesConfirmed={true} setPricesConfirmed={() => {}} onClose={() => setMessage("Preview only; no order exists.")} onRefresh={() => { setPaid(false); setMessage("Synthetic quote refreshed. No API request was sent."); }} onComplete={() => setMessage("Synthetic form validation passed. No order or payment was created.")} /></>;
}
createRoot(document.getElementById("root")).render(<Preview />);
