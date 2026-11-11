import { createHmac } from "node:crypto";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Store from "../models/Store.js";
import Invoice from "../models/Invoice.js";
import Customer from "../models/Person.js";
import { BookstoreAudit, BookstorePayment, BookstoreSequence, ReversalRequest, SaleReversal } from "../models/BookstoreControl.js";
import { bookstoreCommand } from "./bookstoreCommand.js";
import { bookstoreReadScope } from "./bookstoreAccess.js";
import { accountId, fail } from "./accountManagement.js";
import { CLOTHING_SIZES, supportsSizes, validSizeStocks, sizeStockTotal } from "../utils/clothingSizes.js";
import { changeProductStock, planProductStock } from "./sizeInventory.js";
import { requireResourceCapability } from "./bookstoreGrants.js";
import { unusedOrderReference, withOrderReferenceRetry } from "../utils/orderReference.js";

export function exactFields(body, allowed) {
  if (!body || Object.getPrototypeOf(body) !== Object.prototype || Object.keys(body).some(key => !allowed.includes(key))) fail(400, "Unsupported order command field");
}
const commandFields = ["storeId", "operationId", "reason"];
const ordinaryReason = (value, fallback) => value === undefined || (typeof value === "string" && !value.trim()) ? fallback : value;
export async function pricedItems(cart, scope, session) {
  if (!Array.isArray(cart) || !cart.length) fail(400, "Order items required");
  const quantities = new Map();
  for (let i = 0; i < cart.length; i++) {
    if (!Object.hasOwn(cart, i)) fail(400, "Invalid order items");
    const line = cart[i]; exactFields(line, ["product", "quantity", "size"]);
    const product = accountId(line.product);
    if (line.size !== undefined && !CLOTHING_SIZES.includes(line.size)) fail(400, "Invalid clothing size");
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) fail(400, "Positive integer quantity required");
    const key = `${product}:${line.size || ""}`;
    const quantity = (quantities.get(key)?.quantity || 0) + line.quantity;
    if (!Number.isSafeInteger(quantity)) fail(400, "Quantity overflow");
    quantities.set(key, { product, size: line.size, quantity });
  }
  const ids = [...new Set([...quantities.values()].map(line => line.product))];
  const products = await Product.find({ ...scope, _id: { $in: ids }, isActive: true, moneyUnit: "PHP-centavos" }).session(session || null);
  if (products.length !== ids.length) fail(409, "Product unavailable or monetary units unverified");
  const items = [...quantities.values()].map(({ product: id, size, quantity }) => {
    const product = products.find(row => String(row._id) === id);
    if (!Number.isSafeInteger(product.price) || product.price < 0 || !Number.isSafeInteger(product.stock) || product.stock < quantity) fail(409, "Product price or stock unavailable");
    if (supportsSizes(product)) {
      if (!size || !Object.hasOwn(product.sizeStocks || {}, size)) fail(400, "Select an available clothing size");
      if (!validSizeStocks(product.sizeStocks) || sizeStockTotal(product.sizeStocks) !== product.stock || product.sizeStocks[size] < quantity) fail(409, "Selected size has insufficient stock");
    } else if (size !== undefined) fail(400, "Sizes apply only to Clothing products");
    const subtotal = product.price * quantity;
    if (!Number.isSafeInteger(subtotal)) fail(400, "Amount overflow");
    return { product: product._id, ...(size ? { size } : {}), quantity, unitPrice: product.price, subtotal, name: product.name, sku: product.sku, category: product.category };
  });
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  if (!Number.isSafeInteger(total)) fail(400, "Amount overflow");
  return { items, total, products };
}
export const itemDto = item => ({ productId: String(item.product), ...(item.size ? { size: item.size } : {}), name: item.name || "", sku: item.sku || "", quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal });
export const orderDto = order => ({ orderId: String(order._id), reference: order.bookstoreReference, orderStatus: order.orderStatus, total: order.totalAmount, moneyUnit: "PHP-centavos", items: order.items.map(itemDto), assignedTo: order.assignedTo ? String(order.assignedTo) : null });
const quoteDigest = (order, items) => createHmac("sha256", process.env.JWT_SECRET).update(JSON.stringify({ orderId: String(order._id), items: items.map(itemDto) })).digest("hex");
const minimalCart = order => order.items.map(item => ({ product: String(item.product), quantity: item.quantity, ...(item.size ? { size: item.size } : {}) }));

