import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";
import { bookstoreViews } from "../src/features/bookstore/presentation.js";

async function compile(path, replacements = {}) {
  const source = await fs.readFile(new URL(path, import.meta.url), "utf8");
  const compiled = await transformWithOxc(source, "Manager.jsx", { jsx: { runtime: "automatic", development: false } });
  let code = compiled.code;
  for (const [name, url] of Object.entries({ react: import.meta.resolve("react"), "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"), ...replacements })) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
const clothing = await compile("../src/features/products/components/ClothingSizes.jsx", { "../clothingSizes.js": new URL("../src/features/products/clothingSizes.js", import.meta.url).href });
const ui = await compile("../src/shared/components/BookstoreUI.jsx");
const controls = await compile("../src/shared/components/ProductListControls.jsx");
const table = await compile("../src/features/products/components/ManagerProductsTable.jsx", {
  "../../../shared/components/BookstoreUI.jsx": ui,
  "../../../shared/components/ProductListControls.jsx": controls,
  "../../bookstore/money.js": new URL("../src/features/bookstore/money.js", import.meta.url).href,
});
const components = await compile("../src/features/products/components/ManagerProductManagement.jsx", {
  "./ManagerProductsTable.jsx": table,
  "./ClothingSizes.jsx": clothing,
  "../clothingSizes.js": new URL("../src/features/products/clothingSizes.js", import.meta.url).href,
  "../../../shared/components/BookstoreUI.jsx": ui,
  "../../bookstore/money.js": new URL("../src/features/bookstore/money.js", import.meta.url).href,
});
const { default: ManagerProductManagement, ManagerCategoryManagement } = await import(components);
const props = { command() {}, disabled: false, mutationDisabled: true, reason: "", onReasonChange() {} };

test("manager navigation removes catalog and queue even when order capabilities remain available", () => {
  const views = bookstoreViews({ role: "store_manager", capabilities: { "catalog.create": true, "product.manage": true, "category.manage": true, "order.fulfill": true, "order.oversee": true, "inventory.history.read": true } });
  assert.deepEqual(views.map(view => view.id), ["overview", "products", "categories", "inventory"]);
  assert.equal(views.some(view => /catalog|queue/i.test(view.name)), false);
  assert.equal(views.find(view => view.id === "products").name, "Products & Categories");
});

test("manager product management lists shared products and exposes editing without an initial audit reason", () => {
  const html = renderToStaticMarkup(createElement(ManagerProductManagement, { ...props, products: [{ _id: "shared-book", name: "Textbook", sku: "BOOK", category: "Books", price: 15050, stock: 8, isActive: true, moneyUnit: "PHP-centavos" }], categories: [{ name: "Books" }] }));
  for (const text of ["Manage products", "Textbook", "Books", "PHP 150.50", "Edit product"]) assert(html.includes(text));
  assert(html.includes('class="secondary-action">Edit product</button>')); // opening the editor does not require the reason used when saving
});

test("category management includes unused categories and rename/delete controls", () => {
  const html = renderToStaticMarkup(createElement(ManagerCategoryManagement, { ...props, categories: [{ name: "Books", productCount: 5 }, { name: "Supplies", productCount: 0 }] }));
  for (const text of ["Create category", "Manage categories", "Books", "Supplies", "Rename", "Delete"]) assert(html.includes(text));
});

test("manager editor exposes metadata without a price or inventory input", async () => {
  const react = `let index = 0; export function useState(value) { return [index++ === 0 ? { id: "shared-book", name: "Textbook", sku: "BOOK", category: "Books", isActive: true } : value, () => {}]; }`;
  const editor = await compile("../src/features/products/components/ManagerProductManagement.jsx", {
    "./ManagerProductsTable.jsx": table,
    react: `data:text/javascript;base64,${Buffer.from(react).toString("base64")}`,
    "./ClothingSizes.jsx": clothing,
  "../clothingSizes.js": new URL("../src/features/products/clothingSizes.js", import.meta.url).href,
  "../../../shared/components/BookstoreUI.jsx": ui,
    "../../bookstore/money.js": new URL("../src/features/bookstore/money.js", import.meta.url).href,
  });
  const { default: Editor } = await import(editor);
  const html = renderToStaticMarkup(createElement(Editor, { ...props, products: [], categories: [{ name: "Books" }] }));
  for (const text of ["Edit product", "SKU", "Active product", "Save product", "Price changes require an Administrator."]) assert(html.includes(text));
  assert(!html.includes("Price (PHP)"));
  assert(!html.includes('type="number"'));
});
