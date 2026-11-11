import Order from "../models/Order.js";
import { BookstoreAudit, BookstorePayment } from "../models/BookstoreControl.js";
import { bookstoreCommand } from "./bookstoreCommand.js";
import { exactFields } from "./bookstoreOrders.js";
import { accountId, fail } from "./accountManagement.js";

// Queue removal is an append-only marker. Never mutate or delete the order.
export async function removeOrderFromQueue(actor, orderId, body) {
  if (actor?.role !== "cashier") fail(403, "Cashier queue access required");
  exactFields(body, ["storeId", "operationId", "reason", "includeUnpaid"]);
  if (body.includeUnpaid !== undefined && typeof body.includeUnpaid !== "boolean") fail(400, "Invalid queue removal option");
  const target = accountId(orderId);
  return bookstoreCommand(actor, body.storeId, "order.fulfill", {
    // Keep the original cancelled-only command fingerprint compatible with
    // existing receipts. Pending and cancelled queue orders are eligible.
    ...body, orderId: target, reason: body.includeUnpaid === true ? "Cashier removed order from queue" : "Cashier removed cancelled order from queue",
  }, async ({ session, scope, audit }) => {
    const order = await Order.findOne({ _id: target, ...scope, moneyUnit: "PHP-centavos", origin: { $in: ["guest", "student"] }, directPayment: { $ne: true } }).session(session);
    if (!order) fail(404, "Queue order not found");
    const eligibleStatus = ["pending", "cancelled"].includes(order.orderStatus);
    if (!eligibleStatus || order.paymentStatus !== "unpaid" || order.amountPaid !== 0 || order.ledgerRecorded ||
        await BookstorePayment.findOne({ transactionId: order._id, ...scope }).session(session)) {
      fail(409, "Only unpaid or cancelled orders without recorded payments can be removed from the queue");
    }
    const prior = await BookstoreAudit.findOne({ storeId: scope.storeId, action: "order.queue_removed", targetKind: "Transaction", targetId: order._id }).session(session);
    if (!prior) await audit("order.queue_removed", "Transaction", order._id,
      { orderStatus: order.orderStatus, visibleInQueue: true }, { orderStatus: order.orderStatus, visibleInQueue: false });
    return { orderId: target, queueRemoved: true };
  });
}
