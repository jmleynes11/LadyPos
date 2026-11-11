import bcrypt from "bcryptjs";
import Expense from "../models/Expense.js";
import DebtPayment from "../models/DebtPayment.js";
import { AccountReview, AccountGrant, AccountReceipt } from "../models/AccountControl.js";
import { matches } from "./accountManagementAdapter.js";
import { quoteOrder, requestReversal, cancelOrder } from "../services/bookstoreOrders.js";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import Store from "../models/Store.js";
import Product from "../models/Product.js";
import Customer from "../models/Person.js";
import Invoice from "../models/Invoice.js";
import Order from "../models/Order.js";
import { BookstoreAudit, BookstoreReceipt, StockMovement, BookstorePayment, BookstoreSequence, ReversalRequest, SaleReversal, GuestOrderIntent } from "../models/BookstoreControl.js";
import { createApp } from "../app.js";
import { generateToken } from "../utils/generateToken.js";
import { accountAdapter } from "./accountManagementAdapter.js";
import { BOOKSTORE_ROUTE_MANIFEST } from "../auth/bookstoreRouteManifest.js";
import { collectRoutes } from "./routeInventoryAdapter.js";
import { guestBookstoreGuard } from "../middleware/guestBookstore.js";
import { photoFixture } from "./productPhotoFixture.js";

test("Manager product creation route stores photos and returns them through staff, student and guest catalogs", async t => {
  const f = await fixture(t), imageUrl = photoFixture();
  const body = f.command({ name: "Photo book", category: "Books", price: 1000, imageUrl });
  const created = await f.post("/products", 1, body);
  assert.equal(created.status, 201);
  const productId = created.body.data.productId;
  for (const actor of [0, 1, 2, 4]) {
    const detail = await f.request(`/products/${productId}?storeId=${f.storeId}`, { actor });
    assert.equal(detail.status, 200); assert.equal(detail.body.data.imageUrl, imageUrl);
    const catalog = await f.request(`/products?storeId=${f.storeId}`, { actor });
    assert.equal(catalog.status, 200); assert.equal(catalog.body.data.find(row => row._id === productId).imageUrl, imageUrl);
  }
  const guest = await f.request("/bookstore/guest/catalog");
  assert.equal(guest.body.data.products.find(row => row.productId === productId).imageUrl, imageUrl);
  for (const actor of [2, 4, 6, undefined]) assert.equal((await f.post("/products", actor, f.command({ name: "Denied", price: 1 }))).status, actor === undefined ? 401 : 403);
  for (const change of [{ price: 1200 }, { sellingPrice: 1200 }, { name: "Rejected", price: 1200 }]) {
    assert.equal((await f.request(`/products/${productId}`, { actor: 1, method: "PUT", body: f.command(change) })).status, 403);
  }
  assert.equal((await f.request(`/products/${productId}`, { actor: 1, method: "PUT", body: f.command({ name: "Updated photo book" }) })).status, 200);
  assert.equal(f.store.get(Product.modelName).get(productId).price, 1000);
  assert.equal(f.store.get(Product.modelName).get(productId).stock, 0);
  assert.equal((await f.request(`/products/${productId}`, { actor: 0, method: "PUT", body: f.command({ price: 1200 }) })).status, 200);
  assert.equal((await f.request(`/products/${productId}`, { actor: 1, method: "DELETE", body: f.command() })).status, 200);
  assert.equal((await f.post("/products", 1, f.command({ name: "Bad photo", price: 1, imageUrl: "data:image/png;base64,AAAA" }))).status, 400);
  assert.equal((await f.post("/products", 1, f.command({ name: "Other store", price: 1, storeId: String(id()) }))).status, 403);
  assert.equal((await f.post("/products", 0, f.command({ name: "Admin photo", price: 1, imageUrl }))).status, 201);
});

test("Customer order details use owned saved snapshots, reject archived/foreign orders and never write orders", async t => {
  const f = await fixture(t);
  const product = f.store.get(Product.modelName).get(String(f.productId));
  Object.assign(product, { name: "Original uniform", category: "Clothing", price: 27500, sizeStocks: { M: 10 }, imageUrl: photoFixture() });
  const submitted = await f.post("/bookstore/orders", 4, { storeId: String(f.storeId), operationId: randomUUID(), items: [{ product: String(f.productId), quantity: 2, size: "M" }] });
  assert.equal(submitted.status, 200);
  const { orderId, reference } = submitted.body.data;
  const path = `/bookstore/orders/own/${orderId}?storeId=${f.storeId}`;
  Object.assign(product, { name: "Changed catalog name", price: 99999, isActive: false });
  const original = JSON.stringify(f.rows(Order)), auditCount = f.rows(BookstoreAudit).length;
  for (let i = 0; i < 2; i++) {
    const response = await f.request(path, { actor: 4 });
    assert.equal(response.status, 200);
    const detail = response.body.data.order;
    assert.equal(detail.reference, reference); assert.equal(detail.orderId, orderId);
    assert.equal(detail.items[0].name, "Original uniform"); assert.equal(detail.items[0].size, "M");
    assert.equal(detail.items[0].quantity, 2); assert.equal(detail.items[0].unitPrice, 27500); assert.equal(detail.items[0].subtotal, 55000);
    assert.equal(detail.total, 55000); assert.equal(detail.totalQuantity, 2); assert.equal(detail.paymentStatus, "unpaid");
    assert.equal(detail.storeName, "Synthetic bookstore"); assert(detail.submittedAt); assert.equal(detail.items[0].imageUrl, product.imageUrl);
    for (const field of ["studentUser", "customer", "credential", "paymentReference", "owner", "costPrice"]) assert(!JSON.stringify(detail).includes(`"${field}"`));
  }
  assert.equal(JSON.stringify(f.rows(Order)), original); assert.equal(f.rows(BookstoreAudit).length, auditCount);
  assert.equal((await f.request(path, { actor: 5 })).status, 404);
  for (const actor of [0, 1, 2, 6, undefined]) assert.equal((await f.request(path, { actor })).status, actor === undefined ? 401 : 403);
  assert.equal((await f.request(`/bookstore/orders/own/${orderId}?storeId=${id()}`, { actor: 4 })).status, 403);
  assert.equal((await f.request(`/bookstore/orders/own/${reference}?storeId=${f.storeId}`, { actor: 4 })).status, 400);
  f.store.get(Product.modelName).delete(String(f.productId));
  const missing = await f.request(path, { actor: 4 });
  assert.equal(missing.status, 200); assert.equal(missing.body.data.order.items[0].imageUrl, "");
  assert.equal(missing.body.data.order.items[0].name, "Original uniform");
  assert.equal((await f.post(`/bookstore/orders/${orderId}/remove-from-queue`, 2, f.command({ includeUnpaid: true }))).status, 200);
  assert.equal((await f.request(path, { actor: 4 })).status, 404);
  assert.equal(JSON.stringify(f.rows(Order)), original);
});

