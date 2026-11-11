import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import User from "../models/User.js";
import userRoutes from "../routes/UserRoute.js";
import { generateToken } from "../utils/generateToken.js";
import { loginUser, updatePassword, updateUser } from "../controllers/UserController.js";
import { errorHandler } from "../middleware/errorMiddleware.js";
import { respondError } from "../utils/responseHelpers.js";
import { seedAdmin } from "../utils/seedAdmin.js";
import mongoose from "mongoose";
import Expense from "../models/Expense.js";
import { connectDB } from "../config/config.js";
import { http, serve, id, query, invoke, mockAdminActor } from "./helpers.js";

process.env.JWT_SECRET = "phase10a-synthetic-test-signing-secret";

function account(t, role = "admin", confirmed = true) {
  const user = { _id: id(), role, confirmed };
  mockAdminActor(t, user);
  t.mock.method(User, "findById", () => query(user));
  return user;
}

test("registration rejects unauthenticated administrator injection before any write", async (t) => {
  const create = t.mock.method(User, "create", async () => { throw new Error("must not write"); });
  t.mock.method(User, "findOne", async () => null);
  const request = await http(t, userRoutes);
  const result = await request("/api/users/register", { method: "POST", body: {
    identifier: "attacker", password: "synthetic-password", role: "admin", confirmed: true,
  } });
  assert.equal(result.status, 401);
  assert.equal(create.mock.callCount(), 0);
});

test("ordinary authenticated user cannot provision privileged accounts", async (t) => {
  const user = account(t, "user");
  t.mock.method(User, "findOne", async () => null);
  const create = t.mock.method(User, "create", async () => { throw new Error("must not write"); });
  const request = await http(t, userRoutes);
  const result = await request("/api/users/register", { method: "POST", token: await generateToken(user), body: {
    identifier: "another", password: "synthetic-password", role: "admin", confirmed: true,
  } });
  assert.equal(result.status, 403);
  assert.equal(create.mock.callCount(), 0);
});

test("administrator provisioning stores a bcrypt hash and returns no password or impersonation token", async (t) => {
  const admin = account(t);
  t.mock.method(User, "findOne", async () => null);
  let stored;
  t.mock.method(User.collection, "insertOne", async (doc) => { stored = { ...doc }; return { acknowledged: true, insertedId: doc._id }; });
  const request = await http(t, userRoutes);
  const result = await request("/api/users/register", { method: "POST", token: await generateToken(admin), body: {
    identifier: "NewAdmin", password: "synthetic-password", role: "admin", confirmed: false,
  } });
  assert.equal(result.status, 201);
  assert.equal(stored.identifier, "newadmin");
  assert.equal(stored.role, "admin");
  assert.equal(stored.confirmed, false);
  assert.notEqual(stored.password, "synthetic-password");
  assert(await bcrypt.compare("synthetic-password", stored.password));
  assert.equal(result.body.password, undefined);
  assert.equal(result.body.token, undefined);
});

test("current persisted account controls access even when signed token claims admin", async (t) => {
  const user = account(t, "user");
  t.mock.method(User, "find", () => query([]));
  t.mock.method(User, "countDocuments", async () => 0);
  const request = await http(t, userRoutes);
  const token = await generateToken({ ...user, role: "admin" });
  const result = await request("/api/users", { token });
  assert.equal(result.status, 403);
});

test("unconfirmed or deleted accounts cannot use previously signed tokens", async (t) => {
  const user = account(t, "admin", false);
  t.mock.method(User, "find", () => query([]));
  t.mock.method(User, "countDocuments", async () => 0);
  const request = await http(t, userRoutes);
  const token = await generateToken(user);
  assert.equal((await request("/api/users", { token })).status, 401);
  User.findById = () => query(null);
  assert.equal((await request("/api/users", { token })).status, 401);
});

