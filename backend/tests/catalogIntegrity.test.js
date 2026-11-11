import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Store from "../models/Store.js";
import Order from "../models/Order.js";
import { BookstoreAudit, BookstoreReceipt } from "../models/BookstoreControl.js";
import { createBookstoreProduct, updateBookstoreProduct, setBookstoreActiveProducts } from "../services/catalogService.js";
import { accountAdapter } from "./accountManagementAdapter.js";
import { photoFixture } from "./productPhotoFixture.js";
import { bookstoreContext } from "../services/bookstoreReads.js";

process.env.JWT_SECRET = "b03-catalog-synthetic-key";
const id = () => new mongoose.Types.ObjectId();
const cloneValue = value => mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(value));
function fixture(t, role = "admin") {
  const actorId = id(), storeId = id();
  const f = accountAdapter(t, [{ _id: actorId, identifier: "synthetic", role, confirmed: true, accountState: "active", tokenVersion: 0, authorityVersion: 0, storeIds: [storeId] }], { extraModels: [Store, BookstoreAudit, BookstoreReceipt], cloneValue });
  f.store.get(Store.modelName).set(String(storeId), { _id: storeId, name: "Synthetic" });
  return { ...f, actor: { id: String(actorId), role, tokenVersion: 0 }, storeId,
    body: extra => ({ storeId: String(storeId), operationId: randomUUID(), reason: "Synthetic approved catalog change", ...extra }) };
}

test("B03 Administrator creates explicit centavo catalog records with zero stock and durable audit", async t => {
  const f = fixture(t), body = f.body({ name: "Book", sellingPrice: 15050 });
  const result = await createBookstoreProduct(f.actor, body);
  assert.equal(result.price, 15050); assert.equal(result.moneyUnit, "PHP-centavos"); assert.equal(result.stock, 0);
  assert.equal(f.rows(Product)[0].stock, 0); assert.equal(f.rows(BookstoreAudit)[0].action, "product.created");
  await createBookstoreProduct(f.actor, body); assert.equal(f.rows(Product).length, 1);
});

test("B03 price/metadata edits preserve stock, omitted cost and historical sale price", async t => {
  const f = fixture(t), result = await createBookstoreProduct(f.actor, f.body({ name: "Book", price: 15050 }));
  const row = f.store.get(Product.modelName).get(result.productId); row.stock = 7; row.costPrice = 500;
  const saleId = id(); f.store.get(Order.modelName).set(String(saleId), { _id: saleId, owner: id(), items: [{ product: row._id, unitPrice: 15050, subtotal: 15050, quantity: 1 }] });
  await updateBookstoreProduct(f.actor, result.productId, f.body({ name: "Updated" }));
  assert.equal(f.rows(Product)[0].price, 15050); assert.equal(f.rows(Product)[0].stock, 7); assert.equal(f.rows(Product)[0].costPrice, 500);
  await updateBookstoreProduct(f.actor, result.productId, f.body({ price: 20000 }));
  assert.equal(f.rows(Product)[0].price, 20000); assert.equal(f.rows(Order)[0].items[0].unitPrice, 15050);
  assert.equal(f.rows(BookstoreAudit).at(-1).action, "product.price_changed");
});

test("B03 protected aliases, malformed money and non-admin pricing reject before effects", async t => {
  const f = fixture(t);
  for (const extra of [{ stock: 1 }, { quantity: 1 }, { costPrice: 1 }, { owner: String(id()) }, { role: "admin" }, { sellingPrice: 1, price: 2 }, { price: 1.5 }, { price: "100" }, { isActive: "true" }]) {
    await assert.rejects(createBookstoreProduct(f.actor, f.body({ name: "Book", price: 100, ...extra })));
  }
  for (const role of ["cashier", "customer", "user"]) await assert.rejects(createBookstoreProduct({ ...f.actor, role }, f.body({ name: "Book", price: 100 })), error => error.statusCode === 403);
  assert.equal(f.rows(Product).length, 0); assert.equal(f.rows(BookstoreAudit).length, 0);
});

