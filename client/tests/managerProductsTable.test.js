import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { setImmediate } from "node:timers/promises";
import { transformWithOxc } from "vite";

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  if (["ProductListFilters", "ProductListPagination"].includes(node.type?.name)) return nodes(node.type(node.props));
  return [node, ...nodes(node.props?.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (["ProductListFilters", "ProductListPagination"].includes(node?.type?.name)) return text(node.type(node.props));
  if (node && typeof node === "object") return [node.props?.title, text(node.props?.children)].filter(Boolean).join(" ");
  return node == null || typeof node === "boolean" ? "" : String(node);
}
async function fixture(t, count = 125) {
  const key = `productsTest${crypto.randomUUID().replaceAll("-", "")}`;
  const memory = [], effects = [], calls = [], edits = [];
  let cursor = 0, dirty = false, loadError = null, commandError = null, protectedProduct = false;
  const products = Array.from({ length: count }, (_, i) => ({ _id: `id-${i}`, name: `Book ${String(i).padStart(3, "0")}`, sku: `SKU-${i}`, category: i % 2 ? "Books" : "Supplies", price: i * 100, isActive: i % 3 !== 0, moneyUnit: "PHP-centavos" }));
  const harness = {
    state(initial) { const i = cursor++; if (!(i in memory)) memory[i] = initial; return [memory[i], value => { const next = typeof value === "function" ? value(memory[i]) : value; dirty ||= !Object.is(next, memory[i]); memory[i] = next; }]; },
    ref(initial) { const i = cursor++; if (!(i in memory)) memory[i] = { current: initial }; return memory[i]; },
    callback(work, deps) { const i = cursor++, prior = memory[i]; if (!prior || deps.some((value, j) => value !== prior.deps[j])) memory[i] = { deps, work }; return memory[i].work; },
    effect(work, deps) { const i = cursor++, prior = memory[i]; if (!prior || deps.some((value, j) => value !== prior.deps[j])) { prior?.cleanup?.(); memory[i] = { deps }; effects.push(() => { memory[i].cleanup = work(); }); } },
  };
  globalThis[key] = harness;
  t.after(() => { memory.forEach(value => value?.cleanup?.()); delete globalThis[key]; });
  const props = {
    categories: [{ name: "Books" }, { name: "Supplies" }], storeId: "store", refreshVersion: 0, disabled: false, mutationDisabled: false, reason: "Approved cleanup", onReasonChange() {}, onEdit: product => edits.push(product),
    api: { async get(path, { params, signal } = {}) {
      calls.push({ path, params: structuredClone(params) });
      if (loadError) throw loadError;
      if (path !== "/products") return { data: { data: { deletion: { canDelete: !protectedProduct, reason: "This product has transaction history." } } } };
      const filtered = products.filter(product => (!params.category || product.category === params.category) && (!params.isActive || product.isActive === (params.isActive === "true")) && `${product.name} ${product.sku}`.toLowerCase().includes(params.search.trim().toLowerCase()))
        .sort((a, b) => (params.sortBy === "price" ? a.price - b.price : a[params.sortBy].localeCompare(b[params.sortBy])) * (params.sortDirection === "asc" ? 1 : -1));
      const page = Math.min(params.page, Math.max(1, Math.ceil(filtered.length / params.limit)));
      assert.equal(signal.aborted, false);
      return { data: { data: filtered.slice((page - 1) * params.limit, page * params.limit), pagination: { page, total: filtered.length, pages: Math.ceil(filtered.length / params.limit) } } };
    } },
    async command(verb, path, body) {
      calls.push({ verb, path, body });
      if (commandError) throw commandError;
      const index = products.findIndex(product => path === `/products/${product._id}`);
      if (body.deletionMode === "permanent") products.splice(index, 1); else products[index].isActive = false;
      return { productId: path.split("/").at(-1), deleted: body.deletionMode === "permanent" };
    },
  };
  const source = await fs.readFile(new URL("../src/features/products/components/ManagerProductsTable.jsx", import.meta.url), "utf8");
  const controlsSource = await fs.readFile(new URL("../src/shared/components/ProductListControls.jsx", import.meta.url), "utf8");
  const controls = moduleUrl((await transformWithOxc(controlsSource, "ProductListControls.jsx", { jsx: { runtime: "automatic", development: false } })).code.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime"))));
  let code = (await transformWithOxc(source, "ManagerProductsTable.jsx", { jsx: { runtime: "automatic", development: false } })).code;
  const replacements = {
    react: moduleUrl(`export const useState = value => globalThis.${key}.state(value); export const useRef = value => globalThis.${key}.ref(value); export const useCallback = (work,deps) => globalThis.${key}.callback(work,deps); export const useEffect = (work,deps) => globalThis.${key}.effect(work,deps);`),
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "../../../shared/components/BookstoreUI.jsx": moduleUrl("export function EmptyState() {} export function Modal() {} export function Notice() {} export function Panel() {}"),
    "../../../shared/components/ProductListControls.jsx": controls,
    "../../bookstore/money.js": new URL("../src/features/bookstore/money.js", import.meta.url).href,
  };
  for (const [name, url] of Object.entries(replacements)) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
  const { default: Table } = await import(moduleUrl(code));
  const render = () => { cursor = 0; return Table(props); };
  const elements = () => nodes(render());
  const button = name => elements().find(node => node.type === "button" && text(node.props.children).trim() === name);
  const select = label => {
    const row = elements().find(node => node.type === "label" && text(node.props.children).startsWith(label));
    return nodes(row).find(node => node.type === "select");
  };
  const flush = async () => { for (let i = 0; i < 15; i++) { dirty = false; render(); effects.splice(0).forEach(work => work()); await setImmediate(); if (!dirty && !effects.length) return; } throw Error("Product table hook state did not settle"); };
  const confirm = async () => elements().find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
  await flush();
  return { calls, edits, products, props, render, elements, button, select, flush, confirm, text: () => text(render()),
    protect() { protectedProduct = true; }, failLoad(error) { loadError = error; }, failCommand(error) { commandError = error; },
    search(value) { elements().find(node => node.type === "input").props.onChange({ target: { value } }); },
  };
}

test("manager table loads ten rows, paginates, highlights current page and supports every page size", async t => {
  const f = await fixture(t);
  assert.equal(f.elements().filter(node => node.type === "tr").length, 11);
  assert(f.text().includes("Showing 1–10 of 125 products")); assert.equal(f.calls[0].params.management, true);
  f.button("Next").props.onClick(); await f.flush();
  assert(f.text().includes("Showing 11–20 of 125 products"));
  assert.equal(f.elements().find(node => node.props["aria-label"] === "Page 2").props["aria-current"], "page");
  f.button("Previous").props.onClick(); await f.flush();
  for (const limit of [10, 20, 50, 100]) {
    f.select("Products per page").props.onChange({ target: { value: String(limit) } }); await f.flush();
    assert.equal(f.elements().filter(node => node.type === "tr").length, limit + 1);
    assert(f.text().includes(`Showing 1–${limit} of 125 products`));
  }
});

test("manager table combines name/SKU search, category, availability and sorting and resets page", async t => {
  const f = await fixture(t); f.button("Next").props.onClick(); await f.flush();
  f.search("SKU-11"); await f.flush(); assert.equal(f.calls.at(-1).params.page, 1);
  assert(f.text().includes("Book 011"));
  f.search("Book 0"); f.select("Category").props.onChange({ target: { value: "Books" } });
  f.select("Availability").props.onChange({ target: { value: "false" } });
  f.select("Sort by").props.onChange({ target: { value: "price:desc" } }); await f.flush();
  const params = f.calls.at(-1).params;
  assert.equal(params.search, "Book 0"); assert.equal(params.category, "Books"); assert.equal(params.isActive, "false");
  assert.equal(params.sortBy, "price"); assert.equal(params.sortDirection, "desc"); assert.equal(params.page, 1);
  f.search("no-such-product"); await f.flush(); assert(f.text().includes("No matching products")); assert(f.text().includes("Showing 0–0 of 0 products"));
});

test("manager Delete opens named confirmation, Cancel makes no mutation, confirmation refreshes the table", async t => {
  const f = await fixture(t, 11);
  f.button("Next").props.onClick(); await f.flush();
  await f.button("Delete").props.onClick(); assert(f.text().includes("Book 010")); assert(f.text().includes("This action cannot be undone"));
  f.button("Cancel").props.onClick(); assert.equal(f.calls.filter(call => call.verb).length, 0);
  await f.button("Delete").props.onClick(); await f.confirm(); await f.flush();
  assert.deepEqual(f.calls.find(call => call.verb).body, { deletionMode: "permanent" });
  assert.equal(f.products.length, 10); assert(f.text().includes("deleted successfully"));
  assert(f.text().includes("Showing 1–10 of 10 products"));
});

test("manager protected products offer Archive and retain product data", async t => {
  const f = await fixture(t, 2); f.protect();
  const product = { ...f.products[0] }; product.isActive = true; Object.assign(f.products[0], product);
  await f.button("Delete").props.onClick();
  assert(f.text().includes("transaction history")); assert.equal(f.button("Confirm Delete"), undefined);
  assert(f.button("Confirm Archive")); await f.confirm(); await f.flush();
  assert.deepEqual(f.calls.find(call => call.verb).body, {}); assert.equal(f.products.length, 2);
  assert.deepEqual(f.products[0], { ...product, isActive: false }); assert(f.text().includes("archived successfully"));
});

test("manager table handles loading errors and deletion failures without dispatching unsafe actions", async t => {
  const f = await fixture(t, 2);
  f.failLoad(new Error("Temporary outage")); f.props.refreshVersion++; await f.flush();
  assert(f.text().includes("Temporary outage")); assert(f.button("Retry products"));
  f.failLoad(null); f.button("Retry products").props.onClick(); await f.flush();
  await f.button("Delete").props.onClick(); f.failCommand(new Error("Deletion rejected"));
  await f.confirm(); assert.equal(f.products.length, 2); assert(f.text().includes("Deletion rejected"));
  f.button("Cancel").props.onClick();
  f.failLoad(new Error("Reference check unavailable")); await f.button("Delete").props.onClick();
  assert.equal(f.button("Confirm Delete"), undefined); assert(f.button("Retry reference check"));
});

test("manager Edit retains the existing selected-product callback and deletion requires an audit reason", async t => {
  const f = await fixture(t, 2); f.button("Edit product").props.onClick(); assert.equal(f.edits[0]._id, "id-0");
  f.props.mutationDisabled = true; await f.button("Delete").props.onClick();
  assert.equal(f.button("Confirm Delete").props.disabled, true); await f.confirm();
  assert.equal(f.calls.filter(call => call.verb).length, 0);
});