export async function makePendingOrder({ owner, store, origin, studentUser, items, total, assignedTo, orderId, directPayment, session }) {
  if (!store.orderCustomer || !store.createdBy) fail(409, "Bookstore order identity requires setup");
  if (!await Customer.findOne({ _id: store.orderCustomer, storeId: store._id, isDeleted: { $ne: true } }).session(session)) fail(409, "Bookstore customer linkage requires reconciliation");
  const [order] = await Order.create([{
    ...(orderId ? { _id: orderId } : {}), owner, storeId: store._id, customer: store.orderCustomer,
    origin, ...(studentUser ? { studentUser } : {}), ...(assignedTo ? { assignedTo } : {}),
    ...(directPayment === true ? { directPayment: true } : {}),
    bookstoreReference: await unusedOrderReference(session), items, totalAmount: total, amountPaid: 0, paymentStatus: "unpaid",
    orderStatus: "pending", moneyUnit: "PHP-centavos", ledgerRecorded: false,
  }], { session });
  return order;
}

export async function submitAuthenticatedOrder(actor, body) {
  exactFields(body, ["storeId", "operationId", "items"]);
  const student = actor.role === "customer";
  return withOrderReferenceRetry(() => bookstoreCommand(actor, body.storeId, student ? "order.submit" : "sale.process", { ...body, reason: student ? "Student order submission" : "Cashier POS order" }, async ({ session, scope, actorId, audit }) => {
    const store = await Store.findById(scope.storeId, null, { session });
    const { items, total } = await pricedItems(body.items, scope, session);
    const order = await makePendingOrder({ owner: actorId, store, origin: student ? "student" : "pos", studentUser: student ? actorId : undefined, assignedTo: student ? undefined : actorId, directPayment: actor.role === "cashier", items, total, session });
    await audit("order.submitted", "Transaction", order._id, { absent: true }, { reference: order.bookstoreReference, orderStatus: "pending" });
    if (actor.role === "cashier") return { ...orderDto(order), payment: { ...orderDto(order), items: items.map(itemDto), total, quote: quoteDigest(order, items) } };
    return student ? { orderId: String(order._id), reference: order.bookstoreReference, orderStatus: "pending" } : orderDto(order);
  }));
}

async function requireUnarchivedOrder(order, session, status = 409) {
  if (await BookstoreAudit.findOne({ storeId: order.storeId, action: "order.queue_removed", targetKind: "Transaction", targetId: order._id }).session(session || null)) fail(status, "Order has been archived");
}

export async function claimOrder(actor, orderId, body) {
  exactFields(body, commandFields);
  const target = accountId(orderId);
  return bookstoreCommand(actor, body.storeId, "order.fulfill", { ...body, reason: ordinaryReason(body.reason, "Cashier order claim"), orderId: target }, async ({ session, scope, actorId, audit }) => {
    const order = await Order.findOne({ _id: target, ...scope, orderStatus: "pending", moneyUnit: "PHP-centavos" }).session(session);
    if (!order) fail(404, "Pending order not found");
    await requireUnarchivedOrder(order, session, 404);
    if (order.assignedTo && String(order.assignedTo) !== actorId) fail(409, "Order already assigned");
    order.assignedTo = actorId; await order.save({ session });
    await audit("order.claimed", "Transaction", target, { assignedTo: null }, { assignedTo: actorId });
    return orderDto(order);
  });
}

