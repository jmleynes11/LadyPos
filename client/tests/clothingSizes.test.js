import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";
import { cartLine, lineKey } from "../src/features/products/clothingSizes.js";

const source = await fs.readFile(new URL("../src/features/products/components/ClothingSizes.jsx", import.meta.url), "utf8");
const compiled = await transformWithOxc(source, "Sizes.jsx", { jsx: { runtime: "automatic", development: false } });
const code = compiled.code.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
  .replaceAll('"../clothingSizes.js"', JSON.stringify(new URL("../src/features/products/clothingSizes.js", import.meta.url).href));
const { ClothingSizeFields, ClothingSizeSelect } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object") return [];
  return [node, ...elements(node.props?.children)];
}

test("size controls render only for the Clothing category", () => {
  for (const category of ["Books", "Supplies", "General", "Uniforms", ""]) {
    assert.equal(renderToStaticMarkup(createElement(ClothingSizeFields, { category })), "");
    assert.equal(renderToStaticMarkup(createElement(ClothingSizeSelect, { product: { category } })), "");
  }
  const html = renderToStaticMarkup(createElement(ClothingSizeFields, { category: "Clothing", value: { XS: 2, "4XL": 9 } }));
  assert(html.includes("Size Selection")); assert.equal((html.match(/type="checkbox"/g) || []).length, 8);
  assert.equal((html.match(/type="number"/g) || []).length, 2);
  for (const text of ["XS stock quantity", "4XL stock quantity", 'value="2"', 'value="9"']) assert(html.includes(text));
});

test("selecting sizes and editing their quantities preserves independent counts", () => {
  let updated;
  const props = { category: "Clothing", value: { S: 5, M: 3 }, onChange(value) { updated = value; } };
  let nodes = elements(ClothingSizeFields(props));
  nodes.filter(node => node.type === "input" && node.props.type === "checkbox")[3].props.onChange({ target: { checked: true } });
  assert.deepEqual(updated, { S: 5, M: 3, L: 0 });
  nodes.find(node => node.type === "input" && node.props.type === "number" && node.props.value === 3).props.onChange({ target: { value: "7" } });
  assert.deepEqual(updated, { S: 5, M: 7 });
  nodes.filter(node => node.type === "input" && node.props.type === "checkbox")[1].props.onChange({ target: { checked: false } });
  assert.deepEqual(updated, { M: 3 });
});

test("cashier size selection starts empty, is required and disables sold-out sizes; inventory allows restocking zero", () => {
  const product = { category: "Clothing", sizes: [{ size: "S", available: true }, { size: "M", available: false }], sizeStocks: { S: 5, M: 0 } };
  const nodes = elements(ClothingSizeSelect({ product, onChange() {} }));
  assert.equal(nodes.find(node => node.type === "select").props.required, true);
  assert.equal(nodes.find(node => node.type === "select").props.value, "");
  assert.equal(nodes.find(node => node.type === "option" && node.props.value === "M").props.disabled, true);
  const inventory = renderToStaticMarkup(createElement(ClothingSizeSelect, { product, inventory: true }));
  assert(inventory.includes("S · 5 units")); assert(inventory.includes("M · 0 units"));
  assert(!inventory.includes('disabled=""'));
});

test("cart identity distinguishes sizes and preserves unsized product payloads", () => {
  assert.notEqual(lineKey("uniform", "S"), lineKey("uniform", "M"));
  assert.deepEqual(cartLine(lineKey("uniform", "M"), 2), { product: "uniform", size: "M", quantity: 2 });
  assert.equal(lineKey("book"), "book");
  assert.deepEqual(cartLine("book", 2), { product: "book", quantity: 2 });
});

test("renamed sized products retain size selection and inventory editing", () => {
  const product = { category: "Uniforms", sizes: [{ size: "M", available: true }], sizeStocks: { M: 2 } };
  assert(renderToStaticMarkup(createElement(ClothingSizeSelect, { product })).includes('value="M"'));
  assert(renderToStaticMarkup(createElement(ClothingSizeFields, { category: "Uniforms", sized: true, value: product.sizeStocks })).includes("M stock quantity"));
});
