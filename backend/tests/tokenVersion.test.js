import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import { loginUser, updatePassword, updateUser, updateProfile } from "../controllers/UserController.js";
import { generateToken } from "../utils/generateToken.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { errorHandler } from "../middleware/errorMiddleware.js";
import { invoke, query, mockAdminActor } from "./helpers.js";

process.env.JWT_SECRET = "token-version-synthetic-regression-key";
const clone = (value) => JSON.parse(JSON.stringify(value));

// Collection adapter only: real Mongoose hydration, validation, save hooks,
// update generation and matchedCount handling execute without a database.
function matches(record, filter) {
  return Object.entries(filter).every(([field, expected]) => {
    if (field === "$and") return expected.every((part) => matches(record, part));
    if (field === "$or") return expected.some((part) => matches(record, part));
    if (expected && Object.hasOwn(expected, "$exists")) return Object.hasOwn(record, field) === expected.$exists;
    if (field === "_id") return String(record[field]) === String(expected);
    return record[field] === expected;
  });
}

async function fixture(t, { legacy = false } = {}) {
  const admin = mockAdminActor(t);
  const record = {
    _id: new mongoose.Types.ObjectId().toString(), identifier: "synthetic-account",
    password: await bcrypt.hash("synthetic-original-password", 10),
    role: "admin", confirmed: true, ...(legacy ? {} : { tokenVersion: 0 }),
  };
  const state = { record, writes: [], failNext: false, lookupError: null };
  const load = () => state.record ? User.hydrate(clone(state.record)) : null;
  t.mock.method(User, "findById", () => {
    if (state.lookupError) return { select() { return Promise.reject(state.lookupError); } };
    return query(load());
  });
  t.mock.method(User, "findOne", () => query(load()));
  t.mock.method(User.collection, "updateOne", async (filter, update) => {
    if (!(update.$inc?.__v === 1 && !update.$set?.tokenVersion)) state.writes.push({ filter: clone(filter), update: clone(update) });
    if (state.failNext) { state.failNext = false; throw new Error("synthetic write unavailable"); }
    if (!state.record || !matches(state.record, filter)) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    for (const [field, value] of Object.entries(update.$set || {})) state.record[field] = clone(value);
    for (const field of Object.keys(update.$unset || {})) delete state.record[field];
    for (const [field, value] of Object.entries(update.$inc || {})) state.record[field] = (state.record[field] || 0) + value;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  const token = await generateToken(load());
  async function access(bearer = token, admin = false) {
    const req = { headers: { authorization: `Bearer ${bearer}` } };
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
    let accepted = false;
    await protect(req, res, (error) => {
      if (error) errorHandler(error, req, res, () => {});
      else accepted = true;
    });
    if (accepted && admin) authorizeRoles("admin")(req, res, () => {});
    return { status: res.statusCode, accepted, body: res.body };
  }
  const sign = (claims, options = {}) => jwt.sign({ id: record._id, role: "admin", ...claims }, process.env.JWT_SECRET, { expiresIn: "7d", ...options });
  t.after(() => assert.equal(mongoose.connection.readyState, 0, "no database connection is permitted"));
  return { state, load, token, access, sign, admin };
}

async function freshLogin(f, password = "synthetic-original-password") {
  const result = await invoke(loginUser, { body: { identifier: f.state.record.identifier, password } });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.password, undefined);
  assert.equal(jwt.verify(result.body.token, process.env.JWT_SECRET).tokenVersion, f.state.record.tokenVersion ?? 0);
  return result.body.token;
}

test("new JWT includes current version, preserves seven-day expiry and authorizes current account", async (t) => {
  const f = await fixture(t);
  const claims = jwt.verify(f.token, process.env.JWT_SECRET);
  assert.equal(claims.tokenVersion, 0);
  assert.equal(claims.exp - claims.iat, 7 * 24 * 60 * 60);
  assert.equal((await f.access(f.token, true)).status, 200);
  assert.equal(f.state.writes.length, 0);
});

for (const reset of [false, true]) {
  test(`legacy account gains version in the same write as ${reset ? "administrator reset" : "password change"}`, async (t) => {
    const f = await fixture(t, { legacy: true });
    const newPassword = "synthetic-new-password";
    const result = reset
      ? await invoke(updateUser, { user: f.admin, params: { id: f.state.record._id }, body: { password: newPassword } })
      : await invoke(updatePassword, { user: { id: f.state.record._id }, body: { currentPassword: "synthetic-original-password", newPassword } });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.token, undefined);
    assert.equal(f.state.record.tokenVersion, 1);
    assert.equal(f.state.writes.length, 1);
    assert.equal(f.state.writes[0].update.$set.tokenVersion, 1);
    assert.equal(typeof f.state.writes[0].update.$set.password, "string");
    assert(await bcrypt.compare(newPassword, f.state.record.password));
    assert.equal(await bcrypt.compare("synthetic-original-password", f.state.record.password), false);
    assert.equal((await f.access()).status, 401);
    assert.equal((await f.access(await freshLogin(f, newPassword))).status, 200);
  });
}

