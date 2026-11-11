import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { transformWithOxc } from "vite";

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const shared = moduleUrl("export const fixture = {};");
const { fixture } = await import(shared);
const source = (await fs.readFile(new URL("../src/features/bookstore/CustomerOrders.jsx", import.meta.url), "utf8")).replace('import "./customer-orders.css";', "");
let { code } = await transformWithOxc(source, "CustomerOrders.jsx", { jsx: { runtime: "automatic", development: false } });
for (const [name, url] of Object.entries({ react: moduleUrl(`import { fixture } from ${JSON.stringify(shared)}; export const useState = value => fixture.state(value); export const useRef = value => fixture.ref(value); export const useEffect = () => {};`), "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"), "./money.js": new URL("../src/features/bookstore/money.js", import.meta.url).href, "../../shared/components/BookstoreUI.jsx": moduleUrl("export function EmptyState() {} export function Modal() {} export function Notice() {} export function Panel() {} export function ProductVisual() {}") })) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
const { default: CustomerOrders } = await import(moduleUrl(code));
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
const text = node => Array.isArray(node) ? node.map(text).join(" ") : node && typeof node === "object" ? text(node.props?.children) : node == null || typeof node === "boolean" ? "" : String(node);
const order = { orderId: "saved-order", reference: "UPH-SAVED-ORDER", orderStatus: "pending", storeName: "Saved branch", submittedAt: "2026-11-10T02:00:00.000Z", paymentStatus: "unpaid", totalQuantity: 2, total: 55000, items: [{ productId: "uniform", name: "Original uniform", size: "M", quantity: 2, unitPrice: 27500, subtotal: 55000, imageUrl: "" }] };
function harness(get) {
  let cursor = 0; const memory = [], calls = [];
  fixture.state = initial => { const index = cursor++; if (!(index in memory)) memory[index] = initial; return [memory[index], value => { memory[index] = value; }]; };
  fixture.ref = initial => { const index = cursor++; if (!(index in memory)) memory[index] = { current: initial }; return memory[index]; };
  const api = { get: (path, options) => { calls.push({ path, options }); return get ? get(path, options) : Promise.resolve({ data: { data: { order } } }); } };
  const render = () => { cursor = 0; return CustomerOrders({ orders: [order], api, storeId: "branch" }); };
  const button = label => nodes(render()).find(node => node.type === "button" && node.props.children === label);
  return { render, button, calls, modal: () => nodes(render()).find(node => node.type?.name === "Modal") };
}
test("My Orders adds Actions beside Status and opens saved product quantities, sizes and prices with Close", async () => {
  const f = harness();
  assert.deepEqual(nodes(f.render()).filter(node => node.type === "th").map(node => node.props.children), ["Public order reference", "Status", "Actions"]);
  await f.button("View Order").props.onClick();
  assert(f.modal()); assert.equal(f.calls[0].path, "/bookstore/orders/own/saved-order"); assert.equal(f.calls[0].options.params.storeId, "branch");
  for (const expected of [order.reference, "Unpaid", "Saved branch", "Original uniform", "M", "2", "PHP 275.00", "PHP 550.00", "unpaid"]) assert(text(f.render()).includes(expected));
  assert.deepEqual(nodes(f.render()).find(node => node.type?.name === "ProductVisual").props.product, order.items[0]);
  f.button("Close").props.onClick(); assert.equal(f.modal(), undefined); assert(f.button("View Order"));
});
test("detail loading and server errors are visible without replacing the list or creating orders", async () => {
  let reject; const f = harness(() => new Promise((_, fail) => { reject = fail; }));
  const pending = f.button("View Order").props.onClick(); assert(text(f.render()).includes("Loading order details"));
  reject({ response: { data: { message: "Order details unavailable" } } }); await pending;
  assert(text(f.render()).includes("Order details unavailable")); assert(f.button("View Order")); assert.equal(f.calls.length, 1);
});
test("closing during retrieval aborts and prevents late responses from reopening private order details", async () => {
  let resolve; const f = harness(() => new Promise(done => { resolve = done; }));
  const pending = f.button("View Order").props.onClick(); f.button("Close").props.onClick();
  assert(f.calls[0].options.signal.aborted); resolve({ data: { data: { order } } }); await pending; assert.equal(f.modal(), undefined);
});
test("a mismatched backend order is rejected rather than displayed", async () => {
  const f = harness(() => Promise.resolve({ data: { data: { order: { ...order, orderId: "someone-else" } } } }));
  await f.button("View Order").props.onClick(); assert(text(f.render()).includes("Order details unavailable")); assert(!text(f.render()).includes("Original uniform"));
});
