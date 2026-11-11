import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { ObjectId as DriverObjectId } from "mongodb";
import User from "../models/User.js";
import userRoutes from "../routes/UserRoute.js";
import { generateToken } from "../utils/generateToken.js";
import { canonicalAccountId } from "../utils/accountIdentity.js";
import { adminAccountFilter, runAdminAccountMutation } from "../utils/adminAccountMutation.js";
import { http, query, matchesAccountFilter } from "./helpers.js";

process.env.JWT_SECRET = "a06-synthetic-account-identity-test-key";
const actorId = "abcdef012345abcdef012345";
const otherId = "fedcba987654fedcba987654";
const mixedId = "aBcDeF012345AbCdEf012345";
const clone = (value) => JSON.parse(JSON.stringify(value));

// Identity/control-flow adapter only. It does not prove MongoDB transactions.
async function fixture(t, { role = "admin", confirmed = true, stale = false } = {}) {
  const connect = t.mock.method(mongoose, "connect", async () => { throw new Error("Database connections forbidden"); });
  const createConnection = t.mock.method(mongoose, "createConnection", () => { throw new Error("Database connections forbidden"); });
  const records = new Map([
    [actorId, { _id: actorId, identifier: "synthetic-actor", password: "synthetic-placeholder", role, confirmed, tokenVersion: 0, __v: 0 }],
    [otherId, { _id: otherId, identifier: "synthetic-other", password: "synthetic-placeholder", role: "user", confirmed: true, tokenVersion: 0, __v: 0 }],
  ]);
  const stats = { sessions: 0, fences: 0, deleteMethods: 0, collectionDeletes: 0, saved: 0, lookedUp: [] };
  class TestSession {
    active = false;
    async commitTransaction() {}
    async withTransaction(work, options) {
      assert.deepEqual(options, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      const snapshot = [...records].map(([key, row]) => [key, clone(row)]);
      this.active = true;
      try { const result = await work(); await this.commitTransaction(); return result; }
      catch (error) { records.clear(); for (const [key, row] of snapshot) records.set(key, row); throw error; }
      finally { this.active = false; }
    }
    async endSession() {}
  }
  t.mock.method(User, "startSession", async () => { stats.sessions++; return new TestSession(); });
  t.mock.method(User, "findById", (id) => {
    // Match the actual driver's equivalence without accepting malformed values.
    const key = new mongoose.Types.ObjectId(id).toHexString();
    stats.lookedUp.push(key);
    const row = records.get(key);
    return query(row ? User.hydrate(clone(row)) : null);
  });
  t.mock.method(User.collection, "updateOne", async (filter, update, options) => {
    const key = new mongoose.Types.ObjectId(filter._id).toHexString();
    const row = records.get(key);
    if (!row || !matchesAccountFilter(row, filter)) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    if (update.$inc?.__v) { assert(options.session?.active); stats.fences++; }
    else { assert(options.session?.active); stats.saved++; }
    Object.assign(row, clone(update.$set || {}));
    for (const [field, amount] of Object.entries(update.$inc || {})) row[field] = (row[field] || 0) + amount;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  const originalDelete = User.prototype.deleteOne;
  t.mock.method(User.prototype, "deleteOne", function trackedDelete(options) {
    stats.deleteMethods++;
    return originalDelete.call(this, options);
  });
  t.mock.method(User.collection, "deleteOne", async (filter, options) => {
    assert(options.session?.active);
    stats.collectionDeletes++;
    const key = new mongoose.Types.ObjectId(filter._id).toHexString();
    const deleted = records.delete(key);
    return { acknowledged: true, deletedCount: deleted ? 1 : 0 };
  });
  t.mock.method(console, "error", () => {});
  const token = await generateToken(User.hydrate(clone(records.get(actorId))));
  if (stale) records.get(actorId).tokenVersion = 1;
  const request = await http(t, userRoutes);
  t.after(() => {
    assert.equal(mongoose.connection.readyState, 0);
    assert.equal(connect.mock.callCount(), 0);
    assert.equal(createConnection.mock.callCount(), 0);
  });
  return { request, token, records, stats };
}

for (const [name, id] of [["canonical lowercase", actorId], ["uppercase", actorId.toUpperCase()], ["mixed-case", mixedId]]) {
  test(`self-deletion using ${name} ObjectId is rejected before either deletion function`, async (t) => {
    const f = await fixture(t);
    const result = await f.request(`/api/users/${id}`, { method: "DELETE", token: f.token });
    assert.equal(result.status, 400);
    assert.equal(result.body.message, "Cannot delete your own account");
    assert.equal(f.stats.deleteMethods, 0);
    assert.equal(f.stats.collectionDeletes, 0);
    assert.equal(f.stats.sessions, 0);
    assert.equal(f.stats.fences, 0);
    assert.equal(f.stats.lookedUp.length, 1, "only middleware may load the actor; target deletion lookup must not run");
    assert(f.records.has(actorId));
    assert.equal(f.records.get(actorId).__v, 0);
  });
}

test("authorized administrator deletes a different account using a case-variant ObjectId", async (t) => {
  const f = await fixture(t);
  const result = await f.request(`/api/users/${otherId.toUpperCase()}`, { method: "DELETE", token: f.token });
  assert.equal(result.status, 200);
  assert.equal(result.body.message, "User deleted");
  assert.equal(f.stats.deleteMethods, 1); assert.equal(f.stats.collectionDeletes, 1);
  assert.equal(f.stats.sessions, 1); assert.equal(f.stats.fences, 1);
  assert(f.records.has(actorId)); assert.equal(f.records.has(otherId), false);
  assert.equal(f.records.get(actorId).tokenVersion, 0);
});

for (const [name, options, tokenPresent, expected] of [
  ["anonymous", {}, false, 401],
  ["ordinary user", { role: "user" }, true, 403],
  ["unconfirmed administrator", { confirmed: false }, true, 401],
  ["stale administrator", { stale: true }, true, 401],
]) {
  test(`${name} cannot delete accounts or invoke either deletion function`, async (t) => {
    const f = await fixture(t, options);
    const result = await f.request(`/api/users/${otherId}`, { method: "DELETE", token: tokenPresent ? f.token : undefined });
    assert.equal(result.status, expected);
    assert.equal(f.stats.deleteMethods, 0); assert.equal(f.stats.collectionDeletes, 0);
    assert.equal(f.stats.sessions, 0); assert.equal(f.stats.fences, 0);
    assert.equal(f.records.size, 2);
  });
}

for (const method of ["DELETE", "PUT"]) {
  test(`${method} rejects malformed target ObjectIds before target lookup, session or mutation`, async (t) => {
    const f = await fixture(t);
    for (const id of ["not-an-object-id", "a".repeat(23), "a".repeat(25), "g".repeat(24), "abcdefghijkl", ` ${otherId}`, `${otherId} `, "/"]) {
      const result = await f.request(`/api/users/${encodeURIComponent(id)}`, { method, token: f.token, body: method === "PUT" ? { role: "admin" } : undefined });
      assert.equal(result.status, 400);
      assert.equal(result.body.message, "Invalid account ID");
    }
    assert.equal(f.stats.lookedUp.length, 8, "only the eight authenticated middleware lookups are permitted");
    assert.equal(f.stats.sessions, 0); assert.equal(f.stats.fences, 0); assert.equal(f.stats.saved, 0);
    assert.equal(f.stats.deleteMethods, 0); assert.equal(f.stats.collectionDeletes, 0);
  });
}

test("valid absent account preserves404 rather than treating a valid ObjectId as malformed", async (t) => {
  const f = await fixture(t);
  const result = await f.request("/api/users/000000000000000000000000", { method: "DELETE", token: f.token });
  assert.equal(result.status, 404); assert.equal(result.body.message, "User not found");
  assert.equal(f.stats.deleteMethods, 0); assert.equal(f.stats.collectionDeletes, 0);
  assert.equal(f.records.size, 2);
});

test("uppercase self-update uses the atomic self guard and retains security-version behavior", async (t) => {
  const f = await fixture(t);
  const result = await f.request(`/api/users/${actorId.toUpperCase()}`, { method: "PUT", token: f.token, body: { role: "cashier" } });
  assert.equal(result.status, 200);
  assert.equal(f.records.get(actorId).role, "cashier"); assert.equal(f.records.get(actorId).tokenVersion, 1);
  assert.equal(f.stats.saved, 1); assert.equal(f.stats.sessions, 1); assert.equal(f.stats.fences, 1);
  assert.equal((await f.request("/api/users/profile", { token: f.token })).status, 401);
  assert.equal(f.stats.deleteMethods, 0); assert.equal(f.stats.collectionDeletes, 0);
});

test("canonical IDs match across hexadecimal letter case and installed Mongoose/native BSON ObjectIds", () => {
  for (const id of [actorId, actorId.toUpperCase(), mixedId, new mongoose.Types.ObjectId(actorId), new DriverObjectId(actorId.toUpperCase())]) {
    assert.equal(canonicalAccountId(id), actorId);
  }
  assert.equal(canonicalAccountId("000000000000000000000000"), "000000000000000000000000");
  assert.equal(canonicalAccountId("123456123456123456123456"), "123456123456123456123456");
  assert.equal(mongoose.connection.readyState, 0);
});

test("canonical ID parsing rejects malformed values without request-object coercion", () => {
  let coercions = 0;
  const coercible = { toString() { coercions++; return actorId; }, toHexString() { coercions++; return actorId; } };
  const malformedBson = new mongoose.Types.ObjectId(actorId);
  malformedBson.toHexString = () => "invalid";
  for (const id of [null, undefined, "", 0, 123, true, [], {}, coercible, Object(actorId), Buffer.alloc(12), Buffer.alloc(24), Object.create(mongoose.Types.ObjectId.prototype), malformedBson, "abcdefghijkl", "g".repeat(24), ` ${actorId}`, `${actorId} `]) {
    assert.equal(canonicalAccountId(id), null);
  }
  assert.equal(coercions, 0);
});

test("administrative helper recognizes all canonical self identities before starting a transaction", async (t) => {
  const sessions = t.mock.method(User, "startSession", async () => { throw new Error("self identity must not start a transaction"); });
  for (const [actor, target] of [[actorId, actorId.toUpperCase()], [actorId.toUpperCase(), mixedId], [new mongoose.Types.ObjectId(actorId), new DriverObjectId(actorId)]]) {
    const result = await runAdminAccountMutation({ id: actor, role: "admin", tokenVersion: 0 }, target, async ({ guard, session }) => {
      assert.equal(guard._id.toHexString(), actorId);
      assert.equal(guard.role, "admin"); assert.equal(guard.confirmed, true);
      assert.equal(session, undefined);
      return "guarded-self";
    });
    assert.equal(result, "guarded-self");
  }
  assert.equal(sessions.mock.callCount(), 0);
});

test("malformed target/actor IDs are denied before helper work or sessions", async (t) => {
  const sessions = t.mock.method(User, "startSession", async () => { throw new Error("must not start a transaction"); });
  let work = 0;
  for (const id of [undefined, "", 123, [], {}, Buffer.alloc(12), "g".repeat(24)]) {
    await assert.rejects(runAdminAccountMutation({ id: actorId, role: "admin", tokenVersion: 0 }, id, async () => { work++; }), (error) => error.statusCode === 400);
    assert.throws(() => adminAccountFilter({ id, role: "admin", tokenVersion: 0 }), (error) => error.statusCode === 401);
  }
  assert.throws(() => adminAccountFilter({ id: null, role: "admin", tokenVersion: 0 }), (error) => error.statusCode === 401);
  assert.equal(work, 0); assert.equal(sessions.mock.callCount(), 0);
});
