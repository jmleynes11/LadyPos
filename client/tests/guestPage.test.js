import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { setImmediate } from "node:timers/promises";
import { transformWithOxc } from "vite";
import { createGuestSession } from "../src/features/kiosk/guestSession.js";

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (node && typeof node === "object") return [node.props?.title, node.props?.subtitle, node.type?.name === "OrderConfirmation" ? node.props.status.reference : "", text(node.props?.children)].filter(Boolean).join(" ");
  return node == null || typeof node === "boolean" ? "" : String(node);
}

// Execute real kiosk handlers with deterministic hooks, clock and API replies.
// Backend HTTP tests independently verify credentials and persisted effects.
async function fixture(t, initialCatalogError = null) {
  const key = `kioskTest${crypto.randomUUID().replaceAll("-", "")}`;
  const memory = [], effects = [], calls = [];
  let cursor = 0, dirty = false, clock = 0, issued = 0;
  let catalogError = initialCatalogError, orderError = null, trackingError = null;
  const product = { productId: "book", name: "Book", category: "Books", price: 100, availability: true };
  const harness = {
    logout() {}, session: null, params: new URLSearchParams("view=shop"), navigate(value) { harness.params = new URLSearchParams(value); dirty = true; },
    state(initial) { const i = cursor++; if (!(i in memory)) memory[i] = initial; return [memory[i], value => { const next = typeof value === "function" ? value(memory[i]) : value; dirty ||= !Object.is(next, memory[i]); memory[i] = next; }]; },
    ref(initial) { const i = cursor++; if (!(i in memory)) memory[i] = { current: initial }; return memory[i]; },
    callback(work, deps) { const i = cursor++, prior = memory[i]; if (!prior || deps.some((value, j) => value !== prior.deps[j])) memory[i] = { deps, work }; return memory[i].work; },
    effect(work, deps) { const i = cursor++, prior = memory[i]; if (!prior || deps.some((value, j) => value !== prior.deps[j])) { prior?.cleanup?.(); memory[i] = { deps }; effects.push(() => { memory[i].cleanup = work(); }); } },
    createSession(options) { harness.session = createGuestSession({ ...options, now: () => clock, schedule: () => 0, cancel() {} }); return harness.session; },
    async request(path, options) {
      calls.push({ path, body: options.body && structuredClone(options.body), credential: options.credential });
      if (path === "/catalog") { if (catalogError) throw catalogError; return { products: [product] }; }
      if (path === "/intents") return { intentId: `intent-${++issued}`, credential: `private-${issued}`, expiresAt: "2026-11-16T00:00:00.000Z" };
      if (path === "/orders" && orderError) throw orderError;
      if (path.startsWith("/orders/") && trackingError) throw trackingError;
      return { reference: "ORDER", orderStatus: "pending" };
    },
  };
  globalThis[key] = harness;
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: new EventTarget() });
  const cleanup = () => memory.forEach(value => value?.cleanup?.());
  t.after(() => { cleanup(); delete globalThis[key]; if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor); else delete globalThis.document; });
  const source = await fs.readFile(new URL("../src/features/kiosk/KioskPage.jsx", import.meta.url), "utf8");
  let code = (await transformWithOxc(source.replace('import "./guest-confirmation.css";', "").replace('import "./guest-storefront.css";', ""), "KioskPage.jsx", { jsx: { runtime: "automatic", development: false } })).code;
  const replacements = {
    react: moduleUrl(`export const useState = value => globalThis.${key}.state(value); export const useRef = value => globalThis.${key}.ref(value); export const useCallback = (work,deps) => globalThis.${key}.callback(work,deps); export const useEffect = (work,deps) => globalThis.${key}.effect(work,deps);`),
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "react-router-dom": moduleUrl(`export function Link() { return null; } export const useSearchParams = () => [globalThis.${key}.params, value => globalThis.${key}.navigate(value)];`),
    "../../shared/hooks/AuthContext.jsx": moduleUrl(`export const useAuth = () => ({ logout: globalThis.${key}.logout });`),
    "./guestApi.js": moduleUrl(`export const guestRequest = (path, options) => globalThis.${key}.request(path, options);`),
    "./guestSession.js": moduleUrl(`import { attachGuestSessionEvents } from ${JSON.stringify(new URL("../src/features/kiosk/guestSession.js", import.meta.url).href)}; export { attachGuestSessionEvents }; export const createGuestSession = options => globalThis.${key}.createSession(options);`),
    "../../shared/components/BookstoreUI.jsx": moduleUrl("export function Brand() {} export function CatalogFilters() {} export function EmptyState() {} export function Icon() {} export function Notice() {} export function Panel() {} export function ProductDetails() {} export function ProductVisual() {}"),
    "../products/components/ClothingSizes.jsx": moduleUrl("export function ClothingSizeSelect() {}"),
    "./OrderConfirmation.jsx": moduleUrl("export default function OrderConfirmation() {}"),
    "./GuestHome.jsx": moduleUrl("export default function GuestHome() {}"),
    ...Object.fromEntries(["./guestCheckout.js", "../bookstore/money.js", "../bookstore/presentation.js", "../products/clothingSizes.js"].map(path => [path, new URL(`../src/features/kiosk/${path}`, import.meta.url).href])),
  };
  for (const [name, url] of Object.entries(replacements)) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
  const { default: Page } = await import(moduleUrl(code));
  const render = () => { cursor = 0; return Page(); };
  const button = label => nodes(render()).find(node => node.type === "button" && text(node.props.children).trim() === label);
  const flush = async () => { for (let i = 0; i < 10; i++) { dirty = false; render(); effects.splice(0).forEach(work => work()); await setImmediate(); if (!dirty && !effects.length) return; } throw Error("Kiosk hook state did not settle"); };
  await flush();
  return { calls, product, button, nodes: () => nodes(render()), text: () => text(render()),
    session: () => harness.session, flush, navigate: value => harness.navigate(value), params: () => harness.params,
    recoverCatalog() { catalogError = null; }, rejectOrder(error) { orderError = error; }, rejectTracking(error) { trackingError = error; },
    expire() { clock += 300000; harness.session.expireIfIdle(); },
    async reload() { cleanup(); memory.length = 0; effects.length = 0; await flush(); },
  };
}

