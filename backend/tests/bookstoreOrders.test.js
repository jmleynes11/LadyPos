import { reverseInvoiceAlias } from "../services/bookstoreAliases.js";
import { reversalRequests, reconcileBookstoreOperation, pendingQueue } from "../services/bookstoreReads.js";
import { AccountGrant } from "../models/AccountControl.js";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Store from "../models/Store.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Customer from "../models/Person.js";
import Invoice from "../models/Invoice.js";
import { BookstoreAudit, BookstoreReceipt, StockMovement, BookstorePayment, BookstoreSequence, ReversalRequest, SaleReversal } from "../models/BookstoreControl.js";
import { submitAuthenticatedOrder, quoteOrder, completeOrder, claimOrder, cancelOrder, requestReversal, applyReversal } from "../services/bookstoreOrders.js";
import { accountAdapter } from "./accountManagementAdapter.js";
import { removeOrderFromQueue } from "../services/cashierQueue.js";

process.env.JWT_SECRET = "b03-orders-synthetic-key";
const id = () => new mongoose.Types.ObjectId();
const cloneValue = value => mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(value));
function fixture(t) {
  const storeId = id(), customerId = id(), productId = id();
  const accounts = ["admin", "store_manager", "cashier", "cashier", "customer"].map((role, index) => ({ _id: id(), identifier: `synthetic-${index}`, role, confirmed: true, accountState: "active", tokenVersion: 0, authorityVersion: 0, storeIds: [storeId] }));
  const f = accountAdapter(t, accounts, { extraModels: [Store, Customer, Invoice, BookstoreAudit, BookstoreReceipt, StockMovement, BookstorePayment, BookstoreSequence, ReversalRequest, SaleReversal], cloneValue });
  f.store.get(Store.modelName).set(String(storeId), { _id: storeId, name: "Synthetic", createdBy: accounts[0]._id, orderCustomer: customerId });
  f.store.get(Customer.modelName).set(String(customerId), { _id: customerId, owner: accounts[0]._id, storeId, name: "Bookstore orders", isDeleted: false });
  f.store.get(Product.modelName).set(String(productId), { _id: productId, owner: accounts[0]._id, storeId, name: "Book", sku: "BOOK", category: "Books", price: 15050, stock: 3, isActive: true, moneyUnit: "PHP-centavos" });
  const actor = index => ({ id: String(accounts[index]._id), role: accounts[index].role, tokenVersion: 0 });
  const command = extra => ({ storeId: String(storeId), operationId: randomUUID(), reason: "Synthetic approved action", ...extra });
  const submit = index => submitAuthenticatedOrder(actor(index), { storeId: String(storeId), operationId: randomUUID(), items: [{ product: String(productId), quantity: 1 }] });
  const settle = async (orderId, extra = {}) => {
    const quote = await quoteOrder(actor(2), orderId, storeId);
    return completeOrder(actor(2), orderId, command({ quote: quote.quote, confirmedTotal: quote.total, paymentConfirmed: true, paymentMethod: "cash", ...extra }));
  };
  return { ...f, storeId, productId, accounts, actor, command, submit, settle, stock: () => f.rows(Product)[0].stock };
}

test("B03 submission/claim/completion has one payment/receipt/deduction and immutable quoted prices", async t => {
  const f = fixture(t), pending = await f.submit(4);
  assert.equal(f.stock(), 3); assert.equal(f.rows(BookstorePayment).length, 0); assert.equal(f.rows(Invoice).length, 0);
  assert.deepEqual(Object.keys(pending).sort(), ["operationId", "orderId", "orderStatus", "reference"]);
  await claimOrder(f.actor(2), pending.orderId, f.command());
  await assert.rejects(claimOrder(f.actor(3), pending.orderId, f.command()), error => error.statusCode === 409);
  const quote = await quoteOrder(f.actor(2), pending.orderId, f.storeId);
  const body = f.command({ quote: quote.quote, confirmedTotal: 15050, paymentConfirmed: true, paymentMethod: "cash" });
  const sale = await completeOrder(f.actor(2), pending.orderId, body);
  await completeOrder(f.actor(2), pending.orderId, body);
  assert.equal(f.stock(), 2); assert.equal(f.rows(StockMovement).length, 1); assert.equal(f.rows(BookstorePayment).length, 1); assert.equal(f.rows(Invoice).length, 1);
  assert.equal(sale.receipt.items[0].unitPrice, 15050); assert.equal(f.rows(Order)[0].amountPaid, 15050);
  f.store.get(Product.modelName).get(String(f.productId)).price = 20000;
  assert.equal(f.rows(Invoice)[0].snapshot.items[0].unitPrice, 15050);
});

