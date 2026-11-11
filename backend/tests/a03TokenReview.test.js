import test from "node:test";
import { BOOKSTORE_ROUTE_MANIFEST } from "../auth/bookstoreRouteManifest.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import { createApp } from "../app.js";
import { protect } from "../middleware/authMiddleware.js";
import { generateToken } from "../utils/generateToken.js";
import { loginUser } from "../controllers/UserController.js";
import { query, serve, invoke, matchesAccountFilter } from "./helpers.js";

process.env.JWT_SECRET = "a03-synthetic-local-signing-key";
const clone = (value) => JSON.parse(JSON.stringify(value));
const routes = await Promise.all([
  ["users", "User"], ["products", "Product"], ["people", "Person"],
  ["customers", "Customer"], ["orders", "Order"], ["transactions", "Transaction"],
  ["financials", "Financial"], ["dashboard", "Dashboard"], ["invoices", "Invoice"],
  ["debt-payments", "DebtPayment"], ["expenses", "Expense"],
].map(async ([prefix, file]) => ({ prefix: `/api/${prefix}`, router: (await import(`../routes/${file}Route.js`)).default })));

function noDatabase(t) {
  t.mock.method(mongoose, "connect", async () => { throw new Error("Database connections forbidden in A03 tests"); });
  t.mock.method(mongoose, "createConnection", () => { throw new Error("Database connections forbidden in A03 tests"); });
  t.after(() => assert.equal(mongoose.connection.readyState, 0));
}

function signedRaw(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const input = `${header}.${body}`;
  return `${input}.${createHmac("sha256", process.env.JWT_SECRET).update(input).digest("base64url")}`;
}

async function access(token) {
  let accepted = false;
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
  await protect({ headers: { authorization: `Bearer ${token}` } }, res, (error) => {
    if (error) throw error;
    accepted = true;
  });
  return { status: res.statusCode, accepted };
}

test("wrong signatures, unsigned JWTs and malformed claims reject before account lookup", async (t) => {
  noDatabase(t);
  const lookup = t.mock.method(User, "findById", () => { throw new Error("Invalid JWT must not query accounts"); });
  const now = Math.floor(Date.now() / 1000);
  const claims = { id: new mongoose.Types.ObjectId().toString(), tokenVersion: 0, iat: now, exp: now + 60 };
  const invalid = [
    jwt.sign(claims, "a03-different-synthetic-key"),
    jwt.sign(claims, null, { algorithm: "none" }),
    signedRaw({ ...claims, exp: "invalid" }), signedRaw({ ...claims, exp: null }),
    signedRaw({ ...claims, nbf: "invalid" }), signedRaw({ ...claims, id: {} }),
    signedRaw({ ...claims, tokenVersion: true }), signedRaw(null), signedRaw([]),
  ];
  for (const token of invalid) assert.equal((await access(token)).status, 401);
  assert.equal(lookup.mock.callCount(), 0);
});

test("verifier rejects correctly signed current-version JWTs without expiry or beyond issuer lifetime", async (t) => {
  noDatabase(t);
  const account = { _id: new mongoose.Types.ObjectId(), role: "user", confirmed: true, tokenVersion: 0 };
  t.mock.method(User, "findById", () => query(account));
  const now = Math.floor(Date.now() / 1000);
  for (const claims of [
    { id: account._id, tokenVersion: 0 },
    { id: account._id, tokenVersion: 0, iat: now - 30 * 86400, exp: now + 30 * 86400 },
  ]) {
    assert.equal((await access(signedRaw(claims))).status, 401);
  }
  assert.equal((await access(signedRaw({ id: account._id, tokenVersion: 0, exp: now - 1 }))).status, 401);
});

