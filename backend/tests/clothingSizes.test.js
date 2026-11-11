import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Store from "../models/Store.js";
import Customer from "../models/Person.js";
import Order from "../models/Order.js";
import Invoice from "../models/Invoice.js";
import * as controls from "../models/BookstoreControl.js";
import { accountAdapter } from "./accountManagementAdapter.js";
import { createBookstoreProduct, updateBookstoreProduct } from "../services/catalogService.js";
import { adjustBookstoreStock } from "../services/inventoryService.js";
import { submitAuthenticatedOrder, quoteOrder, completeOrder, requestReversal, validateReversal, applyReversal, pricedItems } from "../services/bookstoreOrders.js";
import { getProducts } from "../controllers/ProductController.js";
import { inventoryHistory } from "../services/bookstoreReads.js";
import { manageCategory } from "../services/categoryService.js";
import { clothingAvailable } from "../utils/clothingSizes.js";

process.env.JWT_SECRET = "synthetic-clothing-size-tests";
const id = () => new mongoose.Types.ObjectId();
function fixture(t) {
  const storeId = id(), customerId = id();
  const accounts = ["admin", "store_manager", "cashier", "customer"].map(role => ({ _id: id(), identifier: role, role, confirmed: true,
    accountState: "active", tokenVersion: 0, authorityVersion: 0, storeIds: [storeId] }));
  const f = accountAdapter(t, accounts, { extraModels: [Store, Customer, Invoice, ...Object.values(controls).filter(value => value?.modelName)],
    cloneValue: value => mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(value)) });
  f.store.get(Store.modelName).set(String(storeId), { _id: storeId, name: "Synthetic", createdBy: accounts[0]._id, orderCustomer: customerId });
  f.store.get(Customer.modelName).set(String(customerId), { _id: customerId, owner: accounts[0]._id, storeId, name: "Orders", isDeleted: false });
  const actor = index => ({ id: String(accounts[index]._id), role: accounts[index].role, tokenVersion: 0 });
  const body = extra => ({ storeId: String(storeId), operationId: randomUUID(), reason: "Synthetic clothing inventory change", ...extra });
  const create = (extra = {}) => createBookstoreProduct(actor(1), body({ name: "Uniform", category: "Clothing", price: 10000, sizeStocks: { S: 2, M: 3, XL: 0 }, ...extra }));
  const submit = items => submitAuthenticatedOrder(actor(2), { storeId: String(storeId), operationId: randomUUID(), items });
  const settle = async orderId => {
    const quote = await quoteOrder(actor(2), orderId, storeId);
    return completeOrder(actor(2), orderId, body({ quote: quote.quote, confirmedTotal: quote.total, paymentConfirmed: true, paymentMethod: "cash" }));
  };
  return { ...f, storeId, actor, body, create, submit, settle, product: productId => f.store.get(Product.modelName).get(productId) };
}

test("manager creates and edits all eight clothing sizes with independent whole stock counts and replay safety", async t => {
  const f = fixture(t), sizes = { XS: 1, S: 2, M: 3, L: 4, XL: 5, "2XL": 6, "3XL": 7, "4XL": 8 };
  const product = await f.create({ sizeStocks: sizes });
  assert.deepEqual(product.sizeStocks, sizes); assert.equal(product.stock, 36);
  const body = f.body({ sizeStocks: { ...sizes, M: 9 } });
  await updateBookstoreProduct(f.actor(1), product.productId, body);
  await updateBookstoreProduct(f.actor(1), product.productId, body);
  assert.equal(f.product(product.productId).stock, 42); assert.equal(f.product(product.productId).sizeStocks.M, 9);
  assert.equal(f.rows(controls.StockMovement).length, 2);
  await assert.rejects(updateBookstoreProduct(f.actor(0), product.productId, f.body({ sizeStocks: { ...sizes, M: 10 } })), error => error.statusCode === 403);
});

test("size configuration rejects other categories, invalid sizes, fractions, negatives, empty selection and overflow", async t => {
  const f = fixture(t);
  for (const sizeStocks of [{}, { XXL: 1 }, { M: -1 }, { M: 1.5 }, { M: "2" }, { M: null }, { M: Number.MAX_SAFE_INTEGER, L: 1 }]) {
    await assert.rejects(f.create({ sizeStocks }), error => error.statusCode === 400);
  }
  for (const category of ["Books", "Supplies", "Uniforms", "General"]) await assert.rejects(f.create({ category }), error => error.statusCode === 400);
  await assert.rejects(f.create({ sizeStocks: undefined }), error => error.statusCode === 400);
  assert.equal(f.rows(Product).length, 0); assert.equal(f.rows(controls.StockMovement).length, 0);
});

