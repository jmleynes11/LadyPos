import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";
import { directPaymentReview } from "../src/features/bookstore/directCheckout.js";
import { readPending } from "../src/features/bookstore/pendingOperation.js";

async function compile(path, replacements = {}) {
  const source = await fs.readFile(new URL(path, import.meta.url), "utf8");
  const compiled = await transformWithOxc(source, "Checkout.jsx", { jsx: { runtime: "automatic", development: false } });
  let code = compiled.code;
  for (const [name, url] of Object.entries({ react: import.meta.resolve("react"), "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"), ...replacements })) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
const clothing = await compile("../src/features/products/components/ClothingSizes.jsx", { "../clothingSizes.js": new URL("../src/features/products/clothingSizes.js", import.meta.url).href });
const ui = await compile("../src/shared/components/BookstoreUI.jsx");
const customerHome = await compile("../src/features/bookstore/CustomerHome.jsx", {
  "../../shared/components/BookstoreUI.jsx": ui,
  "./money.js": new URL("../src/features/bookstore/money.js", import.meta.url).href,
});
const component = await compile("../src/features/bookstore/PaymentReview.jsx", {
  "../../shared/components/BookstoreUI.jsx": ui,
  "./money.js": new URL("../src/features/bookstore/money.js", import.meta.url).href,
});
const { default: PaymentReview } = await import(component);
const quote = { orderId: "order", reference: "reference", total: 15050, quote: "server-quote", items: [{ productId: "book", name: "Book", quantity: 1, unitPrice: 15050, subtotal: 15050 }] };
const noop = () => {};
const defaults = { quote: directPaymentReview(quote, quote), method: "cash", paid: false, paymentReference: "", pricesConfirmed: false, disabled: false, busy: false, setMethod: noop, setPaid: noop, setPaymentReference: noop, setPricesConfirmed: noop, onClose: noop, onRefresh: noop, onComplete: noop };
function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object") return [];
  return [node, ...elements(node.props?.children)];
}
const form = props => elements(PaymentReview({ ...defaults, ...props }));
const completeButton = props => form(props).find(node => node.type === "button" && node.props.children === "Complete sale");

test("cashier review detects stale cart prices, unchanged totals with offsetting edits, and refresh changes", () => {
  assert.equal(directPaymentReview(quote, quote).pricesChanged, false);
  const revised = directPaymentReview({ ...quote, total: 20000, items: [{ ...quote.items[0], unitPrice: 20000, subtotal: 20000 }] }, quote);
  assert.equal(revised.pricesChanged, true); assert.equal(revised.previousTotal, 15050); assert.equal(revised.total, 20000);
  assert.equal(directPaymentReview(revised, revised).pricesChanged, true);
  assert.equal(directPaymentReview(revised, revised).previousTotal, 15050);
  assert.equal(directPaymentReview(quote, { ...quote, items: [{ ...quote.items[0], unitPrice: 15000 }] }).pricesChanged, true);
  assert.equal(directPaymentReview(quote, { ...quote, items: [{ ...quote.items[0], productId: "removed" }] }).pricesChanged, true);
});

test("changed cashier prices block payment until the revised total is confirmed", () => {
  const changed = { ...defaults.quote, pricesChanged: true, previousTotal: 10000 };
  assert.equal(completeButton({ quote: changed, paid: true }).props.disabled, true);
  assert.equal(form({ quote: changed }).find(node => node.type === "select").props.disabled, true);
  assert.equal(completeButton({ quote: changed, pricesConfirmed: true, paid: false }).props.disabled, true);
  assert.equal(completeButton({ quote: changed, pricesConfirmed: true, paid: true }).props.disabled, false);
  const html = renderToStaticMarkup(createElement(PaymentReview, { ...defaults, quote: changed }));
  for (const text of ["Review Order / Payment", "Prices changed", "PHP 100.00", "PHP 150.50", "before accepting payment"]) assert(html.includes(text));
});

test("GCash requires verified full payment and a nonblank reference; busy and uncertain operations block completion", () => {
  for (const paymentReference of ["", "   "]) assert.equal(completeButton({ method: "gcash", paid: true, paymentReference }).props.disabled, true);
  assert.equal(completeButton({ method: "gcash", paid: false, paymentReference: "ACTUAL-PAYMENT" }).props.disabled, true);
  assert.equal(completeButton({ method: "gcash", paid: true, paymentReference: "ACTUAL-PAYMENT" }).props.disabled, false);
  assert.equal(completeButton({ paid: true, busy: true }).props.disabled, true);
  assert.equal(completeButton({ paid: true, disabled: true }).props.disabled, true);
  assert.equal(completeButton({ paid: true }).props.disabled, false);
  const html = renderToStaticMarkup(createElement(PaymentReview, { ...defaults, method: "gcash" }));
  assert(html.includes("GCash payment in the authorized account")); assert(html.includes("A screenshot is not payment confirmation"));
  assert(!html.includes('value="bank"')); assert(!html.includes('value="credit"'));
});

