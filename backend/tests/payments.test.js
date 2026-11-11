import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Transaction from "../models/Order.js";
import Customer from "../models/Person.js";
import Invoice from "../models/Invoice.js";
import DebtPayment from "../models/DebtPayment.js";
import User from "../models/User.js";
import orderRoutes from "../routes/OrderRoute.js";
import { generateToken } from "../utils/generateToken.js";
import { createDebtPayment } from "../controllers/DebtPaymentController.js";
import { markAsPaid } from "../controllers/OrderController.js";
import { id, query, invoke, http } from "./helpers.js";

process.env.JWT_SECRET = "phase10a-synthetic-payment-signing-secret";

function fixture(t) {
  const owner = id(), customer = id();
  const session = {
    commits: 0, aborts: 0, ended: 0,
    startTransaction() {}, async commitTransaction() { this.commits++; },
    async abortTransaction() { this.aborts++; }, endSession() { this.ended++; },
  };
  const sale = new Transaction({ owner, customer, items: [{ product: id(), quantity: 1, unitPrice: 1000, subtotal: 1000 }],
    totalAmount: 1000, amountPaid: 0, balance: 1000, orderStatus: "completed" });
  sale.isNew = false;
  const payments = [], invoiceUpdates = [];
  t.mock.method(mongoose, "startSession", async () => session);
  t.mock.method(Customer, "findOne", (filter) => query(String(filter._id) === String(customer) ? { _id: customer } : null));
  t.mock.method(Transaction, "findOne", () => query(sale));
  t.mock.method(Transaction, "find", () => query([sale]));
  const save = t.mock.method(Transaction.collection, "updateOne", async () => ({ acknowledged: true, matchedCount: 1 }));
  t.mock.method(Invoice, "updateOne", async (...args) => { invoiceUpdates.push(args); return { acknowledged: true, matchedCount: 1 }; });
  t.mock.method(DebtPayment.collection, "insertOne", async (doc) => { payments.push({ ...doc }); return { acknowledged: true, insertedId: doc._id }; });
  const req = (amount, extra = {}) => ({ user: { id: owner }, params: {}, body: { customer, transaction: sale._id, amountPaid: amount, paymentMethod: "cash", ...extra } });
  t.after(() => assert.equal(mongoose.connection.readyState, 0));
  return { owner, customer, sale, session, payments, invoiceUpdates, save, req };
}

test("linked partial collection changes balance exactly once and writes one payment", async (t) => {
  const f = fixture(t);
  const result = await invoke(createDebtPayment, f.req(100));
  assert.equal(result.statusCode, 201);
  assert.equal(f.sale.amountPaid, 100);
  assert.equal(f.sale.balance, 900);
  assert.equal(f.sale.paymentStatus, "partial");
  assert.equal(f.payments.length, 1);
  assert.equal(f.save.mock.callCount(), 1);
  assert.equal(f.invoiceUpdates.at(-1)[1].$set.status, "partial");
  assert.equal(f.session.commits, 1);
  assert.equal(f.session.aborts, 0);
});

test("full linked settlement succeeds and synchronizes paid status once", async (t) => {
  const f = fixture(t);
  const result = await invoke(createDebtPayment, f.req(1000));
  assert.equal(result.statusCode, 201);
  assert.equal(f.sale.amountPaid, 1000);
  assert.equal(f.sale.balance, 0);
  assert.equal(f.sale.paymentStatus, "paid");
  assert.equal(f.payments.length, 1);
  assert.equal(f.save.mock.callCount(), 1);
  assert.equal(f.invoiceUpdates.at(-1)[1].$set.status, "paid");
});

