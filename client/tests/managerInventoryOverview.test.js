import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
async function compile(path, replacements = {}) {
  const source = await fs.readFile(new URL(path, import.meta.url), "utf8");
  let { code } = await transformWithOxc(source, "Inventory.jsx", { jsx: { runtime: "automatic", development: false } });
  for (const [name, url] of Object.entries({ react: import.meta.resolve("react"), "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"), ...replacements })) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
  return moduleUrl(code);
}
const controls = await compile("../src/shared/components/ProductListControls.jsx");
const ui = await compile("../src/shared/components/BookstoreUI.jsx");
const imports = {
  "../../shared/components/ProductListControls.jsx": controls,
  "../../shared/components/BookstoreUI.jsx": ui,
  "../products/clothingSizes.js": new URL("../src/features/products/clothingSizes.js", import.meta.url).href,
  "./presentation.js": new URL("../src/features/bookstore/presentation.js", import.meta.url).href,
};
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  if (typeof node.type === "function") return nodes(node.type(node.props));
  return [node, ...nodes(node.props?.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (node && typeof node === "object") return text(node.props?.children);
  return node == null || typeof node === "boolean" ? "" : String(node);
}
async function fixture(t, count = 125) {
  const key = `inventoryTest${crypto.randomUUID().replaceAll("-", "")}`;
  let value;
  globalThis[key] = { state(initial) { value ??= initial; return [value, update => { value = typeof update === "function" ? update(value) : update; }]; } };
  t.after(() => { delete globalThis[key]; });
  const { default: Overview } = await import(await compile("../src/features/bookstore/InventoryOverview.jsx", {
    ...imports, react: moduleUrl(`export const useState = initial => globalThis.${key}.state(initial);`),
  }));
  const products = Array.from({ length: count }, (_, i) => ({ _id: `id-${i}`, name: `Book ${String(i).padStart(3, "0")}`, sku: `SKU-${i}`, category: i % 2 ? "Books" : "Supplies", availability: i % 3 !== 0, stock: i * 2, isActive: i % 6 !== 0 }));
  const adjustments = [], props = { products, canAdjust: product => product._id !== "id-1", disabled: false, onAdjust: product => adjustments.push(product) };
  const elements = () => nodes(Overview(props));
  const select = label => nodes(elements().find(node => node.type === "label" && text(node).startsWith(label))).find(node => node.type === "select");
  const button = name => elements().find(node => node.type === "button" && text(node).trim() === name);
  const change = (label, next) => select(label).props.onChange({ target: { value: String(next) } });
  const rows = () => elements().filter(node => node.type === "tr").slice(1);
  return { products, props, adjustments, elements, select, button, change, rows, text: () => elements().map(text).join(" "), search: next => elements().find(node => node.type === "input").props.onChange({ target: { value: next } }) };
}

test("inventory paginates the full catalog, highlights pages, disables boundaries and supports all page sizes", async t => {
  const f = await fixture(t);
  assert.equal(f.rows().length, 10);
  assert(f.text().includes("Showing 1–10 of 125 products"));
  assert.equal(f.button("Previous").props.disabled, true);
  f.button("Next").props.onClick();
  assert(f.text().includes("Showing 11–20 of 125 products"));
  assert.equal(f.elements().find(node => node.props["aria-label"] === "Page 2").props["aria-current"], "page");
  f.button("13").props.onClick();
  assert(f.text().includes("Showing 121–125 of 125 products"));
  assert.equal(f.rows().length, 5);
  assert.equal(f.button("Next").props.disabled, true);
  f.button("Previous").props.onClick();
  assert(f.text().includes("Showing 111–120 of 125 products"));
  for (const size of [10, 25, 50, 100]) {
    f.change("Products per page", size);
    assert.equal(f.rows().length, size);
    assert(f.text().includes(`Showing 1–${size} of 125 products`));
    assert.equal(f.button("Previous").props.disabled, true);
  }
});

test("inventory combines case-insensitive name/SKU search, category, availability and sort before counting and paging", async t => {
  const f = await fixture(t);
  const original = structuredClone(f.products);
  f.search("  sKu-11  ");
  assert.deepEqual(f.rows().map(text).map(row => row.match(/SKU-\d+/)[0]), [11, 110, 111, 112, 113, 114, 115, 116, 117, 118].map(id => `SKU-${id}`));
  assert(f.text().includes("Showing 1–10 of 11 products"));
  f.search(" bOoK 0 ");
  f.change("Category", "Books");
  f.change("Availability", "false");
  f.change("Sort by", "stock:desc");
  assert(f.text().includes("Showing 1–10 of 17 products"));
  assert.deepEqual(f.rows().map(row => Number(text(row).match(/SKU-(\d+)/)[1])), [99, 93, 87, 81, 75, 69, 63, 57, 51, 45]);
  f.button("Next").props.onClick();
  assert.equal(f.rows().length, 7);
  assert(f.text().includes("Showing 11–17 of 17 products"));
  assert.equal(f.button("Next").props.disabled, true);
  assert.deepEqual(f.products, original);
});

test("each filter, sort and page size resets inventory pagination to the first matching page", async t => {
  const f = await fixture(t);
  for (const apply of [() => f.search("Book"), () => f.change("Category", "Supplies"), () => f.change("Availability", "true"), () => f.change("Sort by", "name:desc"), () => f.change("Products per page", 25)]) {
    f.button("Next").props.onClick();
    assert.equal(f.button("Previous").props.disabled, false);
    apply();
    assert.equal(f.button("Previous").props.disabled, true);
    assert.equal(f.elements().find(node => node.props["aria-current"] === "page").props["aria-label"], "Page 1");
  }
  assert.equal(f.rows().length, 25);
  assert(text(f.rows()[0]).includes("Book 124"));
});

test("inventory empty states show zero filtered results and disabled navigation", async t => {
  const f = await fixture(t);
  f.search("missing product");
  assert(f.text().includes("No matching products"));
  assert(f.text().includes("Showing 0–0 of 0 products"));
  assert.equal(f.rows().length, 0);
  assert.equal(f.button("Previous").props.disabled, true);
  assert.equal(f.button("Next").props.disabled, true);
  f.search("");
  assert.equal(f.rows().length, 10);
  f.props.products = [];
  assert(f.text().includes("Showing 0–0 of 0 products"));
});

test("inventory preserves stock adjustment permissions, selected product callbacks and clothing sizes", async t => {
  const f = await fixture(t, 2);
  Object.assign(f.products[0], { category: "Clothing", stock: 9, sizeStocks: { S: 4, M: 5 } });
  assert.match(f.text(), /S\s*:\s*4/); assert.match(f.text(), /M\s*:\s*5/);
  assert.equal(f.elements().filter(node => node.type === "button" && text(node) === "Adjust stock").length, 1);
  f.button("Adjust stock").props.onClick();
  assert.equal(f.adjustments[0], f.products[0]);
  f.props.disabled = true;
  assert.equal(f.button("Adjust stock").props.disabled, true);
});

test("other roles retain the complete inventory table without search, filters or pagination", async () => {
  const { InventoryProductsTable } = await import(await compile("../src/features/bookstore/InventoryOverview.jsx", imports));
  const products = Array.from({ length: 15 }, (_, i) => ({ _id: String(i), name: `Product ${i}`, category: "Books", stock: i, availability: i > 0 }));
  const html = renderToStaticMarkup(createElement(InventoryProductsTable, { products, canAdjust: () => false }));
  assert.equal((html.match(/<tr>/g) || []).length, 16);
  for (const label of ["Search products", "Products per page", "Previous", "Next", "Adjust stock"]) assert(!html.includes(label));
});