test("B03 bulk activation rollback prevents partial availability and cross-store injection", async t => {
  const f = fixture(t);
  await createBookstoreProduct(f.actor, f.body({ name: "A", price: 100 }));
  await createBookstoreProduct(f.actor, f.body({ name: "B", price: 100 }));
  const productIds = f.rows(Product).map(row => String(row._id));
  await assert.rejects(setBookstoreActiveProducts(f.actor, f.body({ productIds: [String(id())] })), error => error.statusCode === 403);
  t.mock.method(BookstoreAudit.collection, "insertOne", () => { throw new Error("Synthetic audit failure"); });
  await assert.rejects(setBookstoreActiveProducts(f.actor, f.body({ productIds: [] })));
  assert(f.rows(Product).every(row => row.isActive === true));
  assert.equal(f.rows(BookstoreReceipt).length, 2); assert.equal(productIds.length, 2);
});

test("B03 historical monetary units are never inferred by a price edit", async t => {
  const f = fixture(t), productId = id();
  f.store.get(Product.modelName).set(String(productId), { _id: productId, owner: id(), storeId: f.storeId, name: "Legacy", price: 150, stock: 2 });
  await assert.rejects(updateBookstoreProduct(f.actor, productId, f.body({ price: 15000 })), error => error.statusCode === 409);
  assert.equal(f.rows(Product)[0].price, 150); assert.equal(f.rows(Product)[0].moneyUnit, undefined);
});

test("Store Manager creates a scoped product with a persistent photo and idempotent audit", async t => {
  const f = fixture(t, "store_manager"), imageUrl = photoFixture();
  const context = await bookstoreContext(f.actor);
  assert.equal(context.capabilities["catalog.create"], true);
  assert.equal(context.capabilities["catalog.manage"], false);
  assert.equal(context.capabilities["product.price.write"], false);
  const body = f.body({ name: "Manager book", price: 12500, imageUrl });
  const result = await createBookstoreProduct(f.actor, body);
  await createBookstoreProduct(f.actor, body);
  const [stored] = f.rows(Product);
  assert.equal(stored.imageUrl, imageUrl); assert.equal(String(stored.storeId), String(f.storeId));
  assert.equal(String(stored.owner), f.actor.id); assert.equal(stored.stock, 0);
  assert.equal(f.rows(Product).length, 1); assert.equal(f.rows(BookstoreAudit).length, 1);
  for (const change of [{ name: "Changed" }, { isActive: false }]) await updateBookstoreProduct(f.actor, result.productId, f.body(change));
  for (const change of [{ price: 1 }, { sellingPrice: 1 }, { name: "Rejected", price: 1 }]) await assert.rejects(updateBookstoreProduct(f.actor, result.productId, f.body(change)), error => error.statusCode === 403);
  assert.equal(f.rows(Product)[0].price, 12500);
  assert.equal(f.rows(Product)[0].name, "Changed");
  assert.equal(f.rows(Product)[0].imageUrl, imageUrl);
  assert.equal(f.rows(Product)[0].stock, 0);
  assert.equal(context.capabilities["product.manage"], true);
  await assert.rejects(setBookstoreActiveProducts(f.actor, f.body({ productIds: [] })), error => error.statusCode === 403);
  await assert.rejects(createBookstoreProduct(f.actor, f.body({ name: "Other store", price: 1, storeId: String(id()) })), error => error.statusCode === 403);
});

test("product photo validation and audit failures leave no product or orphan photo", async t => {
  const f = fixture(t, "store_manager");
  await assert.rejects(createBookstoreProduct(f.actor, f.body({ name: "Bad", price: 100, imageUrl: "data:image/png;base64,AAAA" })), error => error.statusCode === 400);
  assert.equal(f.rows(Product).length, 0);
  t.mock.method(BookstoreAudit.collection, "insertOne", () => { throw new Error("Synthetic audit failure"); });
  await assert.rejects(createBookstoreProduct(f.actor, f.body({ name: "Rollback", price: 100, imageUrl: photoFixture() })));
  assert.equal(f.rows(Product).length, 0); assert.equal(f.rows(BookstoreReceipt).length, 0);
});