test("new password saves hash once; unrelated saves preserve existing hash", async (t) => {
  t.mock.method(User.collection, "insertOne", async (doc) => ({ acknowledged: true, insertedId: doc._id }));
  t.mock.method(User.collection, "updateOne", async () => ({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }));
  const user = new User({ identifier: "synthetic", password: "synthetic-password" });
  await user.save();
  assert(await bcrypt.compare("synthetic-password", user.password));
  const hash = user.password;
  user.name = "Updated";
  await user.save();
  assert.equal(user.password, hash);
  assert(await user.matchPassword("synthetic-password"));
  assert.equal(await user.matchPassword("wrong-password"), false);
});

test("existing bcrypt login remains compatible; plaintext is not accepted or rewritten", async (t) => {
  const user = new User({ identifier: "existing", password: await bcrypt.hash("synthetic-password", 10), confirmed: true });
  t.mock.method(User, "findOne", async () => user);
  let result = await invoke(loginUser, { body: { identifier: "existing", password: "synthetic-password" } });
  assert.equal(result.statusCode, 200);
  assert(result.body.token);
  assert.equal(result.body.password, undefined);
  user.password = "synthetic-password";
  result = await invoke(loginUser, { body: { identifier: "existing", password: "synthetic-password" } });
  assert.equal(result.statusCode, 401);
  assert.equal(user.password, "synthetic-password");
});

test("password change and admin reset remain login-compatible without double hashing", async (t) => {
  const admin = mockAdminActor(t);
  const user = new User({ identifier: "existing", password: await bcrypt.hash("old-password", 10), confirmed: true });
  user.isNew = false;
  user.$__reset();
  t.mock.method(User, "findById", async () => user);
  t.mock.method(User.collection, "updateOne", async () => ({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }));
  let result = await invoke(updatePassword, { user: { id: user.id }, body: { currentPassword: "old-password", newPassword: "new-password" } });
  assert.equal(result.statusCode, 200);
  assert(await bcrypt.compare("new-password", user.password));
  result = await invoke(updateUser, { user: admin, params: { id: user.id }, body: { password: "reset-password" } });
  assert.equal(result.statusCode, 200);
  assert(await bcrypt.compare("reset-password", user.password));
});

test("unexpected global and helper errors do not disclose sensitive configuration", async (t) => {
  process.env.MONGO_URI = "mongodb://synthetic-user:synthetic-password@invalid.example/test";
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args.join(" ")));
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; } };
  errorHandler(new Error(`connection failed ${process.env.MONGO_URI}`), {}, res, () => {});
  assert.equal(res.statusCode, 500);
  assert(!JSON.stringify(res.body).includes(process.env.MONGO_URI));
  assert(!logs.join(" ").includes(process.env.MONGO_URI));
  respondError(res, 500, `failure ${process.env.JWT_SECRET}`);
  assert(!JSON.stringify(res.body).includes(process.env.JWT_SECRET));
  respondError(res, 400, `failure ${process.env.MONGO_URI}`);
  assert(!JSON.stringify(res.body).includes(process.env.MONGO_URI));
});

test("diagnostics expose no public log stream, configuration or process console overrides", async (t) => {
  const entry = await fs.readFile(new URL("../index.js", import.meta.url), "utf8");
  assert(!entry.includes('console.log("Starting server...", process.env.MONGO_URI)'));
  const originalLog = console.log;
  const { createApp } = await import("../app.js");
  const request = await serve(t, createApp());
  assert.equal(console.log, originalLog);
  const root = await request("/");
  assert.equal(root.status, 200);
  assert(!root.text.includes("EventSource"));
  assert(!root.text.includes(process.env.MONGO_URI));
  assert.equal((await request("/logs-stream")).status, 404);
  assert.equal((await request("/api/health")).status, 503);
});