test("GCash review displays the supplied QR, instructions and exact quoted total without confirming payment", async () => {
  const image = await fs.readFile(new URL("../public/gcash-payment-qr.jpg", import.meta.url));
  assert.equal(createHash("sha256").update(image).digest("hex"), "144fae4026c83ce96a1541f4f3421fa679cc9145b5c9bc49ccf3e0af3e66f050");
  assert.equal(image.readUInt16BE(0), 0xffd8); // Original browser-compatible JPEG.
  const gcash = { ...defaults, method: "gcash" };
  const html = renderToStaticMarkup(createElement(PaymentReview, gcash));
  for (const expected of ["/gcash-payment-qr.jpg", "GCash Payment", "Scan this QR code using your GCash application to complete your payment.", "Exact amount to pay", "PHP 150.50", "Verified GCash payment reference"]) assert(html.includes(expected));
  assert(!html.includes("Official GCash QR display is unavailable"));
  const qr = form(gcash).find(node => node.type === "img");
  const crop = form(gcash).find(node => node.props?.["aria-label"] === "GCash QR code");
  assert(crop.props.className.includes("aspect-square")); assert(crop.props.className.includes("overflow-hidden"));
  assert(crop.props.className.includes("w-full")); assert(crop.props.className.includes("max-w-[320px]"));
  assert.equal(qr.props.style.width, `${828 / 488 * 100}%`);
  assert.equal(qr.props.style.left, `${-170 / 488 * 100}%`);
  assert.equal(qr.props.style.top, `${-268 / 488 * 100}%`);
  assert.equal(qr.props.style.maxWidth, "none"); assert(qr.props.className.includes("h-auto"));
  assert.equal(completeButton(gcash).props.disabled, true);
});

test("switching GCash to Cash and back toggles only the QR section and resets payment consent", () => {
  let method = "gcash", paymentReference = "OLD-REFERENCE", paid = true;
  const state = () => ({ method, paymentReference, paid, setMethod: value => { method = value; }, setPaymentReference: value => { paymentReference = value; }, setPaid: value => { paid = value; } });
  const changeMethod = value => form(state()).find(node => node.type === "select").props.onChange({ target: { value } });
  assert(form(state()).some(node => node.type === "img"));
  changeMethod("cash");
  assert.equal(paymentReference, ""); assert.equal(paid, false);
  assert.equal(form(state()).some(node => node.type === "img"), false);
  assert.equal(form(state()).some(node => node.type === "input" && node.props.type !== "checkbox"), false);
  assert.equal(completeButton({ ...state(), paid: true }).props.disabled, false);
  changeMethod("gcash");
  assert(form(state()).some(node => node.type === "img"));
  assert.equal(completeButton({ ...state(), paid: true }).props.disabled, true);
  form(state()).find(node => node.type === "input" && node.props.type !== "checkbox").props.onChange({ target: { value: "VERIFIED-REFERENCE" } });
  assert.equal(paymentReference, "VERIFIED-REFERENCE"); assert.equal(paid, false);
  form(state()).find(node => node.type === "input" && node.props.type === "checkbox").props.onChange({ target: { checked: true } });
  assert.equal(paid, true); assert.equal(completeButton(state()).props.disabled, false);
});

test("editing payment method, reference or price consent invalidates prior payment verification", () => {
  const events = [], setters = { setMethod: value => events.push(["method", value]), setPaid: value => events.push(["paid", value]), setPaymentReference: value => events.push(["reference", value]), setPricesConfirmed: value => events.push(["prices", value]) };
  form(setters).find(node => node.type === "select").props.onChange({ target: { value: "gcash" } });
  assert.deepEqual(events.splice(0), [["method", "gcash"], ["reference", ""], ["paid", false]]);
  form({ ...setters, method: "gcash" }).find(node => node.type === "input" && node.props.type !== "checkbox").props.onChange({ target: { value: "NEW-REFERENCE" } });
  assert.deepEqual(events.splice(0), [["reference", "NEW-REFERENCE"], ["paid", false]]);
  form({ ...setters, quote: { ...defaults.quote, pricesChanged: true, previousTotal: 10000 } }).find(node => node.type === "input").props.onChange({ target: { checked: false } });
  assert.deepEqual(events, [["prices", false], ["paid", false]]);
});

test("shared review preserves existing queue payment presentation without cashier-catalog price consent", () => {
  const nodes = form({ quote: { ...quote, pricesChanged: true, previousTotal: 10000 }, paid: true });
  assert.equal(nodes[0].props.title, "Review payment");
  assert.equal(nodes.filter(node => node.type === "input" && node.props.type === "checkbox").length, 1);
  assert.equal(nodes.find(node => node.type === "select").props.disabled, false);
  assert.equal(completeButton({ quote, paid: true }).props.disabled, false);
});

