import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import User from "../models/User.js";
import Store from "../models/Store.js";
import Product from "../models/Product.js";
import Customer from "../models/Person.js";
import Transaction from "../models/Order.js";
import Invoice from "../models/Invoice.js";
import DebtPayment from "../models/DebtPayment.js";

const id = () => new mongoose.Types.ObjectId();
const owner = id(), customer = id(), transaction = id();
const cases = [
  [Product, { owner, name: "Synthetic book", price: 10 }],
  [Customer, { owner, name: "Synthetic contact" }],
  [Transaction, { owner, customer, items: [], totalAmount: 0 }],
  [Invoice, { owner, customer, transaction, invoiceNumber: "SYNTHETIC" }],
  [DebtPayment, { owner, customer, amountPaid: 1 }],
];

for (const [Model, fields] of cases) {
  test(`D1 ${Model.modelName} attribution is additive/noncasting without ownership rewrite`, () => {
    const recordId = id(), storeId = id();
    const legacy = Model.hydrate({ _id: recordId, ...fields });
    assert.equal(legacy.storeId, undefined);
    assert(!legacy.isModified("storeId"));
    assert.equal(String(legacy.owner), String(owner));
    const mapped = new Model({ ...fields, storeId });
    assert(!mapped.validateSync()?.errors.storeId);
    assert.equal(String(mapped.storeId), String(storeId));
    for (const invalid of [null, storeId.toString(), [storeId], { $ne: null }]) {
      const row = Model.hydrate({ _id: recordId, ...fields, storeId: invalid });
      assert.deepEqual(row.storeId, invalid);
      assert(row.validateSync()?.errors.storeId);
    }
    assert(Model.schema.indexes().some(([keys, options]) => keys.storeId === 1 && !options.unique));
  });
}

test("D1 explicit memberships remain missing on legacy hydration and malformed types cannot coerce", () => {
  const base = { _id: id(), identifier: "synthetic", password: "synthetic-password", role: "cashier", confirmed: true, accountState: "active" };
  const legacy = User.hydrate(base);
  assert.equal(legacy.storeIds, undefined); assert(!legacy.isModified("storeIds"));
  const storeId = id();
  for (const invalid of [null, storeId, [storeId.toString()], [storeId, storeId], new Array(1), { $in: [storeId] }]) {
    const row = User.hydrate({ ...base, storeIds: invalid });
    assert.deepEqual(row.storeIds, invalid);
    assert(row.validateSync()?.errors.storeIds);
  }
  assert(!new User({ ...base, storeIds: [storeId] }).validateSync()?.errors.storeIds);
  assert(!new User({ ...base, storeIds: [] }).validateSync()?.errors.storeIds);
  assert(new Store({ name: "  Synthetic bookstore  " }).validateSync() === undefined);
});

for (const combined of [false, true]) {
  test(`D1 membership change advances guarded security/authority versions once (combined role=${combined})`, async t => {
    t.mock.method(mongoose, "connect", () => { throw new Error("No database"); });
    t.mock.method(mongoose, "createConnection", () => { throw new Error("No database"); });
    const row = User.hydrate({ _id: id(), identifier: "synthetic", password: "existing-hash", role: "cashier", confirmed: true, accountState: "active", tokenVersion: 5, authorityVersion: 2 });
    let saved;
    t.mock.method(User.collection, "updateOne", async (filter, update) => { saved = { filter, update }; return { acknowledged: true, matchedCount: 1, modifiedCount: 1 }; });
    row.storeIds = [id()]; if (combined) row.role = "store_manager";
    await row.save();
    assert.equal(row.tokenVersion, 6); assert.equal(row.authorityVersion, 3);
    assert.equal(saved.update.$set.tokenVersion, 6);
    assert.match(JSON.stringify(saved.filter), /"tokenVersion":5/);
    assert.equal(row.password, "existing-hash");
    assert.equal(mongoose.connection.readyState, 0);
  });
}
