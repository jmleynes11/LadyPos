import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import { errorHandler } from "../middleware/errorMiddleware.js";
import { beforeEach } from "node:test";
import { randomUUID } from "node:crypto";
import { AccountAudit, AccountGrant, AccountReview, AccountReceipt, AccountRealm } from "../models/AccountControl.js";

mongoose.set("bufferCommands", false);
const syntheticAdministrators = new Map();
const lookupWrappers = new WeakSet();
let activeTest;
function installSyntheticAdministratorLookup() {
  if (!syntheticAdministrators.size || lookupWrappers.has(User.findById)) return;
  const original = User.findById;
  const wrapped = function lookupSyntheticAdministrator(key, ...args) {
    const actor = syntheticAdministrators.get(String(key));
    return actor ? query(actor) : original.call(this, key, ...args);
  };
  lookupWrappers.add(wrapped);
  activeTest.mock.method(User, "findById", wrapped);
}

// Ancillary lifecycle fixtures for the earlier component suites. Their own
// User/session/driver fault adapters remain authoritative. Full effect+audit
// rollback and realm-lock interleavings use accountManagementAdapter separately.
beforeEach(t => {
  activeTest = t;
  syntheticAdministrators.clear();
  for (const Model of [AccountGrant,AccountReview,AccountAudit]) {
    t.mock.method(Model,"find",()=>query([]));
    t.mock.method(Model,"create",async rows=>rows.map(row=>({...row,_id:row._id||id()})));
  }
  t.mock.method(AccountReceipt,"findOne",()=>query(null));
  t.mock.method(AccountReceipt,"create",async rows=>rows);
  t.mock.method(AccountRealm,"findOneAndUpdate",async()=>({_id:"account-management",revision:1}));
  t.mock.method(AccountReview,"findById",(target,projection,options)=>({
    then: async(resolve,reject)=>{
      try { const user=await User.findById(target,null,options);return resolve(user?{_id:target,targetAccountId:target,reviewerId:id(),status:"approved",proposedRole:"admin",expectedVersion:user.tokenVersion??0,expectedRole:user.role,save:async()=>{}}:null); }catch(error){return reject(error);}
    },
  }));
  t.mock.method(User,"countDocuments",()=>query(2)); // Independent synthetic spare Administrator.
  t.mock.method(User,"find",()=>query([
    { _id:id(),role:"admin",confirmed:true,accountState:"active",tokenVersion:0,authorityVersion:0 },
    { _id:id(),role:"admin",confirmed:true,accountState:"active",tokenVersion:0,authorityVersion:0 },
  ]));
  t.mock.method(User.collection,"updateOne",async()=>({acknowledged:true,matchedCount:1,modifiedCount:1}));
  class AncillarySession { inTransaction(){return true;} async commitTransaction(){} async withTransaction(work){const result=await work();await this.commitTransaction();return result;} async endSession(){} }
  t.mock.method(User,"startSession",async()=>new AncillarySession());
});

function commandFixture(req, handlerName = "") {
  if (req.body && ["createUser","updateUser","deleteUser","updatePassword","updateProfile"].includes(handlerName)) {
    req.body={reason:"Synthetic authorized regression action",operationId:randomUUID(),...req.body};
    if (handlerName === "updateUser" && req.body.role === "admin") req.body.reviewId ??= req.params?.id;
  }
  return req;
}

export const id = () => new mongoose.Types.ObjectId();

// Existing controller tests use an independent, authorized administrator.
// Detailed transaction/actor races are exercised by the A04 collection adapter.
export function mockAdminActor(t, account = { _id: id(), role: "admin" }) {
  if (arguments.length < 2) syntheticAdministrators.set(String(account._id), { ...account, confirmed: true, tokenVersion: 0 });
  const actor = { id: String(account._id), role: account.role, tokenVersion: account.tokenVersion ?? 0 };
  const session = {
    inTransaction: () => true,
    async commitTransaction() {},
    async withTransaction(work) { const result = await work(); await this.commitTransaction(); return result; },
    endSession: async () => {},
  };
  t.mock.method(User, "startSession", async () => session);
  t.mock.method(User, "updateOne", async (filter, update, options) => {
    if (String(filter._id) !== actor.id) return User.collection.updateOne(filter,update,options);
    assert.equal(String(filter._id), actor.id);
    assert.equal(filter.role, "admin");
    assert.equal(filter.confirmed, true);
    assert.deepEqual(update, { $inc: { __v: 1 } });
    assert.equal(options.session, session);
    assert.equal(options.timestamps, false);
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  return actor;
}

export function matchesAccountFilter(record, filter) {
  return Object.entries(filter).every(([field, expected]) => {
    if (field === "$and") return expected.every((part) => matchesAccountFilter(record, part));
    if (field === "$or") return expected.some((part) => matchesAccountFilter(record, part));
    if (expected && Object.hasOwn(expected, "$exists")) return Object.hasOwn(record, field) === expected.$exists;
    if (field === "_id") return String(record[field]) === String(expected);
    return record[field] === expected;
  });
}

export function query(value) {
  const result = {
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  for (const name of ["select", "session", "populate", "sort", "skip", "limit"]) {
    result[name] = () => result;
  }
  return result;
}

export async function invoke(handler, req) {
  installSyntheticAdministratorLookup();
  // The named exports are async-handler wrappers; identify command fixtures by
  // importing them explicitly in the caller-independent helper below.
  const handlers = await import("../controllers/UserController.js");
  const name = Object.keys(handlers).find(key=>handlers[key]===handler);
  commandFixture(req,name);
  if (name === "updateUser" && req.body.expectedVersion === undefined && req.body.reason !== "") {
    const target = await User.findById(req.params.id);
    req.body.expectedVersion = target?.tokenVersion ?? 0;
  }
  if (name && req.user && !req.user.role) {
    const account=await User.findById(req.user.id);
    if(account)req.user={...req.user,role:account.role,tokenVersion:account.tokenVersion??0};
  }
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = JSON.parse(JSON.stringify(body)); return this; },
  };
  await handler(req, res, (error) => { if (error) errorHandler(error, req, res, () => {}); });
  return res;
}

export async function http(t, router, prefix = "/api/users") {
  const app = express();
  app.use(express.json());
  app.use(prefix, router);
  app.use(errorHandler);
  return serve(t, app);
}

export async function serve(t, app) {
  installSyntheticAdministratorLookup();
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  t.after(() => assert.equal(mongoose.connection.readyState, 0, "tests must never connect to a database"));
  return async (url, { token, body, method = "GET" } = {}) => {
    if (url.startsWith("/api/users") && ["POST","PUT","DELETE"].includes(method) && !url.endsWith("/login")) {
      body={reason:"Synthetic authorized regression action",operationId:randomUUID(),...(body||{})};
      if(body.role==="admin" && /^\/api\/users\/[a-f0-9]{24}$/i.test(url))body.reviewId??=url.split("/").at(-1);
      if(method==="PUT" && /^\/api\/users\/[a-f0-9]{24}$/i.test(url))body.expectedVersion??=0;
    }
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, text, body: text && response.headers.get("content-type")?.includes("json") ? JSON.parse(text) : null };
  };
}
