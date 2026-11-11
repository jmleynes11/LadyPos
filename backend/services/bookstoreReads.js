import { hasBaseCapability, grantedResources } from "./bookstoreGrants.js";
import User from "../models/User.js";
import Store from "../models/Store.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Invoice from "../models/Invoice.js";
import { BookstoreAudit, BookstoreReceipt, StockMovement, ReversalRequest, SaleReversal } from "../models/BookstoreControl.js";
import { CAPABILITIES } from "../auth/capabilities.js";
import { isStoredMemberships } from "../models/resourceAttribution.js";
import { accountId, fail } from "./accountManagement.js";
import { bookstoreReadScope } from "./bookstoreAccess.js";
import { orderDto, itemDto } from "./bookstoreOrders.js";
import { isAccountActive } from "../auth/accountState.js";
import { accountTokenVersion } from "../utils/tokenVersion.js";
import { operationalProjection } from "../auth/operationalProjection.js";

export async function bookstoreContext(actor) {
  const account = await User.findById(accountId(actor.id));
  if (!account || account.role !== actor.role || account.confirmed !== true || !isAccountActive(account) || accountTokenVersion(account.tokenVersion) !== actor.tokenVersion) fail(401, "Not authorized; sign in again");
  const ids = isStoredMemberships(account.storeIds) ? account.storeIds : [];
  const stores = await Store.find({ _id: { $in: ids } });
  const supported = new Set(["product.manage", "category.manage", "catalog.create", "catalog.manage", "catalog.saleRead", "product.price.write", "inventory.adjust", "inventory.history.read", "sale.process", "payment.record", "receipt.issue", "salesHistory.own", "salesHistory.all", "reversal.request", "reversal.approve", "reversal.apply", "order.submit", "order.status.own", "order.fulfill", "order.oversee"]);
  const conditionalResources = {};
  const capabilities = {};
  for (const key of Object.keys(CAPABILITIES)) {
    const base = hasBaseCapability(account.role, key);
    const resources = supported.has(key) && !base && stores.length ? await grantedResources(actor, key) : [];
    if (resources.length) conditionalResources[key] = resources;
    capabilities[key] = supported.has(key) && stores.length > 0 && (base || resources.length > 0);
  }
  return { accountId: String(account._id), role: account.role, legacyReadOnly: account.role === "user", capabilities, conditionalResources,
    stores: stores.map(store => ({ id: String(store._id), name: store.name, orderingReady: Boolean(store.orderCustomer && store.createdBy) })),
    canManageAccounts: account.role === "admin" };
}

export async function pendingQueue(actor, storeId, includeCancelled = false) {
  const scope = await bookstoreReadScope(actor, storeId, hasBaseCapability(actor.role, "order.oversee") || (await grantedResources(actor, "order.oversee")).length ? "order.oversee" : "order.fulfill");
  if (includeCancelled && actor.role !== "cashier") fail(403, "Cashier queue access required");
  const orders = await Order.find({ ...scope, orderStatus: includeCancelled ? { $in: ["pending", "cancelled"] } : "pending", moneyUnit: "PHP-centavos", origin: { $in: ["guest", "student"] }, directPayment: { $ne: true } }).sort({ createdAt: 1 });
  if (actor.role !== "cashier") return { orders: orders.map(orderDto) };
  const removals = orders.length ? await BookstoreAudit.find({ storeId: scope.storeId, action: "order.queue_removed", targetKind: "Transaction", targetId: { $in: orders.map(order => order._id) } }) : [];
  const removedIds = new Set(removals.map(event => String(event.targetId)));
  return { orders: orders.filter(order => !removedIds.has(String(order._id))).map(orderDto) };
}