for (const [field, changed, restored] of [["role", "cashier", "admin"], ["confirmed", false, true]]) {
  test(`monotonic version preserves revocation after ${field} changes and restoration`, async (t) => {
    const f = await fixture(t);
    assert.equal((await invoke(updateUser, { user: f.admin, params: { id: f.state.record._id }, body: { [field]: changed } })).statusCode, 200);
    assert.equal(f.state.record.tokenVersion, 1);
    assert.equal((await f.access()).status, 401);
    if (field === "role") {
      const current = await freshLogin(f);
      assert.equal((await f.access(current)).status, 200);
      assert.equal((await f.access(current, true)).status, 403);
    } else {
      assert.equal((await invoke(loginUser, { body: { identifier: f.state.record.identifier, password: "synthetic-original-password" } })).statusCode, 403);
      assert.equal((await f.access(await generateToken(f.load()))).status, 401);
    }
    assert.equal((await invoke(updateUser, { user: f.admin, params: { id: f.state.record._id }, body: { [field]: restored } })).statusCode, 200);
    assert.equal(f.state.record.tokenVersion, 2);
    assert.equal((await f.access()).status, 401);
    assert.equal((await f.access(await freshLogin(f), true)).status, 200);
    assert.equal(f.state.writes.length, 2);
  });
}

test("combined security changes advance once; unchanged security state and profile changes do not revoke", async (t) => {
  const f = await fixture(t);
  const id = f.state.record._id;
  assert.equal((await invoke(updateProfile, { user: { id }, body: { name: "Synthetic profile" } })).statusCode, 200);
  assert.equal((await invoke(updateUser, { user: f.admin, params: { id }, body: { role: "admin", confirmed: true, name: "Same state", tokenVersion: 999 } })).statusCode, 200);
  assert.equal(f.state.record.tokenVersion, 0);
  assert.equal((await f.access()).status, 200);
  assert.equal((await invoke(updateUser, { user: f.admin, params: { id }, body: { role: "cashier", confirmed: false, password: "synthetic-reset-password" } })).statusCode, 200);
  assert.equal(f.state.record.tokenVersion, 1);
  assert.equal(f.state.writes.at(-1).update.$set.tokenVersion, 1);
  assert.equal((await f.access()).status, 401);
});

test("legacy bcrypt accounts login as version zero without backfill; claim-less tokens require login", async (t) => {
  const f = await fixture(t, { legacy: true });
  const original = f.state.record.password;
  for (const prefix of ["$2a$", "$2b$", "$2y$"]) {
    f.state.record.password = prefix + original.slice(4);
    assert.equal((await f.access(await freshLogin(f), true)).status, 200);
    assert.equal(Object.hasOwn(f.state.record, "tokenVersion"), false);
  }
  assert.equal(f.state.writes.length, 0);
  assert.equal((await f.access(f.sign({}))).status, 401);
  f.state.record.tokenVersion = 1;
  assert.equal((await f.access(f.sign({}))).status, 401);
  assert.equal((await f.access(f.token)).status, 401);
});

test("malformed, missing, unsupported and stale version claims never fall back to zero", async (t) => {
  const f = await fixture(t);
  for (const value of [undefined, null, "0", -1, 0.5, {}, [], Number.MAX_SAFE_INTEGER + 1, 1]) {
    assert.equal((await f.access(f.sign({ tokenVersion: value }))).status, 401);
  }
  assert.equal((await f.access("not-a-jwt")).status, 401);
  assert.equal((await f.access(f.sign({ tokenVersion: 0 }, { expiresIn: -1 }))).status, 401);
  assert.equal((await f.access(f.sign({ tokenVersion: 0 }, { notBefore: "1h" }))).status, 401);
  assert.equal((await f.access(f.sign({ tokenVersion: 0 }, { algorithm: "HS384" }))).status, 401);
});

test("malformed stored versions fail closed on access and issuance without type coercion", async (t) => {
  const f = await fixture(t);
  t.mock.method(console, "error", () => {});
  for (const value of [null, "0", -1, 0.5, {}, [], Number.MAX_SAFE_INTEGER + 1]) {
    f.state.record.tokenVersion = value;
    const result = await f.access();
    assert.equal(result.accepted, false);
    assert.equal(result.status, 500);
    await assert.rejects(generateToken(f.load()), /Invalid account security version/);
  }
  assert.equal(f.state.writes.length, 0);
});

test("missing accounts and unavailable lookups fail closed without sensitive logging", async (t) => {
  const f = await fixture(t);
  const logs = [];
  for (const method of ["error", "log", "warn"]) t.mock.method(console, method, (...args) => logs.push(args));
  f.state.record = null;
  assert.equal((await f.access()).status, 401);
  f.state.lookupError = new Error(`synthetic driver failure ${f.token} ${process.env.JWT_SECRET}`);
  const failed = await f.access();
  assert.equal(failed.status, 500);
  assert.equal(failed.accepted, false);
  assert.equal(failed.body.message, "Internal server error");
  assert.deepEqual(logs, [["Request failed with status 500"]]);
  assert.equal(f.state.writes.length, 0);
});

