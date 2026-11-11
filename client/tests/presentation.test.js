import test from "node:test";
import assert from "node:assert/strict";
import { bookstoreViews, CANCELLATION_BLOCKER, filterCatalog, ROLE_LABELS } from "../src/features/bookstore/presentation.js";

const context = (role, keys, extra = {}) => ({ role, capabilities: Object.fromEntries(keys.map(key => [key, true])), ...extra });
test("student workspace offers catalog and owned orders without staff workspaces", () => {
  assert.deepEqual(bookstoreViews(context("customer", ["order.submit", "order.status.own"])).map(row => row.id), ["overview", "catalog", "my-orders"]);
});
test("cashier workspace separates own history and reversal requests from inventory and settings", () => {
  assert.deepEqual(bookstoreViews(context("cashier", ["order.fulfill", "salesHistory.own", "reversal.request"])).map(row => row.id), ["catalog", "queue", "history", "reversals"]);
});
test("manager workspace exposes operational views without account administration", () => {
  assert.deepEqual(bookstoreViews(context("store_manager", ["order.oversee", "inventory.history.read", "salesHistory.all", "reversal.apply"])).map(row => row.id), ["overview", "products", "categories", "inventory", "history", "reversals"]);
  assert.match(CANCELLATION_BLOCKER, /AR01 authorization correction/);
});
test("administrator navigation follows returned capabilities and preserves settings", () => {
  assert.deepEqual(bookstoreViews(context("admin", ["catalog.manage", "product.price.write", "inventory.history.read", "salesHistory.all"], { canManageAccounts: true })).map(row => row.id), ["overview", "catalog", "inventory", "history", "settings"]);
  assert.equal(ROLE_LABELS.admin, "Administrator");
});
test("missing context and legacy accounts do not expose operational views", () => {
  assert.deepEqual(bookstoreViews(null).map(row => row.id), ["overview"]);
  assert.deepEqual(bookstoreViews({ legacyReadOnly: true, capabilities: { "order.fulfill": true } }).map(row => row.id), ["overview"]);
});
test("catalog search intersects category, matches SKU, and retains unavailable products", () => {
  const products = [{ name: "Notebook", sku: "NB-1", category: "Books", availability: false }, { name: "Pen", category: "Supplies", availability: true }];
  assert.deepEqual(filterCatalog(products, "  nb-1 ", "Books"), [products[0]]);
  assert.deepEqual(filterCatalog(products, "pen", "Books"), []);
  assert.deepEqual(filterCatalog(products, "", "All products"), products);
  assert.equal(products.length, 2);
});