export async function ownStudentOrders(actor, storeId) {
  const scope = await bookstoreReadScope(actor, storeId, "order.status.own");
  const orders = await Order.find({ ...scope, studentUser: actor.id, moneyUnit: "PHP-centavos" }).sort({ createdAt: -1 });
  // Reuse the exact persistent archive marker used by the Cashier queue.
  const eligible = orders.filter(order => ["pending", "cancelled"].includes(order.orderStatus));
  const removals = eligible.length ? await BookstoreAudit.find({ storeId: scope.storeId, action: "order.queue_removed", targetKind: "Transaction", targetId: { $in: eligible.map(order => order._id) } }) : [];
  const archived = new Set(removals.map(event => String(event.targetId)));
  return { orders: orders.filter(order => !archived.has(String(order._id))).map(order => ({ orderId: String(order._id), reference: order.bookstoreReference, orderStatus: order.reversalId ? "reversed" : order.orderStatus })) };
}

export async function ownStudentOrderDetails(actor, storeId, orderId) {
  if (actor?.role !== "customer") fail(403, "Customer order access required");
  const target = accountId(orderId);
  const scope = await bookstoreReadScope(actor, storeId, "order.status.own", target);
  const order = await Order.findOne({ _id: target, ...scope, studentUser: actor.id, moneyUnit: "PHP-centavos" });
  if (!order || await BookstoreAudit.findOne({ storeId: scope.storeId, action: "order.queue_removed", targetKind: "Transaction", targetId: target })) fail(404, "Order details unavailable");
  const store = await Store.findById(scope.storeId);
  // Only images come from the catalog. Names, sizes and monetary amounts are
  // the saved transaction snapshot, including discontinued products.
  const products = await Product.find({ ...scope, _id: { $in: order.items.map(item => item.product) } });
  return { order: { orderId: String(order._id), reference: order.bookstoreReference,
    orderStatus: order.reversalId ? "reversed" : order.orderStatus,
    submittedAt: order.createdAt?.toISOString() || null, storeName: store.name,
    items: order.items.map(item => ({ ...itemDto(item), imageUrl: products.find(product => String(product._id) === String(item.product))?.imageUrl || "" })),
    totalQuantity: order.items.reduce((total, item) => total + item.quantity, 0),
    total: order.totalAmount, paymentStatus: order.paymentStatus, moneyUnit: "PHP-centavos",
  } };
}

async function historyScope(actor, storeId) {
  const own = actor.role === "cashier";
  const scope = await bookstoreReadScope(actor, storeId, own ? "salesHistory.own" : "salesHistory.all");
  return { ...scope, ...(own ? { processedBy: actor.id } : {}), orderStatus: "completed", moneyUnit: "PHP-centavos" };
}

export async function transactionHistory(actor, storeId, orderId) {
  const scope = await historyScope(actor, storeId);
  if (orderId) scope._id = accountId(orderId);
  const orders = await Order.find(scope).sort({ completedAt: -1 });
  if (orderId && !orders.length) fail(404, "Transaction not found");
  const reversals = await SaleReversal.find({ storeId: scope.storeId, transactionId: { $in: orders.map(order => order._id) } });
  const invoices = await Invoice.find({ storeId: scope.storeId, transaction: { $in: orders.map(order => order._id) }, moneyUnit: "PHP-centavos" });
  const transactions = orders.map(order => ({ ...orderDto(order), processedBy: String(order.processedBy), completedAt: order.completedAt?.toISOString(),
    invoiceId: invoices.find(invoice => String(invoice.transaction) === String(order._id))?._id?.toString(),
    paymentMethod: order.paymentMethod, paymentReference: order.paymentReference,
    reversal: reversals.filter(row => String(row.transactionId) === String(order._id)).map(row => ({ reversalId: String(row._id), amount: row.amount, method: row.method, approvedBy: String(row.approvedBy), reason: row.reason, reference: row.reference })) }));
  const gross = orders.reduce((sum, order) => sum + order.totalAmount, 0), refunded = reversals.reduce((sum, row) => sum + row.amount, 0);
  if (![gross, refunded, gross - refunded].every(Number.isSafeInteger)) fail(409, "Summary amount exceeds safe integer precision");
  return { transactions, summary: { gross, refunded, net: gross - refunded, sales: orders.length, moneyUnit: "PHP-centavos" } };
}

