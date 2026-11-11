const money = (centavos) =>
  typeof centavos === "number" && Number.isFinite(centavos)
    ? `PHP ${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "Unavailable";

export default function Invoice({ invoice }) {
  if (!invoice) return null;
  if (!Array.isArray(invoice.items)) return <p>Receipt details unavailable.</p>;

  return (
    <div id="print-area" className="p-6 bg-white text-black max-w-md mx-auto">
      <img src="/uphsd-seal.png" alt="UPHSD DALTA official seal" style={{ width: 42, height: 61, objectFit: "contain", margin: "0 auto 12px", display: "block" }} />
      <h1 className="text-center text-xl font-bold">UPHSD Bookstore</h1>
      <div className="flex justify-between mb-3 text-sm">
        <span>Invoice #: {invoice.invoiceNumber}</span>
        <span>{invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleString("en-PH") : "Date unavailable"}</span>
      </div>
      <hr className="mb-2" />
      {invoice.items.map((item, index) => (
        <div key={`${item.productId}-${index}`} className="mb-2 text-sm">
          <div className="flex justify-between">
            <span>{item.productName} x{item.quantity}</span>
            <span>{money(item.total)}</span>
          </div>
          <small>Unit price: {money(item.unitPrice)}</small>
        </div>
      ))}
      <hr className="my-2" />
      <div className="text-sm text-right">
        <p>Total: {money(invoice.total)}</p>
        <p>Recorded payment: {money(invoice.amountPaid)}</p>
        <p>Balance: {money(invoice.balance)}</p>
        {invoice.paymentMethod && <p>Method: {invoice.paymentMethod.toUpperCase()}</p>}
        {invoice.paymentReference && <p>Reference: {invoice.paymentReference}</p>}
        {invoice.cashier && <p>Cashier: {invoice.cashier}</p>}
        {invoice.status && <p>Status: {invoice.status}</p>}
      </div>
      <p className="text-center text-xs mt-4">Thank you for your purchase!</p>
    </div>
  );
}