test("every mounted business route rejects anonymous, stale and claim-less requests before handlers", async (t) => {
  noDatabase(t);
  const app = createApp();
  const mounted = app.router.stack.filter((layer) => layer.handle?.stack).map((layer) => layer.handle);
  const bookstoreRouter = mounted.find(router => router.stack.some(layer => layer.route?.path === "/guest/intents"));
  assert(bookstoreRouter, "Bookstore API mount required");
  const activeRoutes = [...routes, { prefix: "/api/bookstore", router: bookstoreRouter }];
  assert.equal(mounted.length, activeRoutes.length);
  for (const { router } of activeRoutes) assert(mounted.includes(router), "unreviewed or missing router mount");
  const endpoints = [];
  let publicLogin = 0;
  for (const { prefix, router } of activeRoutes) {
    let globalGuard = false;
    for (const layer of router.stack) {
      if (layer.handle === protect) globalGuard = true;
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) {
        if (prefix === "/api/users" && layer.route.path === "/login" && method === "post") { publicLogin++; continue; }
        if (BOOKSTORE_ROUTE_MANIFEST.some(row => !row.protected && row.path === prefix + layer.route.path && row.method === method.toUpperCase())) continue;
        const handlers = layer.route.stack.filter((part) => !part.method || part.method === method);
        assert(globalGuard || handlers[0]?.handle === protect, `missing early protect: ${method} ${prefix}${layer.route.path}`);
        endpoints.push({ method: method.toUpperCase(), url: `${prefix}${layer.route.path}`.replace(/:[A-Za-z0-9_]+/g, "000000000000000000000001") });
      }
    }
  }
  assert.equal(publicLogin, 1);
  const account = { _id: new mongoose.Types.ObjectId(), role: "admin", confirmed: true, tokenVersion: 1 };
  t.mock.method(User, "findById", () => query(account));
  t.mock.method(console, "log", () => {});
  const request = await serve(t, app);
  const stale = await generateToken({ ...account, tokenVersion: 0 });
  const legacy = jwt.sign({ id: account._id, role: account.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
  for (const endpoint of endpoints) {
    for (const token of [undefined, stale, legacy]) {
      const result = await request(endpoint.url, { method: endpoint.method, token });
      assert.equal(result.status, 401, `guard bypass: ${endpoint.method} ${endpoint.url}`);
    }
  }
  assert.equal((await request("/api/users/profile", { method: "HEAD", token: stale })).status, 401);
  t.diagnostic(`${activeRoutes.length} mounted routers; ${endpoints.length} protected method/path pairs; ${endpoints.length * 3 + 1} HTTP denials`);
});

test("actual profile route fails closed on missing accounts and unavailable database; valid account remains authorized", async (t) => {
  noDatabase(t);
  let account = { _id: new mongoose.Types.ObjectId(), role: "user", confirmed: true, tokenVersion: 0 };
  let unavailable = false;
  t.mock.method(User, "findById", () => {
    if (unavailable) throw new Error("synthetic database unavailable");
    return query(account);
  });
  t.mock.method(console, "log", () => {});
  const errors = [];
  t.mock.method(console, "error", (...args) => errors.push(args));
  const request = await serve(t, createApp());
  const token = await generateToken(account);
  assert.equal((await request("/api/users/profile", { token })).status, 200);
  account = null;
  assert.equal((await request("/api/users/profile", { token })).status, 401);
  unavailable = true;
  const result = await request("/api/users/profile", { token });
  assert.equal(result.status, 500);
  assert.equal(result.body.message, "Internal server error");
  assert.deepEqual(errors, [["Request failed with status 500"]]);
});

async function securityFixture(t, legacy = false) {
  noDatabase(t);
  const record = {
    _id: new mongoose.Types.ObjectId().toString(), identifier: "a03-synthetic",
    password: await bcrypt.hash("synthetic-original-password", 10),
    role: "admin", confirmed: true, ...(legacy ? {} : { tokenVersion: 0 }),
  };
  const load = () => User.hydrate(clone(record));
  const state = { loseNextAcknowledgement: false, committed: 0 };
  t.mock.method(User, "findById", () => query(load()));
  t.mock.method(User, "findOne", () => query(load()));
  t.mock.method(User.collection, "updateOne", async (filter, update) => {
    if (update.$inc?.__v === 1 && !update.$set?.tokenVersion) {
      if (!matchesAccountFilter(record, filter)) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
      record.__v = (record.__v || 0) + 1;
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
    }
    const guard = filter.$and?.at(-1);
    assert(guard, "security writes must contain a conditional epoch guard");
    const match = matchesAccountFilter(record, filter);
    if (!match) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    assert(Number.isSafeInteger(update.$set.tokenVersion));
    Object.assign(record, clone(update.$set));
    state.committed++;
    if (state.loseNextAcknowledgement) {
      state.loseNextAcknowledgement = false;
      throw new Error("synthetic lost acknowledgement after commit");
    }
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  return { record, load, state };
}

for (const legacy of [false, true]) {
  test(`concurrent password resets have one atomic winner and stale retry cannot overwrite it (${legacy ? "missing" : "stored"} version)`, async (t) => {
    const f = await securityFixture(t, legacy);
    const oldToken = await generateToken(f.load());
    const documents = [f.load(), f.load()];
    const replacements = ["synthetic-reset-first", "synthetic-reset-second"];
    documents.forEach((doc, i) => { doc.password = replacements[i]; });
    const results = await Promise.allSettled(documents.map((doc) => doc.save()));
    const winner = results.findIndex((result) => result.status === "fulfilled");
    const loser = results.findIndex((result) => result.status === "rejected");
    assert(winner >= 0 && loser >= 0);
    assert.equal(results[loser].reason.name, "DocumentNotFoundError");
    assert.equal(f.record.tokenVersion, 1);
    assert.equal(f.state.committed, 1);
    assert(await bcrypt.compare(replacements[winner], f.record.password));
    assert.equal(await bcrypt.compare(replacements[loser], f.record.password), false);
    await assert.rejects(documents[loser].save(), { name: "DocumentNotFoundError" });
    assert.equal(f.record.tokenVersion, 1);
    assert.equal(f.state.committed, 1);
    assert.equal((await access(oldToken)).status, 401);
    assert.equal((await access(await generateToken(f.load()))).status, 200);
  });
}

test("lost write acknowledgement cannot repeat a committed password reset or revive its old token", async (t) => {
  const f = await securityFixture(t);
  const oldToken = await generateToken(f.load());
  const user = f.load();
  user.password = "synthetic-reset-password";
  f.state.loseNextAcknowledgement = true;
  await assert.rejects(user.save(), /synthetic lost acknowledgement/);
  assert.equal(f.record.tokenVersion, 1);
  assert.equal(f.state.committed, 1);
  assert(await bcrypt.compare("synthetic-reset-password", f.record.password));
  assert.equal((await access(oldToken)).status, 401);
  await assert.rejects(user.save(), { name: "DocumentNotFoundError" });
  assert.equal(f.state.committed, 1);
  assert.equal((await access(await generateToken(f.load()))).status, 200);
});

test("login racing a role change can issue only a stale denied token; fresh login uses current version and role", async (t) => {
  const f = await securityFixture(t);
  const originalMatch = User.prototype.matchPassword;
  let checked, release;
  const passwordChecked = new Promise((resolve) => { checked = resolve; });
  const resume = new Promise((resolve) => { release = resolve; });
  t.after(() => release());
  t.mock.method(User.prototype, "matchPassword", async function delayedMatch(password) {
    const result = await originalMatch.call(this, password);
    checked();
    await resume;
    return result;
  });
  const pending = invoke(loginUser, { body: { identifier: f.record.identifier, password: "synthetic-original-password" } });
  await passwordChecked;
  const updated = f.load();
  updated.role = "user";
  await updated.save();
  release();
  const raced = await pending;
  assert.equal(raced.statusCode, 200);
  assert.equal((await access(raced.body.token)).status, 401);
  const fresh = await invoke(loginUser, { body: { identifier: f.record.identifier, password: "synthetic-original-password" } });
  assert.equal(fresh.statusCode, 200);
  assert.equal(fresh.body.role, "user");
  assert.equal(jwt.verify(fresh.body.token, process.env.JWT_SECRET).tokenVersion, 1);
  assert.equal((await access(fresh.body.token)).status, 200);
});

test("an already-authorized self-admin update cannot restore a role after concurrent demotion", { timeout: 10000 }, async (t) => {
  const f = await securityFixture(t);
  let reached, release;
  const controllerReached = new Promise((resolve) => { reached = resolve; });
  const resume = new Promise((resolve) => { release = resolve; });
  t.after(() => release());
  let reads = 0;
  t.mock.method(User, "findById", () => {
    if (++reads === 2) { reached(); return resume.then(() => f.load()); }
    return query(f.load());
  });
  t.mock.method(console, "log", () => {});
  const request = await serve(t, createApp());
  const token = await generateToken(f.load());
  const pending = request(`/api/users/${f.record._id}`, { method: "PUT", token, body: { role: "admin" } });
  await controllerReached; // protect and authorizeRoles have already allowed this request.
  const demoted = f.load();
  demoted.role = "user";
  await demoted.save();
  assert.equal(f.record.tokenVersion, 1);
  release();
  const result = await pending;
  assert.equal(result.status, 401);
  assert.equal(f.record.role, "user");
  assert.equal(f.record.tokenVersion, 1);
  assert.equal((await access(token)).status, 401, "the old token itself remains revoked");
});