export async function readReceipt(actor, storeId, invoiceId) {
  const scope = await historyScope(actor, storeId);
  const invoice = await Invoice.findOne({ _id: accountId(invoiceId), storeId: scope.storeId, moneyUnit: "PHP-centavos" });
  if (!invoice || !await Order.findOne({ _id: invoice.transaction, ...scope })) fail(404, "Receipt not found");
  return { receipt: { invoiceId: String(invoice._id), ...invoice.snapshot, reversed: Boolean(invoice.reversalId) } };
}

export async function inventoryHistory(actor, storeId) {
  const scope = await bookstoreReadScope(actor, storeId, "inventory.history.read");
  const rows = await StockMovement.find(scope).sort({ occurredAt: -1 });
  return { movements: rows.map(row => ({ id: String(row._id), productId: String(row.productId), actorId: String(row.actorId), delta: row.delta, before: row.before, after: row.after,
    ...(row.sizeChanges ? { sizeChanges: row.sizeChanges.map(change => ({ size: change.size, before: change.before, after: change.after, delta: change.delta })) } : {}),
    reason: row.reason, source: row.source, occurredAt: row.occurredAt.toISOString() })) };
}

export async function reversalRequests(actor, storeId) {
  const action = hasBaseCapability(actor.role, "reversal.request") || (await grantedResources(actor, "reversal.request")).length ? "reversal.request" : "reversal.apply";
  const scope = await bookstoreReadScope(actor, storeId, action);
  if (scope.$and) scope.$and = scope.$and.map(bound => ({ transactionId: bound._id }));
  const rows = await ReversalRequest.find({ ...scope, ...(actor.role === "cashier" ? { requestedBy: actor.id } : {}) }).sort({ createdAt: -1 });
  return { requests: rows.map(row => ({ requestId: String(row._id), orderId: String(row.transactionId), reason: row.reason, requestedBy: String(row.requestedBy), status: row.status })) };
}

export async function operationalAudit(actor, storeId) {
  if (actor.role !== "admin") fail(403, "Administrator audit access required");
  const scope = await bookstoreReadScope(actor, storeId, "catalog.manage");
  const rows = await BookstoreAudit.find(scope).sort({ occurredAt: -1 });
  return { events: rows.map(row => ({ id: String(row._id), actorKind: row.actorKind, actorId: row.actorId ? String(row.actorId) : null,
    operationId: row.operationId, action: row.action, targetKind: row.targetKind, targetId: String(row.targetId), occurredAt: row.occurredAt.toISOString(), reason: row.reason, before: row.before, after: row.after })) };
}

export async function reconcileBookstoreOperation(actor, storeId, operationId) {
  if (typeof operationId !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(operationId)) fail(400, "Invalid operation identity");
  await bookstoreContext(actor);
  const receipt = await BookstoreReceipt.findOne({ actorKey: `account:${actor.id}`, operationId });
  if (!receipt || String(receipt.storeId) !== accountId(storeId)) fail(404, "Operation not found; do not blindly repeat an uncertain operation");
  const account = await User.findById(actor.id);
  if (!isStoredMemberships(account.storeIds) || !account.storeIds.some(id => String(id) === String(receipt.storeId))) fail(403, "Explicit bookstore membership required");
  // Submission receipts already contain the committed, nonsecret checkout DTO.
  // Only its original cashier can recover it, with current store/resource access.
  if (receipt.capability === "sale.process" && receipt.result?.orderId && receipt.result?.payment) {
    const scope = await bookstoreReadScope(actor, storeId, "sale.process", receipt.result.orderId);
    const order = await Order.findOne({ _id: accountId(receipt.result.orderId), ...scope, assignedTo: actor.id, directPayment: true, moneyUnit: "PHP-centavos" });
    if (!order) fail(404, "Direct checkout not found in authorized scope");
    return { outcome: "applied", operationId, orderId: receipt.result.orderId, result: operationalProjection(receipt.result) };
  }
  return { outcome: "applied", operationId };
}
