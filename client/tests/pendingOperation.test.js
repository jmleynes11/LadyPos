import test from "node:test";
import assert from "node:assert/strict";
import { readPending, savePending, clearPending, clearSessionPreservingPending } from "../src/features/bookstore/pendingOperation.js";
import { canUseResource } from "../src/features/bookstore/capability.js";
const accountId = "a".repeat(24), storeId = "b".repeat(24);
const marker = { accountId, operationId: "synthetic-command-123", storeId, setup: false };
function storage() { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; }
test("pending operation survives remount and stays isolated by account without request data", () => {
  const browser = storage(); savePending(browser, marker);
  assert.deepEqual(readPending(browser, accountId), marker);
  assert.equal(readPending(browser, "c".repeat(24)), null);
  assert.throws(() => savePending(browser, { ...marker, paymentReference: "private" }));
  clearPending(browser, accountId); assert.equal(readPending(browser, accountId), null);
});
test("unavailable, corrupt or silently failing browser storage blocks dispatch", () => {
  assert.throws(() => savePending({ setItem() {}, getItem: () => null }, marker));
  assert.throws(() => readPending({ getItem: () => "broken" }, accountId));
  assert.throws(() => readPending({ getItem: () => JSON.stringify({ ...marker, accountId: "c".repeat(24) }) }, accountId));
  assert.throws(() => savePending({ setItem() { throw Error("Storage unavailable"); } }, marker));
});
test("logout clears credentials but retains only account-bound reconciliation metadata", () => {
  const values = new Map();
  const browser = { ...storage(), get length() { return values.size; }, key: index => [...values.keys()][index], getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), clear: () => values.clear() };
  savePending(browser, marker); browser.setItem("jwt", "synthetic-secret"); browser.setItem("user", "cached-admin");
  browser.setItem("bookstore.pending." + "c".repeat(24), JSON.stringify({ ...marker, password: "do-not-retain" }));
  clearSessionPreservingPending(browser);
  assert.equal(browser.getItem("jwt"), null); assert.equal(browser.getItem("user"), null);
  assert.deepEqual(readPending(browser, accountId), marker);
  assert.equal(JSON.stringify([...values]).includes("do-not-retain"), false);
  assert.throws(() => readPending(browser, "c".repeat(24)));
});
test("conditional frontend actions require the actual resource bound by server capabilities", () => {
  const context = { capabilities: { "inventory.adjust": true, "catalog.manage": true }, conditionalResources: { "inventory.adjust": [storeId] } };
  assert.equal(canUseResource(context, "inventory.adjust", storeId), true);
  assert.equal(canUseResource(context, "inventory.adjust", accountId), false);
  assert.equal(canUseResource(context, "inventory.adjust"), false);
  assert.equal(canUseResource(context, "catalog.manage"), true);
  assert.equal(canUseResource(context, "account.assignRole", storeId), false);
});