test("order settlement uses customer ID, preserves reference and sequential replay has no extra effect", async (t) => {
  const f = fixture(t);
  const req = { user: { id: f.owner }, params: { id: f.sale.id }, body: { paymentMethod: "gcash", paymentReference: "SYNTHETIC-REF" } };
  const original = structuredClone(req.body);
  let result = await invoke(markAsPaid, req);
  assert.equal(result.statusCode, 201);
  assert.equal(f.sale.balance, 0);
  assert.equal(f.payments.length, 1);
  assert.equal(f.payments[0].paymentReference, "SYNTHETIC-REF");
  assert.deepEqual(req.body, original);
  result = await invoke(markAsPaid, req);
  assert.equal(result.statusCode, 200);
  assert.equal(f.payments.length, 1);
  assert.equal(f.save.mock.callCount(), 1);
});

test("general customer collection preserves oldest-first flow without linked hook side effects", async (t) => {
  const f = fixture(t);
  const result = await invoke(createDebtPayment, f.req(400, { transaction: undefined }));
  assert.equal(result.statusCode, 201);
  assert.equal(f.sale.amountPaid, 400);
  assert.equal(f.sale.balance, 600);
  assert.equal(f.payments.length, 1);
  assert.equal(f.payments[0].transaction, undefined);
});

test("overpayment and missing electronic reference reject before balance or payment writes", async (t) => {
  const f = fixture(t);
  assert.equal((await invoke(createDebtPayment, f.req(1001))).statusCode, 400);
  assert.equal((await invoke(createDebtPayment, f.req(100, { paymentMethod: "bank" }))).statusCode, 400);
  assert.equal(f.sale.amountPaid, 0);
  assert.equal(f.payments.length, 0);
  assert.equal(f.save.mock.callCount(), 0);
  assert.equal(f.session.aborts, 2);
});

test("payment insert failure aborts session rather than reports settlement success", async (t) => {
  const f = fixture(t);
  t.mock.method(DebtPayment.collection, "insertOne", async () => { throw new Error("synthetic insert failure"); });
  const result = await invoke(createDebtPayment, f.req(100));
  assert.equal(result.statusCode, 400);
  assert.equal(f.session.commits, 0);
  assert.equal(f.session.aborts, 1);
  assert.equal(f.session.ended, 1);
});

test("legacy order payment HTTP route rejects anonymous and unscoped admin settlement", async (t) => {
  const f = fixture(t);
  const user = { _id: f.owner, confirmed: true, role: "admin" };
  t.mock.method(User, "findById", () => query(user));
  const request = await http(t, orderRoutes, "/api/orders");
  const url = `/api/orders/${f.sale.id}/pay`;
  assert.equal((await request(url, { method: "PATCH", body: {} })).status, 401);
  assert.equal(f.payments.length, 0);
  const token = await generateToken(user);
  const result = await request(url, { method: "PATCH", token, body: { paymentMethod: "cash" } });
  assert.equal(result.status, 403);
  assert.equal(f.sale.balance, 1000);
  assert.equal(f.payments.length, 0);
  assert.equal((await request(url, { method: "PATCH", token, body: {} })).status, 403);
  assert.equal(f.payments.length, 0);
});

test("general collection applies across existing oldest-first results without duplicating either sale", async (t) => {
  const f = fixture(t);
  const second = new Transaction({ owner: f.owner, customer: f.customer, items: [{ product: id(), quantity: 1, unitPrice: 500, subtotal: 500 }],
    totalAmount: 500, amountPaid: 0, balance: 500, orderStatus: "completed" });
  second.isNew = false;
  Transaction.find = () => query([f.sale, second]);
  const result = await invoke(createDebtPayment, f.req(1200, { transaction: undefined }));
  assert.equal(result.statusCode, 201);
  assert.equal(f.sale.amountPaid, 1000);
  assert.equal(f.sale.balance, 0);
  assert.equal(second.amountPaid, 200);
  assert.equal(second.balance, 300);
  assert.equal(f.payments.length, 1);
  assert.equal(f.payments[0].amountPaid, 1200);
  assert.equal(f.save.mock.callCount(), 2);
});
