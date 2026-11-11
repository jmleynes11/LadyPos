// Add receipt fields without changing stored invoices or existing transaction envelopes.
export function invoiceDto(invoice) {
  const data = typeof invoice.toObject === "function" ? invoice.toObject() : { ...invoice };
  const sale = data.transaction;
  const transactionId = sale?._id || data.transaction || data.orderId;
  return {
    ...data,
    orderId: transactionId ? String(transactionId) : null,
    items: Array.isArray(sale?.items) ? sale.items.map((item) => ({
      productId: item.product ? String(item.product._id || item.product) : null,
      productName: item.product?.name || "Product unavailable (historical name not stored)",
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? item.price ?? null,
      subtotal: item.subtotal ?? null,
      total: item.subtotal ?? null,
    })) : null,
    total: sale?.totalAmount ?? null,
    amountPaid: sale?.amountPaid ?? null,
    balance: sale?.balance ?? null,
    paymentMethod: sale?.paymentMethod ?? null,
    paymentReference: sale?.paymentReference ?? "",
    cashier: sale?.processedBy?.name || sale?.processedBy?.identifier || null,
  };
}