test("kiosk catalog failure retries in place and allows cart quantities and a public-only confirmation", async t => {
  const f = await fixture(t, new Error("Ordering is temporarily unavailable"));
  assert(f.text().includes("temporarily unavailable")); assert(f.button("Retry catalog"));
  f.recoverCatalog(); await f.button("Retry catalog").props.onClick(); await f.flush();
  f.button("Add to order").props.onClick();
  f.nodes().find(node => node.props["aria-label"] === "Add one Book").props.onClick();
  assert.equal(f.session().read().cart[0].quantity, 2);
  f.nodes().find(node => node.props["aria-label"] === "Remove one Book").props.onClick();
  await f.button("Submit unpaid order").props.onClick();
  assert(f.text().includes("ORDER"));
  const confirmation = f.nodes().find(node => node.type?.name === "OrderConfirmation");
  assert.deepEqual(confirmation.props.status, { reference: "ORDER", orderStatus: "pending" });
  assert(!JSON.stringify(confirmation.props).includes("private-1"));
  assert.equal(f.button("Check order status"), undefined);
  assert(!f.text().includes("Save your private tracking access"));
  assert(!f.text().includes("private-1"));
  assert(!f.nodes().some(node => node.props?.className === "welcome-banner"));
  assert.equal(f.session().read().proof.credential, "private-1");
});

test("kiosk uncertain checkout offers only replay; tracking 404 does not unlock a duplicate submission", async t => {
  const f = await fixture(t); f.button("Add to order").props.onClick();
  f.rejectOrder(new TypeError("lost response")); await f.button("Submit unpaid order").props.onClick();
  assert(f.button("Retry same submission")); assert.equal(f.button("Submit unpaid order"), undefined);
  const original = f.calls.find(call => call.path === "/orders");
  f.rejectTracking(Object.assign(new Error("Order not found"), { status: 404 }));
  await f.button("Check order status").props.onClick();
  assert(f.button("Retry same submission")); assert.equal(f.button("Submit unpaid order"), undefined);
  f.rejectOrder(null); await f.button("Retry same submission").props.onClick();
  assert.deepEqual(f.calls.filter(call => call.path === "/orders"), [original, original]);
  assert(f.nodes().some(node => node.type?.name === "OrderConfirmation"));
});

test("kiosk definitive expired submission recovers with a new guest intent", async t => {
  const f = await fixture(t); f.button("Add to order").props.onClick();
  f.rejectOrder(Object.assign(new Error("expired"), { status: 403 })); await f.button("Submit unpaid order").props.onClick();
  assert(f.text().includes("initialize new guest access"));
  f.rejectOrder(null); await f.button("Submit unpaid order").props.onClick();
  assert.equal(f.calls.filter(call => call.path === "/intents").length, 2);
  assert(f.nodes().some(node => node.type?.name === "OrderConfirmation"));
});

test("kiosk five-minute, Finish and reload cleanup clear cart, confirmation, proof and pending retry", async t => {
  const f = await fixture(t);
  for (const clear of [() => f.expire(), () => f.button("Finish / New Order").props.onClick(), () => f.reload()]) {
    f.button("Add to order").props.onClick(); await f.button("Submit unpaid order").props.onClick();
    assert(f.nodes().some(node => node.type?.name === "OrderConfirmation")); await clear(); await f.flush();
    assert(!f.nodes().some(node => node.type?.name === "OrderConfirmation"));
    assert.equal(f.button("Check order status"), undefined);
    assert.deepEqual(f.session().read().cart, []); assert.equal(f.session().read().proof, null);
    assert.equal(f.button("Submit unpaid order").props.disabled, true);
  }
});

test("stale kiosk quantity handler cannot restore a cart after background idle expiry", async t => {
  const f = await fixture(t); f.button("Add to order").props.onClick();
  const decrement = f.nodes().find(node => node.props["aria-label"] === "Remove one Book");
  f.expire(); decrement.props.onClick(); assert.deepEqual(f.session().read().cart, []);
});

