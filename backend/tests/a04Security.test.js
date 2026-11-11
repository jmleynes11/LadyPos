import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";
import { createApp } from "../app.js";
import { generateToken } from "../utils/generateToken.js";
import { protect } from "../middleware/authMiddleware.js";
import { ACCESS_TOKEN_LIFETIME_SECONDS } from "../utils/tokenPolicy.js";
import { query, serve, matchesAccountFilter } from "./helpers.js";

process.env.JWT_SECRET = "a04-synthetic-test-signing-key";
const clone = (value) => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
// Like a real ClientSession, keep identity across Mongoose option cloning.
class TestSession {}

function noDatabase(t) {
  const connect = t.mock.method(mongoose, "connect", async () => { throw new Error("No database connections allowed"); });
  const create = t.mock.method(mongoose, "createConnection", () => { throw new Error("No database connections allowed"); });
  t.after(() => {
    assert.equal(mongoose.connection.readyState, 0);
    assert.equal(connect.mock.callCount(), 0);
    assert.equal(create.mock.callCount(), 0);
  });
}

function signRaw(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const input = `${header}.${body}`;
  return `${input}.${createHmac("sha256", process.env.JWT_SECRET).update(input).digest("base64url")}`;
}

async function tokenStatus(token) {
  let accepted = false;
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json() { return this; } };
  await protect({ headers: { authorization: `Bearer ${token}` } }, res, (error) => {
    if (error) throw error;
    accepted = true;
  });
  return { status: res.statusCode, accepted };
}

test("seven-day temporal contract rejects missing, malformed, future, expired and excessive claims before lookup", async (t) => {
  noDatabase(t);
  const now = 1800000000;
  t.mock.method(Date, "now", () => now * 1000);
  const account = { _id: new mongoose.Types.ObjectId(), role: "admin", confirmed: true, tokenVersion: 0 };
  const lookup = t.mock.method(User, "findById", () => query(account));
  const base = { id: String(account._id), tokenVersion: 0, iat: now, exp: now + ACCESS_TOKEN_LIFETIME_SECONDS };
  const invalid = [
    { ...base, exp: undefined }, { ...base, iat: undefined },
    { ...base, exp: now }, { ...base, iat: now - 10, exp: now - 1 },
    { ...base, exp: now + ACCESS_TOKEN_LIFETIME_SECONDS + 1 },
    { ...base, iat: now - 1, exp: now + ACCESS_TOKEN_LIFETIME_SECONDS },
    { ...base, iat: now + 1 }, { ...base, exp: now - 1 },
    { ...base, iat: "1800000000" }, { ...base, exp: "1800000100" },
    { ...base, iat: null }, { ...base, exp: null },
    { ...base, iat: now - 0.5 }, { ...base, exp: now + 0.5 },
    { ...base, iat: -1 }, { ...base, exp: Number.MAX_SAFE_INTEGER + 1 },
  ];
  for (const claims of invalid) assert.equal((await tokenStatus(signRaw(claims))).status, 401);
  assert.equal(lookup.mock.callCount(), 0);
  assert.equal((await tokenStatus(signRaw(base))).status, 200);
  assert.equal((await tokenStatus(signRaw({ ...base, iat: now - ACCESS_TOKEN_LIFETIME_SECONDS + 1, exp: now + 1 }))).status, 200);
  assert.equal((await tokenStatus(signRaw({ ...base, tokenVersion: 1 }))).status, 401);
  assert.equal((await tokenStatus(await generateToken(account))).status, 200);
  // Sign-in compatibility for an absent stored version, not a missing JWT claim.
  delete account.tokenVersion;
  assert.equal((await tokenStatus(await generateToken(account))).status, 200);
  assert.equal((await tokenStatus(signRaw({ ...base, tokenVersion: undefined }))).status, 401);
  t.mock.method(Date, "now", () => (now + ACCESS_TOKEN_LIFETIME_SECONDS) * 1000);
  assert.equal((await tokenStatus(signRaw(base))).status, 401);
});