// Exercise the real page handlers with deterministic hook state and an API fake.
// The HTTP suites separately execute authorization, payment and inventory writes.
async function catalogHarness(t, role = "cashier") {
  const key = `checkoutTest${crypto.randomUUID().replaceAll("-", "")}`;
  const memory = [], effects = [], calls = [];
  let cursor = 0, dirty = false;
  let completionError;
  const accountId = "a".repeat(24), storeId = "b".repeat(24), productId = "c".repeat(24);
  const serverQuote = { ...quote, orderId: "d".repeat(24), directPayment: true, items: [{ ...quote.items[0], productId }] };
  const customerOrder = { orderId: "e".repeat(24), reference: "UPH-6HWT-8PRK", orderStatus: "pending" };
  const customerOrders = [];
  const product = { _id: productId, name: "Book", sku: "BOOK", category: "Books", price: 10000, availability: true, moneyUnit: "PHP-centavos" };
  const api = {
    async get(path) {
      calls.push(["get", path]);
      if (path === "/products") return { data: { data: [product] } };
      if (path.endsWith("/quote")) return { data: { data: serverQuote } };
      if (path === "/bookstore/orders/own") return { data: { data: { orders: [...customerOrders] } } };
      return { data: { data: { orders: [] } } };
    },
    async post(path, body) {
      calls.push(["post", path, JSON.parse(JSON.stringify(body))]);
      if (path.endsWith("/complete") && completionError) throw completionError;
      if (path.endsWith("/complete")) return { data: { data: { receipt: { ...serverQuote, invoiceNumber: "INV-TEST", paymentMethod: body.paymentMethod } } } };
      if (path === "/bookstore/orders" && role === "customer") { customerOrders.push({ ...customerOrder }); return { data: { data: { ...customerOrder } } }; }
      // Payment review must use the returned ID, without an inline payment DTO.
      return { data: { data: { orderId: serverQuote.orderId } } };
    },
  };
  const capabilities = Object.fromEntries((role === "cashier" ? ["sale.process", "payment.record", "receipt.issue", "order.fulfill"] : ["order.submit", "order.status.own"]).map(value => [value, true]));
  const harness = {
    params: new URLSearchParams("view=catalog"), navigation: [],
    navigate(params) { harness.params = new URLSearchParams(params); harness.navigation.push(harness.params.toString()); dirty = true; },
    page: { context: { accountId, role, stores: [{ id: storeId }], capabilities }, api, refresh: noop },
    state(initial) { const index = cursor++; if (!(index in memory)) memory[index] = typeof initial === "function" ? initial() : initial; return [memory[index], value => { const next = typeof value === "function" ? value(memory[index]) : value; if (!Object.is(next, memory[index])) dirty = true; memory[index] = next; }]; },
    ref(initial) { const index = cursor++; if (!(index in memory)) memory[index] = { current: initial }; return memory[index]; },
    callback(work, deps) { const index = cursor++, prior = memory[index]; if (!prior || deps.some((value, i) => value !== prior.deps[i])) memory[index] = { deps, work }; return memory[index].work; },
    effect(work, deps) { const index = cursor++, prior = memory[index]; if (!prior || deps.some((value, i) => value !== prior.deps[i])) { prior?.cleanup?.(); memory[index] = { deps }; effects.push(() => { memory[index].cleanup = work(); }); } },
  };
  globalThis[key] = harness;
  const storage = new Map(), originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } });
  t.after(() => { delete globalThis[key]; if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage); else delete globalThis.sessionStorage; });
  const module = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const dummy = module("export default function Dummy() { return null; } export function ManagerCategoryManagement() { return null; }");
  const pageModule = await compile("../src/features/bookstore/BookstorePage.jsx", {
    react: module(`export const useState = value => globalThis.${key}.state(value); export const useRef = value => globalThis.${key}.ref(value); export const useCallback = (work,deps) => globalThis.${key}.callback(work,deps); export const useEffect = (work,deps) => globalThis.${key}.effect(work,deps);`),
    "react-router-dom": module(`export function Link() { return null; } export const useLocation = () => ({ hash: globalThis.${key}.hash || "" }); export const useSearchParams = () => [globalThis.${key}.params, params => globalThis.${key}.navigate(params)];`),
    "./bookstoreContext.js": module(`export const useBookstore = () => globalThis.${key}.page;`),
    "../products/components/ManagerProductManagement.jsx": dummy,
    "../products/components/ProductPhotoInput.jsx": dummy,
    "./InventoryOverview.jsx": module("export default function ManagerInventoryOverview() { return null; } export function InventoryProductsTable() { return null; }"),
    "../products/components/ClothingSizes.jsx": clothing,
    "../products/clothingSizes.js": new URL("../src/features/products/clothingSizes.js", import.meta.url).href,
    "./PaymentReview.jsx": component,
    "./CustomerHome.jsx": customerHome,
    "./CustomerOrders.jsx": module("export default function CustomerOrders() { return null; }"),
    "./CashierOrderQueue.jsx": module("export default function CashierOrderQueue() { return null; }"),
    "./CustomerOrderConfirmation.jsx": module("export default function CustomerOrderConfirmation() { return null; }"),
    "../../shared/components/BookstoreUI.jsx": ui,
    ...Object.fromEntries(["capability", "directCheckout", "pendingOperation", "money", "presentation", "navigation"].map(name => [`./${name}.js`, new URL(`../src/features/bookstore/${name}.js`, import.meta.url).href])),
  });
  const { default: Page } = await import(pageModule);
  const render = () => { cursor = 0; const root = Page(); return elements(root.type(root.props)); };
  const button = text => render().find(node => (node.type === "button" || node.type?.name === "Button") && (Array.isArray(node.props.children) ? node.props.children.includes(text) : node.props.children === text));
  const review = () => render().find(node => node.type?.name === "PaymentReview");
  const flush = async () => { for (let i = 0; i < 12; i++) { dirty = false; render(); effects.splice(0).forEach(work => work()); await setImmediate(); if (!dirty && !effects.length) return; } throw Error("Hook state did not settle"); };
  const reload = async () => { memory.forEach(value => value?.cleanup?.()); memory.length = 0; effects.length = 0; await flush(); };
  await flush();
  return { render, button, review, calls, serverQuote, customerOrder, customerOrders, product, flush, reload, harness, rejectCompletion: error => { completionError = error; } };
}

