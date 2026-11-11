import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";
import { ACCOUNT_ROLES, resolveAccountRole } from "../auth/accountRoles.js";
import { requireLegacyOperationalAccess } from "../middleware/roleAdmission.js";
import { requireProductManagementAccess, requireProductCreationAccess, requireInventoryAdjustmentAccess, requireProductReadAccess, requireReversalAliasAccess } from "../middleware/bookstoreAdmission.js";
import { protect } from "../middleware/authMiddleware.js";
import { generateToken } from "../utils/generateToken.js";
import { loginUser, createUser, updateUser } from "../controllers/UserController.js";
import { createApp } from "../app.js";
import { ROUTE_MANIFEST, HEAD_MANIFEST } from "../auth/routeManifest.js";
import { collectRoutes, validateInventory } from "./routeInventoryAdapter.js";
import { BOOKSTORE_ROUTE_MANIFEST } from "../auth/bookstoreRouteManifest.js";
import { id, query, invoke, serve } from "./helpers.js";

process.env.JWT_SECRET = "b02-synthetic-test-signing-key";
const roles = [...Object.keys(ACCOUNT_ROLES), "user"];
const newRoles = ["store_manager", "cashier", "customer"];

beforeEach((t) => {
  const deny = () => { throw new Error("Database connections forbidden"); };
  t.mock.method(mongoose, "connect", deny);
  t.mock.method(mongoose, "createConnection", deny);
  t.mock.method(console, "log", () => {});
  t.after(() => assert.equal(mongoose.connection.readyState, 0));
});

test("B02 exact stored-role adapter has four business roles and an unresolved legacy state", () => {
  assert.deepEqual(ACCOUNT_ROLES, {
    admin: "Administrator", store_manager: "Store Manager", cashier: "Cashier", customer: "Customer / Student",
  });
  for (const [key, label] of Object.entries(ACCOUNT_ROLES)) {
    assert.deepEqual(resolveAccountRole(key), { kind: "business", businessRole: label });
  }
  assert.deepEqual(resolveAccountRole("user"), { kind: "legacy-unassigned", businessRole: null });
  for (const role of [undefined, null, "", "Admin", "admin ", "Administrator", "constructor", "__proto__", 1, [], {}, ["admin"]]) {
    assert.equal(resolveAccountRole(role), null);
  }
});

for (const role of roles) {
  test(`B02 schema and bcrypt login preserve ${role} without assigning or rewriting it`, async (t) => {
    const password = await bcrypt.hash("synthetic-password", 4);
    const user = new User({ identifier: "synthetic", role, confirmed: true, password });
    await user.validate();
    const writes = t.mock.method(User.collection, "updateOne", () => { throw new Error("No writes"); });
    t.mock.method(User, "findOne", () => query(user));
    const result = await invoke(loginUser, { body: { identifier: "synthetic", password: "synthetic-password" } });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.role, role);
    assert.equal(result.body.password, undefined);
    assert.equal(user.password, password);
    assert.equal(user.role, role);
    assert.equal(writes.mock.callCount(), 0);
  });
}

test("B02 unknown persisted roles fail both login and protect without issuing access", async (t) => {
  const user = { _id: id(), role: "unrecognized", confirmed: true, tokenVersion: 0, matchPassword: async () => true };
  t.mock.method(User, "findOne", () => query(user));
  t.mock.method(User, "findById", () => query(user));
  const login = await invoke(loginUser, { body: { identifier: "synthetic", password: "synthetic-password" } });
  assert.equal(login.statusCode, 401);
  assert.equal(login.body.token, undefined);
  const token = await generateToken(user);
  for (const role of ["unrecognized", undefined, null, {}, [], "Admin", "customer "]) {
    user.role = role;
    const req = { headers: { authorization: `Bearer ${token}` } };
    let reached = false;
    const res = { status(n) { this.code = n; return this; }, json() {} };
    await protect(req, res, () => { reached = true; });
    assert.equal(res.code, 401);
    assert.equal(reached, false);
    assert.equal(req.user, undefined);
  }
});

test("B02 admission is separate from authentication and fails closed without legacy role", () => {
  for (const role of [...newRoles, "unknown", null, undefined]) {
    const res = { status(n) { this.code = n; return this; }, json() {} };
    let calls = 0;
    requireLegacyOperationalAccess({ user: { role } }, res, () => calls++);
    assert.equal(res.code, 403);
    assert.equal(calls, 0);
  }
  for (const role of ["admin", "user"]) {
    let calls = 0;
    requireLegacyOperationalAccess({ method: "GET", user: { role } }, {}, () => calls++);
    assert.equal(calls, 1);
  }
  const res = { status(n) { this.code = n; return this; }, json() {} };
  requireLegacyOperationalAccess({}, res, () => assert.fail("Unauthenticated"));
  assert.equal(res.code, 401);
});

