import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Store from "../models/Store.js";
import Product from "../models/Product.js";
import { BookstoreAudit, BookstoreReceipt } from "../models/BookstoreControl.js";
import { accountAdapter } from "./accountManagementAdapter.js";
import { manageCategory, readCategories } from "../services/categoryService.js";
import { updateBookstoreProduct } from "../services/catalogService.js";

process.env.JWT_SECRET = "category-management-synthetic-key";
const id = () => new mongoose.Types.ObjectId();
function fixture(t, role = "store_manager") {
  const actorId = id(), storeId = id(), productId = id(), otherStore = id();
  const f = accountAdapter(t, [{ _id: actorId, identifier: "synthetic", role, confirmed: true, accountState: "active", tokenVersion: 0, authorityVersion: 0, storeIds: [storeId] }], { extraModels: [Store, BookstoreAudit, BookstoreReceipt], cloneValue: value => mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(value)) });
  f.store.get(Store.modelName).set(String(storeId), { _id: storeId, name: "Synthetic" });
  const product = { _id: productId, storeId, owner: id(), name: "Shared book", category: "Books", sku: "BOOK", stock: 8, price: 1000, costPrice: 300, isActive: true, moneyUnit: "PHP-centavos" };
  f.store.get(Product.modelName).set(String(productId), product);
  const otherId = id(); f.store.get(Product.modelName).set(String(otherId), { ...product, _id: otherId, storeId: otherStore });
  return { ...f, actor: { id: String(actorId), role, tokenVersion: 0 }, storeId, productId, otherId,
    body: extra => ({ storeId: String(storeId), operationId: randomUUID(), reason: "Synthetic management change", ...extra }) };
}

test("Manager creates unused categories, renames existing assignments and deletes with explicit reassignment", async t => {
  const f = fixture(t);
  assert.deepEqual((await readCategories(f.actor, f.storeId)).categories, [{ name: "Books", productCount: 1 }]);
  const body = f.body({ action: "create", name: "Supplies" });
  await manageCategory(f.actor, body); await manageCategory(f.actor, body);
  assert.equal(f.rows(BookstoreReceipt).length, 1);
  assert((await readCategories(f.actor, f.storeId)).categories.some(row => row.name === "Supplies" && row.productCount === 0));
  await manageCategory(f.actor, f.body({ action: "rename", name: "Books", newName: "Textbooks" }));
  assert.equal(f.store.get(Product.modelName).get(String(f.productId)).category, "Textbooks");
  assert.equal(f.store.get(Product.modelName).get(String(f.otherId)).category, "Books");
  await assert.rejects(manageCategory(f.actor, f.body({ action: "delete", name: "Textbooks" })), error => error.statusCode === 409);
  await manageCategory(f.actor, f.body({ action: "delete", name: "Textbooks", replacement: "Supplies" }));
  const product = f.store.get(Product.modelName).get(String(f.productId));
  assert.equal(product.category, "Supplies"); assert.equal(product.stock, 8); assert.equal(product.price, 1000); assert.equal(product.costPrice, 300);
  assert.deepEqual((await readCategories(f.actor, f.storeId)).categories, [{ name: "Supplies", productCount: 1 }]);
});

test("category changes reject malformed names, duplicates and cross-store requests without partial effects", async t => {
  const f = fixture(t);
  for (const fields of [{ action: "create", name: " books " }, { action: "create", name: "" }, { action: "create", name: "x".repeat(101) }, { action: "create", name: "bad\nname" }, { action: "rename", name: "Missing", newName: "Changed" }, { action: "delete", name: "Books", replacement: "Missing" }, { action: "create", name: "Injected", owner: String(id()) }, { action: "create", name: "Cross store", storeId: String(id()) }]) await assert.rejects(manageCategory(f.actor, f.body(fields)));
  assert.equal(f.rows(BookstoreAudit).length, 0);
  t.mock.method(BookstoreAudit.collection, "insertOne", () => { throw Error("Synthetic audit failure"); });
  await assert.rejects(manageCategory(f.actor, f.body({ action: "rename", name: "Books", newName: "Changed" })));
  assert.equal(f.store.get(Product.modelName).get(String(f.productId)).category, "Books");
  assert.equal(f.rows(Store)[0].categoryNames, undefined); assert.equal(f.rows(BookstoreReceipt).length, 0);
});

for (const role of ["admin", "cashier", "customer", "user"]) test(`new category management does not grant access to ${role}`, async t => {
  const f = fixture(t, role);
  await assert.rejects(readCategories(f.actor, f.storeId), error => error.statusCode === 403);
  await assert.rejects(manageCategory(f.actor, f.body({ action: "create", name: "Denied" })), error => error.statusCode === 403);
});

test("Manager edits shared product metadata without price access, retaining stock, cost, and scoped ownership", async t => {
  const f = fixture(t);
  await updateBookstoreProduct(f.actor, f.productId, f.body({ name: "Updated book", sku: "NEW", category: "Textbooks", isActive: false }));
  const product = f.store.get(Product.modelName).get(String(f.productId));
  assert.equal(product.name, "Updated book"); assert.equal(product.price, 1000); assert.equal(product.isActive, false);
  assert.equal(product.stock, 8); assert.equal(product.costPrice, 300);
  await updateBookstoreProduct(f.actor, f.productId, f.body({ isActive: true }));
  for (const change of [{ price: 1200 }, { sellingPrice: 1200 }, { stock: 999 }, { costPrice: 0 }, { owner: f.actor.id }]) await assert.rejects(updateBookstoreProduct(f.actor, f.productId, f.body(change)), error => error.statusCode === 403);
  await assert.rejects(updateBookstoreProduct(f.actor, f.otherId, f.body({ name: "Outside" })), error => error.statusCode === 404);
});
