import { installProductManagementQueries } from "./productManagementAdapter.js";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Invoice from "../models/Invoice.js";
import Store from "../models/Store.js";
import { StockMovement, SaleReversal, BookstoreAudit, BookstoreReceipt } from "../models/BookstoreControl.js";
import { accountAdapter } from "./accountManagementAdapter.js";
import { managedProducts, productDeletionStatus, deleteManagedProduct } from "../services/productManagement.js";
import { archiveBookstoreProduct, updateBookstoreProduct } from "../services/catalogService.js";
import { createApp } from "../app.js";
import { generateToken } from "../utils/generateToken.js";

process.env.JWT_SECRET = "synthetic-product-management-tests";
const id = () => new mongoose.Types.ObjectId();
const clone = value => mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(value));
// Extend only this fixture's queries with nested paths and real page slicing.
// The application still runs its own Mongoose schemas and transaction helpers.
async function fixture(t) {
  const storeId = id(), actorId = id();
  const account = { _id: actorId, identifier: "synthetic-manager", role: "store_manager", confirmed: true, accountState: "active", tokenVersion: 0, authorityVersion: 0, storeIds: [storeId] };
  const f = accountAdapter(t, [account], { extraModels: [Store, Invoice, StockMovement, SaleReversal, BookstoreAudit, BookstoreReceipt], cloneValue: clone });
  f.store.get(Store.modelName).set(String(storeId), { _id: storeId, name: "Synthetic bookstore" });
  installProductManagementQueries(t, f, clone);
  const addProduct = (extra = {}) => {
    const product = { _id: id(), owner: actorId, storeId, name: "Unused book", sku: "BOOK", category: "Books", price: 100, stock: 0, isActive: true, moneyUnit: "PHP-centavos", ...extra };
    f.store.get(Product.modelName).set(String(product._id), product); return product;
  };
  const actor = { id: String(actorId), role: account.role, tokenVersion: 0 };
  const body = extra => ({ storeId: String(storeId), operationId: randomUUID(), reason: "Synthetic approved product cleanup", ...extra });
  const server = createApp().listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const token = await generateToken(account);
  const request = async (path = "", options = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/products${path}`, { method: options.method || "GET", headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}) }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  return { ...f, storeId, actor, body, addProduct, request };
}

test("Manage Products permanently deletes an unreferenced zero-stock product once and retains durable audit", async t => {
  const f = await fixture(t), product = f.addProduct(), body = f.body({ deletionMode: "permanent" });
  const before = await f.request(`/${product._id}?management=true&storeId=${f.storeId}`);
  assert.equal(before.status, 200); assert.equal(before.body.data.deletion.canDelete, true);
  const deleted = await f.request(`/${product._id}`, { method: "DELETE", body });
  assert.equal(deleted.status, 200); assert.equal(deleted.body.data.deleted, true); assert.equal(f.rows(Product).length, 0);
  assert.equal((await f.request(`/${product._id}`, { method: "DELETE", body })).status, 200);
  assert.equal(f.rows(BookstoreAudit).length, 1); assert.deepEqual(f.rows(BookstoreAudit)[0].after, { deleted: true });
  assert.equal(f.rows(BookstoreAudit)[0].before.name, "Unused book"); assert.equal(f.rows(BookstoreReceipt).length, 1);
});

for (const source of ["pending order", "completed order", "cancelled order", "legacy order", "invoice", "movement", "return", "operation receipt"]) test(`Manage Products protects ${source} references and permits archival without changing history`, async t => {
  const f = await fixture(t), product = f.addProduct(), key = id();
  let Model, history;
  if (source.includes("order")) {
    Model = Order; history = { _id: key, owner: id(), storeId: id(), orderStatus: source.split(" ")[0], items: [{ product: product._id, quantity: 1, unitPrice: 125, subtotal: 125, name: "Original historical name" }] };
    if (source === "legacy order") { history.products = history.items; delete history.items; }
  } else if (source === "invoice") { Model = Invoice; history = { _id: key, snapshot: { items: [{ productId: String(product._id), name: "Original book", unitPrice: 125 }] } }; }
  else if (source === "movement") { Model = StockMovement; history = { _id: key, productId: product._id, before: 1, after: 0, delta: -1 }; }
  else if (source === "return") { Model = SaleReversal; history = { _id: key, returned: [{ productId: String(product._id), quantity: 1 }] }; }
  else { Model = BookstoreReceipt; history = { _id: key, result: { receipt: { items: [{ productId: String(product._id), unitPrice: 125 }] } } }; }
  f.store.get(Model.modelName).set(String(key), history);
  const original = clone(history);
  assert.equal((await productDeletionStatus(Product.hydrate(product))).canDelete, false);
  const blocked = await f.request(`/${product._id}`, { method: "DELETE", body: f.body({ deletionMode: "permanent" }) });
  assert.equal(blocked.status, 409); assert.equal(f.rows(Product).length, 1);
  const archived = await f.request(`/${product._id}`, { method: "DELETE", body: f.body() });
  assert.equal(archived.status, 200); assert.equal(f.rows(Product)[0].isActive, false);
  assert.equal(f.rows(Product)[0].name, product.name); assert.equal(f.rows(Product)[0].price, product.price);
  assert.deepEqual(f.store.get(Model.modelName).get(String(key)), original);
});

test("Manage Products rechecks references after modal preflight and rolls deletion back if audit fails", async t => {
  const f = await fixture(t), product = f.addProduct();
  assert.equal((await productDeletionStatus(Product.hydrate(product))).canDelete, true);
  const movementId = id(); f.store.get(StockMovement.modelName).set(String(movementId), { _id: movementId, productId: product._id });
  await assert.rejects(deleteManagedProduct(f.actor, product._id, f.body({ deletionMode: "permanent" })), error => error.statusCode === 409);
  f.store.get(StockMovement.modelName).delete(String(movementId));
  f.faults.audit = true; // Bookstore audit has a separate collection below.
  t.mock.method(BookstoreAudit.collection, "insertOne", async () => { throw Error("Synthetic audit failure"); });
  await assert.rejects(deleteManagedProduct(f.actor, product._id, f.body({ deletionMode: "permanent" })));
  assert.equal(f.rows(Product).length, 1); assert.equal(f.rows(BookstoreReceipt).length, 0);
});

test("Manage Products preserves stock, scope, authority, existing edit and default DELETE archive semantics", async t => {
  const f = await fixture(t), product = f.addProduct({ stock: 3 }), other = f.addProduct({ storeId: id() });
  await assert.rejects(deleteManagedProduct(f.actor, product._id, f.body({ deletionMode: "permanent" })), error => error.statusCode === 409);
  await assert.rejects(deleteManagedProduct(f.actor, other._id, f.body({ deletionMode: "permanent" })), error => error.statusCode === 404);
  for (const role of ["admin", "cashier", "customer", "user"]) await assert.rejects(deleteManagedProduct({ ...f.actor, role }, product._id, f.body({ deletionMode: "permanent" })), error => error.statusCode === 403);
  await updateBookstoreProduct(f.actor, product._id, f.body({ name: "Edited book", sku: "EDITED" }));
  assert.equal(f.store.get(Product.modelName).get(String(product._id)).stock, 3);
  await archiveBookstoreProduct(f.actor, product._id, f.body());
  assert.equal(f.store.get(Product.modelName).get(String(product._id)).name, "Edited book");
  assert.equal(f.store.get(Product.modelName).get(String(product._id)).isActive, false);
});

test("Manage Products server paging supports all limits, literal name/SKU search, combined filters and sorting", async t => {
  const f = await fixture(t);
  for (let i = 0; i < 125; i++) f.addProduct({ name: `Product ${String(i).padStart(3, "0")}`, sku: `SKU-${i}`, price: 125 - i, category: i % 2 ? "Books" : "Supplies", isActive: i % 3 !== 0 });
  f.addProduct({ name: "Foreign", storeId: id() });
  const list = params => f.request(`?${new URLSearchParams({ management: "true", storeId: String(f.storeId), ...params })}`);
  const first = await list({}); assert.equal(first.body.data.length, 10); assert.equal(first.body.pagination.total, 125); assert.equal(first.body.pagination.pages, 13);
  for (const limit of [10, 20, 50, 100]) {
    const response = await list({ page: 2, limit });
    assert.equal(response.status, 200); assert.equal(response.body.pagination.page, 2);
    assert.equal(response.body.data.length, Math.min(limit, 125 - limit));
    assert.equal(response.body.data[0].name, `Product ${String(limit).padStart(3, "0")}`);
  }
  for (const search of ["Product 007", "SKU-7"]) { const response = await list({ search }); assert(response.body.data.some(row => row.sku === "SKU-7")); }
  assert.equal((await list({ search: ".*" })).body.pagination.total, 0);
  const filtered = await list({ category: "Books", isActive: "false", sortBy: "price", sortDirection: "desc", limit: 100 });
  const expected = f.rows(Product).filter(row => String(row.storeId) === String(f.storeId) && row.category === "Books" && row.isActive === false);
  assert.equal(filtered.body.pagination.total, expected.length); assert.equal(filtered.body.data.length, expected.length);
  assert(filtered.body.data.every((row, i, rows) => i === 0 || rows[i - 1].price >= row.price));
  for (const sortBy of ["name", "price", "category"]) for (const sortDirection of ["asc", "desc"]) {
    const response = await list({ sortBy, sortDirection }); assert.equal(response.status, 200);
    assert(response.body.data.every((row, i, rows) => i === 0 || (sortBy === "price" ? rows[i - 1].price - row.price : rows[i - 1][sortBy].localeCompare(row[sortBy])) * (sortDirection === "asc" ? 1 : -1) <= 0));
  }
  const empty = await list({ search: "missing-product", page: 999 }); assert.equal(empty.body.pagination.page, 1); assert.deepEqual(empty.body.data, []);
  assert.equal((await list({ limit: 11 })).status, 400); assert.equal((await list({ sortBy: "$bad" })).status, 400);
  for (const role of ["admin", "cashier", "customer", "user"]) await assert.rejects(managedProducts({ ...f.actor, role }, { storeId: f.storeId }, {}), error => error.statusCode === 403);
});
