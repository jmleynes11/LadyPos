import { AccountGrant } from "../models/AccountControl.js";
import { bookstoreContext } from "../services/bookstoreReads.js";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Store from "../models/Store.js";
import { BookstoreAudit, BookstoreReceipt, StockMovement } from "../models/BookstoreControl.js";
import { adjustBookstoreStock } from "../services/inventoryService.js";
import { accountAdapter } from "./accountManagementAdapter.js";
import { createApp } from "../app.js";
import { generateToken } from "../utils/generateToken.js";
import { createProduct, updateProduct } from "../controllers/ProductController.js";
import { catalogFields } from "../services/catalogService.js";

process.env.JWT_SECRET = "b03-inventory-synthetic-signing-key";
const id = () => new mongoose.Types.ObjectId();
const cloneValue = value => mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(value));
function fixture(t) {
  const actorId = id(), storeId = id(), productId = id();
  const f = accountAdapter(t, [{ _id: actorId, identifier: "manager", role: "store_manager", confirmed: true, accountState: "active", tokenVersion: 0, authorityVersion: 0, storeIds: [storeId] }], { extraModels: [Store, BookstoreAudit, BookstoreReceipt, StockMovement], cloneValue });
  f.store.get(Store.modelName).set(String(storeId), { _id: storeId, name: "Synthetic bookstore" });
  // Different creator proves shared inventory does not use requester ownership.
  f.store.get(Product.modelName).set(String(productId), { _id: productId, owner: id(), storeId, name: "Synthetic", price: 100, stock: 5, isActive: true, moneyUnit: "PHP-centavos", costPrice: 40 });
  return { ...f, actor: { id: String(actorId), role: "store_manager", tokenVersion: 0 }, storeId, productId, body: (delta, extra = {}) => ({ storeId: String(storeId), operationId: randomUUID(), reason: "Synthetic approved delivery", delta, ...extra }), stock: () => f.rows(Product)[0].stock };
}

test("B03 Manager shared stock adjustment has one movement/audit and deduplicates replay", async t => {
  const f = fixture(t), body = f.body(3);
  await adjustBookstoreStock(f.actor, f.productId, body);
  await adjustBookstoreStock(f.actor, f.productId, body);
  assert.equal(f.stock(), 8); assert.equal(f.rows(StockMovement).length, 1); assert.equal(f.rows(BookstoreAudit).length, 1);
  assert.equal(f.rows(StockMovement)[0].before, 5); assert.equal(f.rows(StockMovement)[0].after, 8);
  assert.equal(String(f.rows(StockMovement)[0].actorId), f.actor.id);
});

test("B03 concurrent deltas accumulate under staged realm serialization; underflow is rejected without clamping", async t => {
  const f = fixture(t);
  await Promise.all([adjustBookstoreStock(f.actor, f.productId, f.body(2)), adjustBookstoreStock(f.actor, f.productId, f.body(3))]);
  assert.equal(f.stock(), 10); assert.equal(f.rows(StockMovement).length, 2);
  await assert.rejects(adjustBookstoreStock(f.actor, f.productId, f.body(-11)), error => error.statusCode === 409);
  assert.equal(f.stock(), 10); assert.equal(f.rows(StockMovement).length, 2);
});

test("B03 wrong role/store, protected fields and malformed deltas have zero stock effects", async t => {
  const f = fixture(t);
  for (const role of ["cashier", "customer", "user", "admin"]) await assert.rejects(adjustBookstoreStock({ ...f.actor, role }, f.productId, f.body(1)), error => [401, 403].includes(error.statusCode));
  await assert.rejects(adjustBookstoreStock(f.actor, f.productId, f.body(1, { storeId: String(id()) })), error => error.statusCode === 403);
  for (const body of [f.body(1, { price: 1 }), f.body(1, { quantity: 1 }), f.body(1, { reason: "" }), f.body(1.5), f.body("2"), f.body(NaN)]) await assert.rejects(adjustBookstoreStock(f.actor, f.productId, body));
  assert.equal(f.stock(), 5); assert.equal(f.rows(StockMovement).length, 0);
});

test("B03 required audit failure rolls back stock and movement together", async t => {
  const f = fixture(t);
  t.mock.method(BookstoreAudit.collection, "insertOne", () => { throw new Error("Required audit unavailable"); });
  await assert.rejects(adjustBookstoreStock(f.actor, f.productId, f.body(2)));
  assert.equal(f.stock(), 5); assert.equal(f.rows(StockMovement).length, 0); assert.equal(f.rows(BookstoreReceipt).length, 0);
});