// Controlled persistence adapter: executes real Mongoose queries/save hooks and
// stages writes/locks locally. It models interleavings, NOT MongoDB guarantees.
async function fixture(t, { legacyActor = false } = {}) {
  noDatabase(t);
  const password = await bcrypt.hash("synthetic-original-password", 10);
  const actorId = new mongoose.Types.ObjectId().toString();
  const targetId = new mongoose.Types.ObjectId().toString();
  const store = new Map([
    [actorId, { _id: actorId, identifier: "synthetic-admin", password, role: "admin", confirmed: true, __v: 0, ...(legacyActor ? {} : { tokenVersion: 0 }) }],
    [targetId, { _id: targetId, identifier: "synthetic-target", password, role: "user", confirmed: true, tokenVersion: 0, __v: 0 }],
  ]);
  const hooks = {};
  const locks = new Map();
  const state = { events: [], sessions: [], failCommit: false, retryOnce: false };
  const view = (id, session) => session?.staged.has(String(id)) ? session.staged.get(String(id)) : store.get(String(id));
  const load = (id, session) => { const row = view(id, session); return row ? User.hydrate(clone(row)) : null; };
  const waitForLock = async (id, session) => {
    while (locks.has(id) && locks.get(id) !== session) await locks.get(id).released.promise;
  };
  const releaseLocks = (session) => {
    for (const [id, owner] of locks) if (owner === session) locks.delete(id);
    session.released.resolve();
  };
  t.mock.method(User, "startSession", async () => {
    const session = Object.assign(new TestSession(), {
      active: false, staged: new Map(), released: deferred(), ended: false,
      inTransaction() { return this.active; },
      async commitTransaction() {},
      async withTransaction(work, options) {
        assert.deepEqual(options, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
        for (let attempt = 0; attempt < 2; attempt++) {
          this.active = true; this.staged = new Map(); this.released = deferred();
          try {
            const result = await work();
            if (state.retryOnce && attempt === 0) {
              state.events.push("abort-retry");
              releaseLocks(this); this.active = false;
              if (hooks.afterAbort) await hooks.afterAbort();
              continue;
            }
            if (hooks.beforeCommit) await hooks.beforeCommit();
            if (state.failCommit) throw new Error("synthetic transaction failure");
            await this.commitTransaction();
            for (const [id, row] of this.staged) { if (row) store.set(id, clone(row)); else store.delete(id); }
            state.events.push("commit");
            return result;
          } finally { this.active = false; releaseLocks(this); }
        }
        throw new Error("Unexpected test retry exhaustion");
      },
      async endSession() { this.ended = true; },
    });
    state.sessions.push(session);
    return session;
  });
  t.mock.method(User, "findById", (id, projection, options) => query(load(id, options?.session)));
  t.mock.method(User, "findOne", (filter, projection, options) => {
    const rows = new Map(store);
    for (const [id, row] of options?.session?.staged || []) rows.set(id, row);
    const row = [...rows.values()].find((row) => row && matchesAccountFilter(row, filter));
    return query(row ? User.hydrate(clone(row)) : null);
  });
  t.mock.method(User.collection, "updateOne", async (filter, update, options) => {
    const id = String(filter._id);
    const session = options?.session;
    const fence = update.$inc?.__v === 1 && !update.$set?.tokenVersion;
    if (fence && hooks.beforeFence) await hooks.beforeFence();
    if (!fence && hooks.beforeWrite) await hooks.beforeWrite({ id, session });
    await waitForLock(id, session);
    const row = view(id, session);
    if (!row || !matchesAccountFilter(row, filter)) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    if (session) { assert(state.sessions.includes(session)); assert(session.active); locks.set(id, session); }
    if (fence) {
      assert.equal(update.$set?.updatedAt, undefined);
      assert(session);
      state.events.push("actor-fenced");
    }
    const next = clone(row);
    Object.assign(next, clone(update.$set || {}));
    for (const [field, amount] of Object.entries(update.$inc || {})) next[field] = (next[field] || 0) + amount;
    for (const field of Object.keys(update.$unset || {})) delete next[field];
    if (session) session.staged.set(id, next); else { store.set(id, next); state.events.push("direct-write"); }
    if (fence && hooks.afterFence) await hooks.afterFence();
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  t.mock.method(User.collection, "insertOne", async (row, options) => {
    assert(options.session?.active);
    options.session.staged.set(String(row._id), clone(row));
    return { acknowledged: true, insertedId: row._id };
  });
  t.mock.method(User.collection, "deleteOne", async (filter, options) => {
    assert(options.session?.active);
    const id = String(filter._id);
    await waitForLock(id, options.session);
    const row = view(id, options.session);
    if (!row || !matchesAccountFilter(row, filter)) return { acknowledged: true, deletedCount: 0 };
    locks.set(id, options.session); options.session.staged.set(id, null);
    return { acknowledged: true, deletedCount: 1 };
  });
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
  const request = await serve(t, createApp());
  const token = await generateToken(load(actorId));
  return { actorId, targetId, store, load, hooks, state, token, request };
}

for (const legacyActor of [false, true]) {
  test(`self-admin update loses authorization if demotion commits before the audited actor fence (${legacyActor ? "missing" : "stored"} version)`, { timeout: 10000 }, async (t) => {
    const reached = deferred(), resume = deferred();
    t.after(() => resume.resolve());
    const f = await fixture(t, { legacyActor });
    f.hooks.beforeFence = async () => { delete f.hooks.beforeFence; reached.resolve(); await resume.promise; };
    const pending = f.request(`/api/users/${f.actorId}`, { method: "PUT", token: f.token, body: { role: "admin", password: "synthetic-reset-password" } });
    await reached.promise;
    const demoted = f.load(f.actorId); demoted.role = "user"; await demoted.save();
    resume.resolve();
    assert.equal((await pending).status, 401);
    const stored = f.store.get(f.actorId);
    assert.equal(stored.role, "user"); assert.equal(stored.tokenVersion, 1);
    assert(await bcrypt.compare("synthetic-original-password", stored.password));
    assert.equal(f.state.sessions.length, 1, "audited self-target requires a transaction and a conditional target write");
  });
}

for (const action of ["update", "create", "delete"]) {
  test(`admitted cross-account ${action} is rejected if administrator is demoted before actor fence`, { timeout: 10000 }, async (t) => {
    const reached = deferred(), resume = deferred(); t.after(() => resume.resolve());
    const f = await fixture(t);
    f.hooks.beforeFence = async () => { reached.resolve(); await resume.promise; };
    const options = action === "create"
      ? { method: "POST", body: { identifier: "synthetic-new-admin", password: "synthetic-password", role: "admin", confirmed: false } }
      : { method: action === "delete" ? "DELETE" : "PUT", body: { role: "admin" } };
    const pending = f.request(action === "create" ? "/api/users/register" : `/api/users/${f.targetId}`, { ...options, token: f.token });
    await reached.promise;
    const demoted = f.load(f.actorId); demoted.role = "user"; await demoted.save();
    resume.resolve();
    assert.equal((await pending).status, 401);
    assert.equal(f.store.size, 2); assert.equal(f.store.get(f.targetId).role, "user");
    assert.equal(f.store.get(f.actorId).__v, 0);
    assert(f.state.sessions.every((session) => session.ended));
  });
}

test("actor fence orders a concurrent demotion after the admitted account mutation commits", { timeout: 10000 }, async (t) => {
  const fenced = deferred(), resume = deferred(); t.after(() => resume.resolve());
  const f = await fixture(t);
  f.hooks.afterFence = async () => { fenced.resolve(); await resume.promise; };
  const pending = f.request(`/api/users/${f.targetId}`, { method: "PUT", token: f.token, body: { role: "admin" } });
  await fenced.promise;
  const demoted = f.load(f.actorId); demoted.role = "user";
  let demotionFinished = false;
  const demotion = demoted.save().then(() => { demotionFinished = true; });
  assert.equal(demotionFinished, false); assert.equal(f.store.get(f.targetId).role, "user");
  resume.resolve();
  assert.equal((await pending).status, 200); await demotion;
  assert.equal(f.store.get(f.targetId).role, "admin"); assert.equal(f.store.get(f.targetId).tokenVersion, 1);
  assert.equal(f.store.get(f.actorId).role, "user"); assert.equal(f.store.get(f.actorId).tokenVersion, 1);
  assert.equal(f.store.get(f.actorId).__v, 1);
  assert(f.state.events.indexOf("commit") < f.state.events.indexOf("direct-write"));
});

test("transaction failure rolls back actor revision and target; no success response precedes commit", { timeout: 10000 }, async (t) => {
  const reached = deferred(), resume = deferred(); t.after(() => resume.resolve());
  const f = await fixture(t);
  f.hooks.beforeCommit = async () => { reached.resolve(); await resume.promise; };
  f.state.failCommit = true;
  let responded = false;
  const pending = f.request(`/api/users/${f.targetId}`, { method: "PUT", token: f.token, body: { role: "admin" } }).then((result) => { responded = true; return result; });
  await reached.promise;
  assert.equal(responded, false); assert.equal(f.store.get(f.targetId).role, "user");
  resume.resolve();
  assert.equal((await pending).status, 500);
  assert.equal(f.store.get(f.actorId).__v, 0); assert.equal(f.store.get(f.targetId).tokenVersion, 0);
  assert(f.state.sessions.every((session) => session.ended));
});

test("transaction callback retry rechecks the actor and cannot reuse authorization after demotion", async (t) => {
  const f = await fixture(t);
  f.state.retryOnce = true;
  f.hooks.afterAbort = async () => { const user = f.load(f.actorId); user.role = "user"; await user.save(); };
  const result = await f.request(`/api/users/${f.targetId}`, { method: "PUT", token: f.token, body: { role: "admin" } });
  assert.equal(result.status, 401);
  assert.equal(f.store.get(f.targetId).role, "user"); assert.equal(f.store.get(f.targetId).tokenVersion, 0);
  assert.equal(f.store.get(f.actorId).__v, 0); assert.equal(f.store.get(f.actorId).tokenVersion, 1);
});

test("authorized admin provisioning, update and deletion retain normal behavior without revoking the actor", async (t) => {
  const f = await fixture(t, { legacyActor: true });
  const create = await f.request("/api/users/register", { method: "POST", token: f.token, body: { identifier: "synthetic-created", password: "synthetic-password", role: "admin", confirmed: false } });
  assert.equal(create.status, 201); assert.equal(create.body.password, undefined); assert.equal(create.body.token, undefined);
  const created = f.store.get(create.body._id); assert.equal(created.tokenVersion, 0); assert(await bcrypt.compare("synthetic-password", created.password));
  assert.equal((await f.request(`/api/users/${f.targetId}`, { method: "PUT", token: f.token, body: { role: "admin" } })).status, 200);
  assert.equal((await f.request(`/api/users/${f.targetId}`, { method: "DELETE", token: f.token })).status, 200);
  assert.equal(f.store.has(f.targetId), false); assert.equal(f.store.get(f.actorId).__v, 3);
  assert.equal(Object.hasOwn(f.store.get(f.actorId), "tokenVersion"), false);
  assert.equal((await f.request("/api/users/profile", { token: f.token })).status, 200);
});

test("unsupported transactions fail closed without nontransactional fallback", async (t) => {
  const f = await fixture(t);
  t.mock.method(User, "startSession", async () => ({
    async commitTransaction() {},
    withTransaction: async () => { throw new Error("synthetic unsupported transactions"); },
    endSession: async () => {},
  }));
  const result = await f.request(`/api/users/${f.targetId}`, { method: "PUT", token: f.token, body: { role: "admin" } });
  assert.equal(result.status, 500); assert.equal(result.body.message, "Internal server error");
  assert.equal(f.store.get(f.targetId).role, "user"); assert.equal(f.store.get(f.actorId).__v, 0);
});

for (const change of ["password reset", "role restoration", "confirmation restoration"]) {
  test(`admitted actor stays stale after ${change} even when currently confirmed admin`, { timeout: 10000 }, async (t) => {
    const reached = deferred(), resume = deferred(); t.after(() => resume.resolve());
    const f = await fixture(t);
    f.hooks.beforeFence = async () => { reached.resolve(); await resume.promise; };
    const pending = f.request(`/api/users/${f.targetId}`, { method: "PUT", token: f.token, body: { role: "admin" } });
    await reached.promise;
    const actor = f.load(f.actorId);
    if (change === "password reset") {
      actor.password = "synthetic-reset-password";
      await actor.save();
    } else {
      const field = change === "role restoration" ? "role" : "confirmed";
      actor[field] = field === "role" ? "user" : false;
      await actor.save();
      actor[field] = field === "role" ? "admin" : true;
      await actor.save();
    }
    assert.equal(f.store.get(f.actorId).role, "admin");
    assert.equal(f.store.get(f.actorId).confirmed, true);
    resume.resolve();
    assert.equal((await pending).status, 401);
    assert.equal(f.store.get(f.targetId).role, "user");
    assert.equal(f.store.get(f.actorId).__v, 0);
  });
}

test("successful transaction retry commits the target security update and actor revision exactly once", async (t) => {
  const f = await fixture(t);
  f.state.retryOnce = true;
  const result = await f.request(`/api/users/${f.targetId}`, { method: "PUT", token: f.token, body: { password: "synthetic-reset-password" } });
  assert.equal(result.status, 200);
  assert.equal(f.store.get(f.actorId).__v, 1);
  assert.equal(f.store.get(f.actorId).tokenVersion, 0);
  assert.equal(f.store.get(f.targetId).tokenVersion, 1);
  assert(await bcrypt.compare("synthetic-reset-password", f.store.get(f.targetId).password));
  assert.equal(f.state.events.filter((event) => event === "commit").length, 1);
});
