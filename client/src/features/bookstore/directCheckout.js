// Compare the server quote with the prices the cashier actually reviewed.
// Retain an unconfirmed change across refreshes, including offsetting price edits.
export function directPaymentReview(current, previous) {
  const pricesChanged = Boolean(current.pricesChanged || previous.pricesChanged) || current.total !== previous.total ||
    previous.items.some(item => current.items.find(row => row.productId === item.productId && row.size === item.size)?.unitPrice !== item.unitPrice);
  return {
    ...current,
    directCheckout: true,
    previousTotal: previous.pricesChanged ? previous.previousTotal : current.pricesChanged ? current.previousTotal : previous.total,
    pricesChanged,
  };
}