test("Cashier refresh of removed dashboard and bare workspace renders catalog without dashboard sections", async t => {
  const page = await catalogHarness(t);
  for (const params of [{ view: "overview" }, {}, { view: "unknown" }]) {
    page.harness.navigate(params); await page.flush();
    assert.equal(page.harness.params.get("view"), "catalog");
    assert(page.button("Add to order"));
    assert(!page.render().some(node => node.props?.className === "welcome-banner" || node.props?.className === "stat-grid" || node.props?.className === "dashboard-columns"));
    await page.reload();
    assert.equal(page.harness.params.get("view"), "catalog"); assert(page.button("Add to order"));
  }
});

for (const orderStatus of ["cancelled", "pending"]) test(`Cashier ${orderStatus} queue removal uses the authenticated command and refreshes the queue`, async t => {
  const page = await catalogHarness(t, "cashier"), api = page.harness.page.api;
  const oldGet = api.get, oldPost = api.post;
  let orders = [{ orderId: "e".repeat(24), orderStatus, reference: "UPH-CANC-ELLD", items: [], total: 10000 }];
  api.get = async path => path === "/bookstore/orders/queue" ? { data: { data: { orders: [...orders] } } } : oldGet(path);
  api.post = async (path, body) => {
    if (!path.endsWith("/remove-from-queue")) return oldPost(path, body);
    page.calls.push(["post", path, body]); orders = []; return { data: { data: { orderId: "e".repeat(24), queueRemoved: true } } };
  };
  page.harness.navigate({ view: "queue" }); await page.flush();
  let queue = page.render().find(node => node.type?.name === "CashierOrderQueue");
  assert.equal(queue.props.orders.length, 1);
  await queue.props.onRemove("e".repeat(24), orderStatus); await page.flush();
  queue = page.render().find(node => node.type?.name === "CashierOrderQueue"); assert.equal(queue.props.orders.length, 0);
  const post = page.calls.find(([verb, path]) => verb === "post" && path.endsWith("/remove-from-queue"));
  assert(post); assert.equal(post[2].storeId, "b".repeat(24)); assert.match(post[2].operationId, /^[a-f0-9-]{36}$/);
  assert.equal(post[2].includeUnpaid, orderStatus === "pending" ? true : undefined);
});

test("Customer home, category filtering, featured details and cart reuse existing catalog state and unpaid submission", async t => {
  const page = await catalogHarness(t, "customer");
  page.product.category = "Books & Supplies";
  page.button("Add to order").props.onClick(); page.button("Add to order").props.onClick();
  page.harness.navigate({}); await page.flush();
  const home = page.render().find(node => node.type?.name === "CustomerHome");
  assert(home); assert.deepEqual(home.props.products, [page.product]);
  assert(!page.render().some(node => ["stat-grid", "dashboard-columns", "welcome-banner"].includes(node.props?.className)));
  home.props.onProduct(page.product);
  const details = page.render().find(node => node.type?.name === "ProductDetails");
  assert.equal(details.props.product, page.product); details.props.onClose();
  home.props.onBrowse("Books & Supplies"); await page.flush();
  assert.equal(page.harness.params.get("view"), "catalog"); assert.equal(page.harness.params.get("category"), "Books & Supplies");
  let filters = page.render().find(node => node.type?.name === "CatalogFilters");
  assert.equal(filters.props.category, "Books & Supplies");
  filters.props.setSearch("does not match"); assert.equal(page.button("Add to order"), undefined);
  filters.props.setSearch("BOOK"); assert(page.button("Add to order"));
  filters.props.setCategory("Clothing"); await page.flush(); assert.equal(page.button("Add to order"), undefined);
  page.harness.navigate({}); await page.flush();
  page.render().find(node => node.type?.name === "CustomerHome").props.onBrowse("All products"); await page.flush();
  assert.equal(page.harness.params.has("category"), false);
  filters = page.render().find(node => node.type?.name === "CatalogFilters"); assert.equal(filters.props.search, "");
  assert(page.render().some(node => node.props?.id === "customer-cart"));
  await page.button("Submit unpaid order").props.onClick();
  const posts = page.calls.filter(([verb]) => verb === "post");
  assert.equal(posts.length, 1); assert.equal(posts[0][1], "/bookstore/orders");
  assert.deepEqual(posts[0][2].items, [{ product: page.product._id, quantity: 2 }]);
  assert.equal(page.review(), undefined);
  page.harness.navigate({}); await page.flush();
  page.render().find(node => node.type?.name === "CustomerHome").props.onOrders(); await page.flush();
  assert.equal(page.harness.params.get("view"), "my-orders");
  assert(page.render().some(node => node.type?.name === "CustomerOrders"));
});

test("Customer category deep links survive reload, Cart targets the existing order panel, and clothing sizes remain separate", async t => {
  const page = await catalogHarness(t, "customer");
  Object.assign(page.product, { category: "Clothing", sizes: [{ size: "S", available: true }, { size: "M", available: true }, { size: "XL", available: false }] });
  page.harness.navigate({ view: "catalog", category: "Clothing" }); await page.flush(); await page.reload();
  assert.equal(page.render().find(node => node.type?.name === "CatalogFilters").props.category, "Clothing");
  const select = () => page.render().find(node => node.type?.name === "ClothingSizeSelect");
  assert.equal(page.button("Add to order").props.disabled, true);
  select().props.onChange("S"); page.button("Add to order").props.onClick();
  select().props.onChange("M"); page.button("Add to order").props.onClick();
  select().props.onChange("XL"); assert.equal(page.button("Add to order").props.disabled, true);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document"); let scrolls = 0;
  Object.defineProperty(globalThis, "document", { configurable: true, value: { getElementById(id) { assert.equal(id, "customer-cart"); return { scrollIntoView() { scrolls++; } }; } } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "document", previous); else delete globalThis.document; });
  page.harness.hash = "#customer-cart"; await page.flush(); assert(scrolls > 0);
  await page.button("Submit unpaid order").props.onClick();
  assert.deepEqual(page.calls.find(([verb]) => verb === "post")[2].items, [{ product: page.product._id, quantity: 1, size: "S" }, { product: page.product._id, quantity: 1, size: "M" }]);
});