test("clothing checkout requires an in-stock selected size and combines duplicates per product and size", async t => {
  const f = fixture(t), { productId } = await f.create();
  for (const size of [undefined, "XS", "XL", "XXL", null]) await assert.rejects(f.submit([{ product: productId, quantity: 1, ...(size !== undefined ? { size } : {}) }]));
  await assert.rejects(f.submit([{ product: productId, size: "S", quantity: 3 }]), error => error.statusCode === 409);
  const pending = await f.submit([{ product: productId, size: "S", quantity: 1 }, { product: productId, size: "M", quantity: 1 }, { product: productId, size: "S", quantity: 1 }]);
  assert.deepEqual(pending.items.map(({ size, quantity }) => ({ size, quantity })), [{ size: "S", quantity: 2 }, { size: "M", quantity: 1 }]);
  assert.equal(f.product(productId).stock, 5);
  const sale = await f.settle(pending.orderId);
  assert.deepEqual(f.product(productId).sizeStocks, { S: 0, M: 2, XL: 0 }); assert.equal(f.product(productId).stock, 2);
  assert.deepEqual(sale.receipt.items.map(item => item.size), ["S", "M"]);
  assert.deepEqual(f.rows(Order)[0].items.map(item => item.size), ["S", "M"]);
  const movement = f.rows(controls.StockMovement).find(row => row.source === "sale");
  assert.equal(movement.delta, -3); assert.deepEqual(movement.sizeChanges.map(row => row.size), ["S", "M"]);
});

test("size stock changes between submission and payment reject overselling; audit failure rolls back all size effects", async t => {
  const f = fixture(t), { productId } = await f.create();
  const pending = await f.submit([{ product: productId, size: "S", quantity: 2 }]);
  await adjustBookstoreStock(f.actor(1), productId, f.body({ size: "S", delta: -1 }));
  await assert.rejects(f.settle(pending.orderId), error => error.statusCode === 409);
  assert.equal(f.rows(controls.BookstorePayment).length, 0);
  await adjustBookstoreStock(f.actor(1), productId, f.body({ size: "S", delta: 1 }));
  t.mock.method(controls.BookstoreAudit.collection, "insertOne", () => { throw new Error("Synthetic audit failure"); });
  await assert.rejects(f.settle(pending.orderId));
  assert.deepEqual(f.product(productId).sizeStocks, { S: 2, M: 3, XL: 0 }); assert.equal(f.product(productId).stock, 5);
  assert.equal(f.rows(controls.BookstorePayment).length, 0); assert.equal(f.rows(Invoice).length, 0);
});