test("Guest Kiosk never exposes account navigation or the removed private-tracking section before or after submission", async t => {
  const f = await fixture(t);
  const check = () => {
    for (const label of ["My Orders", "My Account", "Save your private tracking access", "Save private tracking file", "Download your tracking file", "Your saved private access"]) assert(!f.text().includes(label));
    assert.deepEqual(f.nodes().filter(node => node.type?.name === "Link").map(node => node.props.to), ["/kiosk", "/kiosk?view=shop", "/login"]);
    assert.equal(f.button("Save private tracking file"), undefined);
  };
  check(); f.button("Add to order").props.onClick(); await f.button("Submit unpaid order").props.onClick(); check();
  assert(f.button("Finish / New Order"));
  assert.deepEqual(f.calls.find(call => call.path === "/orders").body.items, [{ product: "book", quantity: 1 }]);
});

test("uncertain guest submissions can still check status using hidden in-memory proof without replaying the order", async t => {
  const f = await fixture(t); f.button("Add to order").props.onClick();
  f.rejectOrder(new TypeError("response lost")); await f.button("Submit unpaid order").props.onClick();
  assert(f.button("Check order status"));
  await f.button("Check order status").props.onClick();
  assert(f.calls.some(call => call.path === "/orders/intent-1" && call.credential === "private-1"));
  assert.equal(f.calls.filter(call => call.path === "/orders").length, 1);
  assert(f.nodes().some(node => node.type?.name === "OrderConfirmation"));
  assert.equal(f.button("Retry same submission"), undefined);
  assert(!f.text().includes("private-1")); assert(!f.text().includes("Save your private tracking access"));
});

test("Guest clothing sizes and cart quantities retain their existing submission payload", async t => {
  const f = await fixture(t);
  Object.assign(f.product, { category: "Clothing", sizes: [{ size: "S", available: true }, { size: "M", available: true }, { size: "XL", available: false }] });
  const select = () => f.nodes().find(node => node.type?.name === "ClothingSizeSelect");
  assert.equal(f.button("Add to order").props.disabled, true);
  select().props.onChange("S"); f.button("Add to order").props.onClick(); f.button("Add to order").props.onClick();
  select().props.onChange("M"); f.button("Add to order").props.onClick();
  select().props.onChange("XL"); assert.equal(f.button("Add to order").props.disabled, true);
  await f.button("Submit unpaid order").props.onClick();
  assert.deepEqual(f.calls.find(call => call.path === "/orders").body.items, [{ product: "book", quantity: 2, size: "S" }, { product: "book", quantity: 1, size: "M" }]);
  assert.equal(f.nodes().find(node => node.type?.name === "OrderConfirmation").props.status.orderStatus, "pending");
});

test("Guest Home uses live catalog products, routes categories to Shop, and retains the cart across navigation", async t => {
  const f = await fixture(t); f.button("Add to order").props.onClick();
  f.navigate({}); await f.flush();
  const home = f.nodes().find(node => node.type?.name === "GuestHome");
  assert(home); assert.deepEqual(home.props.products, [f.product]);
  home.props.onProduct(f.product); assert(f.nodes().some(node => node.type?.name === "ProductDetails" && node.props.product === f.product));
  f.nodes().find(node => node.type?.name === "ProductDetails").props.onClose();
  home.props.onBrowse("Books"); await f.flush();
  assert.equal(f.params().get("view"), "shop"); assert.equal(f.params().get("category"), "Books");
  assert.equal(f.session().read().cart[0].quantity, 1);
  const nav = f.nodes().find(node => node.type === "nav");
  assert.deepEqual(nodes(nav).filter(node => node.type?.name === "Link").map(node => node.props.children), ["Home", "Shop"]);
  assert.equal(nodes(nav).find(node => node.props?.children === "Shop").props["aria-current"], "page");
  await f.button("Submit unpaid order").props.onClick(); assert(f.nodes().some(node => node.type?.name === "OrderConfirmation"));
  const homeLink = f.nodes().find(node => node.type?.name === "Link" && node.props.children === "Home"); homeLink.props.onClick(); f.navigate({}); await f.flush();
  assert(f.nodes().some(node => node.type?.name === "GuestHome")); assert.deepEqual(f.session().read().cart, []);
  assert.equal(f.calls.filter(call => call.path === "/orders").length, 1);
});

test("Guest sign out clears the cart and private proof and returns to sign in without modifying the submitted order", async t => {
  const f = await fixture(t);
  f.button("Add to order").props.onClick();
  await f.button("Submit unpaid order").props.onClick();
  assert(f.session().read().proof);
  const signOut = f.nodes().find(node => node.type?.name === "Link" && node.props.children === "Sign out");
  assert.equal(signOut.props.to, "/login");
  signOut.props.onClick();
  assert.deepEqual(f.session().read().cart, []);
  assert.equal(f.session().read().proof, null);
  assert(!f.nodes().some(node => node.type?.name === "OrderConfirmation"));
  assert.deepEqual(f.calls.map(call => call.path), ["/catalog", "/intents", "/orders"]);
});