test("invalid credentials and failed password validation never change persisted security state", async (t) => {
  const f = await fixture(t);
  assert.equal((await invoke(loginUser, { body: { identifier: f.state.record.identifier, password: "wrong-password" } })).statusCode, 401);
  assert.equal((await invoke(updatePassword, { user: { id: f.state.record._id }, body: { currentPassword: "wrong-password", newPassword: "synthetic-new-password" } })).statusCode, 401);
  assert.equal((await invoke(updateUser, { user: f.admin, params: { id: f.state.record._id }, body: { password: "x" } })).statusCode, 400);
  assert.equal(f.state.record.tokenVersion, 0);
  assert.equal(f.state.writes.length, 0);
  assert.equal((await f.access()).status, 200);
});

for (const legacy of [false, true]) {
  test(`conditional atomic save rejects a concurrent stale security writer (${legacy ? "missing" : "stored"} version)`, async (t) => {
    const f = await fixture(t, { legacy });
    const first = f.load(), second = f.load();
    first.role = "user";
    second.confirmed = false;
    const outcomes = await Promise.allSettled([first.save(), second.save()]);
    assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(outcomes.find((result) => result.status === "rejected").reason.name, "DocumentNotFoundError");
    assert.equal(f.state.record.tokenVersion, 1);
    assert.equal((f.state.record.role === "user") !== (f.state.record.confirmed === false), true);
    assert.equal((await f.access()).status, 401);
    const retry = f.load();
    if (retry.role === "admin") retry.role = "user";
    else retry.confirmed = false;
    await retry.save();
    assert.equal(f.state.record.tokenVersion, 2);
  });
}

test("failed password write preserves old state; retry hashes and advances once", async (t) => {
  const f = await fixture(t);
  const user = f.load();
  user.password = "synthetic-new-password";
  f.state.failNext = true;
  await assert.rejects(user.save(), /synthetic write unavailable/);
  assert.equal(f.state.record.tokenVersion, 0);
  assert(await bcrypt.compare("synthetic-original-password", f.state.record.password));
  assert.equal((await f.access()).status, 200);
  await user.save();
  assert.equal(f.state.record.tokenVersion, 1);
  assert(await bcrypt.compare("synthetic-new-password", f.state.record.password));
  assert.equal((await f.access()).status, 401);
  user.name = "After retry";
  await user.save();
  assert.equal(f.state.record.tokenVersion, 1);
  user.confirmed = false;
  await user.save();
  assert.equal(f.state.record.tokenVersion, 2);
});

test("overflow and direct version reassignment fail before a security write", async (t) => {
  const f = await fixture(t);
  f.state.record.tokenVersion = Number.MAX_SAFE_INTEGER;
  const exhausted = f.load();
  exhausted.role = "user";
  await assert.rejects(exhausted.save(), /version exhausted/);
  assert.equal(f.state.writes.length, 0);
  f.state.record.tokenVersion = 4;
  const reassigned = f.load();
  reassigned.tokenVersion = 0;
  await assert.rejects(reassigned.save(), /server controlled/);
  assert.equal(f.state.record.tokenVersion, 4);
  assert.equal(f.state.writes.length, 0);
});

test("an unrelated legacy profile save cannot backfill zero over a newer security version", async (t) => {
  const f = await fixture(t, { legacy: true });
  const profile = f.load();
  profile.name = "Stale profile snapshot";
  assert.equal(Object.hasOwn(profile.getChanges().$set || {}, "tokenVersion"), false);
  const security = f.load();
  security.role = "user";
  await security.save();
  await profile.save();
  assert.equal(f.state.record.tokenVersion, 1);
  assert.equal(f.state.record.role, "user");
  assert.equal((await f.access()).status, 401);
});

test("new account inserts initialize version zero without accepting malformed stored formats", async (t) => {
  let stored;
  t.mock.method(User.collection, "insertOne", async (doc) => {
    stored = doc;
    return { acknowledged: true, insertedId: doc._id };
  });
  const user = new User({ identifier: "synthetic-new", password: "synthetic-password", confirmed: true });
  await user.save();
  assert.equal(stored.tokenVersion, 0);
  assert(await bcrypt.compare("synthetic-password", stored.password));
  const bad = new User({ identifier: "synthetic-bad", password: "synthetic-password", tokenVersion: "0" });
  await assert.rejects(bad.validate(), /Invalid account security version/);
  assert.equal(mongoose.connection.readyState, 0);
});

test("successful, stale and malformed token checks emit no token or account diagnostics", async (t) => {
  const f = await fixture(t);
  const logs = [];
  for (const method of ["log", "error", "warn", "debug", "info"]) t.mock.method(console, method, (...args) => logs.push(args));
  assert.equal((await f.access()).status, 200);
  const user = f.load();
  user.role = "user";
  await user.save();
  assert.equal((await f.access()).status, 401);
  assert.equal((await f.access(f.sign({ tokenVersion: "0" }))).status, 401);
  assert.equal((await f.access("invalid-synthetic-token")).status, 401);
  assert.equal((await f.access(await freshLogin(f))).status, 200);
  assert.deepEqual(logs, []);
});