test("B03 actual inventory HTTP route authorizes mapped Manager and denies cashier", async t => {
  const f = fixture(t), server = createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const token = await generateToken(f.load(f.actor.id));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/products/${f.productId}/stock`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(f.body(2)) });
  assert.equal(response.status, 200); assert.equal(f.stock(), 7);
  // Manager's base permission needs no additional grant or approval.
  const findGrants = AccountGrant.find;
  t.mock.method(AccountGrant, "find", function (filter, ...args) {
    assert.notEqual(filter.capability, "inventory.adjust", "Manager must not require a conditional grant");
    return findGrants.call(this, filter, ...args);
  });
  const context = await bookstoreContext(f.actor);
  assert.equal(context.capabilities["inventory.adjust"], true);
  assert.equal(context.conditionalResources["inventory.adjust"], undefined);
  const decrease = await fetch(`http://127.0.0.1:${server.address().port}/api/products/${f.productId}/stock`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(f.body(-3)) });
  assert.equal(decrease.status, 200); assert.equal(f.stock(), 4);
  assert.equal(f.rows(StockMovement).length, 2);
  f.store.get("User").get(f.actor.id).role = "cashier";
  const cashierToken = await generateToken(f.load(f.actor.id));
  const denied = await fetch(`http://127.0.0.1:${server.address().port}/api/products/${f.productId}/stock`, { method: "PATCH", headers: { Authorization: `Bearer ${cashierToken}`, "Content-Type": "application/json" }, body: JSON.stringify(f.body(2)) });
  assert.equal(denied.status, 403); assert.equal(f.stock(), 4);
});

test("B03 catalog payloads cannot bypass stock/cost authority and omitted fields remain unchanged", async () => {
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } });
  for (const handler of [createProduct, updateProduct]) for (const field of ["stock", "quantity", "costPrice"]) {
    const res = response();
    await handler({ user: { id: String(id()), role: "admin" }, params: { id: String(id()) }, body: { name: "Synthetic", price: 100, [field]: 10 } }, res);
    assert.equal(res.statusCode, 403);
  }
  assert.deepEqual(catalogFields({ name: "Updated" }), { name: "Updated" });
});

test("B03 shared catalog role DTOs exclude costs/owners and enforce store selection", async t => {
  const f = fixture(t), server = createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  for (const role of ["admin", "store_manager", "cashier", "customer"]) {
    f.store.get("User").get(f.actor.id).role = role;
    const token = await generateToken(f.load(f.actor.id));
    const read = async storeId => fetch(`http://127.0.0.1:${server.address().port}/api/products/${f.productId}?storeId=${storeId}`, { headers: { Authorization: `Bearer ${token}` } });
    const result = await read(f.storeId); assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.data.price, 100); assert.equal(body.data.availability, true);
    assert.equal(body.data.costPrice, undefined); assert.equal(body.data.owner, undefined);
    assert.equal(Object.hasOwn(body.data, "stock"), ["admin", "store_manager"].includes(role));
    assert.equal((await read(id())).status, 403);
  }
});

// Real B02 resolver and schemas over staged storage; no native database claim.
test("B03 current bounded B02 Admin stock grant permits only its mapped Product and is rechecked", async t => {
  const f = fixture(t), issuer = id(), admin = f.store.get("User").get(f.actor.id);
  admin.role = "admin"; f.actor.role = "admin";
  f.store.get("User").set(String(issuer), { _id: issuer, identifier: "issuer", role: "admin", confirmed: true, accountState: "active", tokenVersion: 0, authorityVersion: 0 });
  const grantId = id();
  const grant = { _id: grantId, recipientAccountId: admin._id, capability: "inventory.adjust", scope: { kind: "store", resourceIds: [String(f.productId)] }, grantedBy: issuer, reason: "Synthetic reviewed approval", effectiveAt: new Date(Date.now()-1000), expiresAt: new Date(Date.now()+60000), recipientVersion: 0, grantorAuthorityVersion: 0, revokedAt: null, operationId: randomUUID() };
  f.store.get(AccountGrant.modelName).set(String(grantId), grant);
  assert.equal((await bookstoreContext(f.actor)).capabilities["inventory.adjust"], true);
  await adjustBookstoreStock(f.actor, f.productId, f.body(1)); assert.equal(f.stock(), 6);
  const other = id();
  f.store.get(Product.modelName).set(String(other), { ...f.rows(Product)[0], _id: other });
  await assert.rejects(adjustBookstoreStock(f.actor, other, f.body(1)), e => e.statusCode === 403);
  for (const mutate of [
    () => { f.store.get(AccountGrant.modelName).get(String(grantId)).expiresAt = new Date(0); },
    () => { const g=f.store.get(AccountGrant.modelName).get(String(grantId)); g.expiresAt=new Date(Date.now()+60000); g.revokedAt=new Date(); },
    () => { f.store.get(AccountGrant.modelName).get(String(grantId)).revokedAt=null; f.store.get("User").get(String(issuer)).authorityVersion=1; },
  ]) { mutate(); await assert.rejects(adjustBookstoreStock(f.actor, f.productId, f.body(1)), e => e.statusCode === 403); }
  assert.equal(f.stock(), 6); assert.equal(f.rows(StockMovement).length, 1);
});
