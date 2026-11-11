import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import User from "../models/User.js";
import Store from "../models/Store.js";
import { AccountAudit, AccountReceipt } from "../models/AccountControl.js";
import { replaceStoreMemberships } from "../services/accountManagement.js";
import { accountAdapter } from "./accountManagementAdapter.js";

process.env.JWT_SECRET = "b03-membership-synthetic-signing-key";
const id = () => new mongoose.Types.ObjectId();
const cloneValue = value => mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(value));
function fixture(t) {
  const admin = id(), target = id(), storeId = id();
  const adapter = accountAdapter(t, [
    { _id: admin, identifier: "synthetic-admin", password: "existing-hash", role: "admin", confirmed: true, accountState: "active", tokenVersion: 0, authorityVersion: 0 },
    { _id: target, identifier: "synthetic-cashier", password: "existing-hash", role: "cashier", confirmed: true, accountState: "active", tokenVersion: 0, authorityVersion: 0 },
  ], { extraModels: [Store], cloneValue });
  adapter.store.get(Store.modelName).set(String(storeId), { _id: storeId, name: "Synthetic bookstore" });
  return { ...adapter, admin, target, storeId, actor: { id: String(admin), role: "admin", tokenVersion: 0 }, command: (extra = {}) => ({ operationId: randomUUID(), reason: "Reviewed synthetic membership", expectedVersion: 0, storeIds: [String(storeId)], ...extra }) };
}

test("D1 membership command atomically audits explicit IDs, advances epochs and reconciles replay", async t => {
  const f = fixture(t), body = f.command();
  const result = await replaceStoreMemberships(f.actor, String(f.target), body);
  assert.deepEqual(result.storeIds, [String(f.storeId)]);
  assert.equal(f.load(f.target).tokenVersion, 1); assert.equal(f.load(f.target).authorityVersion, 1);
  assert.equal(f.load(f.target).password, "existing-hash");
  assert.deepEqual(f.rows(AccountAudit)[0].before, { storeIds: [] });
  assert.deepEqual(f.rows(AccountAudit)[0].after, { storeIds: [String(f.storeId)] });
  assert.equal(f.rows(AccountAudit)[0].action, "account.store_membership_changed");
  assert.equal(f.rows(AccountReceipt).length, 1);
  await replaceStoreMemberships(f.actor, String(f.target), body);
  assert.equal(f.load(f.target).tokenVersion, 1); assert.equal(f.rows(AccountAudit).length, 1);
  await assert.rejects(replaceStoreMemberships(f.actor, String(f.target), { ...body, storeIds: [] }), error => error.statusCode === 409);
});

test("D1 membership audit insertion failure rolls back membership, epochs and receipt", async t => {
  const f = fixture(t); f.faults.audit = true;
  await assert.rejects(replaceStoreMemberships(f.actor, String(f.target), f.command()));
  assert.equal(f.load(f.target).storeIds, undefined); assert.equal(f.load(f.target).tokenVersion, 0);
  assert.equal(f.rows(AccountAudit).length, 0); assert.equal(f.rows(AccountReceipt).length, 0);
});

test("D1 membership command rejects non-admin, missing stores, stale and malformed IDs without commit", async t => {
  const f = fixture(t);
  await assert.rejects(replaceStoreMemberships({ id: String(f.target), role: "cashier", tokenVersion: 0 }, String(f.target), f.command()), error => error.statusCode === 403);
  for (const body of [f.command({ expectedVersion: 1 }), f.command({ storeIds: [String(id())] }), f.command({ storeIds: [String(f.storeId), String(f.storeId)] }), f.command({ storeIds: [{ $ne: null }] }), f.command({ storeIds: new Array(1) })]) {
    await assert.rejects(replaceStoreMemberships(f.actor, String(f.target), body));
  }
  assert.equal(f.stats.commits, 0); assert.equal(f.load(f.target).tokenVersion, 0);
});

test("D1 membership removal preserves records and prevents stale writes", async t => {
  const f = fixture(t);
  await replaceStoreMemberships(f.actor, String(f.target), f.command());
  await assert.rejects(replaceStoreMemberships(f.actor, String(f.target), f.command({ storeIds: [] })), error => error.statusCode === 409);
  await replaceStoreMemberships(f.actor, String(f.target), f.command({ expectedVersion: 1, storeIds: [] }));
  assert.deepEqual(f.load(f.target).storeIds, []);
  assert.equal(f.load(f.target).tokenVersion, 2);
  assert.equal(f.rows(Store).length, 1); assert.equal(f.rows(User).length, 2);
});
