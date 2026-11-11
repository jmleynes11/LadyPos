import Order from "../models/Order.js";
import Invoice from "../models/Invoice.js";
import { ReversalRequest } from "../models/BookstoreControl.js";
import { bookstoreReadScope } from "./bookstoreAccess.js";
import { accountId, fail } from "./accountManagement.js";
import { applyReversal, cancelOrder } from "./bookstoreOrders.js";

// Every retained void/delete alias uses the same scoped state/effect service.
// There is no invoice-only status mutation or legacy automatic-restock path.
export async function reverseOrderAlias(actor, orderId, body) {
  const scope = await bookstoreReadScope(actor, body?.storeId, "reversal.apply", orderId);
  const order = await Order.findOne({ _id: accountId(orderId), ...scope, moneyUnit: "PHP-centavos" });
  if (!order) fail(404, "Order not found");
  if (order.orderStatus === "pending") return cancelOrder(actor, orderId, body);
  const request = await ReversalRequest.findOne({ _id: accountId(body.requestId), transactionId: order._id, ...scope });
  if (!request) fail(404, "Reversal request not found");
  const { requestId, ...command } = body;
  return applyReversal(actor, requestId, command);
}
export async function reverseInvoiceAlias(actor, invoiceId, body) {
  const invoice = await Invoice.findOne({ _id: accountId(invoiceId), storeId: accountId(body?.storeId), moneyUnit: "PHP-centavos" });
  if (!invoice) fail(404, "Receipt not found");
  await bookstoreReadScope(actor, body?.storeId, "reversal.apply", String(invoice.transaction));
  return reverseOrderAlias(actor, invoice.transaction, body);
}
