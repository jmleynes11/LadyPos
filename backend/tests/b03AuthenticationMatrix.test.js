import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { createApp } from "../app.js";
import { collectRoutes } from "./routeInventoryAdapter.js";

process.env.JWT_SECRET = "b03-authentication-matrix-synthetic-key";
test("B03 complete mounted graph and inherited HEAD reject eight invalid authentication states without writes", async t => {
  const base = collectRoutes({ includeAccountRoutes: true, includeBookstoreRoutes: true }).filter(row => row.protected);
  const rows = [...base, ...base.filter(row => row.method === "GET").map(row => ({ ...row, method: "HEAD" }))];
  let account, effects = 0, requests = 0;
  t.mock.method(mongoose, "connect", () => assert.fail("Database forbidden"));
  t.mock.method(mongoose, "createConnection", () => assert.fail("Database forbidden"));
  t.mock.method(User, "findById", () => ({ select: async () => account }));
  t.mock.method(console, "log", () => {});
  for (const operation of ["insertOne", "insertMany", "updateOne", "updateMany", "deleteOne", "deleteMany", "findOneAndUpdate"]) t.mock.method(mongoose.Collection.prototype, operation, () => { effects++; assert.fail("Domain write before authentication"); });
  const accountId = new mongoose.Types.ObjectId(), now = Math.floor(Date.now() / 1000);
  const sign = (claims = {}, key = process.env.JWT_SECRET) => jwt.sign({ id: String(accountId), role: "admin", tokenVersion: 0, iat: now, exp: now + 600, ...claims }, key);
  const variants = [["anonymous", undefined, {}], ["unconfirmed", sign(), { confirmed: false }], ["deleted", sign(), null], ["expired", sign({ iat: now - 800, exp: now - 100 }), {}], ["wrong-signature", sign({}, "other-synthetic-key"), {}], ["malformed", "not-a-jwt", {}], ["stale", sign({ tokenVersion: 1 }), {}], ["suspended", sign(), { accountState: "suspended" }]];
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  for (const [name, token, changes] of variants) {
    account = changes === null ? null : { _id: accountId, role: "admin", confirmed: true, accountState: "active", tokenVersion: 0, ...changes };
    for (const row of rows) {
      const path = row.path.replace(/:[A-Za-z0-9_]+/g, String(accountId)), sendsBody = !["GET", "HEAD"].includes(row.method);
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: row.method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(sendsBody ? { "Content-Type": "application/json" } : {}) }, ...(sendsBody ? { body: "{}" } : {}) });
      assert.equal(response.status, 401, `${name} ${row.method} ${path}`); await response.text(); requests++;
    }
  }
  assert.equal(base.length, 95); assert.equal(rows.length, 135); assert.equal(requests, 1080); assert.equal(effects, 0); assert.equal(mongoose.connection.readyState, 0);
  t.diagnostic("1,080 HTTP denials; 95 explicit +40 inherited HEAD; no persistence or native database");
});