test("student reference insert collision retries a rolled-back submission without duplicating records", async t => {
  const f = fixture(t), insert = Order.collection.insertOne;
  let attempts = 0;
  t.mock.method(Order.collection, "insertOne", async function (...args) {
    if (++attempts === 1) throw new mongoose.mongo.MongoServerError({ code: 11000, keyPattern: { bookstoreReference: 1 } });
    return insert.apply(this, args);
  });
  const submitted = await f.submit(4);
  assert.match(submitted.reference, /^UPH-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(attempts, 2); assert.equal(f.rows(Order).length, 1); assert.equal(f.rows(BookstoreReceipt).length, 1);
  assert.equal(f.stats.commits, 1); assert.equal(f.stock(), 3);
  await claimOrder(f.actor(2), submitted.orderId, f.command());
  const sale = await f.settle(submitted.orderId);
  assert.equal(sale.receipt.reference, submitted.reference);
  assert.equal(sale.orderId, submitted.orderId);
});

test("Cashier removes only the cancelled queue entry while preserving its order, reference, cancellation and audit history", async t => {
  const f = fixture(t), cancelled = await f.submit(4), active = await f.submit(4);
  await claimOrder(f.actor(2), cancelled.orderId, f.command());
  const oldQuote = await quoteOrder(f.actor(2), cancelled.orderId, f.storeId);
  await cancelOrder(f.actor(1), cancelled.orderId, f.command({ reason: "Existing cancellation reason" }));
  const orderBefore = cloneValue(f.rows(Order).find(row => String(row._id) === cancelled.orderId));
  const cancellationBefore = cloneValue(f.rows(BookstoreAudit).filter(row => row.action === "order.cancelled"));
  assert.deepEqual((await pendingQueue(f.actor(2), f.storeId)).orders.map(row => row.orderId), [active.orderId]);
  assert.equal((await pendingQueue(f.actor(2), f.storeId, true)).orders.length, 2);
  for (const index of [0, 1, 4]) await assert.rejects(removeOrderFromQueue(f.actor(index), cancelled.orderId, f.command()), error => error.statusCode === 403);
  await assert.rejects(pendingQueue(f.actor(1), f.storeId, true), error => error.statusCode === 403);
  const body = f.command(), result = await removeOrderFromQueue(f.actor(2), cancelled.orderId, body);
  assert.equal(result.queueRemoved, true);
  assert.deepEqual(await removeOrderFromQueue(f.actor(2), cancelled.orderId, body), result);
  await removeOrderFromQueue(f.actor(3), cancelled.orderId, f.command());
  for (const index of [2, 3]) assert.deepEqual((await pendingQueue(f.actor(index), f.storeId, true)).orders.map(row => row.orderId), [active.orderId]);
  assert.deepEqual(f.rows(Order).find(row => String(row._id) === cancelled.orderId), orderBefore);
  assert.deepEqual(f.rows(BookstoreAudit).filter(row => row.action === "order.cancelled"), cancellationBefore);
  assert.equal(f.rows(BookstoreAudit).filter(row => row.action === "order.queue_removed").length, 1);
  assert.equal(f.rows(Order).length, 2); assert.equal(f.stock(), 3);
  for (const Model of [Invoice, BookstorePayment, StockMovement]) assert.equal(f.rows(Model).length, 0);
  await assert.rejects(claimOrder(f.actor(2), cancelled.orderId, f.command()), error => error.statusCode === 404);
  await assert.rejects(quoteOrder(f.actor(2), cancelled.orderId, f.storeId), error => error.statusCode === 404);
  await assert.rejects(completeOrder(f.actor(2), cancelled.orderId, f.command({ quote: oldQuote.quote, confirmedTotal: oldQuote.total, paymentConfirmed: true, paymentMethod: "cash" })), error => error.statusCode === 409);
  assert.deepEqual(f.rows(Order).find(row => String(row._id) === cancelled.orderId), orderBefore);
});

test("queue removal cannot touch other stores, POS checkouts, completed sales or cancellations with payment linkage", async t => {
  const f = fixture(t), student = await f.submit(4), pos = await f.submit(2);
  await cancelOrder(f.actor(1), student.orderId, f.command());
  await assert.rejects(removeOrderFromQueue(f.actor(2), student.orderId, f.command({ storeId: String(id()) })), error => error.statusCode === 403);
  await assert.rejects(removeOrderFromQueue(f.actor(2), pos.orderId, f.command()), error => error.statusCode === 404);
  const sale = await f.settle(pos.orderId);
  await assert.rejects(removeOrderFromQueue(f.actor(2), sale.orderId, f.command()), error => error.statusCode === 404);
  const order = f.store.get(Order.modelName).get(student.orderId);
  order.amountPaid = 1;
  await assert.rejects(removeOrderFromQueue(f.actor(2), student.orderId, f.command()), error => error.statusCode === 409);
  order.amountPaid = 0; order.ledgerRecorded = true;
  await assert.rejects(removeOrderFromQueue(f.actor(2), student.orderId, f.command()), error => error.statusCode === 409);
  order.ledgerRecorded = false;
  const paymentId = id(); f.store.get(BookstorePayment.modelName).set(String(paymentId), { _id: paymentId, transactionId: order._id, storeId: f.storeId, amount: 1 });
  await assert.rejects(removeOrderFromQueue(f.actor(2), student.orderId, f.command()), error => error.statusCode === 409);
  assert.equal(f.rows(BookstoreAudit).filter(row => row.action === "order.queue_removed").length, 0);
});

test("queue marker and command receipt roll back together when audit persistence fails", async t => {
  const f = fixture(t), order = await f.submit(4);
  await cancelOrder(f.actor(1), order.orderId, f.command());
  const before = JSON.stringify(f.rows(Order)), receipts = f.rows(BookstoreReceipt).length, create = BookstoreAudit.create;
  t.mock.method(BookstoreAudit, "create", async function (rows, ...options) {
    if (rows[0].action === "order.queue_removed") throw new Error("Synthetic queue audit failure");
    return create.call(this, rows, ...options);
  });
  await assert.rejects(removeOrderFromQueue(f.actor(2), order.orderId, f.command()), /Synthetic queue audit failure/);
  assert.equal(JSON.stringify(f.rows(Order)), before); assert.equal(f.rows(BookstoreReceipt).length, receipts);
  assert.equal((await pendingQueue(f.actor(2), f.storeId, true)).orders.length, 1);
});

for (const assigned of [false, true]) test(`Unpaid removal archives assigned=${assigned} and rejects stale claims and payment quotes`, async t => {
  const f = fixture(t), submitted = await f.submit(4), other = await f.submit(4);
  let quote;
  if (assigned) { await claimOrder(f.actor(2), submitted.orderId, f.command()); quote = await quoteOrder(f.actor(2), submitted.orderId, f.storeId); }
  const before = cloneValue(f.rows(Order).find(row => String(row._id) === submitted.orderId));
  const body = f.command({ includeUnpaid: true });
  await removeOrderFromQueue(f.actor(2), submitted.orderId, body);
  await removeOrderFromQueue(f.actor(2), submitted.orderId, body);
  await removeOrderFromQueue(f.actor(3), submitted.orderId, f.command());
  assert.deepEqual(f.rows(Order).find(row => String(row._id) === submitted.orderId), before);
  assert.deepEqual((await pendingQueue(f.actor(2), f.storeId, true)).orders.map(row => row.orderId), [other.orderId]);
  assert.equal(f.rows(BookstoreAudit).filter(row => row.action === "order.queue_removed").length, 1);
  await assert.rejects(claimOrder(f.actor(2), submitted.orderId, f.command()), error => error.statusCode === 404);
  await assert.rejects(quoteOrder(f.actor(2), submitted.orderId, f.storeId), error => error.statusCode === 404);
  if (quote) await assert.rejects(completeOrder(f.actor(2), submitted.orderId, f.command({ quote: quote.quote, confirmedTotal: quote.total, paymentConfirmed: true, paymentMethod: "cash" })), error => error.statusCode === 409);
  assert.equal(f.stock(), 3);
  for (const Model of [Invoice, BookstorePayment, StockMovement]) assert.equal(f.rows(Model).length, 0);
});

test("unpaid removal options do not allow completed sales, recorded payments, other roles or invalid flags", async t => {
  const f = fixture(t), submitted = await f.submit(4);
  for (const index of [0, 1, 4]) await assert.rejects(removeOrderFromQueue(f.actor(index), submitted.orderId, f.command({ includeUnpaid: true })), error => error.statusCode === 403);
  for (const includeUnpaid of ["true", 1, null]) await assert.rejects(removeOrderFromQueue(f.actor(2), submitted.orderId, f.command({ includeUnpaid })), error => error.statusCode === 400);
  const order = f.store.get(Order.modelName).get(submitted.orderId);
  order.amountPaid = 1;
  await assert.rejects(removeOrderFromQueue(f.actor(2), submitted.orderId, f.command({ includeUnpaid: true })), error => error.statusCode === 409);
  order.amountPaid = 0;
  await claimOrder(f.actor(2), submitted.orderId, f.command()); await f.settle(submitted.orderId);
  const before = cloneValue(f.rows(Order)[0]), stock = f.stock();
  await assert.rejects(removeOrderFromQueue(f.actor(2), submitted.orderId, f.command({ includeUnpaid: true })), error => error.statusCode === 409);
  assert.deepEqual(f.rows(Order)[0], before); assert.equal(f.stock(), stock);
  assert.equal(f.rows(BookstorePayment).length, 1); assert.equal(f.rows(Invoice).length, 1);
});

for (const paymentMethod of ["cash", "gcash"]) test(`cashier cart submission proceeds directly to ${paymentMethod} payment without entering the queue`, async t => {
  const f = fixture(t);
  const body = { storeId: String(f.storeId), operationId: randomUUID(), items: [{ product: String(f.productId), quantity: 1 }] };
  const submitted = await submitAuthenticatedOrder(f.actor(2), body);
  assert.equal(submitted.payment.orderId, submitted.orderId);
  assert.equal(submitted.payment.assignedTo, f.actor(2).id);
  assert.equal(submitted.payment.total, 15050);
  assert.equal((await quoteOrder(f.actor(2), submitted.orderId, f.storeId)).quote, submitted.payment.quote);
  const replay = await submitAuthenticatedOrder(f.actor(2), body);
  assert.deepEqual(replay, submitted); assert.equal(f.rows(Order).length, 1);
  assert.equal(f.stock(), 3); assert.equal(f.rows(BookstorePayment).length, 0);
  for (const actor of [1, 2, 3]) assert.equal((await pendingQueue(f.actor(actor), f.storeId)).orders.length, 0);
  const student = await f.submit(4);
  assert.equal(student.payment, undefined);
  assert.deepEqual((await pendingQueue(f.actor(2), f.storeId)).orders.map(order => order.orderId), [student.orderId]);
  const payment = f.command({ quote: submitted.payment.quote, confirmedTotal: submitted.payment.total, paymentConfirmed: true, paymentMethod, ...(paymentMethod === "gcash" ? { paymentReference: "CASHIER-DIRECT-GCASH" } : {}) });
  await assert.rejects(completeOrder(f.actor(3), submitted.orderId, payment), error => error.statusCode === 403);
  const sale = await completeOrder(f.actor(2), submitted.orderId, payment);
  await completeOrder(f.actor(2), submitted.orderId, payment);
  assert.equal(sale.orderStatus, "completed"); assert.equal(sale.receipt.paymentMethod, paymentMethod);
  assert.equal(f.stock(), 2); assert.equal(f.rows(BookstorePayment).length, 1); assert.equal(f.rows(Invoice).length, 1);
  assert.deepEqual((await pendingQueue(f.actor(2), f.storeId)).orders.map(order => order.orderId), [student.orderId]);
});

test("B03 price changes require reconfirmation; bank/credit/partial/forged fields have zero effects", async t => {
  const f = fixture(t), pending = await f.submit(2), quote = await quoteOrder(f.actor(2), pending.orderId, f.storeId);
  f.store.get(Product.modelName).get(String(f.productId)).price = 20000;
  await assert.rejects(completeOrder(f.actor(2), pending.orderId, f.command({ quote: quote.quote, confirmedTotal: quote.total, paymentConfirmed: true, paymentMethod: "cash" })), error => error.statusCode === 409);
  for (const extra of [{ paymentMethod: "bank" }, { paymentMethod: "credit" }, { amountPaid: 1 }, { paymentStatus: "partial" }, { owner: String(id()) }, { paymentMethod: "gcash", paymentReference: "" }]) await assert.rejects(f.settle(pending.orderId, extra));
  assert.equal(f.stock(), 3); assert.equal(f.rows(BookstorePayment).length, 0);
});

test("cashier direct checkout rejects stale prices then completes only the revised server quote", async t => {
  const f = fixture(t), draft = await f.submit(2);
  f.store.get(Product.modelName).get(String(f.productId)).price = 20000;
  const payment = f.command({ quote: draft.payment.quote, confirmedTotal: draft.payment.total, paymentConfirmed: true, paymentMethod: "cash" });
  await assert.rejects(completeOrder(f.actor(2), draft.orderId, payment), error => error.statusCode === 409);
  assert.equal(f.stock(), 3); assert.equal(f.rows(BookstorePayment).length, 0);
  const revised = await quoteOrder(f.actor(2), draft.orderId, f.storeId);
  assert.equal(revised.total, 20000); assert.notEqual(revised.quote, draft.payment.quote);
  assert.equal(revised.orderId, draft.orderId); assert.equal(revised.directPayment, true);
  assert.equal(revised.pricesChanged, true); assert.equal(revised.previousTotal, 15050);
  await quoteOrder(f.actor(2), draft.orderId, f.storeId);
  assert.equal(f.rows(Order).length, 1); assert.equal(f.rows(BookstorePayment).length, 0); assert.equal(f.stock(), 3);
  await assert.rejects(completeOrder(f.actor(2), draft.orderId, { ...payment, quote: revised.quote }), error => error.statusCode === 409);
  const sale = await completeOrder(f.actor(2), draft.orderId, { ...payment, quote: revised.quote, confirmedTotal: revised.total });
  assert.equal(sale.receipt.total, 20000); assert.equal(f.stock(), 2);
  await assert.rejects(completeOrder(f.actor(2), draft.orderId, { ...payment, operationId: randomUUID(), quote: revised.quote, confirmedTotal: revised.total }), error => error.statusCode === 409);
  assert.equal(f.rows(StockMovement).length, 1); assert.equal(f.rows(BookstorePayment).length, 1); assert.equal(f.rows(Invoice).length, 1);
});

test("student queue quote retains its original contract and never becomes a cashier direct checkout", async t => {
  const f = fixture(t), student = await f.submit(4);
  await claimOrder(f.actor(2), student.orderId, f.command());
  const quote = await quoteOrder(f.actor(2), student.orderId, f.storeId);
  assert.equal(quote.directPayment, undefined); assert.equal(quote.pricesChanged, undefined); assert.equal(quote.previousTotal, undefined);
  assert.deepEqual((await pendingQueue(f.actor(2), f.storeId)).orders.map(order => order.orderId), [student.orderId]);
});

test("Cashier notification source follows persisted pending orders through claim, completion and cancellation", async t => {
  const f = fixture(t), count = async () => (await pendingQueue(f.actor(2), f.storeId)).orders.length;
  assert.equal(await count(), 0);
  const first = await f.submit(4), second = await f.submit(4);
  await f.submit(2); // A direct POS checkout must not increase the queue badge.
  assert.equal(await count(), 2);
  await claimOrder(f.actor(2), first.orderId, f.command());
  assert.equal(await count(), 2); // Claiming does not settle a pending payment.
  await f.settle(first.orderId);
  assert.equal(await count(), 1);
  await cancelOrder(f.actor(1), second.orderId, f.command());
  assert.equal(await count(), 0);
});

test("cashier GCash direct checkout requires explicit actual-payment attestation and a reference", async t => {
  const f = fixture(t), draft = await f.submit(2);
  const payment = { quote: draft.payment.quote, confirmedTotal: draft.payment.total, paymentMethod: "gcash", paymentReference: "VERIFIED-IN-AUTHORIZED-ACCOUNT" };
  for (const paymentConfirmed of [undefined, false, "true", 1]) {
    await assert.rejects(completeOrder(f.actor(2), draft.orderId, f.command({ ...payment, paymentConfirmed })), error => error.statusCode === 400);
  }
  for (const paymentReference of [undefined, "", "   ", 123]) {
    await assert.rejects(completeOrder(f.actor(2), draft.orderId, f.command({ ...payment, paymentConfirmed: true, paymentReference })), error => error.statusCode === 400);
  }
  assert.equal(f.stock(), 3); assert.equal(f.rows(BookstorePayment).length, 0); assert.equal(f.rows(Invoice).length, 0);
  assert.equal(f.rows(Order)[0].paymentStatus, "unpaid");
  await completeOrder(f.actor(2), draft.orderId, f.command({ ...payment, paymentConfirmed: true }));
  assert.equal(f.rows(BookstorePayment).length, 1); assert.equal(f.stock(), 2);
});

for (const unavailable of [{ stock: 0 }, { isActive: false }]) test(`cashier direct checkout rechecks availability at payment: ${JSON.stringify(unavailable)}`, async t => {
  const f = fixture(t), draft = await f.submit(2);
  Object.assign(f.store.get(Product.modelName).get(String(f.productId)), unavailable);
  await assert.rejects(completeOrder(f.actor(2), draft.orderId, f.command({ quote: draft.payment.quote, confirmedTotal: draft.payment.total, paymentConfirmed: true, paymentMethod: "cash" })), error => error.statusCode === 409);
  assert.equal(f.rows(Order)[0].paymentStatus, "unpaid");
  for (const model of [StockMovement, BookstorePayment, BookstoreSequence, Invoice]) assert.equal(f.rows(model).length, 0);
  assert.equal((await pendingQueue(f.actor(2), f.storeId)).orders.length, 0);
});

test("cashier direct origin is server-controlled and other roles retain submission authorization", async t => {
  const f = fixture(t), fields = { storeId: String(f.storeId), operationId: randomUUID(), items: [{ product: String(f.productId), quantity: 1 }] };
  for (const index of [0, 1]) await assert.rejects(submitAuthenticatedOrder(f.actor(index), fields), error => error.statusCode === 403);
  for (const index of [2, 4]) for (const forged of [{ origin: "guest" }, { directPayment: true }, { assignedTo: f.actor(3).id }]) {
    await assert.rejects(submitAuthenticatedOrder(f.actor(index), { ...fields, ...forged }), error => error.statusCode === 400);
  }
  assert.equal(f.rows(Order).length, 0);
  const draft = await f.submit(2);
  assert.equal(f.rows(Order)[0].origin, "pos"); assert.equal(f.rows(Order)[0].directPayment, true);
  await assert.rejects(quoteOrder(f.actor(3), draft.orderId, f.storeId), error => error.statusCode === 404);
  await assert.rejects(claimOrder(f.actor(3), draft.orderId, f.command()), error => error.statusCode === 409);
  const otherStore = id();
  await assert.rejects(quoteOrder(f.actor(2), draft.orderId, otherStore), error => error.statusCode === 403);
});

test("B03 failed audit rolls back sale, stock, movement, sequence, payment and receipt", async t => {
  const f = fixture(t), pending = await f.submit(2);
  t.mock.method(BookstoreAudit.collection, "insertOne", () => { throw new Error("Synthetic required audit failure"); });
  await assert.rejects(f.settle(pending.orderId));
  assert.equal(f.stock(), 3); assert.equal(f.rows(Order)[0].orderStatus, "pending");
  for (const Model of [StockMovement, BookstorePayment, BookstoreSequence, Invoice]) assert.equal(f.rows(Model).length, 0);
});

test("B03 Manager-only unpaid cancellation has no payment or inventory effects", async t => {
  const f = fixture(t), pending = await f.submit(4);
  await assert.rejects(cancelOrder(f.actor(2), pending.orderId, f.command()), error => error.statusCode === 403);
  await cancelOrder(f.actor(1), pending.orderId, f.command());
  assert.equal(f.rows(Order)[0].orderStatus, "cancelled"); assert.equal(f.stock(), 3); assert.equal(f.rows(StockMovement).length, 0);
  await assert.rejects(claimOrder(f.actor(2), pending.orderId, f.command()));
});

test("B03 whole-sale original-method reversal requires Manager and restocks only saleable returns", async t => {
  const f = fixture(t), pending = await f.submit(2); await f.settle(pending.orderId, { paymentMethod: "gcash", paymentReference: "GCASH-SALE" });
  await assert.rejects(requestReversal(f.actor(3), pending.orderId, f.command()), error => error.statusCode === 403);
  const request = await requestReversal(f.actor(2), pending.orderId, f.command());
  const body = f.command({ repaymentConfirmed: true, repaymentMethod: "gcash", refundReference: "GCASH-REFUND", returnsConfirmed: true, returned: [] });
  await assert.rejects(applyReversal(f.actor(2), request.requestId, body), error => error.statusCode === 403);
  await assert.rejects(applyReversal(f.actor(1), request.requestId, { ...body, repaymentMethod: "cash" }), error => error.statusCode === 400);
  const result = await applyReversal(f.actor(1), request.requestId, body);
  await applyReversal(f.actor(1), request.requestId, body);
  assert.equal(result.amount, 15050); assert.equal(f.stock(), 2); assert.equal(f.rows(SaleReversal).length, 1);
  assert.equal(f.rows(Order)[0].amountPaid, 15050); assert.equal(f.rows(Order)[0].orderStatus, "completed");
  assert.equal(f.rows(Invoice)[0].status, "paid"); assert.equal(f.rows(BookstorePayment)[0].amount, 15050);
});

test("B03 returned quantities, reversal replay and concurrent completion cannot duplicate stock", async t => {
  const f = fixture(t), pending = await f.submit(2); await f.settle(pending.orderId);
  const request = await requestReversal(f.actor(2), pending.orderId, f.command());
  const body = f.command({ repaymentConfirmed: true, repaymentMethod: "cash", returnsConfirmed: true, returned: [{ productId: String(f.productId), quantity: 1 }] });
  await assert.rejects(applyReversal(f.actor(1), request.requestId, { ...body, returned: [{ productId: String(f.productId), quantity: 2 }] }));
  await applyReversal(f.actor(1), request.requestId, body); assert.equal(f.stock(), 3);
  await assert.rejects(applyReversal(f.actor(1), request.requestId, f.command({ ...body, operationId: randomUUID() })), error => error.statusCode === 409);
  assert.equal(f.stock(), 3); assert.equal(f.rows(StockMovement).length, 2);
});

test("B03 last-item competing cashiers have one sale winner under staged realm ordering", async t => {
  const f = fixture(t); f.store.get(Product.modelName).get(String(f.productId)).stock = 1;
  const a = await f.submit(2), b = await f.submit(3);
  const quoteA = await quoteOrder(f.actor(2), a.orderId, f.storeId), quoteB = await quoteOrder(f.actor(3), b.orderId, f.storeId);
  const results = await Promise.allSettled([
    completeOrder(f.actor(2), a.orderId, f.command({ quote: quoteA.quote, confirmedTotal: quoteA.total, paymentConfirmed: true, paymentMethod: "cash" })),
    completeOrder(f.actor(3), b.orderId, f.command({ quote: quoteB.quote, confirmedTotal: quoteB.total, paymentConfirmed: true, paymentMethod: "cash" })),
  ]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  assert.equal(f.stock(), 0); assert.equal(f.rows(BookstorePayment).length, 1); assert.equal(f.rows(StockMovement).length, 1); assert.equal(f.rows(Invoice).length, 1);
});

function seedGrant(f, recipient, capability, resourceId, issuer = f.accounts[0]._id) {
  const grantId = id();
  f.store.get(AccountGrant.modelName).set(String(grantId), { _id: grantId, recipientAccountId: f.accounts[recipient]._id, capability, scope: { kind: capability === "order.fulfill" ? "assigned-order" : "authorized-transaction", resourceIds: [String(resourceId)] }, grantedBy: issuer, reason: "Synthetic bounded approval", effectiveAt: new Date(Date.now()-1000), expiresAt: new Date(Date.now()+60000), recipientVersion: 0, grantorAuthorityVersion: 0, revokedAt: null, operationId: randomUUID() });
  return grantId;
}
test("B03 conditional Manager completion conjuncts sale, payment and receipt grants for exact order", async t => {
  const f=fixture(t), pending=await f.submit(4);
  await assert.rejects(claimOrder(f.actor(1),pending.orderId,f.command()),e=>e.statusCode===403);
  seedGrant(f,1,"order.fulfill",pending.orderId);
  await claimOrder(f.actor(1),pending.orderId,f.command());
  seedGrant(f,1,"sale.process",pending.orderId);
  const quote=await quoteOrder(f.actor(1),pending.orderId,f.storeId);
  const body=f.command({quote:quote.quote,confirmedTotal:quote.total,paymentConfirmed:true,paymentMethod:"cash"});
  await assert.rejects(completeOrder(f.actor(1),pending.orderId,body),e=>e.statusCode===403);
  seedGrant(f,1,"payment.record",pending.orderId);
  await assert.rejects(completeOrder(f.actor(1),pending.orderId,body),e=>e.statusCode===403);
  seedGrant(f,1,"receipt.issue",pending.orderId);
  await completeOrder(f.actor(1),pending.orderId,body);
  assert.equal(f.stock(),2);assert.equal(f.rows(BookstorePayment).length,1);assert.equal(f.rows(Invoice).length,1);
});
test("B03 conditional Admin reversal requires both approval and apply grants bound to original sale",async t=>{
  const f=fixture(t),pending=await f.submit(2);await f.settle(pending.orderId);
  const request=await requestReversal(f.actor(2),pending.orderId,f.command());
  const issuer=id();f.store.get("User").set(String(issuer),{_id:issuer,identifier:"other-admin",role:"admin",confirmed:true,accountState:"active",tokenVersion:0,authorityVersion:0});
  const body=f.command({repaymentConfirmed:true,repaymentMethod:"cash",returnsConfirmed:true,returned:[]});
  seedGrant(f,0,"reversal.apply",pending.orderId,issuer);
  await assert.rejects(applyReversal(f.actor(0),request.requestId,body),e=>e.statusCode===403);
  seedGrant(f,0,"reversal.approve",pending.orderId,issuer);
  assert.equal((await reversalRequests(f.actor(0),f.storeId)).requests.length,1);
  const invoice=f.rows(Invoice)[0];
  await reverseInvoiceAlias(f.actor(0),invoice._id,{...body,requestId:request.requestId});
  assert.equal(f.rows(SaleReversal).length,1);assert.equal(f.stock(),2);
  for(const grant of f.store.get(AccountGrant.modelName).values())grant.revokedAt=new Date();
  const acknowledgment=await reconcileBookstoreOperation(f.actor(0),f.storeId,body.operationId);
  assert.deepEqual(acknowledgment,{outcome:"applied",operationId:body.operationId});
});