for (const role of ["admin", "store_manager"]) test(`${role} overview keeps its dashboard and never renders the Customer storefront`, async t => {
  const page = await catalogHarness(t, role);
  page.harness.navigate({ view: "overview" }); await page.flush();
  assert(page.render().some(node => node.props?.className === "welcome-banner"));
  assert(page.render().some(node => node.props?.className === "stat-grid"));
  assert(!page.render().some(node => node.type?.name === "CustomerHome"));
});

for (const role of ["store_manager", "admin", "cashier"]) test(`${role} inventory uses controls only for the Store Manager and preserves adjustment authorization`, async t => {
  const page = await catalogHarness(t, role);
  page.harness.page.context = { ...page.harness.page.context, capabilities: { "inventory.history.read": true, "inventory.adjust": true } };
  page.harness.navigate({ view: "inventory" });
  await page.flush();
  const inventory = page.render().find(node => ["ManagerInventoryOverview", "InventoryProductsTable"].includes(node.type?.name));
  assert.equal(inventory.type.name, role === "store_manager" ? "ManagerInventoryOverview" : "InventoryProductsTable");
  assert.equal(inventory.props.canAdjust(page.product), role === "store_manager");
  if (role === "store_manager") {
    inventory.props.onAdjust(page.product);
    assert(page.render().some(node => node.props?.title === "Adjust stock"));
  }
  assert.equal(page.calls.filter(([verb]) => verb !== "get").length, 0);
  page.harness.navigate({ view: "overview" });
  await page.flush();
  assert(!page.render().some(node => node.type?.name === "ManagerInventoryOverview"));
});

test("cashier must choose an in-stock clothing size before adding; different sizes remain separate through submission", async t => {
  const page = await catalogHarness(t);
  Object.assign(page.product, { category: "Clothing", sizes: [{ size: "S", available: true }, { size: "M", available: true }, { size: "XL", available: false }] });
  const sizeSelect = () => page.render().find(node => node.type?.name === "ClothingSizeSelect");
  assert.equal(page.button("Add to order").props.disabled, true);
  sizeSelect().props.onChange("S");
  assert.equal(page.button("Add to order").props.disabled, false);
  page.button("Add to order").props.onClick(); page.button("Add to order").props.onClick();
  sizeSelect().props.onChange("M"); page.button("Add to order").props.onClick();
  sizeSelect().props.onChange("XL"); assert.equal(page.button("Add to order").props.disabled, true);
  await page.button("Submit Order").props.onClick();
  const submitted = page.calls.find(([verb, path]) => verb === "post" && path === "/bookstore/orders");
  assert.deepEqual(submitted[2].items, [{ product: page.product._id, quantity: 2, size: "S" }, { product: page.product._id, quantity: 1, size: "M" }]);
});

test("payment review displays each purchased clothing size and compares prices by size", () => {
  const sized = { ...quote, total: 200, items: [{ productId: "uniform", size: "S", name: "Uniform", quantity: 1, unitPrice: 100, subtotal: 100 }, { productId: "uniform", size: "M", name: "Uniform", quantity: 1, unitPrice: 100, subtotal: 100 }] };
  assert.equal(directPaymentReview(sized, { ...sized, items: [...sized.items].reverse() }).pricesChanged, false);
  const html = renderToStaticMarkup(createElement(PaymentReview, { ...defaults, quote: sized }));
  assert(html.includes("Uniform (S) × 1")); assert(html.includes("Uniform (M) × 1"));
});

for (const method of ["cash", "gcash"]) test(`cashier catalog adds items, submits directly, resumes the same checkout and issues a ${method} receipt`, async t => {
  const page = await catalogHarness(t);
  page.button("Add to order").props.onClick();
  assert.equal(page.button("Submit Order").props.disabled, false);
  await page.button("Submit Order").props.onClick();
  await page.flush();
  let review = page.review();
  assert(review); assert.equal(review.props.quote.directCheckout, true); assert.equal(review.props.quote.pricesChanged, true);
  assert.equal(review.props.quote.previousTotal, 10000);
  const submitted = page.calls.filter(([verb]) => verb === "post");
  assert.equal(submitted.length, 1); assert.equal(submitted[0][1], "/bookstore/orders");
  assert.deepEqual(submitted[0][2].items, [{ product: "c".repeat(24), quantity: 1 }]);
  assert.equal(submitted[0][2].reason, undefined);
  assert.equal(page.harness.params.get("view"), "payment"); assert.equal(page.harness.params.get("checkout"), page.serverQuote.orderId);
  assert.equal(page.calls.some(([, path]) => path === "/bookstore/orders/queue"), false);
  assert.equal(page.harness.navigation.some(url => url.includes("view=queue")), false);
  review.props.onClose(); assert.equal(page.review(), undefined);
  assert.equal(page.button("Submit Order").props.disabled, true);
  await page.button("Resume checkout").props.onClick();
  await page.flush();
  assert.equal(page.calls.filter(([verb]) => verb === "post").length, 1);
  review = page.review();
  review.props.setPricesConfirmed(true); review.props.setMethod(method);
  review.props.setPaymentReference(method === "gcash" ? "VERIFIED-REFERENCE" : ""); review.props.setPaid(true);
  await page.review().props.onComplete();
  assert.equal(page.review(), undefined);
  assert(page.render().some(node => node.props?.title === "Sale receipt"));
  const paid = page.calls.filter(([verb, path]) => verb === "post" && path.endsWith("/complete"));
  assert.equal(paid.length, 1); assert.equal(paid[0][2].paymentMethod, method); assert.equal(paid[0][2].paymentConfirmed, true);
  assert.equal(paid[0][2].confirmedTotal, 15050); assert.equal(paid[0][2].quote, "server-quote");
});