export async function quoteOrder(actor, orderId, storeId) {
  const scope = await bookstoreReadScope(actor, storeId, "sale.process", orderId);
  const order = await Order.findOne({ _id: accountId(orderId), ...scope, orderStatus: "pending", assignedTo: actor.id, moneyUnit: "PHP-centavos" });
  if (!order) fail(404, "Assigned order not found");
  await requireUnarchivedOrder(order, null, 404);
  const { items, total } = await pricedItems(minimalCart(order), scope);
  const direct = actor.role === "cashier" && order.directPayment === true;
  return { ...orderDto(order), items: items.map(itemDto), total, quote: quoteDigest(order, items), ...(direct ? {
    directPayment: true,
    previousTotal: order.totalAmount,
    pricesChanged: total !== order.totalAmount || order.items.some(item => items.find(current => String(current.product) === String(item.product))?.unitPrice !== item.unitPrice),
  } : {}) };
}

async function receiptNumber(storeId, session) {
  const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric" }).format(new Date()));
  let sequence = await BookstoreSequence.findOne({ storeId, year }).session(session);
  if (!sequence) [sequence] = await BookstoreSequence.create([{ storeId, year, seq: 1 }], { session });
  else { sequence.seq++; await sequence.save({ session }); }
  let number = `INV-${year}-${String(sequence.seq).padStart(4, "0")}`;
  while (await Invoice.findOne({ storeId, invoiceNumber: number }).session(session)) {
    sequence.seq++; await sequence.save({ session });
    number = `INV-${year}-${String(sequence.seq).padStart(4, "0")}`;
  }
  return number;
}

export async function completeOrder(actor, orderId, body) {
  exactFields(body, [...commandFields, "quote", "confirmedTotal", "paymentConfirmed", "paymentMethod", "paymentReference"]);
  const target = accountId(orderId);
  if (body.paymentConfirmed !== true || !["cash", "gcash"].includes(body.paymentMethod)) fail(400, "Confirmed full cash/GCash payment required");
  if (body.paymentMethod === "gcash" && (typeof body.paymentReference !== "string" || !body.paymentReference.trim())) fail(400, "GCash reference required");
  return bookstoreCommand(actor, body.storeId, "sale.process", { ...body, reason: ordinaryReason(body.reason, "Cashier confirmed full payment"), orderId: target }, async ({ session, scope, actorId, operationId, reason, audit, requireCapability }) => {
    await requireCapability("payment.record");
    await requireCapability("receipt.issue");
    const order = await Order.findOne({ _id: target, ...scope, moneyUnit: "PHP-centavos" }).session(session);
    if (!order) fail(404, "Order not found");
    if (order.orderStatus !== "pending" || order.ledgerRecorded) fail(409, "Order is not eligible for completion");
    await requireUnarchivedOrder(order, session);
    if (String(order.assignedTo) !== actorId) fail(403, "Assigned cashier required");
    const { items, total, products } = await pricedItems(minimalCart(order), scope, session);
    if (body.quote !== quoteDigest(order, items) || body.confirmedTotal !== total) fail(409, "Prices changed or total unconfirmed; request a new quote");
    for (const product of products) {
      const changes = items.filter(item => String(item.product) === String(product._id)).map(item => ({ size: item.size, delta: -item.quantity }));
      await changeProductStock(product, changes, { session, scope, actorId, operationId, reason, source: "sale", transactionId: order._id });
    }
    order.items = items; order.totalAmount = total; order.amountPaid = total; order.paymentStatus = "paid";
    order.paymentMethod = body.paymentMethod; order.paymentReference = body.paymentReference || "";
    order.orderStatus = "completed"; order.completedAt = new Date(); order.processedBy = actorId; order.ledgerRecorded = true;
    await order.save({ session });
    const invoiceNumber = await receiptNumber(scope.storeId, session);
    const snapshot = { ...orderDto(order), invoiceNumber, issuedAt: order.completedAt.toISOString(), paymentMethod: order.paymentMethod, paymentReference: order.paymentReference, cashierId: actorId };
    const [invoice] = await Invoice.create([{ owner: order.owner, customer: order.customer, transaction: order._id, ...scope, invoiceNumber, status: "paid", moneyUnit: "PHP-centavos", snapshot }], { session });
    await BookstorePayment.create([{ storeId: scope.storeId, transactionId: order._id, actorId, operationId, amount: total, method: order.paymentMethod, reference: order.paymentReference, occurredAt: new Date() }], { session });
    await audit("sale.completed", "Transaction", target, { orderStatus: "pending" }, { orderStatus: "completed", total, cashierId: actorId });
    await audit("payment.recorded", "Transaction", target, { amountPaid: 0 }, { amountPaid: total, method: order.paymentMethod });
    await audit("receipt.issued", "Invoice", invoice._id, { absent: true }, { invoiceNumber, transactionId: target });
    return { ...orderDto(order), receipt: { invoiceId: String(invoice._id), ...snapshot } };
  });
}

