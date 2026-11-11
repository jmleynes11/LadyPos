import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Store from "../models/Store.js";
import Product from "../models/Product.js";
import { BookstoreAudit, BookstoreReceipt, StockMovement } from "../models/BookstoreControl.js";
import { bookstoreCommand } from "../services/bookstoreCommand.js";
import { accountAdapter } from "./accountManagementAdapter.js";
import { operationalProjection } from "../auth/operationalProjection.js";

process.env.JWT_SECRET = "b03-command-synthetic-signing-key";
const id = () => new mongoose.Types.ObjectId();
const cloneValue = value => mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(value));
function fixture(t, role = "admin") {
  const actorId = id(), storeId = id();
  const f = accountAdapter(t, [{ _id: actorId, identifier: "synthetic", password: "existing", role, confirmed: true, accountState: "active", tokenVersion: 0, authorityVersion: 0, storeIds: [storeId] }], { extraModels: [Store, BookstoreAudit, BookstoreReceipt, StockMovement], cloneValue });
  f.store.get(Store.modelName).set(String(storeId), { _id: storeId, name: "Synthetic bookstore" });
  const actor = { id: String(actorId), role, tokenVersion: 0 };
  const body = { operationId: randomUUID(), reason: "Synthetic approved operation" };
  let calls = 0;
  const work = async ({ session, scope, audit }) => {
    calls++;
    const [product] = await Product.create([{ owner: actorId, storeId: scope.storeId, name: "Synthetic book", price: 10, stock: 0 }], { session });
    await audit("product.created", "Product", product._id, { absent: true }, { productId: String(product._id), price: product.price });
    return { productId: String(product._id) };
  };
  return { ...f, actor, storeId, body, work, calls: () => calls };
}

test("B03 operational effect/audit/receipt commit together and matching replay has no duplicate effect", async t => {
  const f = fixture(t);
  const result = await bookstoreCommand(f.actor, f.storeId, "catalog.manage", f.body, f.work);
  assert.equal(f.rows(Product).length, 1); assert.equal(f.rows(BookstoreAudit).length, 1); assert.equal(f.rows(BookstoreReceipt).length, 1);
  const replay = await bookstoreCommand(f.actor, f.storeId, "catalog.manage", f.body, f.work);
  assert.deepEqual(replay, result); assert.equal(f.calls(), 1);
  assert.equal(String(f.rows(BookstoreAudit)[0].actorId), f.actor.id);
  assert.equal(String(f.rows(BookstoreAudit)[0].storeId), String(f.storeId));
  await assert.rejects(bookstoreCommand(f.actor, f.storeId, "catalog.manage", { ...f.body, reason: "Different command" }, f.work), error => error.statusCode === 409);
});

test("B03 operational audit failure aborts product and operation identity", async t => {
  const f = fixture(t);
  t.mock.method(BookstoreAudit.collection, "insertOne", () => { throw new Error("Synthetic required audit failure"); });
  await assert.rejects(bookstoreCommand(f.actor, f.storeId, "catalog.manage", f.body, f.work));
  assert.equal(f.rows(Product).length, 0); assert.equal(f.rows(BookstoreReceipt).length, 0); assert.equal(f.stats.commits, 0);
});

test("B03 capability and bookstore membership both constrain current actor", async t => {
  const f = fixture(t, "store_manager");
  await assert.rejects(bookstoreCommand(f.actor, f.storeId, "product.price.write", f.body, f.work), error => error.statusCode === 403);
  await assert.rejects(bookstoreCommand(f.actor, id(), "inventory.adjust", f.body, f.work), error => error.statusCode === 403);
  assert.equal(f.calls(), 0); assert.equal(f.stats.commits, 0);
});

test("B03 unknown commit retains one effect and reconciles without replay", async t => {
  const f = fixture(t);
  const unknown = Object.assign(new Error("Synthetic uncertain acknowledgement"), { hasErrorLabel: label => label === "UnknownTransactionCommitResult" });
  f.faults.afterCommit = unknown;
  await assert.rejects(bookstoreCommand(f.actor, f.storeId, "catalog.manage", f.body, f.work), error => error.name === "AccountMutationIndeterminateError");
  assert.equal(f.rows(Product).length, 1); assert.equal(f.calls(), 1);
  delete f.faults.afterCommit;
  await bookstoreCommand(f.actor, f.storeId, "catalog.manage", f.body, f.work);
  assert.equal(f.calls(), 1); assert.equal(f.rows(Product).length, 1);
});

test("B03 operational ledgers reject query, document and bulk edits before persistence", async t => {
  for (const Model of [BookstoreAudit, BookstoreReceipt, StockMovement]) {
    t.mock.method(Model.collection, "updateOne", () => assert.fail("No ledger mutation"));
    await assert.rejects(Model.updateOne({}, { $set: { reason: "rewrite" } }), /append-only/);
    await assert.rejects(Model.deleteMany({}), /append-only/);
    await assert.rejects(Model.bulkWrite([{ deleteOne: { filter: {} } }]), /append-only/);
    const document = Model.hydrate({ _id: id() });
    await assert.rejects(document.deleteOne(), /append-only/);
  }
});

test("B03 operational projections exclude nested secrets/contacts and redact labelled credentials", async t => {
  for (const key of ["password", "token", "guestAccess", "credential", "fingerprint", "phone", "costPrice"]) {
    assert.throws(() => operationalProjection({ nested: [{ [key]: "private" }] }), /Protected field/);
  }
  assert.throws(() => operationalProjection(new Product({ name: "Raw model", price: 1 })), /Explicit operational DTO/);
  assert.throws(() => operationalProjection(new Array(1)), /Invalid operational projection/);
  assert(!operationalProjection({ note: "password=synthetic-private-value" }).note.includes("synthetic-private-value"));
  const f = fixture(t);
  await assert.rejects(bookstoreCommand(f.actor, f.storeId, "catalog.manage", f.body, async context => {
    await f.work(context);
    return { credential: "must-not-persist" };
  }), /Protected field/);
  assert.equal(f.rows(Product).length, 0); assert.equal(f.rows(BookstoreAudit).length, 0);
});