test("provisioning requires an explicit approved role, stays unconfirmed, and rejects malformed privilege fields", async (t) => {
  const admin = account(t);
  t.mock.method(User, "findOne", async () => null);
  const documents = [];
  t.mock.method(User.collection, "insertOne", async (doc) => { documents.push(doc); return { acknowledged: true, insertedId: doc._id }; });
  const request = await http(t, userRoutes);
  const token = await generateToken(admin);
  const base = { identifier: "ordinary", password: "synthetic-password", role: "customer" };
  assert.equal((await request("/api/users/register", { method: "POST", token, body: base })).status, 201);
  assert.equal(documents[0].role, "customer");
  assert.equal(documents[0].confirmed, false);
  for (const extra of [{ role: "manager" }, { confirmed: "true" }, { password: 123456 }, { password: "x".repeat(73) }]) {
    assert.equal((await request("/api/users/register", { method: "POST", token, body: { ...base, ...extra } })).status, 400);
  }
  assert.equal(documents.length, 1);
});

test("invalid token and bad login fail without internal errors or password disclosure", async (t) => {
  t.mock.method(User, "findOne", async () => null);
  const request = await http(t, userRoutes);
  assert.equal((await request("/api/users", { token: "invalid" })).status, 401);
  for (const body of [{}, { identifier: { $ne: null }, password: "synthetic" }, { identifier: "unknown", password: "synthetic" }]) {
    const result = await request("/api/users/login", { method: "POST", body });
    assert([400, 401].includes(result.status));
    assert.equal(result.body.password, undefined);
    assert.equal(result.body.token, undefined);
  }
});

test("password hash survives a failed insert and save retry without hashing twice", async (t) => {
  let attempts = 0;
  t.mock.method(User.collection, "insertOne", async (doc) => {
    if (++attempts === 1) throw new Error("synthetic insert failure");
    return { acknowledged: true, insertedId: doc._id };
  });
  const user = new User({ identifier: "retry", password: "synthetic-password" });
  await assert.rejects(user.save(), /synthetic insert failure/);
  await user.save();
  assert(await bcrypt.compare("synthetic-password", user.password));
});

test("offline bootstrap is owner-gated and never replaces an existing administrator", async (t) => {
  let existing = null, inserted;
  t.mock.method(User, "findOne", async () => existing);
  const writes = t.mock.method(User.collection, "insertOne", async (doc) => { inserted = doc; return { acknowledged: true, insertedId: doc._id }; });
  await assert.rejects(seedAdmin(undefined), /Password/);
  assert.equal(writes.mock.callCount(), 0);
  await assert.rejects(seedAdmin("synthetic-seed-password"), /separately authorized recovery/);
  assert.equal(inserted, undefined);
  existing = { identifier: "admin" };
  assert.equal(await seedAdmin("different-password"), false);
  assert.equal(writes.mock.callCount(), 0);
});

test("legacy controller errors and request logs cannot disclose secret query/body values", async (t) => {
  const admin = account(t);
  const secret = process.env.JWT_SECRET;
  const logs = [];
  t.mock.method(console, "log", (...args) => logs.push(args.join(" ")));
  t.mock.method(Expense, "find", () => { throw new Error(`failure ${secret} ${process.env.MONGO_URI}`); });
  const { createApp } = await import("../app.js");
  const request = await serve(t, createApp());
  const result = await request(`/api/expenses?token=${secret}`, { method: "POST", token: await generateToken(admin), body: {
    itemName: "synthetic", amount: 1, note: secret,
  } });
  assert.equal(result.status, 403, "unscoped financial writes now deny before controller work");
  const read = await request(`/api/expenses?token=${secret}`, { token: await generateToken(admin) });
  assert.equal(read.status, 500);
  assert.equal(read.body.error, "Internal server error");
  assert(!read.text.includes(secret));
  assert(!result.text.includes(secret));
  assert(!logs.join(" ").includes(secret));
  assert(!logs.join(" ").includes(process.env.MONGO_URI));
});

test("database connection failures log a constant message without URI or driver error", async (t) => {
  const logs = [];
  t.mock.method(mongoose, "connect", async () => { throw new Error(process.env.MONGO_URI); });
  t.mock.method(console, "error", (...args) => logs.push(args.join(" ")));
  const exit = t.mock.method(process, "exit", () => {});
  await connectDB();
  assert.equal(exit.mock.calls[0].arguments[0], 1);
  assert.deepEqual(logs, ["Database connection failed"]);
});