test("student catalog retains unpaid submission without direct payment review", async t => {
  const page = await catalogHarness(t, "customer");
  page.button("Add to order").props.onClick();
  await page.button("Submit unpaid order").props.onClick();
  assert.equal(page.review(), undefined); assert.equal(page.button("Submit Order"), undefined);
  assert.equal(page.calls.filter(([verb]) => verb === "post").length, 1);
  assert.equal(page.calls.some(([, path]) => path.endsWith("/quote") || path.endsWith("/complete")), false);
});

test("Customer submission shows the exact returned order, restores confirmation on reload and never resubmits during navigation", async t => {
  const page = await catalogHarness(t, "customer");
  page.button("Add to order").props.onClick();
  await page.button("Submit unpaid order").props.onClick(); await page.flush();
  const confirmation = () => page.render().find(node => node.type?.name === "CustomerOrderConfirmation");
  assert.equal(page.harness.params.get("submitted"), page.customerOrder.orderId);
  assert.equal(page.harness.params.get("storeId"), "b".repeat(24));
  assert.equal(confirmation().props.order.reference, page.customerOrder.reference);
  assert.equal(confirmation().props.order.orderStatus, "pending");
  assert.equal(page.button("Submit unpaid order"), undefined); assert.equal(page.button("Add to order"), undefined);
  await page.reload();
  assert.equal(confirmation().props.order.reference, page.customerOrder.reference);
  page.harness.navigate({ view: "my-orders" }); await page.flush();
  assert(page.render().find(node => node.type?.name === "CustomerOrders").props.orders.some(order => order.reference === page.customerOrder.reference));
  page.harness.navigate({}); await page.flush(); assert(page.render().some(node => node.type?.name === "CustomerHome"));
  page.harness.navigate({ view: "catalog" }); await page.flush(); assert(page.button("Add to order"));
  assert.equal(page.button("Submit unpaid order").props.disabled, true);
  assert.equal(page.calls.filter(([verb]) => verb === "post").length, 1);
});

test("Customer confirmation uses the latest owned status and never substitutes another order's reference", async t => {
  const page = await catalogHarness(t, "customer");
  page.button("Add to order").props.onClick(); await page.button("Submit unpaid order").props.onClick(); await page.flush();
  page.customerOrders[0].orderStatus = "completed"; await page.reload();
  assert.equal(page.render().find(node => node.type?.name === "CustomerOrderConfirmation").props.order.orderStatus, "completed");
  page.harness.navigate({ view: "catalog", submitted: "f".repeat(24), storeId: "b".repeat(24) }); await page.flush();
  assert.equal(page.render().find(node => node.type?.name === "CustomerOrderConfirmation").props.order, null);
  assert.equal(page.calls.filter(([verb]) => verb === "post").length, 1);
});

test("Customer double submit is blocked while the successful response refreshes existing order data", async t => {
  const page = await catalogHarness(t, "customer"), api = page.harness.page.api, oldGet = api.get;
  page.button("Add to order").props.onClick(); const submit = page.button("Submit unpaid order");
  let release;
  api.get = path => path === "/products" ? new Promise(resolve => { release = () => resolve({ data: { data: [page.product] } }); }) : oldGet(path);
  const first = submit.props.onClick();
  await setImmediate(); assert(release);
  await submit.props.onClick(); assert.equal(page.calls.filter(([verb]) => verb === "post").length, 1);
  release(); await first; await page.flush();
  assert.equal(page.render().find(node => node.type?.name === "CustomerOrderConfirmation").props.order.reference, page.customerOrder.reference);
});

for (const role of ["cashier", "admin", "store_manager"]) test(`${role} ignores Customer confirmation parameters and keeps its existing workspace`, async t => {
  const page = await catalogHarness(t, role);
  page.harness.navigate({ view: role === "store_manager" ? "products" : "catalog", submitted: "e".repeat(24) }); await page.flush();
  assert(!page.render().some(node => node.type?.name === "CustomerOrderConfirmation"));
  assert(page.render().some(node => node.type === "h1" && node.props.children === (role === "store_manager" ? "Products & Categories" : role === "admin" ? "Products & categories" : "Product catalog")));
});

test("cashier completion rejection refreshes changed prices and clears payment and total confirmation", async t => {
  const page = await catalogHarness(t);
  page.button("Add to order").props.onClick(); await page.button("Submit Order").props.onClick(); await page.flush();
  page.review().props.setPricesConfirmed(true); page.review().props.setPaid(true);
  page.serverQuote.total = 20000; page.serverQuote.items[0].unitPrice = 20000; page.serverQuote.items[0].subtotal = 20000;
  page.rejectCompletion({ response: { status: 409, data: { message: "Prices changed; request a new quote" } } });
  await page.review().props.onComplete();
  const review = page.review();
  assert.equal(review.props.quote.total, 20000); assert.equal(review.props.quote.pricesChanged, true);
  assert.equal(review.props.paid, false); assert.equal(review.props.pricesConfirmed, false);
  assert.equal(page.calls.filter(([verb, path]) => verb === "post" && path.endsWith("/complete")).length, 1);
  assert.equal(page.render().some(node => node.props?.title === "Sale receipt"), false);
});

