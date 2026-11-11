import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import mongoose from "mongoose";
import User from "../models/User.js";
import { runAdminAccountMutation } from "../utils/adminAccountMutation.js";
import { AccountMutationIndeterminateError } from "../utils/accountMutationOutcome.js";
import { errorHandler } from "../middleware/errorMiddleware.js";

const require = createRequire(import.meta.url);
const wire = require("../node_modules/mongodb/lib/operations/execute_operation.js");
const clone = (row) => ({ ...row });

function fault({ code, labels = [], nested = false } = {}) {
  const error = new mongoose.mongo.MongoServerError(nested
    ? { message: "synthetic-private-commit", writeConcernError: { code } }
    : { message: "synthetic-private-commit", code });
  for (const label of labels) error.addErrorLabel(label);
  return error;
}

// Installed driver loops, synthetic session state and collection/wire effects.
// This models outcomes explicitly; it does not establish native MongoDB facts.
function fixture(t, { nativeCommit = false, prototypeCommit = false, plans = [] } = {}) {
  const connect = t.mock.method(mongoose, "connect", async () => { throw new Error("Database access forbidden"); });
  const create = t.mock.method(mongoose, "createConnection", () => { throw new Error("Database access forbidden"); });
  const actor = { id: new mongoose.Types.ObjectId().toHexString(), role: "admin", tokenVersion: 0 };
  const target = new mongoose.Types.ObjectId().toHexString();
  const row = { role: "user", tokenVersion: 0 };
  const state = { starts: 0, callbacks: 0, commits: 0, effects: 0, fences: 0, aborts: 0, ends: 0, revoked: false };
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const apply = () => {
    if (session.applied) return;
    Object.assign(row, session.staged);
    state.effects++;
    session.applied = true;
  };
  const attemptCommit = async () => {
    state.commits++;
    const plan = plans[state.commits - 1] || {};
    if (plan.apply || !plan.error) apply();
    session.transaction.state = "TRANSACTION_COMMITTED";
    if (plan.revoke) state.revoked = true;
    if (plan.error) throw plan.error;
  };
  const session = {
    client: {}, clientOptions: {},
    transaction: { state: "NO_TRANSACTION", options: { writeConcern: { w: "majority" } }, transition(n) { this.state = n; } },
    startTransaction() {
      state.starts++;
      this.transaction.state = "STARTING_TRANSACTION";
      this.staged = clone(row); this.applied = false;
    },
    unpin() {},
    commitTransaction: nativeCommit
      ? function () { return mongoose.mongo.ClientSession.prototype.commitTransaction.call(this); }
      : attemptCommit,
    async abortTransaction() {
      state.aborts++;
      if (session.abortError) throw session.abortError;
      this.transaction.state = "TRANSACTION_ABORTED";
    },
    async endSession() { state.ends++; if (session.cleanupError) throw session.cleanupError; },
    withTransaction(work, options) { return mongoose.mongo.ClientSession.prototype.withTransaction.call(this, work, options); },
  };
  if (prototypeCommit) {
    Object.setPrototypeOf(session, { commitTransaction: session.commitTransaction });
    delete session.commitTransaction;
  }
  const descriptor = Object.getOwnPropertyDescriptor(session, "commitTransaction");
  if (nativeCommit) t.mock.method(wire, "executeOperation", async (_client, operation) => {
    assert.equal(operation.command.commitTransaction, 1, "the synthetic wire must never perform non-commit operations");
    return attemptCommit();
  });
  t.mock.method(User, "startSession", async () => session);
  t.mock.method(User, "updateOne", async (filter, update, options) => {
    state.fences++;
    assert.equal(String(filter._id), actor.id); assert.equal(filter.role, "admin"); assert.equal(filter.confirmed, true);
    assert.equal(options.session, session); assert.deepEqual(update, { $inc: { __v: 1 } });
    if (state.revoked) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    session.transaction.state = "TRANSACTION_IN_PROGRESS";
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  const work = async () => {
    state.callbacks++;
    session.staged.role = "admin";
    session.staged.tokenVersion++;
    if (session.callbackError && state.callbacks === 1) throw session.callbackError;
    return clone(session.staged);
  };
  t.after(() => {
    assert.equal(connect.mock.callCount(), 0); assert.equal(create.mock.callCount(), 0);
    assert.equal(mongoose.connection.readyState, 0);
    assert.deepEqual(Object.getOwnPropertyDescriptor(session, "commitTransaction"), descriptor);
  });
  return { actor, target, row, session, state, logs, work };
}

test("nested code50 compound write-concern input blocks target replay", async (t) => {
  const primary = fault({ code: 50, nested: true, labels: ["UnknownTransactionCommitResult", "TransientTransactionError", "RetryableWriteError"] });
  const f = fixture(t, { plans: [{ error: primary, apply: true }] });
  const { error } = await resultOf(f);
  assert(error instanceof AccountMutationIndeterminateError); assert.equal(error.cause, primary);
  assert.equal(f.state.callbacks, 1); assert.equal(f.state.effects, 1); assert.equal(f.row.tokenVersion, 1);
  assert.deepEqual(primary.errorLabels, ["UnknownTransactionCommitResult", "TransientTransactionError", "RetryableWriteError"]);
});

test("non-timeout compound uncertainty retains same-transaction commit acknowledgement retry", async (t) => {
  const primary = fault({ labels: ["UnknownTransactionCommitResult", "TransientTransactionError"] });
  const f = fixture(t, { plans: [{ error: primary, apply: true }] });
  const { value, error } = await resultOf(f);
  assert.equal(error, undefined); assert.equal(value.role, "admin"); assert.equal(value.tokenVersion, 1);
  assert.equal(f.state.starts, 1); assert.equal(f.state.callbacks, 1); assert.equal(f.state.commits, 2);
  assert.equal(f.state.effects, 1); assert.equal(f.row.tokenVersion, 1);
  assert.deepEqual(primary.errorLabels, ["UnknownTransactionCommitResult", "TransientTransactionError"]);
});

test("unknown-only acknowledgement retry preserves one target effect and the original session identity", async (t) => {
  const f = fixture(t, { plans: [{ error: fault({ labels: ["UnknownTransactionCommitResult"] }), apply: true }] });
  const { value, error } = await resultOf(f);
  assert.equal(error, undefined); assert.equal(value.tokenVersion, 1);
  assert.equal(f.state.callbacks, 1); assert.equal(f.state.fences, 1); assert.equal(f.state.effects, 1); assert.equal(f.state.commits, 2);
});

test("confirmed aborted commit allows a fresh callback and applies only the successful transaction", async (t) => {
  const f = fixture(t, { plans: [{ error: fault({ code: 251, labels: ["TransientTransactionError"] }) }] });
  const { value, error } = await resultOf(f);
  assert.equal(error, undefined); assert.equal(value.tokenVersion, 1);
  assert.equal(f.state.callbacks, 2); assert.equal(f.state.fences, 2); assert.equal(f.state.starts, 2);
  assert.equal(f.state.commits, 2); assert.equal(f.state.effects, 1); assert.equal(f.row.tokenVersion, 1);
});

test("a later transient-only abort result can clarify an earlier uncertain acknowledgement", async (t) => {
  const f = fixture(t, { plans: [
    { error: fault({ labels: ["UnknownTransactionCommitResult"] }) },
    { error: fault({ code: 251, labels: ["TransientTransactionError"] }) },
  ] });
  const { value, error } = await resultOf(f);
  assert.equal(error, undefined); assert.equal(value.tokenVersion, 1);
  assert.equal(f.state.callbacks, 2); assert.equal(f.state.commits, 3); assert.equal(f.state.effects, 1);
});

test("safe retry after a confirmed abort still denies an actor revoked before its next fence", async (t) => {
  const f = fixture(t, { plans: [{ error: fault({ code: 251, labels: ["TransientTransactionError"] }), revoke: true }] });
  const { error } = await resultOf(f);
  assert.equal(error.statusCode, 401); assert.equal(f.state.callbacks, 1); assert.equal(f.state.fences, 2);
  assert.equal(f.state.effects, 0); assert.equal(f.row.role, "user"); assert.equal(f.row.tokenVersion, 0);
});

test("unretryable commit rejection is not replayed or falsely asserted to prove rollback", async (t) => {
  const primary = fault({ code: 11000 });
  const f = fixture(t, { plans: [{ error: primary }] });
  const { error } = await resultOf(f);
  assert(error instanceof AccountMutationIndeterminateError); assert.equal(error.cause, primary);
  assert.equal(f.state.effects, 0); assert.equal(f.state.callbacks, 1); assert.equal(f.state.commits, 1);
});

for (const applied of [false, true]) {
  test(`compound commit plus cleanup failure retains the primary uncertainty, applied=${applied}`, async (t) => {
    const primary = fault({ code: 50, labels: ["UnknownTransactionCommitResult", "TransientTransactionError"] });
    const f = fixture(t, { plans: [{ error: primary, apply: applied }] });
    f.session.cleanupError = new Error("synthetic-private-cleanup");
    const { error } = await resultOf(f);
    assert(error instanceof AccountMutationIndeterminateError); assert.equal(error.cause, primary);
    assert.equal(f.state.callbacks, 1); assert.equal(f.state.effects, Number(applied)); assert.equal(f.row.tokenVersion, Number(applied));
    const res = { statusCode: 409, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; } };
    errorHandler(error, {}, res, () => {});
    assert.equal(res.statusCode, 500); assert.equal(res.body.code, "ACCOUNT_MUTATION_OUTCOME_UNKNOWN");
    assert.equal(res.body.operationOutcome, "indeterminate"); assert.equal(res.body.retryable, false);
    assert(!JSON.stringify(res.body).includes("synthetic-private")); assert(!JSON.stringify(f.logs).includes("synthetic-private"));
    assert.equal(f.state.ends, 1);
  });
}

test("unlabelled commit failure preserves its primary error even if driver finalization throws a secondary error", async (t) => {
  const primary = new Error("synthetic-private-primary");
  const f = fixture(t, { plans: [{ error: primary, apply: true }] });
  const { error } = await resultOf(f);
  assert(error instanceof AccountMutationIndeterminateError); assert.equal(error.cause, primary);
  assert.equal(f.state.effects, 1); assert.equal(f.state.callbacks, 1); assert.equal(f.state.commits, 1);
});

test("acknowledged commit success survives cleanup failure and restores the observer", async (t) => {
  const f = fixture(t);
  f.session.cleanupError = new Error("synthetic-private-cleanup");
  const { value, error } = await resultOf(f);
  assert.equal(error, undefined); assert.equal(value.tokenVersion, 1); assert.equal(f.row.role, "admin");
  assert.equal(f.state.effects, 1); assert.equal(f.state.callbacks, 1); assert.equal(f.state.ends, 1);
  assert.deepEqual(f.logs, [["Account mutation session cleanup failed"]]);
});

test("known aborted callback retry remains supported and applies one committed target change", async (t) => {
  const f = fixture(t);
  f.session.callbackError = fault({ labels: ["TransientTransactionError"] });
  const { value, error } = await resultOf(f);
  assert.equal(error, undefined); assert.equal(value.tokenVersion, 1);
  assert.equal(f.state.callbacks, 2); assert.equal(f.state.fences, 2); assert.equal(f.state.commits, 1); assert.equal(f.state.effects, 1);
});

test("unknown compound callback still rejects without any commit or target effect", async (t) => {
  const f = fixture(t);
  const primary = fault({ labels: ["TransientTransactionError", "UnknownTransactionCommitResult"] });
  f.session.callbackError = primary;
  const { error } = await resultOf(f);
  assert(error instanceof AccountMutationIndeterminateError); assert.equal(error.cause, primary);
  assert.equal(f.state.callbacks, 1); assert.equal(f.state.commits, 0); assert.equal(f.state.effects, 0); assert.equal(f.row.role, "user");
});

test("an inherited public commit method is observed and restored without leaving an own override", async (t) => {
  const f = fixture(t, { prototypeCommit: true });
  const { value, error } = await resultOf(f);
  assert.equal(error, undefined); assert.equal(value.tokenVersion, 1); assert.equal(f.state.effects, 1);
  assert.equal(Object.hasOwn(f.session, "commitTransaction"), false);
});

for (const unsupported of ["missing", "nonconfigurable"]) {
  test(`an ${unsupported} commit observer fails closed before actor or target writes`, async (t) => {
    let writes = 0, callbacks = 0, ends = 0;
    const session = { async withTransaction(work) { callbacks++; return work(); }, async endSession() { ends++; } };
    if (unsupported === "nonconfigurable") Object.defineProperty(session, "commitTransaction", { value: async () => {}, configurable: false });
    t.mock.method(User, "startSession", async () => session);
    t.mock.method(User, "updateOne", async () => { writes++; });
    await assert.rejects(runAdminAccountMutation({ id: new mongoose.Types.ObjectId().toHexString(), role: "admin", tokenVersion: 0 },
      new mongoose.Types.ObjectId().toHexString(), async () => { writes++; }));
    assert.equal(writes, 0); assert.equal(callbacks, 0); assert.equal(ends, 1);
    assert.equal(mongoose.connection.readyState, 0);
  });
}

async function resultOf(f) {
  try { return { value: await runAdminAccountMutation(f.actor, f.target, f.work) }; }
  catch (error) { return { error }; }
}

for (const nativeCommit of [false, true]) {
  test(`original R1 probe${nativeCommit ? 2 : 1}: compound code50 commit never replays the target`, async (t) => {
    const primary = fault({ code: 50, labels: nativeCommit ? ["TransientTransactionError"]
      : ["TransientTransactionError", "UnknownTransactionCommitResult"] });
    const f = fixture(t, { nativeCommit, plans: [{ error: primary, apply: true }] });
    const outcome = await resultOf(f);
    assert.equal(f.state.callbacks, 1, "original failing no-replay acceptance assertion");
    assert.equal(f.state.effects, 1); assert.equal(f.state.commits, 1); assert.equal(f.state.fences, 1);
    assert.equal(f.row.role, "admin"); assert.equal(f.row.tokenVersion, 1);
    assert(outcome.error instanceof AccountMutationIndeterminateError); assert.equal(outcome.error.cause, primary);
    assert.equal(outcome.value, undefined); assert.equal(f.state.ends, 1);
  });
}