test("product photo request limit supports normalized photos without enlarging other API requests", async t => {
  const f = await fixture(t);
  const raw = Buffer.concat(Array.from({ length: 200 }, () => Buffer.concat([Buffer.from([0]), randomBytes(800)])));
  const imageUrl = photoFixture({ width: 200, height: 200, raw });
  assert(imageUrl.length > 100 * 1024);
  assert.equal((await f.post("/products", 1, f.command({ name: "Large photo", price: 100, imageUrl }))).status, 201);
  assert.equal((await f.post("/products", 1, f.command({ name: "Oversized", price: 100, imageUrl: "a".repeat(800000) }))).status, 413);
  assert.equal((await f.post("/bookstore/orders", 4, { ignored: "a".repeat(150000) })).status, 413);
});

process.env.JWT_SECRET = "b03-api-synthetic-signing-key";
const id = () => new mongoose.Types.ObjectId();
const cloneValue = value => mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(value));
async function fixture(t) {
  const storeId = id(), contactId = id(), productId = id();
  const accounts = ["admin", "store_manager", "cashier", "cashier", "customer", "customer", "user"].map((role, index) => ({ _id: id(), identifier: `synthetic-${index}`, password: "synthetic-existing-hash", role, confirmed: true, accountState: "active", tokenVersion: 0, authorityVersion: 0, storeIds: [storeId] }));
  const f = accountAdapter(t, accounts, { extraModels: [Expense, DebtPayment, Store, Customer, Invoice, BookstoreAudit, BookstoreReceipt, StockMovement, BookstorePayment, BookstoreSequence, ReversalRequest, SaleReversal, GuestOrderIntent], cloneValue });
  f.store.get(Store.modelName).set(String(storeId), { _id: storeId, name: "Synthetic bookstore", createdBy: accounts[0]._id, orderCustomer: contactId });
  f.store.get(Customer.modelName).set(String(contactId), { _id: contactId, owner: accounts[0]._id, storeId, name: "Bookstore orders", isDeleted: false });
  f.store.get(Product.modelName).set(String(productId), { _id: productId, owner: accounts[0]._id, storeId, name: "Book", sku: "BOOK", category: "Books", price: 15050, costPrice: 5000, stock: 10, isActive: true, moneyUnit: "PHP-centavos" });
  const tokens = await Promise.all(accounts.map(account => generateToken(account)));
  const app = createApp({ bookstoreConfig: { publicStoreId: String(storeId), guestRateLimit: 1000, guestWindowMs: 60000 } });
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const request = async (path, { actor, method = "GET", body, credential, headers = {} } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method,
      headers: { ...(actor !== undefined ? { Authorization: `Bearer ${tokens[actor]}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...(credential ? { "X-Guest-Order-Credential": credential } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text(); return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  const command = extra => ({ storeId: String(storeId), operationId: randomUUID(), reason: "Synthetic approved command", ...extra });
  const post = (path, actor, body) => request(path, { actor, body, method: "POST" });
  const submit = actor => post("/bookstore/orders", actor, { storeId: String(storeId), operationId: randomUUID(), items: [{ product: String(productId), quantity: 1 }] });
  const settle = async actor => {
    const pending = await submit(actor); assert.equal(pending.status, 200);
    const quote = await request(`/bookstore/orders/${pending.body.data.orderId}/quote?storeId=${storeId}`, { actor }); assert.equal(quote.status, 200);
    const sale = await post(`/bookstore/orders/${pending.body.data.orderId}/complete`, actor, command({ quote: quote.body.data.quote, confirmedTotal: quote.body.data.total, paymentConfirmed: true, paymentMethod: "cash" })); assert.equal(sale.status, 200);
    return sale.body.data;
  };
  return { ...f, accounts, storeId, productId, request, command, post, submit, settle };
}

test("B03 additive manifest exposes all public/protected registrations without hiding historical drift", () => {
  const all = collectRoutes({ includeAccountRoutes: true, includeBookstoreRoutes: true });
  const actual = all.filter(row => row.mount === "/api/bookstore");
  assert.deepEqual(actual, BOOKSTORE_ROUTE_MANIFEST);
  assert.equal(actual.filter(row => row.protected).length, 24); assert.equal(actual.filter(row => !row.protected).length, 4);
});

test("B03 guest HTTP ordering is verifier-only, idempotent, private and cannot downgrade JWTs", async t => {
  const f = await fixture(t);
  const catalog = await f.request("/bookstore/guest/catalog"); assert.equal(catalog.status, 200);
  assert.equal(catalog.body.data.products[0].price, 15050); assert(!JSON.stringify(catalog.body).includes("costPrice"));
  const intent = await f.post("/bookstore/guest/intents", undefined, {}); assert.equal(intent.status, 200);
  const proof = intent.body.data, body = { intentId: proof.intentId, operationId: randomUUID(), items: [{ product: String(f.productId), quantity: 1 }] };
  const submit = () => f.request("/bookstore/guest/orders", { method: "POST", body, credential: proof.credential });
  assert.equal((await submit()).status, 200); assert.equal((await submit()).status, 200);
  assert.equal(f.rows(Order).length, 1); assert.equal(f.rows(Product)[0].stock, 10); assert.equal(f.rows(BookstorePayment).length, 0);
  const status = await f.request(`/bookstore/guest/orders/${proof.intentId}`, { credential: proof.credential });
  assert.equal(status.status, 200); assert.deepEqual(Object.keys(status.body.data).sort(), ["orderStatus", "reference"]);
  assert.equal((await f.request(`/bookstore/guest/orders/${proof.intentId}?credential=${proof.credential}`)).status, 403);
  assert.equal((await f.request(`/bookstore/guest/orders/${id()}`, { credential: proof.credential })).status, 403);
  assert.equal((await f.request("/bookstore/guest/orders", { method: "POST", body, credential: proof.credential, headers: { Authorization: "Bearer invalid" } })).status, 401);
  assert(!JSON.stringify(f.rows(GuestOrderIntent)).includes(proof.credential));
  assert(!JSON.stringify(f.rows(BookstoreAudit)).includes(proof.credential));
  assert(!JSON.stringify(f.rows(BookstoreReceipt)).includes(proof.credential));
  for (const path of ["/products", "/users", "/bookstore/context", "/bookstore/audit"]) assert.equal((await f.request(path, { credential: proof.credential })).status, 401);
});

test("Cashier queue removal is authenticated, cancelled-only, durable and preserves the customer's order", async t => {
  const f = await fixture(t), submitted = await f.submit(4), target = submitted.body.data.orderId;
  const path = `/bookstore/orders/${target}/remove-from-queue`;
  for (const actor of [undefined, 0, 1, 4, 6]) assert.equal((await f.post(path, actor, f.command())).status, actor === undefined ? 401 : 403);
  assert.equal((await f.post(`/bookstore/orders/${target}/cancel`, 1, f.command({ reason: "Original approved cancellation" }))).status, 200);
  const before = JSON.stringify(f.store.get(Order.modelName).get(target));
  const read = actor => f.request(`/bookstore/orders/queue?storeId=${f.storeId}&includeCancelled=true`, { actor });
  assert.equal((await read(1)).status, 403);
  assert.equal((await read(2)).body.data.orders.find(row => row.orderId === target).orderStatus, "cancelled");
  const body = f.command(), removed = await f.post(path, 2, body);
  assert.equal(removed.status, 200); assert.equal(removed.body.data.queueRemoved, true);
  assert.deepEqual((await f.post(path, 2, body)).body, removed.body);
  assert.equal((await read(3)).body.data.orders.some(row => row.orderId === target), false);
  assert.equal(JSON.stringify(f.store.get(Order.modelName).get(target)), before);
  assert.equal(f.rows(BookstoreAudit).filter(row => row.action === "order.cancelled").length, 1);
  assert.equal(f.rows(BookstoreAudit).filter(row => row.action === "order.queue_removed").length, 1);
  const own = await f.request(`/bookstore/orders/own?storeId=${f.storeId}`, { actor: 4 });
  assert.equal(own.body.data.orders.some(row => row.orderId === target), false);
  assert.equal(f.rows(Product)[0].stock, 10); assert.equal(f.rows(BookstorePayment).length, 0);
});

test("shared cancelled-order archival hides the exact Customer order across refreshed and newly authenticated reads", async t => {
  const f = await fixture(t), target = (await f.submit(4)).body.data.orderId;
  const otherOwn = (await f.submit(4)).body.data.orderId, otherCustomer = (await f.submit(5)).body.data.orderId;
  const own = actor => f.request(`/bookstore/orders/own?storeId=${f.storeId}`, { actor });
  assert((await own(4)).body.data.orders.some(row => row.orderId === target));
  assert.equal((await f.post(`/bookstore/orders/${target}/cancel`, 1, f.command({ reason: "Preserve original cancellation" }))).status, 200);
  const original = JSON.stringify(f.store.get(Order.modelName).get(target));
  const cancellation = JSON.stringify(f.rows(BookstoreAudit).filter(row => row.action === "order.cancelled"));
  const body = f.command();
  for (let i = 0; i < 2; i++) assert.equal((await f.post(`/bookstore/orders/${target}/remove-from-queue`, 2, body)).status, 200);
  for (let i = 0; i < 2; i++) {
    assert.deepEqual((await own(4)).body.data.orders.map(row => row.orderId), [otherOwn]);
    assert.deepEqual((await own(5)).body.data.orders.map(row => row.orderId), [otherCustomer]);
    assert(!(await f.request(`/bookstore/orders/queue?storeId=${f.storeId}&includeCancelled=true`, { actor: 3 })).body.data.orders.some(row => row.orderId === target));
  }
  const freshToken = await generateToken(f.accounts[4]);
  const fresh = await f.request(`/bookstore/orders/own?storeId=${f.storeId}`, { headers: { Authorization: `Bearer ${freshToken}` } });
  assert.deepEqual(fresh.body.data.orders.map(row => row.orderId), [otherOwn]);
  assert.equal(JSON.stringify(f.store.get(Order.modelName).get(target)), original);
  assert.equal(JSON.stringify(f.rows(BookstoreAudit).filter(row => row.action === "order.cancelled")), cancellation);
  const markers = f.rows(BookstoreAudit).filter(row => row.action === "order.queue_removed");
  assert.equal(markers.length, 1); assert.equal(String(markers[0].actorId), String(f.accounts[2]._id)); assert(markers[0].occurredAt);
  assert.equal(f.rows(Product)[0].stock, 10); assert.equal(f.rows(BookstorePayment).length, 0);
});

test("removing a cancelled guest queue entry preserves its original private verification and public reference", async t => {
  const f = await fixture(t), proof = (await f.post("/bookstore/guest/intents", undefined, {})).body.data;
  const submitted = await f.request("/bookstore/guest/orders", { method: "POST", credential: proof.credential, body: { intentId: proof.intentId, operationId: randomUUID(), items: [{ product: String(f.productId), quantity: 1 }] } });
  const { orderId, reference } = submitted.body.data;
  assert.equal((await f.post(`/bookstore/orders/${orderId}/cancel`, 1, f.command())).status, 200);
  const intentBefore = JSON.stringify(f.rows(GuestOrderIntent));
  assert.equal((await f.post(`/bookstore/orders/${orderId}/remove-from-queue`, 2, f.command())).status, 200);
  assert.deepEqual((await f.request(`/bookstore/guest/orders/${proof.intentId}`, { credential: proof.credential })).body.data, { reference, orderStatus: "cancelled" });
  assert.equal((await f.request(`/bookstore/guest/orders/${proof.intentId}`, { credential: reference })).status, 403);
  assert.equal(JSON.stringify(f.rows(GuestOrderIntent)), intentBefore);
  assert.equal(f.store.get(Order.modelName).get(orderId).bookstoreReference, reference);
  assert(!JSON.stringify(f.rows(BookstoreAudit)).includes(proof.credential));
});

for (const assigned of [false, true]) test(`unpaid archive synchronizes assigned=${assigned} across refreshed queues and newly authenticated Customer reads`, async t => {
  const f = await fixture(t), target = (await f.submit(4)).body.data.orderId;
  const otherOwn = (await f.submit(4)).body.data.orderId, otherCustomer = (await f.submit(5)).body.data.orderId;
  if (assigned) assert.equal((await f.post(`/bookstore/orders/${target}/claim`, 2, f.command())).status, 200);
  const original = JSON.stringify(f.store.get(Order.modelName).get(target));
  const own = actor => f.request(`/bookstore/orders/own?storeId=${f.storeId}`, { actor });
  assert((await own(4)).body.data.orders.some(row => row.orderId === target));
  const path = `/bookstore/orders/${target}/remove-from-queue`, body = f.command({ includeUnpaid: true });
  for (let i = 0; i < 2; i++) assert.equal((await f.post(path, 2, body)).status, 200);
  for (let i = 0; i < 2; i++) {
    assert.deepEqual((await own(4)).body.data.orders.map(row => row.orderId), [otherOwn]);
    assert.deepEqual((await own(5)).body.data.orders.map(row => row.orderId), [otherCustomer]);
    assert(!(await f.request(`/bookstore/orders/queue?storeId=${f.storeId}&includeCancelled=true`, { actor: 3 })).body.data.orders.some(row => row.orderId === target));
  }
  const freshToken = await generateToken(f.accounts[4]);
  const fresh = await f.request(`/bookstore/orders/own?storeId=${f.storeId}`, { headers: { Authorization: `Bearer ${freshToken}` } });
  assert.deepEqual(fresh.body.data.orders.map(row => row.orderId), [otherOwn]);
  assert.equal(JSON.stringify(f.store.get(Order.modelName).get(target)), original);
  const markers = f.rows(BookstoreAudit).filter(row => row.action === "order.queue_removed");
  assert.equal(markers.length, 1); assert.equal(String(markers[0].actorId), String(f.accounts[2]._id)); assert(markers[0].occurredAt);
  assert.equal(f.rows(BookstoreAudit).filter(row => row.action === "order.cancelled").length, 0);
  assert.equal(f.rows(Product)[0].stock, 10); assert.equal(f.rows(BookstorePayment).length, 0);
});

test("guest short references survive collision/replay and never substitute for private proof; old UUIDs remain usable", async t => {
  const f = await fixture(t), insert = Order.collection.insertOne;
  let attempts = 0;
  t.mock.method(Order.collection, "insertOne", async function (...args) {
    if (++attempts === 1) throw new mongoose.mongo.MongoServerError({ code: 11000, keyPattern: { bookstoreReference: 1 } });
    return insert.apply(this, args);
  });
  const proof = (await f.post("/bookstore/guest/intents", undefined, {})).body.data;
  const body = { intentId: proof.intentId, operationId: randomUUID(), items: [{ product: String(f.productId), quantity: 1 }] };
  const submit = () => f.request("/bookstore/guest/orders", { method: "POST", credential: proof.credential, body });
  const first = await submit(), replay = await submit();
  assert.equal(first.status, 200); assert.equal(replay.status, 200);
  assert.deepEqual(replay.body.data, first.body.data); assert.equal(attempts, 2);
  const { reference, orderId } = first.body.data;
  assert.match(reference, /^UPH-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(orderId, proof.intentId); assert.equal(f.rows(Order).length, 1);
  assert.equal(f.rows(Product)[0].stock, 10); assert.equal(f.rows(BookstorePayment).length, 0);
  assert(!JSON.stringify(first.body).includes(proof.credential));
  const status = await f.request(`/bookstore/guest/orders/${proof.intentId}`, { credential: proof.credential });
  assert.equal(status.body.data.reference, reference);
  for (const options of [{}, { credential: reference }]) {
    assert.equal((await f.request(`/bookstore/guest/orders/${proof.intentId}`, options)).status, 403);
    const publicLookup = await f.request(`/bookstore/guest/orders/${reference}`, options);
    assert.equal(publicLookup.status, 400); assert.equal(publicLookup.body.data, null);
  }
  const secondProof = (await f.post("/bookstore/guest/intents", undefined, {})).body.data;
  const second = await f.request("/bookstore/guest/orders", { method: "POST", credential: secondProof.credential, body: { ...body, operationId: randomUUID(), intentId: secondProof.intentId } });
  assert.equal(second.status, 200); assert.notEqual(second.body.data.reference, reference);
  // Seed the persisted result of an order submitted before this format change.
  const legacy = "d491ca1e-67a0-4d03-ae64-11c9b5312100";
  f.store.get(Order.modelName).get(orderId).bookstoreReference = legacy;
  for (const receipt of f.store.get(BookstoreReceipt.modelName).values()) if (receipt.operationId === body.operationId) receipt.result.reference = legacy;
  assert.equal((await submit()).body.data.reference, legacy);
  assert.equal((await f.request(`/bookstore/guest/orders/${proof.intentId}`, { credential: proof.credential })).body.data.reference, legacy);
  const queue = await f.request(`/bookstore/orders/queue?storeId=${f.storeId}`, { actor: 2 });
  assert.equal(queue.body.data.orders.find(order => order.orderId === orderId).reference, legacy);
  assert.equal((await f.post(`/bookstore/orders/${orderId}/claim`, 2, f.command())).status, 200);
  const quote = (await f.request(`/bookstore/orders/${orderId}/quote?storeId=${f.storeId}`, { actor: 2 })).body.data;
  const sale = await f.post(`/bookstore/orders/${orderId}/complete`, 2, f.command({ quote: quote.quote, confirmedTotal: quote.total, paymentConfirmed: true, paymentMethod: "cash" }));
  assert.equal(sale.status, 200); assert.equal(sale.body.data.receipt.reference, legacy);
  assert.equal(f.store.get(Order.modelName).get(orderId).bookstoreReference, legacy);
});

test("B03 authenticated student order scope ignores forged identity and isolates other students", async t => {
  const f = await fixture(t);
  const first = await f.submit(4), second = await f.submit(5); assert.equal(first.status, 200); assert.equal(second.status, 200);
  const mine = await f.request(`/bookstore/orders/own?storeId=${f.storeId}&studentUser=${f.accounts[5]._id}`, { actor: 4 });
  assert.equal(mine.status, 200); assert.equal(mine.body.data.orders.length, 1); assert.equal(mine.body.data.orders[0].orderId, first.body.data.orderId);
  const injected = await f.post("/bookstore/orders", 4, { storeId: String(f.storeId), operationId: randomUUID(), items: [{ product: String(f.productId), quantity: 1, price: 1 }], studentUser: String(f.accounts[5]._id), orderStatus: "completed" });
  assert.equal(injected.status, 400); assert.equal(f.rows(Order).length, 2); assert.equal(f.rows(Product)[0].stock, 10);
  assert.equal((await f.request(`/bookstore/orders/queue?storeId=${f.storeId}`, { actor: 4 })).status, 403);
  assert.equal((await f.request(`/bookstore/transactions?storeId=${f.storeId}`, { actor: 4 })).status, 403);
});

test("cashier HTTP submission returns payment immediately and queues only guest/student orders", async t => {
  const f = await fixture(t), submitted = await f.submit(2);
  assert.equal(submitted.status, 200);
  const { orderId, payment } = submitted.body.data;
  assert.equal(payment.orderId, orderId); assert.equal(payment.total, 15050);
  const student = await f.submit(4);
  const intent = (await f.post("/bookstore/guest/intents", undefined, {})).body.data;
  const guest = await f.request("/bookstore/guest/orders", { method: "POST", credential: intent.credential, body: { intentId: intent.intentId, operationId: randomUUID(), items: [{ product: String(f.productId), quantity: 1 }] } });
  assert.equal(guest.status, 200);
  // Older cashier POS drafts must not be mixed with kiosk orders either.
  const legacyId = id();
  f.store.get(Order.modelName).set(String(legacyId), { ...f.rows(Order).find(row => String(row._id) === orderId), _id: legacyId, directPayment: undefined });
  for (const actor of [1, 2, 3]) {
    const queue = await f.request(`/bookstore/orders/queue?storeId=${f.storeId}`, { actor });
    assert.equal(queue.status, 200);
    const ids = queue.body.data.orders.map(order => order.orderId);
    assert.deepEqual(ids.sort(), [student.body.data.orderId, guest.body.data.orderId].sort());
  }
  const forged = await f.post("/bookstore/orders", 4, { storeId: String(f.storeId), operationId: randomUUID(), items: [{ product: String(f.productId), quantity: 1 }], directPayment: true });
  assert.equal(forged.status, 400);
  const paid = await f.post(`/bookstore/orders/${orderId}/complete`, 2, f.command({ quote: payment.quote, confirmedTotal: payment.total, paymentConfirmed: true, paymentMethod: "cash" }));
  assert.equal(paid.status, 200); assert.equal(paid.body.data.orderStatus, "completed");
  assert.equal(f.rows(BookstorePayment).length, 1); assert.equal(f.rows(Invoice).length, 1);
});

test("B03 Cashier own history/receipt isolation and Manager/Admin all-cashier history use backend scope", async t => {
  const f = await fixture(t), saleA = await f.settle(2), saleB = await f.settle(3);
  for (const [actor, count] of [[0, 2], [1, 2], [2, 1], [3, 1]]) {
    const history = await f.request(`/bookstore/transactions?storeId=${f.storeId}&cashierId=${f.accounts[3]._id}`, { actor });
    assert.equal(history.status, 200); assert.equal(history.body.data.transactions.length, count);
  }
  assert.equal((await f.request(`/bookstore/transactions/${saleB.orderId}?storeId=${f.storeId}`, { actor: 2 })).status, 404);
  assert.equal((await f.request(`/bookstore/receipts/${saleA.receipt.invoiceId}?storeId=${f.storeId}`, { actor: 2 })).status, 200);
  assert.equal((await f.request(`/bookstore/receipts/${saleB.receipt.invoiceId}?storeId=${f.storeId}`, { actor: 2 })).status, 404);
  assert.equal((await f.request(`/bookstore/transactions?storeId=${id()}`, { actor: 1 })).status, 403);
});

test("B03 role/field matrix protects catalog, inventory, audit and reversal approvals", async t => {
  const f = await fixture(t), sale = await f.settle(2);
  const request = await f.post(`/bookstore/orders/${sale.orderId}/reversals`, 2, f.command()); assert.equal(request.status, 200);
  const body = f.command({ repaymentConfirmed: true, repaymentMethod: "cash", returnsConfirmed: true, returned: [] });
  for (const actor of [0, 2, 3, 4, 5, 6]) assert.equal((await f.post(`/bookstore/reversals/${request.body.data.requestId}/apply`, actor, body)).status, 403);
  assert.equal((await f.post(`/bookstore/reversals/${request.body.data.requestId}/apply`, 1, body)).status, 200);
  for (const actor of [2, 4, 6]) assert.equal((await f.post("/products", actor, f.command({ name: "Forged", price: 1 }))).status, 403);
  for (const actor of [1, 2, 4, 6]) assert.equal((await f.request(`/bookstore/audit?storeId=${f.storeId}`, { actor })).status, 403);
  assert.equal((await f.request(`/bookstore/audit?storeId=${f.storeId}`, { actor: 0 })).status, 200);
  for (const actor of [2, 4, 6]) assert.equal((await f.request(`/bookstore/movements?storeId=${f.storeId}`, { actor })).status, 403);
});

test("B03 all retained void/delete/invoice aliases share Manager approval and preserve original money history", async t => {
  const f = await fixture(t);
  for (const alias of ["orderVoid", "transactionVoid", "orderDelete", "invoiceVoid"]) {
    const sale = await f.settle(2);
    const request = await f.post(`/bookstore/orders/${sale.orderId}/reversals`, 2, f.command());
    const path = alias === "orderVoid" ? `/orders/${sale.orderId}/void` : alias === "transactionVoid" ? `/transactions/${sale.orderId}/void`
      : alias === "orderDelete" ? `/orders/${sale.orderId}` : `/invoices/${sale.receipt.invoiceId}/void`;
    const body = f.command({ requestId: request.body.data.requestId, repaymentConfirmed: true, repaymentMethod: "cash", returnsConfirmed: true, returned: [] });
    const method = alias === "orderDelete" ? "DELETE" : "PATCH";
    assert.equal((await f.request(path, { actor: 2, method, body })).status, 403);
    assert.equal((await f.request(path, { actor: 1, method, body })).status, 200);
    assert.equal((await f.request(path, { actor: 1, method, body })).status, 200);
  }
  assert.equal(f.rows(SaleReversal).length, 4); assert.equal(f.rows(Product)[0].stock, 6);
  assert(f.rows(Order).every(order => order.orderStatus === "completed" && order.amountPaid === 15050));
  assert(f.rows(Invoice).every(invoice => invoice.status === "paid" && invoice.reversalId));
});

test("B03 guest activation fails closed without explicit rate/store settings and private GET HEAD requires proof", async t => {
  const f = await fixture(t);
  const response = await f.request("/bookstore/guest/intents", { method: "POST", body: {} });
  const proof = response.body.data;
  assert.equal((await f.request(`/bookstore/guest/orders/${proof.intentId}`, { method: "HEAD" })).status, 403);
  const row = f.store.get(GuestOrderIntent.modelName).get(proof.intentId);
  row.verification.issuedAt = new Date(Date.now() - 8 * 86400000); row.verification.expiresAt = new Date(Date.now() - 86400000);
  assert.equal((await f.request("/bookstore/guest/orders", { method: "POST", credential: proof.credential, body: { intentId: proof.intentId, operationId: randomUUID(), items: [{ product: String(f.productId), quantity: 1 }] } })).status, 403);
  assert.equal(f.rows(Order).length, 0);
  const res = () => ({ code: 200, set() { return this; }, status(code) { this.code = code; return this; }, json() { return this; } });
  const missing = res(); guestBookstoreGuard({})({ headers: {}, ip: "synthetic" }, missing, () => assert.fail("Missing activation must deny")); assert.equal(missing.code, 503);
  const limited = guestBookstoreGuard({ publicStoreId: String(f.storeId), guestRateLimit: 1, guestWindowMs: 60000 });
  let calls = 0; limited({ headers: {}, ip: "synthetic" }, res(), () => calls++);
  const exceeded = res(); limited({ headers: {}, ip: "synthetic" }, exceeded, () => calls++);
  assert.equal(calls, 1); assert.equal(exceeded.code, 429);
});

test("guest activation rejects instruction text and missing settings without guessing a store", async t => {
  const f = await fixture(t);
  for (const config of [{}, { publicStoreId: "Operational audit → store.created → Target.", guestRateLimit: 100, guestWindowMs: 60000 }]) {
    const server = createApp({ bookstoreConfig: config }).listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/bookstore/guest/catalog`);
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "GUEST_ORDERING_NOT_CONFIGURED");
    } finally { await new Promise(resolve => server.close(resolve)); }
  }
  assert.equal((await f.request("/bookstore/guest/catalog")).status, 200);
  assert.equal(f.rows(Order).length, 0);
});

