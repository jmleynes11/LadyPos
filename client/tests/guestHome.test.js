import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

async function compile(path, replacements = {}) {
  const source = await fs.readFile(new URL(path, import.meta.url), "utf8");
  let { code } = await transformWithOxc(source, "Customer.jsx", { jsx: { runtime: "automatic", development: false } });
  for (const [name, url] of Object.entries({ react: import.meta.resolve("react"), "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"), ...replacements })) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
const ui = await compile("../src/shared/components/BookstoreUI.jsx");
const { default: GuestHome } = await import(await compile("../src/features/kiosk/GuestHome.jsx", {
  "../../shared/components/BookstoreUI.jsx": ui,
  "../bookstore/money.js": new URL("../src/features/bookstore/money.js", import.meta.url).href,
}));
const product = (id, category, extra = {}) => ({ productId: id, category, name: `Catalog ${id}`, price: 12345, availability: true, moneyUnit: "PHP-centavos", ...extra });
const products = [product("uniform", "Clothing", { imageUrl: "/stored-uniform.png" }), product("book", "Books", { price: 15050 }), product("pen", "Supplies", { price: 1250 })];
const noop = () => {};
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
}

test("Guest storefront renders requested shopping content and actual catalog names, images and prices without dashboard cards", () => {
  const html = renderToStaticMarkup(createElement(GuestHome, { products, onBrowse: noop, onProduct: noop, onOrders: noop }));
  for (const text of ["Welcome to UPHSD Bookstore!", "Everything You Need,", "All in One Place.", "Explore university uniforms, school supplies, merchandise, and more.", "Start Browsing", "Shop by Category", "Featured Products", "Easy product browsing", "Convenient order submission", "Accessible order information", "/stored-uniform.png", "Catalog uniform", "Catalog book", "PHP 150.50", "PHP 12.50"]) assert(html.includes(text));
  for (const text of ["stat-grid", "stat-card", "dashboard-columns", "Sales overview", "Total products"]) assert(!html.includes(text));
});

test("Start Browsing and category cards use actual categories; featured selections pass the exact catalog product to existing details", () => {
  const browsed = [], selected = []; 
  const elements = nodes(GuestHome({ products, onBrowse: value => browsed.push(value), onProduct: value => selected.push(value), onOrders: noop }));
  elements.find(node => node.props?.className === "guest-home-browse").props.onClick();
  const categories = elements.filter(node => node.props?.className === "guest-home-category");
  assert.equal(categories.length, 3);
  for (const category of categories) category.props.onClick();
  assert.deepEqual(browsed, ["All products", "Books", "Clothing", "Supplies"]);
  for (const button of elements.filter(node => node.props?.className === "guest-home-product-image")) button.props.onClick();
  assert.deepEqual(selected, products); assert.equal(selected[0], products[0]);

});

test("featured choices prioritize available catalog products, omit archived/unverified records and handle empty data", () => {
  const source = [product("sold-out", "Books", { availability: false }), ...products, product("archived", "Hidden", { isActive: false }), product("legacy", "Unverified", { isActive: false })];
  const props = { products: source, onBrowse: noop, onProduct: noop, onOrders: noop };
  const elements = nodes(GuestHome(props));
  const cards = elements.filter(node => node.props?.className === "guest-home-product");
  assert.deepEqual(cards.map(node => node.key), ["uniform", "book", "pen", "sold-out"]);
  const html = renderToStaticMarkup(createElement(GuestHome, props));
  assert(!html.includes("Catalog archived")); assert(!html.includes("Catalog legacy")); assert(!html.includes("Shop Hidden"));
  const empty = renderToStaticMarkup(createElement(GuestHome, { ...props, products: [] }));
  assert(empty.includes("Collections are on their way")); assert(empty.includes("New essentials are on the way")); assert(!empty.includes("Catalog uniform"));
});
