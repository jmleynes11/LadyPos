import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";
import { loginUser, updatePassword, updateUser } from "../controllers/UserController.js";
import { generateToken } from "../utils/generateToken.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { invoke, query, mockAdminActor } from "./helpers.js";

process.env.JWT_SECRET = "a02-synthetic-token-regression-key";

async function fixture(t) {
  const admin = mockAdminActor(t);
  const user = new User({ identifier: "a02-synthetic", password: await bcrypt.hash("synthetic-original-password", 10), role: "admin", confirmed: true });
  user.isNew = false;
  user.$__reset();
  t.mock.method(User, "findById", () => query(user));
  t.mock.method(User, "findOne", () => query(user));
  t.mock.method(User.collection, "updateOne", async () => ({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }));
  t.after(() => assert.equal(mongoose.connection.readyState, 0));
  const token = await generateToken(user);
  async function access(admin = false, bearer = token) {
    const req = { headers: { authorization: `Bearer ${bearer}` } };
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json() { return this; } };
    let accepted = false;
    await protect(req, res, (error) => { if (error) throw error; accepted = true; });
    if (accepted && admin) authorizeRoles("admin")(req, res, () => {});
    return res.statusCode;
  }
  return { user, access, admin };
}

const changes = [
  ["password change", async ({ user }) => {
    const result = await invoke(updatePassword, { user: { id: user.id }, body: { currentPassword: "synthetic-original-password", newPassword: "synthetic-changed-password" } });
    assert.equal(result.statusCode, 200);
    assert(await user.matchPassword("synthetic-changed-password"));
    assert.equal(await user.matchPassword("synthetic-original-password"), false);
  }],
  ["administrator reset", async ({ user, admin }) => {
    const result = await invoke(updateUser, { user: admin, params: { id: user.id }, body: { password: "synthetic-reset-password" } });
    assert.equal(result.statusCode, 200);
    assert(await user.matchPassword("synthetic-reset-password"));
    assert.equal(await user.matchPassword("synthetic-original-password"), false);
  }],
  ["role demotion and restoration", async (f) => {
    assert.equal((await invoke(updateUser, { user: f.admin, params: { id: f.user.id }, body: { role: "cashier" } })).statusCode, 200);
    assert.equal(await f.access(true), 401);
    assert.equal((await invoke(updateUser, { user: f.admin, params: { id: f.user.id }, body: { role: "admin" } })).statusCode, 200);
  }],
  ["unconfirmation and reconfirmation", async (f) => {
    assert.equal((await invoke(updateUser, { user: f.admin, params: { id: f.user.id }, body: { confirmed: false } })).statusCode, 200);
    assert.equal(await f.access(), 401);
    assert.equal((await invoke(updateUser, { user: f.admin, params: { id: f.user.id }, body: { confirmed: true } })).statusCode, 200);
  }],
];

for (const [name, change] of changes) {
  test(`SECURITY ACCEPTANCE: old token rejected after ${name}`, async (t) => {
    const f = await fixture(t);
    await change(f);
    assert.equal(await f.access(false, await generateToken(f.user)), 200, "a fresh token for the current confirmed account must still work");
    assert.equal(await f.access(), 401);
  });
}

test("bcrypt 2a/2b/2y authentication remains compatible with versioned tokens", async (t) => {
  const f = await fixture(t);
  const hash = f.user.password;
  for (const prefix of ["$2a$", "$2b$", "$2y$"]) {
    f.user.password = prefix + hash.slice(4);
    const result = await invoke(loginUser, { body: { identifier: f.user.identifier, password: "synthetic-original-password" } });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.password, undefined);
  }
  assert.equal(await f.access(true), 200);
});