test("guest expired intent recovers with new proof; old saved proof stays valid and stores remain isolated", async t => {
  const f = await fixture(t);
  const issue = async () => (await f.post("/bookstore/guest/intents", undefined, {})).body.data;
  const submit = proof => f.request("/bookstore/guest/orders", { method: "POST", credential: proof.credential, body: { intentId: proof.intentId, operationId: randomUUID(), items: [{ product: String(f.productId), quantity: 2 }] } });
  const saved = await issue(); assert.equal((await submit(saved)).status, 200);
  const expired = await issue(), row = f.store.get(GuestOrderIntent.modelName).get(expired.intentId);
  const expiry = new Date(Date.now() - 1);
  row.verification.expiresAt = expiry; row.verification.issuedAt = new Date(expiry.valueOf() - 7 * 86400000);
  assert.equal((await submit(expired)).status, 403);
  assert.equal(f.rows(Order).length, 1);
  const fresh = await issue(); assert.notEqual(fresh.credential, expired.credential);
  const submitted = await submit(fresh); assert.equal(submitted.status, 200);
  assert.equal(submitted.body.data.orderStatus, "pending");
  assert.equal((await f.request(`/bookstore/guest/orders/${saved.intentId}`, { credential: saved.credential })).status, 200);
  assert.equal((await f.request(`/bookstore/guest/orders/${saved.intentId}`, { credential: fresh.credential })).status, 403);
  assert.equal(f.rows(Order).length, 2); assert.equal(f.rows(Product)[0].stock, 10);
  for (const path of ["/users", "/products", "/bookstore/context", "/bookstore/audit"]) assert.equal((await f.request(path, { credential: fresh.credential })).status, 401);
});