test("B02 every existing business registration has admission before its controller; B01 manifest remains intact", () => {
  validateInventory(collectRoutes(), ROUTE_MANIFEST);
  let count = 0;
  for (const layer of createApp().router.stack) {
    if (!layer.handle?.stack) continue;
    const routes = layer.handle.stack.filter(item => item.route);
    if (routes.some(item => item.route.path === "/guest/intents")) {
      const observed = routes.flatMap(item => Object.keys(item.route.methods).map(method => `${method.toUpperCase()} /api/bookstore${item.route.path} ${item.route.stack.filter(part => part.method === method).at(-1).handle.name}`)).sort();
      assert.deepEqual(observed, BOOKSTORE_ROUTE_MANIFEST.map(row => `${row.method} ${row.path} ${row.handler}`).sort());
      continue; // additive API has its own role/HTTP suite, not legacy admission
    }
    // The User router deliberately provides separately guarded self/admin APIs.
    if (routes.some(item => item.route.path === "/login")) continue;
    for (const item of routes) {
      for (const method of Object.keys(item.route.methods)) {
        const handlers = item.route.stack.filter(h => h.method === method).map(h => h.handle);
        const handlerName = handlers.at(-1).name;
        const admission = ["updateProduct", "deleteProduct"].includes(handlerName) ? requireProductManagementAccess : handlerName === "createProduct" ? requireProductCreationAccess : handlerName === "adjustStock" ? requireInventoryAdjustmentAccess
          : ["voidTransaction", "deleteOrder", "markVoid"].includes(handlerName) ? requireReversalAliasAccess
          : ["getProducts", "getProductById"].includes(handlerName) ? requireProductReadAccess : requireLegacyOperationalAccess;
        assert(handlers.indexOf(admission) >= 0);
        assert(handlers.indexOf(admission) < handlers.length - 1);
        count++;
      }
    }
  }
  assert.equal(count, 52);
});

for (const role of newRoles) {
  test(`B02 ${role} denied every mounted operational method and HEAD; self access remains available`, async (t) => {
    const user = { _id: id(), identifier: "synthetic", role, confirmed: true, accountState: "active", tokenVersion: 0 };
    let reads = 0;
    t.mock.method(User, "findById", () => { reads++; return query(user); });
    // Any accidental domain persistence must fail even without a live database.
    const effects = [];
    for (const key of ["insertOne", "updateOne", "deleteOne", "updateMany"]) {
      t.mock.method(mongoose.Collection.prototype, key, () => { effects.push(key); throw new Error("Domain effect forbidden"); });
    }
    const token = await generateToken(user);
    const request = await serve(t, createApp());
    const routes = [...ROUTE_MANIFEST, ...HEAD_MANIFEST].filter(row => row.protected && row.mount !== "/api/users");
    assert.equal(routes.length, 73);
    for (const row of routes) {
      const path = row.path.replace(/:[a-zA-Z]+/g, String(user._id));
      const result = await request(path, { token, method: row.method, ...(row.method === "HEAD" || row.method === "GET" ? {} : { body: {} }) });
      assert.equal(result.status, 403, `${row.method} ${row.path}`);
    }
    // Four legacy registrations redundantly run protect a second time.
    assert.equal(reads, 77, "blocked operations perform only authentication account lookups, including existing duplicates");
    assert.deepEqual(effects, []);
    assert.equal((await request("/api/users/profile", { token })).status, 200);
    assert.equal((await request("/api/users", { token })).status, 403);
    assert.equal((await request("/api/users/register", { method: "POST", token, body: { role: "admin" } })).status, 403);
    assert.equal((await request(`/api/users/${user._id}`, { method: "PUT", token, body: { role: "admin" } })).status, 403);
  });
}

test("B02 unknown schema roles reject validation rather than receiving defaults", async () => {
  for (const role of ["unknown", "Admin", "store-manager", "customer ", null, {}]) {
    const user = new User({ identifier: "synthetic", password: "synthetic-password", role });
    await assert.rejects(user.validate());
  }
});

test("B02 missing persisted role is not hydrated into legacy operational authority", async (t) => {
  const user = User.hydrate({ _id: id(), identifier: "synthetic", password: await bcrypt.hash("synthetic-password", 4), confirmed: true, tokenVersion: 0 });
  assert.equal(user.role, undefined);
  t.mock.method(User, "findOne", () => query(user));
  t.mock.method(User, "findById", () => query(user));
  assert.equal((await invoke(loginUser, { body: { identifier: "synthetic", password: "synthetic-password" } })).statusCode, 401);
  const token = await generateToken({ _id: user._id, role: "admin", tokenVersion: 0 });
  const res = { status(n) { this.code = n; return this; }, json() {} };
  await protect({ headers: { authorization: `Bearer ${token}` } }, res, () => assert.fail("Missing persisted role"));
  assert.equal(res.code, 401);
});

test("B02 new-role writes require valid reason and guarded persistence before any lookup", async (t) => {
  const reads = t.mock.method(User, "findOne", () => { throw new Error("No lookup"); });
  for (const role of newRoles) {
    const req = { user: { id: String(id()), role: "admin", tokenVersion: 0 }, params: { id: String(id()) }, body: { identifier: "synthetic", password: "synthetic-password", role, reason: "" } };
    assert.equal((await invoke(createUser, req)).statusCode, 400);
    assert.equal((await invoke(updateUser, req)).statusCode, 400);
  }
  assert.equal(reads.mock.callCount(), 0);
});

for (const role of newRoles) {
  test(`B02 model role transition to ${role} retains atomic epoch invalidation`, async (t) => {
    const user = User.hydrate({ _id: id(), identifier: "synthetic", password: await bcrypt.hash("synthetic-password", 4), role: "user", confirmed: true, tokenVersion: 2 });
    let write;
    t.mock.method(User.collection, "updateOne", async (filter, update) => { write = { filter, update }; return { acknowledged: true, matchedCount: 1, modifiedCount: 1 }; });
    user.role = role;
    await user.save();
    assert.equal(write.update.$set.role, role);
    assert.equal(write.update.$set.tokenVersion, 3);
    assert(JSON.stringify(write.filter).includes('"tokenVersion":2'));
  });
}