export async function cancelOrder(actor, orderId, body) {
  exactFields(body, commandFields); const target = accountId(orderId);
  return bookstoreCommand(actor, body.storeId, "order.oversee", { ...body, orderId: target }, async ({ session, scope, actorId, reason, audit }) => {
    const order = await Order.findOne({ _id: target, ...scope, moneyUnit: "PHP-centavos" }).session(session);
    if (!order) fail(404, "Order not found");
    if (order.orderStatus !== "pending" || order.ledgerRecorded || order.amountPaid !== 0) fail(409, "Only unpaid pending orders can be cancelled");
    if (await BookstorePayment.findOne({ transactionId: order._id, ...scope }).session(session)) fail(409, "Payment linkage requires reconciliation");
    order.orderStatus = "cancelled"; order.cancelledAt = new Date(); order.cancelledBy = actorId; order.cancellationReason = reason;
    await order.save({ session });
    await audit("order.cancelled", "Transaction", target, { orderStatus: "pending" }, { orderStatus: "cancelled" });
    return { orderId: target, orderStatus: "cancelled" };
  });
}

export async function requestReversal(actor, orderId, body) {
  exactFields(body, commandFields); const target = accountId(orderId);
  return bookstoreCommand(actor, body.storeId, "reversal.request", { ...body, orderId: target }, async ({ session, scope, actorId, reason, audit }) => {
    const order = await Order.findOne({ _id: target, ...scope, moneyUnit: "PHP-centavos" }).session(session);
    if (!order) fail(404, "Sale not found");
    if (actor.role === "cashier" && String(order.processedBy) !== actorId) fail(403, "Own transaction required");
    if (order.orderStatus !== "completed" || order.balance !== 0 || order.paymentStatus !== "paid" || order.reversalId) fail(409, "Sale is not eligible for reversal");
    const [request] = await ReversalRequest.create([{ storeId: scope.storeId, transactionId: order._id, requestedBy: actorId, reason, status: "requested" }], { session });
    await audit("reversal.requested", "Reversal", request._id, { absent: true }, { transactionId: target, status: "requested" });
    return { requestId: String(request._id), orderId: target, status: "requested" };
  });
}

async function reversalAssessment(target, entries, scope, session = null) {
  const request = await ReversalRequest.findOne({ _id: target, ...scope }).session(session);
  if (!request || request.status !== "requested") fail(409, "Pending reversal request required");
  const order = await Order.findOne({ _id: request.transactionId, ...scope, moneyUnit: "PHP-centavos" }).session(session);
  if (!order || order.orderStatus !== "completed" || order.paymentStatus !== "paid" || order.balance !== 0 || order.reversalId) fail(409, "Fully paid unreversed sale required");
  if (!Number.isSafeInteger(order.totalAmount) || !["cash", "gcash"].includes(order.paymentMethod)) fail(400, "Original-method whole-sale repayment required");
  const invoice = await Invoice.findOne({ transaction: order._id, ...scope }).session(session);
  if (!invoice) fail(409, "Receipt requires reconciliation");
  if (!Array.isArray(entries)) fail(400, "Invalid return list");
  const returned = [], seen = new Set();
  for (let i = 0; i < entries.length; i++) {
    if (!Object.hasOwn(entries, i)) fail(400, "Invalid return list");
    const entry = entries[i]; exactFields(entry, ["productId", "quantity", "size"]);
    const productId = accountId(entry.productId), sold = order.items.find(item => String(item.product) === productId && item.size === entry.size);
    const key = `${productId}:${entry.size || ""}`;
    if (!sold || seen.has(key) || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0 || entry.quantity > sold.quantity) fail(400, "Invalid saleable return quantity");
    seen.add(key); returned.push({ productId, ...(entry.size ? { size: entry.size } : {}), quantity: entry.quantity });
  }
  const inventory = [];
  for (const productId of new Set(returned.map(entry => entry.productId))) {
    const product = await Product.findOne({ _id: productId, ...scope }).session(session);
    if (!product) fail(409, "Return product requires reconciliation");
    const changes = returned.filter(entry => entry.productId === productId).map(entry => ({ size: entry.size, delta: entry.quantity }));
    planProductStock(product, changes, { source: "return" });
    inventory.push({ product, changes });
  }
  return { request, order, invoice, returned, inventory };
}