const allowedRoles = {
  bookstoreCategoriesRead: [1], bookstoreCategoryManage: [1],
  bookstoreContextRead: [0,1,2,4], bookstoreCreate:[0], bookstoreMembershipReplace:[0], bookstoreOrderSubmit:[2,4],
  studentOrdersRead:[4], studentOrderDetailsRead:[4], bookstoreQueueRead:[1,2], cashierQueueRemove:[2], bookstoreOrderClaim:[2], bookstoreOrderQuote:[2], bookstoreOrderComplete:[2],
  bookstoreOrderCancel:[1], bookstoreReversalRequest:[1,2], bookstoreReversalApply:[1], bookstoreReversalValidate:[1], bookstoreReversalsRead:[1,2],
  bookstoreHistoryRead:[0,1,2], bookstoreTransactionRead:[0,1,2], bookstoreReceiptRead:[0,1,2], bookstoreMovementsRead:[0,1],
  bookstoreAuditRead:[0], bookstoreOperationRead:[0,1,2,4],
};
for (const actor of [0,1,2,4]) test("B03 every protected bookstore method and inherited HEAD role matrix: "+["admin","manager","cashier",null,"customer"][actor], async t => {
  const explicit=BOOKSTORE_ROUTE_MANIFEST.filter(row=>row.protected);
  const rows=[...explicit,...explicit.filter(row=>row.method==="GET").map(row=>({...row,method:"HEAD"}))];
  assert.equal(rows.length,37);
  for (const row of rows) await t.test(row.method+" "+row.path, async sub => {
    const f=await fixture(sub), actorObject=index=>({id:String(f.accounts[index]._id),role:f.accounts[index].role,tokenVersion:0});
    const paid=await f.settle(2), pending=await f.submit(4), pendingId=pending.body.data.orderId;
    const assigned=await f.submit(2),assignedId=assigned.body.data.orderId;
    const quote=await quoteOrder(actorObject(2),assignedId,f.storeId);
    const reversal=await requestReversal(actorObject(2),paid.orderId,f.command());
    const operationId=randomUUID();
    f.store.get(BookstoreReceipt.modelName).set(String(id()),{_id:id(),actorKey:"account:"+f.accounts[actor]._id,operationId,storeId:f.storeId,capability:"order.submit",result:{orderStatus:"pending"}});
    let target=paid.orderId,body=f.command();
    switch(row.handler){
      case "bookstoreCategoryManage":body=f.command({action:"create",name:"New category"});break;
      case "bookstoreCreate":body={operationId:randomUUID(),reason:"Reviewed synthetic store",name:"New synthetic store"};break;
      case "bookstoreMembershipReplace":target=String(f.accounts[5]._id);body={operationId:randomUUID(),reason:"Reviewed synthetic member",expectedVersion:0,storeIds:[]};break;
      case "bookstoreOrderSubmit":body={storeId:String(f.storeId),operationId:randomUUID(),items:[{product:String(f.productId),quantity:1}]};break;
      case "studentOrderDetailsRead":case "bookstoreOrderClaim":case "bookstoreOrderCancel":target=pendingId;break;
      case "cashierQueueRemove":await cancelOrder(actorObject(1),pendingId,f.command());target=pendingId;break;
      case "bookstoreOrderQuote":target=assignedId;break;
      case "bookstoreOrderComplete":target=assignedId;body=f.command({quote:quote.quote,confirmedTotal:quote.total,paymentConfirmed:true,paymentMethod:"cash"});break;
      case "bookstoreReversalApply":target=reversal.requestId;body=f.command({repaymentConfirmed:true,repaymentMethod:"cash",returnsConfirmed:true,returned:[]});break;
      case "bookstoreReversalValidate":target=reversal.requestId;body={storeId:String(f.storeId),returned:[]};break;
      case "bookstoreReceiptRead":target=String(f.rows(Invoice)[0]._id);break;
      case "bookstoreOperationRead":target=operationId;break;
    }
    const path=row.path.replace("/api", "").replace(":id",target)+"?storeId="+f.storeId;
    const before=JSON.stringify([...f.store].map(([name,records])=>[name,[...records]]));
    const response=await f.request(path,{actor,method:row.method,...(!["GET","HEAD"].includes(row.method)?{body}:{})});
    const expected=allowedRoles[row.handler].includes(actor)?200:403;
    assert.equal(response.status,expected,JSON.stringify(response.body));
    if(expected===403)assert.equal(JSON.stringify([...f.store].map(([name,records])=>[name,[...records]])),before,"Denied role changed persisted data");
    if(row.method==="HEAD")assert.equal(response.body,null);
  });
});

