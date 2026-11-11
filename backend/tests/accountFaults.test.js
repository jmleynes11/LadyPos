import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { createApp } from "../app.js";
import { generateToken } from "../utils/generateToken.js";
import { runAdminAccountMutation } from "../utils/adminAccountMutation.js";
import { AccountMutationIndeterminateError, saveAccountMutation } from "../utils/accountMutationOutcome.js";
import { errorHandler } from "../middleware/errorMiddleware.js";
import { matchesAccountFilter, query, serve } from "./helpers.js";

process.env.JWT_SECRET = "a08a-synthetic-signing-key";
const clone = (value) => JSON.parse(JSON.stringify(value));
class FaultSession {}

async function fixture(t) {
  const connect = t.mock.method(mongoose, "connect", async () => { throw new Error("Database access forbidden"); });
  const createConnection = t.mock.method(mongoose, "createConnection", () => { throw new Error("Database access forbidden"); });
  t.after(() => {
    assert.equal(connect.mock.callCount(), 0);
    assert.equal(createConnection.mock.callCount(), 0);
    assert.equal(mongoose.connection.readyState, 0);
  });
  const actorId = new mongoose.Types.ObjectId().toHexString();
  const targetId = new mongoose.Types.ObjectId().toHexString();
  const password = await bcrypt.hash("synthetic-original-password", 4);
  const rows = new Map([
    [actorId, { _id: actorId, identifier: "synthetic-actor", password, role: "admin", confirmed: true, tokenVersion: 0, __v: 0 }],
    [targetId, { _id: targetId, identifier: "synthetic-target", password, role: "user", confirmed: true, tokenVersion: 0, __v: 0 }],
  ]);
  const faults = {};
  const stats = { sessions: 0, callbacks: 0, commits: 0, cleanup: 0, fences: 0, saves: 0, inserts: 0, deletes: 0 };
  const logs = [];
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", (...args) => logs.push(args));
  const view = (id, session) => (session?.staged || rows).get(String(id).toLowerCase());
  const load = (id, session) => { const row = view(id, session); return row ? User.hydrate(clone(row)) : null; };
  t.mock.method(User, "findById", (id, projection, options) => query(load(id, options?.session)));
  t.mock.method(User, "findOne", (filter, projection, options) => {
    const row = [...(options?.session?.staged || rows).values()].find((row) => matchesAccountFilter(row, filter));
    return query(row ? User.hydrate(clone(row)) : null);
  });
  t.mock.method(User, "startSession", async () => {
    stats.sessions++;
    if (faults.start) throw faults.start;
    return Object.assign(new FaultSession(), {
      staged: new Map(),
      inTransaction() { return true; },
      async commitTransaction() {},
      async withTransaction(work) {
        if (faults.unsupported) throw faults.unsupported;
        this.staged = new Map([...rows].map(([id, row]) => [id, clone(row)]));
        stats.callbacks++;
        const result = await work();
        if (faults.beforeCommit) throw faults.beforeCommit;
        await this.commitTransaction();
        rows.clear();
        for (const [id, row] of this.staged) rows.set(id, clone(row));
        stats.commits++;
        if (faults.afterCommit) throw faults.afterCommit;
        return result;
      },
      async endSession() { stats.cleanup++; if (faults.cleanup) throw faults.cleanup; },
    });
  });
  t.mock.method(User.collection, "updateOne", async (filter, update, options) => {
    const session = options?.session;
    const fence = update.$inc?.__v === 1 && !update.$set?.tokenVersion;
    if (fence) {
      stats.fences++;
      if (Object.hasOwn(faults, "fenceResult")) return faults.fenceResult;
    } else {
      stats.saves++;
      if (faults.beforeWrite) throw faults.beforeWrite;
    }
    const row = view(filter._id, session);
    if (!row || !matchesAccountFilter(row, filter)) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    Object.assign(row, clone(update.$set || {}));
    for (const [key, value] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + value;
    for (const key of Object.keys(update.$unset || {})) delete row[key];
    if (!fence && faults.afterWrite) throw faults.afterWrite;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  t.mock.method(User.collection, "insertOne", async (row, options) => {
    stats.inserts++;
    (options?.session?.staged || rows).set(String(row._id), clone(row));
    return { acknowledged: true, insertedId: row._id };
  });
  t.mock.method(User.collection, "deleteOne", async (filter, options) => {
    stats.deletes++;
    const deleted = (options?.session?.staged || rows).delete(String(filter._id));
    return { acknowledged: true, deletedCount: Number(deleted) };
  });
  const actor = { id: actorId, role: "admin", tokenVersion: 0 };
  const token = await generateToken(load(actorId));
  const request = await serve(t, createApp());
  return { actor, actorId, targetId, rows, faults, stats, logs, token, request, load };
}

test("cleanup failure cannot replace an acknowledged administrative success", async (t) => {
  const f = await fixture(t);
  f.faults.cleanup = new Error("synthetic-cleanup-secret");
  const result = await f.request(`/api/users/${f.targetId}`, { method: "PUT", token: f.token, body: { role: "admin" } });
  assert.equal(result.status, 200);
  assert.equal(result.body.role, "admin");
  assert.equal(f.rows.get(f.targetId).tokenVersion, 1);
  assert.equal(f.stats.commits, 1); assert.equal(f.stats.cleanup, 1);
  assert.equal(f.stats.callbacks, 1); assert.equal(f.stats.saves, 1);
  assert(!JSON.stringify(f.logs).includes("synthetic-cleanup-secret"));
});

test("cleanup failure preserves the original callback rejection and aborts staged changes", async (t) => {
  const f = await fixture(t);
  const original = Object.assign(new Error("Original rejection"), { statusCode: 409 });
  f.faults.cleanup = new Error("synthetic-cleanup-secret");
  await assert.rejects(runAdminAccountMutation(f.actor, f.targetId, async () => { throw original; }), (error) => error === original);
  assert.equal(f.stats.commits, 0); assert.equal(f.stats.cleanup, 1);
  assert.equal(f.rows.get(f.actorId).__v, 0);
  assert(!JSON.stringify(f.logs).includes("synthetic-cleanup-secret"));
});

test("cleanup failure preserves an existing404 response without exposing driver details", async (t) => {
  const f = await fixture(t);
  f.faults.cleanup = new Error("synthetic-cleanup-secret");
  const result = await f.request(`/api/users/${new mongoose.Types.ObjectId()}`, { method: "DELETE", token: f.token });
  assert.equal(result.status, 404); assert.equal(result.body.message, "User not found");
  assert.equal(result.body.operationOutcome, undefined);
  assert.equal(f.stats.commits, 0); assert.equal(f.stats.deletes, 0); assert.equal(f.stats.cleanup, 1);
  assert.deepEqual(f.logs, [["Account mutation session cleanup failed"], ["Account command did not return acknowledged success"]]);
});

test("session-start failure performs no callback, fallback write or cleanup on a nonexistent session", async (t) => {
  const f = await fixture(t);
  f.faults.start = new Error("synthetic-session-secret");
  const result = await f.request(`/api/users/${f.targetId}`, { method: "DELETE", token: f.token });
  assert.equal(result.status, 500); assert.equal(result.body.operationOutcome, undefined);
  assert.equal(f.stats.callbacks, 0); assert.equal(f.stats.deletes, 0); assert.equal(f.stats.cleanup, 0);
  assert(f.rows.has(f.targetId));
  assert(!result.text.includes("synthetic-session-secret"));
});

test("unsupported transactions fail before target work even when cleanup also fails", async (t) => {
  const f = await fixture(t);
  const original = new Error("synthetic-unsupported-secret");
  f.faults.unsupported = original;
  f.faults.cleanup = new Error("synthetic-cleanup-secret");
  let work = 0;
  await assert.rejects(runAdminAccountMutation(f.actor, f.targetId, async () => { work++; }), (error) => error === original);
  assert.equal(work, 0); assert.equal(f.stats.cleanup, 1); assert.equal(f.stats.fences, 0);
  assert.deepEqual(f.logs, [["Account mutation session cleanup failed"]]);
});

test("absent, unacknowledged, unmatched and unmodified fences never invoke a target write", async (t) => {
  const f = await fixture(t);
  const failures = [undefined, null, {}, { acknowledged: false, matchedCount: 1, modifiedCount: 1 },
    { acknowledged: true, matchedCount: 0, modifiedCount: 0 }, { acknowledged: true, matchedCount: 1, modifiedCount: 0 },
    { acknowledged: true, matchedCount: "1", modifiedCount: 1 }];
  for (const result of failures) {
    f.faults.fenceResult = result;
    const response = await f.request(`/api/users/${f.targetId}`, { method: "DELETE", token: f.token });
    assert.equal(response.status, 401); assert.equal(response.body.operationOutcome, undefined);
  }
  assert.equal(f.stats.fences, failures.length); assert.equal(f.stats.cleanup, failures.length);
  assert.equal(f.stats.deletes, 0); assert.equal(f.stats.commits, 0);
  assert.equal(f.rows.get(f.actorId).__v, 0); assert(f.rows.has(f.targetId));
});

for (const operation of ["create", "update", "delete"]) {
  test(`${operation} commit uncertainty plus cleanup failure keeps its primary outcome and is not replayed`, async (t) => {
    const f = await fixture(t);
    const original = new mongoose.mongo.MongoServerError({ message: "synthetic-commit-secret" });
    original.addErrorLabel("UnknownTransactionCommitResult");
    f.faults.afterCommit = original;
    f.faults.cleanup = new Error("synthetic-cleanup-secret");
    const url = operation === "create" ? "/api/users/register" : `/api/users/${f.targetId}`;
    const body = operation === "create" ? { identifier: "synthetic-created", password: "synthetic-new-password", role: "cashier" }
      : operation === "update" ? { password: "synthetic-new-password" } : undefined;
    const response = await f.request(url, { token: f.token, method: operation === "create" ? "POST" : operation === "update" ? "PUT" : "DELETE", body });
    assert.equal(response.status, 500); assert.equal(response.body.code, "ACCOUNT_MUTATION_OUTCOME_UNKNOWN");
    assert.equal(response.body.operationOutcome, "indeterminate"); assert.equal(response.body.retryable, false);
    assert.equal(f.stats.callbacks, 1); assert.equal(f.stats.commits, 1); assert.equal(f.stats.cleanup, 1);
    assert.equal(f.rows.get(f.actorId).__v, 1);
    assert(!response.text.includes("synthetic-")); assert(!JSON.stringify(f.logs).includes("synthetic-"));
    if (operation === "create") { assert.equal(f.stats.inserts, 1); assert.equal(f.rows.size, 3); }
    if (operation === "update") { assert.equal(f.stats.saves, 1); assert.equal(f.rows.get(f.targetId).tokenVersion, 1); assert(await f.load(f.targetId).matchPassword("synthetic-new-password")); }
    if (operation === "delete") { assert.equal(f.stats.deletes, 1); assert.equal(f.rows.has(f.targetId), false); }
  });
}

test("unclassified post-callback failure is conservatively indeterminate even when the adapter did not commit", async (t) => {
  const f = await fixture(t);
  f.faults.beforeCommit = new Error("synthetic-before-commit-secret");
  const response = await f.request(`/api/users/${f.targetId}`, { method: "PUT", token: f.token, body: { role: "admin" } });
  assert.equal(response.status, 500); assert.equal(response.body.operationOutcome, "indeterminate");
  assert.equal(response.body.retryable, false); assert.equal(f.stats.callbacks, 1); assert.equal(f.stats.commits, 0);
  assert.equal(f.rows.get(f.targetId).role, "user"); assert.equal(f.rows.get(f.actorId).__v, 0);
});

test("self administrative lost acknowledgement preserves revocation and cannot restore privileges with the stale token", async (t) => {
  const f = await fixture(t);
  f.faults.afterCommit = Object.assign(new Error("synthetic-write-secret"), { errorLabels: ["UnknownTransactionCommitResult"] });
  const url = `/api/users/${f.actorId.toUpperCase()}`;
  const response = await f.request(url, { method: "PUT", token: f.token, body: { role: "cashier" } });
  assert.equal(response.status, 500); assert.equal(response.body.operationOutcome, "indeterminate");
  assert.equal(f.rows.get(f.actorId).role, "cashier"); assert.equal(f.rows.get(f.actorId).tokenVersion, 1);
  assert.equal((await f.request(url, { method: "PUT", token: f.token, body: { role: "admin" } })).status, 401);
  assert.equal(f.stats.saves, 1); assert.equal(f.stats.sessions, 1);
});

test("profile acknowledgement loss is reported without retry or a spurious security epoch change", async (t) => {
  const f = await fixture(t);
  f.faults.afterCommit = Object.assign(new Error("synthetic-profile-secret"), { errorLabels: ["UnknownTransactionCommitResult"] });
  const response = await f.request("/api/users/profile", { method: "PUT", token: f.token, body: { name: "Synthetic updated name" } });
  assert.equal(response.status, 500); assert.equal(response.body.operationOutcome, "indeterminate");
  assert.equal(response.body.retryable, false); assert.equal(f.stats.saves, 1);
  assert.equal(f.rows.get(f.actorId).tokenVersion, 0); assert.equal(f.rows.get(f.actorId).name, "Synthetic updated name");
});

test("an unclassified single-write failure never implies rollback or retries automatically", async (t) => {
  const f = await fixture(t);
  f.faults.beforeWrite = new Error("synthetic-transport-secret");
  const response = await f.request("/api/users/password", { method: "PUT", token: f.token,
    body: { currentPassword: "synthetic-original-password", newPassword: "synthetic-new-password" } });
  assert.equal(response.status, 500); assert.equal(response.body.operationOutcome, "indeterminate");
  assert.equal(response.body.retryable, false); assert.equal(f.stats.saves, 1);
  assert.equal(f.rows.get(f.actorId).tokenVersion, 0); assert(await f.load(f.actorId).matchPassword("synthetic-original-password"));
});

// Exercise the INSTALLED driver's withTransaction loop. Session state and wire
// operations are synthetic; this is not a real ClientSession/database test.
function driverFixture(t) {
  const actor = { id: new mongoose.Types.ObjectId().toHexString(), role: "admin", tokenVersion: 0 };
  const target = new mongoose.Types.ObjectId().toHexString();
  const stats = { starts: 0, commits: 0, aborts: 0, ends: 0, fences: 0 };
  const faults = {};
  const session = {
    transaction: { state: "NO_TRANSACTION" },
    startTransaction() { stats.starts++; this.transaction.state = "TRANSACTION_IN_PROGRESS"; },
    async commitTransaction() {
      stats.commits++;
      if (faults.commit) await faults.commit(stats.commits);
      this.transaction.state = "TRANSACTION_COMMITTED";
    },
    async abortTransaction() {
      stats.aborts++;
      if (faults.abort) throw faults.abort;
      this.transaction.state = "TRANSACTION_ABORTED";
    },
    async endSession() { stats.ends++; },
    withTransaction(work, options) { return mongoose.mongo.ClientSession.prototype.withTransaction.call(this, work, options); },
  };
  t.mock.method(User, "startSession", async () => session);
  t.mock.method(User, "updateOne", async (filter, update, options) => {
    stats.fences++;
    assert.equal(filter.role, "admin"); assert.equal(filter.tokenVersion, undefined); assert(filter.$or);
    assert.deepEqual(update, { $inc: { __v: 1 } }); assert.equal(options.session, session);
    if (faults.actorRevoked) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  t.after(() => assert.equal(mongoose.connection.readyState, 0));
  return { actor, target, stats, faults, logs };
}

function labelled(...labels) {
  const error = new mongoose.mongo.MongoServerError({ message: "synthetic-driver-secret" });
  for (const label of labels) error.addErrorLabel(label);
  return error;
}

test("unknown callback outcome overrides a transient label in the installed driver and prevents callback replay", async (t) => {
  const f = driverFixture(t);
  const original = labelled("UnknownTransactionCommitResult", "TransientTransactionError");
  let calls = 0;
  await assert.rejects(runAdminAccountMutation(f.actor, f.target, async () => { calls++; throw original; }),
    (error) => error instanceof AccountMutationIndeterminateError && error.cause === original && !error.hasErrorLabel);
  assert.equal(calls, 1); assert.equal(f.stats.starts, 1); assert.equal(f.stats.commits, 0);
  assert.equal(f.stats.aborts, 1); assert.equal(f.stats.ends, 1);
});

test("installed driver retries an uncertain commit acknowledgement without replaying the target callback", async (t) => {
  const f = driverFixture(t);
  f.faults.commit = async (attempt) => { if (attempt === 1) throw labelled("UnknownTransactionCommitResult"); };
  let calls = 0;
  const result = await runAdminAccountMutation(f.actor, f.target, async () => { calls++; return "acknowledged"; });
  assert.equal(result, "acknowledged"); assert.equal(calls, 1); assert.equal(f.stats.starts, 1);
  assert.equal(f.stats.commits, 2); assert.equal(f.stats.fences, 1); assert.equal(f.stats.ends, 1);
});

test("installed driver terminal commit uncertainty is non-retryable to the application", async (t) => {
  const f = driverFixture(t);
  const original = new mongoose.mongo.MongoServerError({ message: "synthetic-driver-secret", code: 50 });
  original.addErrorLabel("UnknownTransactionCommitResult");
  f.faults.commit = async () => { throw original; };
  let calls = 0;
  await assert.rejects(runAdminAccountMutation(f.actor, f.target, async () => { calls++; return "result"; }),
    (error) => error instanceof AccountMutationIndeterminateError && error.cause === original);
  assert.equal(calls, 1); assert.equal(f.stats.starts, 1); assert.equal(f.stats.commits, 1); assert.equal(f.stats.ends, 1);
});

test("installed driver retains safe aborted callback retry with a fresh actor fence", async (t) => {
  const f = driverFixture(t);
  let calls = 0;
  const result = await runAdminAccountMutation(f.actor, f.target, async () => {
    if (++calls === 1) throw labelled("TransientTransactionError");
    return "retried-aborted-transaction";
  });
  assert.equal(result, "retried-aborted-transaction"); assert.equal(calls, 2);
  assert.equal(f.stats.starts, 2); assert.equal(f.stats.fences, 2); assert.equal(f.stats.aborts, 1); assert.equal(f.stats.commits, 1);
});

test("installed driver callback retry cannot reuse an actor that lost authorization after abort", async (t) => {
  const f = driverFixture(t);
  let calls = 0;
  await assert.rejects(runAdminAccountMutation(f.actor, f.target, async () => {
    calls++;
    f.faults.actorRevoked = true;
    throw labelled("TransientTransactionError");
  }), (error) => error.statusCode === 401);
  assert.equal(calls, 1); assert.equal(f.stats.starts, 2); assert.equal(f.stats.fences, 2);
  assert.equal(f.stats.commits, 0); assert.equal(f.stats.ends, 1);
});

test("abort failure retains the primary callback error as cause and does not replay the target", async (t) => {
  const f = driverFixture(t);
  const original = Object.assign(new Error("synthetic-primary-secret"), { statusCode: 409 });
  f.faults.abort = new Error("synthetic-abort-secret");
  let calls = 0;
  await assert.rejects(runAdminAccountMutation(f.actor, f.target, async () => { calls++; throw original; }),
    (error) => error instanceof AccountMutationIndeterminateError && error.cause === original && error.statusCode === 500);
  assert.equal(calls, 1); assert.equal(f.stats.commits, 0); assert.equal(f.stats.ends, 1);
  assert.deepEqual(f.logs, [["Account transaction finalization failed"]]);
});

test("known single-save rejections retain their original errors; write concern failures remain indeterminate", async () => {
  const rejected = [new mongoose.Error.ValidationError(), new mongoose.Error.CastError("ObjectId", "bad", "_id"),
    new mongoose.Error.DocumentNotFoundError({}), new mongoose.Error.VersionError(new User({ identifier: "synthetic", password: "synthetic" }), 1, []),
    new mongoose.Error.ParallelSaveError(new User({ identifier: "synthetic", password: "synthetic" })),
    new mongoose.mongo.MongoServerError({ message: "synthetic-duplicate", code: 11000 })];
  for (const original of rejected) {
    let calls = 0;
    await assert.rejects(saveAccountMutation({ save: async () => { calls++; throw original; } }), (error) => error === original);
    assert.equal(calls, 1);
  }
  const original = new mongoose.mongo.MongoWriteConcernError({ writeConcernError: { errmsg: "synthetic-concern-secret", code: 11000 } });
  await assert.rejects(saveAccountMutation({ save: async () => { throw original; } }),
    (error) => error instanceof AccountMutationIndeterminateError && error.cause === original);
  const ambiguous = Object.assign(new mongoose.Error.ValidationError(), { hasErrorLabel: "not-callable", errorLabels: ["UnknownTransactionCommitResult"] });
  await assert.rejects(saveAccountMutation({ save: async () => { throw ambiguous; } }),
    (error) => error instanceof AccountMutationIndeterminateError && error.cause === ambiguous);
});

test("only trusted outcome errors add non-retryable metadata; causes and forged error fields stay private", (t) => {
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const fake = { statusCode: 404, code: "ACCOUNT_MUTATION_OUTCOME_UNKNOWN", operationOutcome: "indeterminate", retryable: true,
    message: "Not found" };
  const uncertain = new AccountMutationIndeterminateError(new Error("synthetic-private-cause"));
  for (const error of [fake, uncertain]) {
    const res = { statusCode: 409, status(status) { this.statusCode = status; return this; }, json(body) { this.body = body; } };
    errorHandler(error, {}, res, () => {});
    assert.equal(res.statusCode, error === fake ? 404 : 500);
    assert.equal(res.body.operationOutcome, error === fake ? undefined : "indeterminate");
    if (error !== fake) { assert.equal(res.body.retryable, false); assert.equal(res.body.message, "Internal server error"); }
    assert(!JSON.stringify(res.body).includes("synthetic-private-cause"));
  }
  assert.deepEqual(logs, [["Request failed with status 500"]]);
});

test("lost commit acknowledgement reports indeterminate without replaying the mutation", async (t) => {
  const f = await fixture(t);
  f.faults.afterCommit = new Error("synthetic-commit-secret");
  const result = await f.request(`/api/users/${f.targetId}`, { method: "PUT", token: f.token, body: { role: "admin" } });
  assert.equal(result.status, 500);
  assert.equal(result.body.code, "ACCOUNT_MUTATION_OUTCOME_UNKNOWN");
  assert.equal(result.body.operationOutcome, "indeterminate");
  assert.equal(result.body.retryable, false);
  assert.equal(f.rows.get(f.targetId).tokenVersion, 1);
  assert.equal(f.stats.callbacks, 1); assert.equal(f.stats.saves, 1); assert.equal(f.stats.commits, 1);
  assert(!result.text.includes("synthetic-commit-secret"));
});

test("self password lost acknowledgement remains revoked and reports indeterminate without retry", async (t) => {
  const f = await fixture(t);
  f.faults.afterCommit = Object.assign(new Error("synthetic-write-secret"), { errorLabels: ["UnknownTransactionCommitResult"] });
  const result = await f.request("/api/users/password", { method: "PUT", token: f.token,
    body: { currentPassword: "synthetic-original-password", newPassword: "synthetic-new-password" } });
  assert.equal(result.status, 500);
  assert.equal(result.body.operationOutcome, "indeterminate");
  assert.equal(result.body.retryable, false);
  assert.equal(f.stats.saves, 1); assert.equal(f.stats.sessions, 1);
  assert.equal(f.rows.get(f.actorId).tokenVersion, 1);
  assert(await f.load(f.actorId).matchPassword("synthetic-new-password"));
  assert.equal((await f.request("/api/users/profile", { token: f.token })).status, 401);
  assert(!result.text.includes("synthetic-write-secret"));
});