// Read-only preflight before staff confirm manual repayment. Apply repeats every
// check inside the transaction; this result never represents a recorded refund.
export async function validateReversal(actor, requestId, body) {
  exactFields(body, ["storeId", "returned"]);
  const target = accountId(requestId);
  const request = await ReversalRequest.findOne({ _id: target, storeId: accountId(body.storeId) });
  if (!request) fail(404, "Reversal request not found");
  const scope = await bookstoreReadScope(actor, body.storeId, "reversal.apply", String(request.transactionId));
  await requireResourceCapability(actor, "reversal.approve", request.transactionId);
  const { order, returned } = await reversalAssessment(target, body.returned, scope);
  return { eligible: true, orderId: String(order._id), amount: order.totalAmount, method: order.paymentMethod, returned };
}

export async function applyReversal(actor, requestId, body) {
  exactFields(body, [...commandFields, "repaymentConfirmed", "repaymentMethod", "refundReference", "returnsConfirmed", "returned"]);
  const target = accountId(requestId);
  if (body.repaymentConfirmed !== true || body.returnsConfirmed !== true || !Array.isArray(body.returned)) fail(400, "Repayment and return assessment confirmation required");
  return bookstoreCommand(actor, body.storeId, "reversal.apply", { ...body, targetId: target }, async ({ session, scope, actorId, operationId, reason, audit, requireCapability }) => {
    await requireCapability("reversal.approve");
    const { request, order, invoice, returned, inventory } = await reversalAssessment(target, body.returned, scope, session);
    if (!Number.isSafeInteger(order.totalAmount) || !["cash", "gcash"].includes(order.paymentMethod) || body.repaymentMethod !== order.paymentMethod) fail(400, "Original-method whole-sale repayment required");
    if (order.paymentMethod === "gcash" && (typeof body.refundReference !== "string" || !body.refundReference.trim())) fail(400, "GCash refund reference required");
    for (const { product, changes } of inventory) {
      await changeProductStock(product, changes, { session, scope, actorId, operationId, reason, source: "return", transactionId: order._id });
    }
    const [reversal] = await SaleReversal.create([{ storeId: scope.storeId, transactionId: order._id, requestId: request._id, approvedBy: actorId, operationId, amount: order.totalAmount, method: order.paymentMethod, reference: body.refundReference || "", reason, returned, occurredAt: new Date() }], { session });
    order.reversalId = reversal._id; order.reversedAt = new Date(); await order.save({ session });
    invoice.reversalId = reversal._id; await invoice.save({ session });
    request.status = "applied"; request.approvedBy = actorId; request.appliedAt = new Date(); await request.save({ session });
    await audit("reversal.applied", "Reversal", reversal._id, { reversed: false }, { reversed: true, transactionId: String(order._id), amount: order.totalAmount, method: order.paymentMethod, returned });
    return { reversalId: String(reversal._id), orderId: String(order._id), amount: order.totalAmount, method: order.paymentMethod, returned };
  });
}