const historicalPassword=await bcrypt.hash("Synthetic-B03-Only!",4);
for(const actor of [0,1,2,4])test("B03 all historical/account methods and inherited HEAD canonical role matrix: "+actor,async t=>{
  const explicit=collectRoutes({includeAccountRoutes:true}).filter(row=>row.protected);
  const rows=[...explicit,...explicit.filter(row=>row.method==="GET").map(row=>({...row,method:"HEAD"}))];
  assert.equal(rows.length,98);
  for(const row of rows)await t.test(row.method+" "+row.path,async sub=>{
    const f=await fixture(sub),target=id(),reviewId=id(),grantId=id(),independent=id(),operationId=randomUUID(),legacyOrder=id(),legacyInvoice=id();
    for(const account of f.store.get("User").values())account.password=historicalPassword;
    f.store.get("User").set(String(target),{_id:target,identifier:"reviewed-peer",password:historicalPassword,role:"store_manager",confirmed:true,accountState:row.handler==="reactivateAccount"?"suspended":"active",tokenVersion:0,authorityVersion:0,storeIds:[f.storeId]});
    f.store.get("User").set(String(independent),{_id:independent,identifier:"independent-admin",password:historicalPassword,role:"admin",confirmed:true,accountState:"active",tokenVersion:0,authorityVersion:0});
    const customerId=f.rows(Customer)[0]._id;
    f.store.get(Order.modelName).set(String(legacyOrder),{_id:legacyOrder,owner:f.accounts[0]._id,customer:customerId,items:[{product:f.productId,quantity:1,unitPrice:100,subtotal:100}],totalAmount:100,amountPaid:100,balance:0,paymentStatus:"paid",orderStatus:"completed",createdAt:new Date("2025-01-01")});
    f.store.get(Invoice.modelName).set(String(legacyInvoice),{_id:legacyInvoice,owner:f.accounts[0]._id,customer:customerId,transaction:legacyOrder,invoiceNumber:"INV-2025-0001",issuedAt:new Date("2025-01-01"),status:"paid"});
    const baseReview={reviewerId:independent,reason:"Synthetic explicit independent review",evidenceRefs:["synthetic-review"],revision:1,expectedVersion:0,operationId:randomUUID()};
    f.store.get(AccountReview.modelName).set(String(reviewId),{_id:reviewId,...baseReview,targetAccountId:target,proposedRole:"cashier",expectedRole:"store_manager",status:"approved"});
    const verification=id();f.store.get(AccountReview.modelName).set(String(verification),{_id:verification,...baseReview,targetAccountId:f.accounts[0]._id,proposedRole:"admin",expectedRole:"admin",status:"applied",verifiedAuthorityVersion:0});
    f.store.get(AccountGrant.modelName).set(String(grantId),{_id:grantId,recipientAccountId:target,capability:"salesHistory.own",scope:{kind:"own-processor",resourceIds:[String(target)]},grantedBy:f.accounts[0]._id,reason:"Synthetic approved grant",effectiveAt:new Date(Date.now()-1000),expiresAt:new Date(Date.now()+60000),recipientVersion:0,grantorAuthorityVersion:0,revokedAt:null,operationId:randomUUID()});
    const receiptId=id();f.store.get(AccountReceipt.modelName).set(String(receiptId),{_id:receiptId,operationId,actorId:f.accounts[actor]._id,targetId:f.accounts[actor]._id,fingerprint:"synthetic",result:{message:"Profile saved"}});
    // Aggregation/population transport is staged here; ownership match predicates
    // and real route/controller code execute. This is not a MongoDB engine test.
    sub.mock.method(Order,"aggregate",async()=>[]);
    sub.mock.method(Customer,"aggregate",async pipeline=>{const match=pipeline.find(stage=>stage.$match)?.$match||{};const values=f.rows(Customer).filter(record=>matches(record,match)).map(record=>({...record,totalDebt:0,totalPaid:0,totalOrders:0}));return pipeline.some(stage=>stage.$facet)?[{data:values,meta:[{total:values.length}]}]:values;});
    sub.mock.method(Invoice.prototype,"populate",async function(){return this;});
    let targetId=String(target),body=f.command(),expected=403;
    const read=["GET","HEAD"].includes(row.method);
    if(row.mount==="/api/users"){
      const self=["getProfile","updateProfile","updatePassword","reconcileAccountOperation"].includes(row.handler);
      expected=self||actor===0?200:403;body={operationId:randomUUID(),reason:"Synthetic reviewed account command",expectedVersion:0};
      switch(row.handler){
        case "createUser":body={...body,identifier:"new-synthetic-student",password:"New-Synthetic-B03!",role:"customer",confirmed:false,accountState:"active"};if(actor===0)expected=201;break;
        case "updateProfile":body={...body,name:"Synthetic profile"};break;
        case "updatePassword":body={...body,currentPassword:"Synthetic-B03-Only!",newPassword:"New-Synthetic-B03!"};break;
        case "assignRole":body={...body,role:"cashier"};break;
        case "createReview":body={...body,proposedRole:"cashier",status:"approved",evidenceRefs:["synthetic-owner-review"]};break;
        case "applyAccountReview":body={...body,reviewId:String(reviewId)};break;
        case "createGrant":body={...body,capability:"salesHistory.own",scope:{kind:"own-processor",resourceIds:[String(target)]},approvalRef:"synthetic-explicit-approval",effectiveAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()};break;
        case "updateUser":body={...body,name:"Synthetic reviewed peer"};break;
      }
    }else if(["getProducts","getProductById"].includes(row.handler)){expected=200;targetId=String(f.productId);}
    else if(["createProduct","updateProduct","deleteProduct","setActiveProducts"].includes(row.handler)){
      expected=actor===1 && row.handler!=="setActiveProducts"?(row.handler==="createProduct"?201:200):actor===0?(row.handler==="createProduct"?201:200):403;targetId=String(f.productId);
      if(row.handler==="createProduct")body={...body,name:"New synthetic book",sku:"NEW-MATRIX",price:100};
      if(row.handler==="updateProduct"){body={...body,price:200};if(actor===1)expected=403;}
      if(row.handler==="setActiveProducts")body={...body,productIds:[]};
    }else if(row.handler==="adjustStock"){expected=actor===1?200:403;targetId=String(f.productId);body={...body,delta:1};}
    else if(["voidTransaction","deleteOrder","markVoid"].includes(row.handler)){
      // Same approved Manager cancellation path for every retained alias.
      expected=actor===1?200:403;const pending=await f.submit(4);targetId=pending.body.data.orderId;
      if(row.handler==="markVoid"){const alias=id();f.store.get(Invoice.modelName).set(String(alias),{_id:alias,owner:f.accounts[0]._id,storeId:f.storeId,transaction:new mongoose.Types.ObjectId(targetId),customer:customerId,moneyUnit:"PHP-centavos",invoiceNumber:"INV-ALIAS",status:"unpaid"});targetId=String(alias);}
    }else if(read){
      expected=actor===0?200:403;
      if(["getCustomerById"].includes(row.handler))targetId=String(customerId);
      if(row.handler==="getTransactionById")targetId=String(legacyOrder);
      if(row.handler==="getInvoiceById")targetId=String(legacyInvoice);
    }
    const path=row.path.replace("/api", "").replace(":operationId",operationId).replace(":orderId",String(legacyOrder)).replace(":transactionId",String(legacyOrder)).replace(":grantId",String(grantId)).replace(":debtId",String(id())).replace(":id",targetId)+"?storeId="+f.storeId;
    const before=JSON.stringify([...f.store].map(([name,records])=>[name,[...records]]));
    const response=await f.request(path,{actor,method:row.method,...(!read?{body}:{})});
    assert.equal(response.status,expected,JSON.stringify(response.body));
    if(expected===403)assert.equal(JSON.stringify([...f.store].map(([name,records])=>[name,[...records]])),before,"Denied role changed stored records");
    if(row.method==="HEAD")assert.equal(response.body,null);
  });
});