test("cashier uncertain payment retains its operation identity and cannot dispatch another payment", async t => {
  const page = await catalogHarness(t);
  page.button("Add to order").props.onClick(); await page.button("Submit Order").props.onClick(); await page.flush();
  page.review().props.setPricesConfirmed(true); page.review().props.setPaid(true);
  page.rejectCompletion(new Error("Response lost"));
  await page.review().props.onComplete();
  assert.equal(page.review().props.disabled, true); assert.equal(page.review().props.paid, false);
  assert(page.render().some(node => node.props?.title === "Operation reconciliation"));
  await page.review().props.onComplete();
  assert.equal(page.calls.filter(([verb, path]) => verb === "post" && path.endsWith("/complete")).length, 1);
  assert.equal(page.calls.filter(([, path]) => path.endsWith("/quote")).length, 1);
});

test("cashier double submit and page reload retain one returned checkout ID without queue requests", async t => {
  const page = await catalogHarness(t);
  page.button("Add to order").props.onClick();
  const submit = page.button("Submit Order").props.onClick;
  await Promise.all([submit(), submit()]); await page.flush();
  const checkoutId = page.harness.params.get("checkout");
  assert.equal(checkoutId, page.serverQuote.orderId);
  await page.reload();
  assert.equal(page.review().props.quote.orderId, checkoutId); assert.equal(page.review().props.paid, false);
  assert.equal(page.calls.filter(([verb, path]) => verb === "post" && path === "/bookstore/orders").length, 1);
  assert.equal(page.calls.filter(([verb, path]) => verb === "get" && path === `/bookstore/orders/${checkoutId}/quote`).length, 2);
  assert.equal(page.calls.some(([, path]) => path === "/bookstore/orders/queue"), false);
});

test("a stale backend quote fails closed on the payment URL instead of falling back to the queue", async t => {
  const page = await catalogHarness(t);
  delete page.serverQuote.directPayment;
  page.button("Add to order").props.onClick(); await page.button("Submit Order").props.onClick(); await page.flush();
  assert.equal(page.review(), undefined);
  assert.equal(page.harness.params.get("view"), "payment"); assert.equal(page.harness.params.get("checkout"), page.serverQuote.orderId);
  assert(page.render().some(node => typeof node.props?.children === "string" && node.props.children.includes("Restart or update the backend")));
  assert.equal(page.calls.filter(([verb]) => verb === "post").length, 1);
  assert.equal(page.calls.some(([, path]) => path === "/bookstore/orders/queue"), false);
});

test("lost direct-checkout response retains its operation across reload, recovers the existing order and completes it once", async t => {
  const page = await catalogHarness(t), api = page.harness.page.api;
  const get = api.get, post = api.post;
  let committed, orders = 0;
  api.post = async (path, body) => {
    if (path !== "/bookstore/orders") return post(path, body);
    page.calls.push(["post", path, body]); orders++;
    committed = { ...page.serverQuote, orderStatus: "pending", operationId: body.operationId, payment: { ...page.serverQuote } };
    throw Error("Response lost after server commit");
  };
  api.get = async (path, options) => path.startsWith("/bookstore/operations/") ? { data: { data: { outcome: "applied", operationId: committed.operationId, orderId: committed.orderId, result: committed } } } : get(path, options);
  page.button("Add to order").props.onClick(); await page.button("Submit Order").props.onClick();
  const marker = readPending(sessionStorage, "a".repeat(24));
  assert.equal(marker.kind, "directCheckout"); assert.equal(marker.operationId, committed.operationId);
  assert.equal(page.button("Submit Order").props.disabled, true);
  await page.button("Submit Order").props.onClick(); assert.equal(orders, 1);
  await page.reload(); assert.deepEqual(readPending(sessionStorage, "a".repeat(24)), marker);
  await page.button("Check acknowledged outcome").props.onClick(); await page.flush();
  assert.equal(readPending(sessionStorage, "a".repeat(24)), null);
  assert.equal(page.harness.params.get("checkout"), committed.orderId);
  assert.equal(page.review().props.quote.orderId, committed.orderId); assert.equal(page.review().props.quote.total, committed.total);
  page.review().props.setPaid(true); await page.review().props.onComplete(); await page.flush();
  assert.equal(orders, 1); assert.equal(page.calls.filter(([verb, path]) => verb === "post" && path.endsWith("/complete")).length, 1);
  assert(page.render().some(node => node.props?.title === "Sale receipt"));
});

