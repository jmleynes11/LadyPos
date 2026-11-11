import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Transaction from "../models/Order.js";
import Invoice from "../models/Invoice.js";
import { createApp } from "../app.js";
import { generateToken } from "../utils/generateToken.js";
import { ROUTE_MANIFEST } from "../auth/routeManifest.js";
import { id, query, serve } from "./helpers.js";

process.env.JWT_SECRET = "b03-cutover-synthetic-signing-key";
beforeEach(t => {
  const deny = () => { throw new Error("Database connections forbidden"); };
  t.mock.method(mongoose, "connect", deny);
  t.mock.method(mongoose, "createConnection", deny);
  t.mock.method(console, "log", () => {});
});

async function fixture(t) {
  const account = { _id: id(), role: "user", confirmed: true, accountState: "active", tokenVersion: 0 };
  t.mock.method(User, "findById", () => query(account));
  let sessions = 0;
  for (const model of [User, mongoose]) t.mock.method(model, "startSession", () => { sessions++; throw new Error("Legacy reads/writes must not start effect sessions"); });
  const request = await serve(t, createApp());
  const token = await generateToken(account);
  return { account, token, request, sessions: () => sessions };
}

test("D2 every registered legacy operational write denies before domain access or fence", async t => {
  const f = await fixture(t);
  let effects = 0;
  for (const method of ["insertOne", "insertMany", "updateOne", "updateMany", "deleteOne", "deleteMany", "findOneAndUpdate"]) {
    t.mock.method(mongoose.Collection.prototype, method, () => { effects++; throw new Error("Forbidden domain effect"); });
  }
  const rows = ROUTE_MANIFEST.filter(row => row.protected && row.mount !== "/api/users" && !["GET", "HEAD"].includes(row.method));
  assert(rows.length > 20);
  for (const row of rows) {
    const path = row.path.replace(/:[a-zA-Z]+/g, String(id()));
    const result = await f.request(path, { token: f.token, method: row.method, body: { price: 1, stock: 100, reason: "forged", role: "admin" } });
    assert.equal(result.status, 403, `${row.method} ${row.path}`);
  }
  assert.equal(effects, 0);
  assert.equal(f.sessions(), 0);
  assert.equal((await f.request("/api/users/profile", { token: f.token })).status, 200);
});

test("D2 product reads remain owner-scoped despite forged owner query", async t => {
  const f = await fixture(t), productId = id(), peerId = id();
  t.mock.method(Product, "findOne", filter => {
    assert.equal(String(filter.owner), String(f.account._id));
    return query(String(filter._id) === String(productId) ? { _id: productId, owner: f.account._id, price: 10 } : null);
  });
  assert.equal((await f.request(`/api/products/${productId}?owner=${peerId}`, { token: f.token })).status, 200);
  assert.equal((await f.request(`/api/products/${peerId}?owner=${peerId}`, { token: f.token })).status, 404);
  assert.equal(f.sessions(), 0);
});

for (const existing of [false, true]) {
  test(`D2 receipt ensure GET/HEAD aliases are read-only (${existing ? "existing" : "missing"} receipt)`, async t => {
    const f = await fixture(t), saleId = id();
    t.mock.method(Transaction, "findOne", filter => {
      assert.equal(String(filter.owner), String(f.account._id));
      return query({ _id: saleId, owner: f.account._id });
    });
    const invoice = { _id: id(), invoiceNumber: "SYNTHETIC", status: "paid", transaction: { _id: saleId, items: [], totalAmount: 0 }, async populate() { return this; } };
    t.mock.method(Invoice, "findOne", filter => {
      assert.equal(String(filter.owner), String(f.account._id));
      assert.equal(String(filter.transaction), String(saleId));
      return query(existing ? invoice : null);
    });
    let writes = 0;
    for (const method of ["insertOne", "updateOne", "findOneAndUpdate"]) t.mock.method(mongoose.Collection.prototype, method, () => { writes++; throw new Error("No receipt issuance"); });
    for (const alias of ["order", "transaction"]) for (const method of ["GET", "HEAD"]) {
      const result = await f.request(`/api/invoices/${alias}/${saleId}/ensure`, { token: f.token, method });
      assert.equal(result.status, existing ? 200 : 403, `${method} ${alias}`);
    }
    assert.equal(writes, 0);
    assert.equal(f.sessions(), 0);
  });
}