test("concurrent sales cannot purchase the same final size unit twice", async t => {
  const f = fixture(t), { productId } = await f.create({ sizeStocks: { M: 1, L: 5 } });
  const a = await f.submit([{ product: productId, size: "M", quantity: 1 }]), b = await f.submit([{ product: productId, size: "M", quantity: 1 }]);
  const results = await Promise.allSettled([f.settle(a.orderId), f.settle(b.orderId)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.deepEqual(f.product(productId).sizeStocks, { M: 0, L: 5 }); assert.equal(f.product(productId).stock, 5);
});

test("size inventory adjustments require a selected size, preserve other sizes and display size movement history", async t => {
  const f = fixture(t), { productId } = await f.create();
  for (const extra of [{ delta: 1 }, { size: "XS", delta: 1 }, { size: "S", delta: -3 }]) await assert.rejects(adjustBookstoreStock(f.actor(1), productId, f.body(extra)));
  const body = f.body({ size: "XL", delta: 4 });
  await adjustBookstoreStock(f.actor(1), productId, body); await adjustBookstoreStock(f.actor(1), productId, body);
  assert.deepEqual(f.product(productId).sizeStocks, { S: 2, M: 3, XL: 4 }); assert.equal(f.product(productId).stock, 9);
  const history = await inventoryHistory(f.actor(1), f.storeId);
  assert(history.movements.some(row => row.sizeChanges?.some(change => change.size === "XL" && change.before === 0 && change.after === 4)));
});

test("returns preserve the purchased size and reject missing, mismatched, duplicate or excessive size returns", async t => {
  const f = fixture(t), { productId } = await f.create();
  const order = await f.submit([{ product: productId, size: "S", quantity: 1 }, { product: productId, size: "M", quantity: 2 }]);
  await f.settle(order.orderId);
  const request = await requestReversal(f.actor(2), order.orderId, f.body());
  const apply = returned => applyReversal(f.actor(1), request.requestId, f.body({ repaymentConfirmed: true, repaymentMethod: "cash", returnsConfirmed: true, returned }));
  for (const returned of [[{ productId, quantity: 1 }], [{ productId, size: "XL", quantity: 1 }], [{ productId, size: "S", quantity: 2 }], [{ productId, size: "M", quantity: 1 }, { productId, size: "M", quantity: 1 }]]) await assert.rejects(apply(returned), error => error.statusCode === 400);
  await apply([{ productId, size: "S", quantity: 1 }, { productId, size: "M", quantity: 1 }]);
  assert.deepEqual(f.product(productId).sizeStocks, { S: 2, M: 2, XL: 0 }); assert.equal(f.product(productId).stock, 4);
  assert.equal(f.rows(controls.StockMovement).filter(row => row.source === "return").length, 1);
});

test("non-clothing retains unsized creation, stock adjustment and checkout and rejects injected sizing", async t => {
  const f = fixture(t);
  const { productId } = await createBookstoreProduct(f.actor(1), f.body({ name: "Notebook", category: "Books", price: 1000 }));
  await adjustBookstoreStock(f.actor(1), productId, f.body({ delta: 5 }));
  await assert.rejects(adjustBookstoreStock(f.actor(1), productId, f.body({ delta: 1, size: "M" })), error => error.statusCode === 400);
  await assert.rejects(f.submit([{ product: productId, quantity: 1, size: "M" }]), error => error.statusCode === 400);
  const pending = await f.submit([{ product: productId, quantity: 2 }]);
  const sale = await f.settle(pending.orderId);
  assert.equal(f.product(productId).stock, 3); assert.equal(f.product(productId).sizeStocks, undefined);
  assert.equal(Object.hasOwn(sale.receipt.items[0], "size"), false);
});

test("inventory reads expose clothing counts only to management; cashier receives size availability only", async t => {
  const f = fixture(t), { productId } = await f.create();
  for (const index of [0, 1, 2, 3]) {
    const res = { status() { return this; }, json(body) { this.body = body; } };
    await getProducts({ user: f.actor(index), query: {}, productScope: { storeId: f.storeId } }, res);
    const product = res.body.data.find(row => String(row._id) === productId);
    assert.deepEqual(product.sizes, [{ size: "S", available: true }, { size: "M", available: true }, { size: "XL", available: false }]);
    assert.equal(Object.hasOwn(product, "sizeStocks"), index < 2);
    if (index < 2) assert.deepEqual(product.sizeStocks, { S: 2, M: 3, XL: 0 });
  }
});

test("historical clothing stock requires explicit allocation; category edits preserve allocated sizes", async t => {
  const f = fixture(t), productId = String(id());
  f.store.get(Product.modelName).set(productId, { _id: new mongoose.Types.ObjectId(productId), owner: f.actor(0).id, storeId: f.storeId, name: "Old uniform", category: "Clothing", price: 1000, stock: 4, isActive: true, moneyUnit: "PHP-centavos" });
  assert.equal(Boolean(clothingAvailable(f.product(productId))), false);
  await assert.rejects(pricedItems([{ product: productId, quantity: 1 }], { storeId: f.storeId }), error => error.statusCode === 400);
  await updateBookstoreProduct(f.actor(1), productId, f.body({ sizeStocks: { M: 4 } }));
  assert.equal(f.product(productId).stock, 4); assert(clothingAvailable(f.product(productId)));
  await updateBookstoreProduct(f.actor(1), productId, f.body({ category: "Supplies" }));
  assert.deepEqual(f.product(productId).sizeStocks, { M: 4 }); assert.equal(f.product(productId).stock, 4);
});

test("category rename away from Clothing preserves sizing and aggregate stock", async t => {
  const f = fixture(t), { productId } = await f.create();
  await manageCategory(f.actor(1), f.body({ action: "rename", name: "Clothing", newName: "Supplies" }));
  assert.equal(f.product(productId).category, "Supplies"); assert.equal(f.product(productId).stock, 5); assert.deepEqual(f.product(productId).sizeStocks, { S: 2, M: 3, XL: 0 });
});

test("pending M uniform still quotes and completes after Clothing is renamed to Uniforms", async t => {
  const f = fixture(t), { productId } = await f.create();
  const pending = await f.submit([{ product: productId, size: "M", quantity: 1 }]);
  const originalItems = JSON.parse(JSON.stringify(f.rows(Order)[0].items));
  await manageCategory(f.actor(1), f.body({ action: "rename", name: "Clothing", newName: "Uniforms" }));
  assert.deepEqual(f.product(productId).sizeStocks, { S: 2, M: 3, XL: 0 });
  const quoted = await quoteOrder(f.actor(2), pending.orderId, f.storeId);
  assert.equal(quoted.items[0].size, "M"); assert.equal(quoted.total, 10000);
  assert.deepEqual(JSON.parse(JSON.stringify(f.rows(Order)[0].items)), originalItems);
  const sale = await f.settle(pending.orderId);
  assert.equal(sale.receipt.items[0].size, "M"); assert.equal(f.product(productId).sizeStocks.M, 2);
  const res = { status() { return this; }, json(body) { this.body = body; } };
  await getProducts({ user: f.actor(2), query: {}, productScope: { storeId: f.storeId } }, res);
  assert.deepEqual(res.body.data[0].sizes, [{ size: "S", available: true }, { size: "M", available: true }, { size: "XL", available: false }]);
});

for (const change of ["rename", "remove"]) test(`saleable M return survives ${change} and preserves historical sale and exact inventory`, async t => {
  const f = fixture(t), { productId } = await f.create({ sizeStocks: { S: 2, M: 1 } });
  const pending = await f.submit([{ product: productId, size: "M", quantity: 1 }]);
  await f.settle(pending.orderId);
  const originalItems = JSON.parse(JSON.stringify(f.rows(Order)[0].items)), snapshot = structuredClone(f.rows(Invoice)[0].snapshot);
  if (change === "rename") await manageCategory(f.actor(1), f.body({ action: "rename", name: "Clothing", newName: "Uniforms" }));
  else await updateBookstoreProduct(f.actor(1), productId, f.body({ sizeStocks: { S: 2 } }));
  const request = await requestReversal(f.actor(2), pending.orderId, f.body());
  const returned = [{ productId, size: "M", quantity: 1 }];
  const checked = await validateReversal(f.actor(1), request.requestId, { storeId: String(f.storeId), returned });
  assert.equal(checked.eligible, true); assert.equal(f.rows(controls.SaleReversal).length, 0);
  assert.equal(f.product(productId).stock, 2);
  const body = f.body({ repaymentConfirmed: true, repaymentMethod: "cash", returnsConfirmed: true, returned });
  const result = await applyReversal(f.actor(1), request.requestId, body);
  assert.deepEqual(await applyReversal(f.actor(1), request.requestId, body), result);
  await assert.rejects(applyReversal(f.actor(1), request.requestId, { ...body, operationId: randomUUID() }), e => e.statusCode === 409);
  assert.equal(f.rows(controls.SaleReversal).length, 1);
  assert.deepEqual(f.product(productId).sizeStocks, { S: 2, M: 1 }); assert.equal(f.product(productId).stock, 3);
  const movements = f.rows(controls.StockMovement), returns = movements.filter(row => row.source === "return");
  assert.equal(returns.length, 1); assert.equal(String(returns[0].productId), productId);
  assert.deepEqual(returns[0].sizeChanges, [{ size: "M", before: 0, after: 1, delta: 1 }]);
  assert.equal(movements.reduce((sum, row) => sum + row.delta, 0), f.product(productId).stock);
  assert.deepEqual(JSON.parse(JSON.stringify(f.rows(Order)[0].items)), originalItems); assert.deepEqual(f.rows(Invoice)[0].snapshot, snapshot);
});

test("incompatible size removal for a pending order and unallocated category changes fail before saving", async t => {
  const f = fixture(t), { productId } = await f.create({ sizeStocks: { S: 2, M: 1 } });
  await f.submit([{ product: productId, size: "M", quantity: 1 }]);
  await adjustBookstoreStock(f.actor(1), productId, f.body({ size: "M", delta: -1 }));
  const audits = f.rows(controls.BookstoreAudit).length, movements = f.rows(controls.StockMovement).length;
  await assert.rejects(updateBookstoreProduct(f.actor(1), productId, f.body({ sizeStocks: { S: 2 } })), e => e.statusCode === 409);
  assert.deepEqual(f.product(productId).sizeStocks, { S: 2, M: 0 });
  assert.equal(f.rows(controls.BookstoreAudit).length, audits); assert.equal(f.rows(controls.StockMovement).length, movements);
  const legacy = f.product(productId); delete legacy.sizeStocks; legacy.stock = 2;
  await assert.rejects(manageCategory(f.actor(1), f.body({ action: "rename", name: "Clothing", newName: "Uniforms" })), e => e.statusCode === 409);
  assert.equal(f.product(productId).category, "Clothing");
});

test("unsized pending and historical sales cannot be converted into incompatible sized inventory", async t => {
  const f = fixture(t);
  const { productId } = await createBookstoreProduct(f.actor(1), f.body({ name: "Notebook", category: "Books", price: 1000 }));
  await adjustBookstoreStock(f.actor(1), productId, f.body({ delta: 2 }));
  const pending = await f.submit([{ product: productId, quantity: 1 }]);
  const edit = () => updateBookstoreProduct(f.actor(1), productId, f.body({ category: "Clothing", sizeStocks: { M: 2 } }));
  await assert.rejects(edit(), e => e.statusCode === 409);
  await f.settle(pending.orderId); await assert.rejects(edit(), e => e.statusCode === 409);
  assert.equal(f.product(productId).category, "Books"); assert.equal(f.product(productId).sizeStocks, undefined);
});

test("failed return rolls back refund, request, invoice, stock and movements; same-operation retry records once", async t => {
  const f = fixture(t), { productId } = await f.create({ sizeStocks: { S: 2, M: 1 } });
  const pending = await f.submit([{ product: productId, size: "M", quantity: 1 }]); await f.settle(pending.orderId);
  await updateBookstoreProduct(f.actor(1), productId, f.body({ sizeStocks: { S: 2 } }));
  const request = await requestReversal(f.actor(2), pending.orderId, f.body());
  const body = f.body({ repaymentConfirmed: true, repaymentMethod: "cash", returnsConfirmed: true, returned: [{ productId, size: "M", quantity: 1 }] });
  const originalInsert = controls.BookstoreAudit.collection.insertOne;
  const fault = t.mock.method(controls.BookstoreAudit.collection, "insertOne", () => { throw Error("Synthetic reversal audit failure"); });
  await assert.rejects(applyReversal(f.actor(1), request.requestId, body));
  assert.equal(f.rows(controls.SaleReversal).length, 0); assert.equal(f.rows(controls.ReversalRequest)[0].status, "requested");
  assert.equal(f.rows(Order)[0].reversalId, undefined); assert.equal(f.rows(Invoice)[0].reversalId, undefined);
  assert.deepEqual(f.product(productId).sizeStocks, { S: 2 }); assert.equal(f.product(productId).stock, 2);
  assert.equal(f.rows(controls.StockMovement).filter(row => row.source === "return").length, 0);
  fault.mock.mockImplementation(originalInsert);
  await applyReversal(f.actor(1), request.requestId, body); await applyReversal(f.actor(1), request.requestId, body);
  assert.equal(f.rows(controls.SaleReversal).length, 1); assert.equal(f.product(productId).sizeStocks.M, 1);
});

test("return preflight rejects unauthorized staff and mismatched historical size without recording a refund", async t => {
  const f = fixture(t), { productId } = await f.create();
  const pending = await f.submit([{ product: productId, size: "M", quantity: 1 }]); await f.settle(pending.orderId);
  const request = await requestReversal(f.actor(2), pending.orderId, f.body());
  const body = { storeId: String(f.storeId), returned: [{ productId, size: "M", quantity: 1 }] };
  for (const index of [0, 2, 3]) await assert.rejects(validateReversal(f.actor(index), request.requestId, body), e => e.statusCode === 403);
  await assert.rejects(validateReversal(f.actor(1), request.requestId, { ...body, returned: [{ productId, size: "S", quantity: 1 }] }), e => e.statusCode === 400);
  assert.equal(f.rows(controls.SaleReversal).length, 0);
});