for (const outcome of ["applied-without-result", "unresolved", "unavailable", "wrong-operation", "invalid-result"]) test(`checkout recovery ${outcome} retains its marker and blocks replacement`, async t => {
  const page = await catalogHarness(t), api = page.harness.page.api, get = api.get;
  api.post = async (path, body) => { page.calls.push(["post", path, body]); throw Error("Response lost"); };
  api.get = async (path, options) => {
    if (!path.startsWith("/bookstore/operations/")) return get(path, options);
    const marker = readPending(sessionStorage, "a".repeat(24));
    if (outcome === "unavailable") throw Error("Offline");
    return { data: { data: { outcome: outcome === "unresolved" ? "unknown" : "applied", operationId: outcome === "wrong-operation" ? "wrong-operation" : marker.operationId,
      ...(outcome === "invalid-result" ? { result: { orderId: "invalid", payment: {} } } : {}) } } };
  };
  page.button("Add to order").props.onClick(); await page.button("Submit Order").props.onClick();
  const marker = readPending(sessionStorage, "a".repeat(24));
  await page.reload(); await page.button("Check acknowledged outcome").props.onClick(); await page.flush();
  assert.deepEqual(readPending(sessionStorage, "a".repeat(24)), marker);
  assert.equal(page.review(), undefined); assert.equal(page.button("Submit Order").props.disabled, true);
  await page.button("Submit Order").props.onClick(); assert.equal(page.calls.filter(([verb]) => verb === "post").length, 1);
  assert(page.render().some(node => node.props?.title === "Operation reconciliation"));
});

test("an initial checkout response missing its order ID retains the original operation for recovery", async t => {
  const page = await catalogHarness(t), api = page.harness.page.api;
  api.post = async (path, body) => { page.calls.push(["post", path, body]); return { data: { data: { operationId: body.operationId } } }; };
  page.button("Add to order").props.onClick(); await page.button("Submit Order").props.onClick();
  assert.equal(readPending(sessionStorage, "a".repeat(24)).operationId, page.calls.find(([verb]) => verb === "post")[2].operationId);
  assert.equal(page.button("Submit Order").props.disabled, true); assert(page.button("Check acknowledged outcome"));
});

test("cashier catalog keeps the M-size payload after the product category becomes Uniforms", async t => {
  const page = await catalogHarness(t);
  Object.assign(page.product, { category: "Uniforms", sizes: [{ size: "M", available: true }] });
  assert.equal(page.button("Add to order").props.disabled, true);
  page.render().find(node => node.type?.name === "ClothingSizeSelect").props.onChange("M");
  page.button("Add to order").props.onClick(); await page.button("Submit Order").props.onClick();
  assert.deepEqual(page.calls.find(([verb]) => verb === "post")[2].items, [{ product: page.product._id, size: "M", quantity: 1 }]);
});

test("return UI validates before repayment and keeps a failed recording open for retry without claiming success", async t => {
  const page = await catalogHarness(t, "store_manager"), api = page.harness.page.api, get = api.get;
  const sale = { ...page.serverQuote, paymentMethod: "cash", items: [{ ...page.serverQuote.items[0], size: "M", quantity: 1 }] };
  const request = { requestId: "e".repeat(24), orderId: sale.orderId, status: "requested", reason: "Return" };
  page.harness.page.context = { ...page.harness.page.context, capabilities: { "reversal.apply": true, "reversal.approve": true, "order.oversee": true } };
  let rejectValidation = true, rejectApply = true;
  api.get = async path => path === "/bookstore/reversals" ? { data: { data: { requests: [request] } } } : path === `/bookstore/transactions/${sale.orderId}` ? { data: { data: { transactions: [sale] } } } : get(path);
  api.post = async (path, body) => {
    page.calls.push(["post", path, body]);
    if (path.endsWith("/validate")) {
      if (rejectValidation) throw { response: { status: 409, data: { message: "Return inventory requires reconciliation" } } };
      return { data: { data: { eligible: true, orderId: sale.orderId } } };
    }
    if (rejectApply) throw { response: { status: 409, data: { message: "Receipt requires reconciliation" } } };
    return { data: { data: { reversalId: "recorded-reversal" } } };
  };
  page.harness.navigate({ view: "reversals" }); await page.flush();
  // Set the existing required audit reason before opening Manager review.
  page.render().find(node => node.type === "input" && node.props.placeholder?.startsWith("Explain the change")).props.onChange({ target: { value: "Assessed return" } });
  await page.button("Review repayment & returns").props.onClick();
  const modal = () => page.render().find(node => node.props?.title === "Confirm repayment & saleable returns");
  const returnForm = () => elements(modal()).find(node => node.type === "form");
  const repayment = () => elements(modal()).find(node => node.type === "input" && node.props.type === "checkbox");
  elements(modal()).find(node => node.type === "input" && node.props.type === "number").props.onChange({ target: { value: "1" } });
  assert.equal(repayment().props.disabled, true); assert.equal(page.button("Record confirmed reversal").props.disabled, true);
  await page.button("Validate return eligibility").props.onClick(); assert.equal(repayment().props.disabled, true);
  assert.equal(page.calls.some(([, path]) => path.endsWith("/apply")), false);
  rejectValidation = false; await page.button("Validate return eligibility").props.onClick();
  assert.equal(repayment().props.disabled, false); repayment().props.onChange({ target: { checked: true } });
  await returnForm().props.onSubmit({ preventDefault() {} });
  assert(modal()); assert.equal(readPending(sessionStorage, "a".repeat(24)), null);
  assert(page.render().some(node => node.props?.children === "Receipt requires reconciliation"));
  assert(!page.render().some(node => node.props?.children === "Recorded."));
  rejectApply = false; await returnForm().props.onSubmit({ preventDefault() {} });
  assert.equal(modal(), undefined);
  const writes = page.calls.filter(([, path]) => path.endsWith("/apply"));
  assert.equal(writes.length, 2); assert.deepEqual(writes[0][2].returned, [{ productId: page.product._id, size: "M", quantity: 1 }]);
});
