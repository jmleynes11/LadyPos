import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { transformWithOxc } from "vite";

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const fixtureUrl = moduleUrl("export const fixture = {};");
const { fixture } = await import(fixtureUrl);
const reactHooks = moduleUrl(`import { fixture } from ${JSON.stringify(fixtureUrl)}; export const useState = initial => fixture.state(initial); export const useRef = initial => fixture.ref(initial);`);
const source = await fs.readFile(new URL("../src/features/bookstore/CashierOrderQueue.jsx", import.meta.url), "utf8");
let { code } = await transformWithOxc(source.replace('import "./cashier-order-queue.css";', ""), "Queue.jsx", { jsx: { runtime: "automatic", development: false } });
for (const [name, url] of Object.entries({ react: reactHooks, "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"), "./money.js": new URL("../src/features/bookstore/money.js", import.meta.url).href, "../../shared/components/BookstoreUI.jsx": moduleUrl("export function Modal() {} export function Notice() {} export function EmptyState() {}") })) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
const { default: CashierOrderQueue } = await import(moduleUrl(code));
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
}
const order = (orderId, orderStatus, assignedTo = null) => ({ orderId, orderStatus, assignedTo, reference: `UPH-${orderId}`, total: 15050, items: [{ name: "Catalog book", quantity: 1 }] });
function harness(overrides = {}) {
  const memory = [], removed = [], claimed = [], reviewed = []; let cursor = 0;
  fixture.state = initial => { const i = cursor++; if (!(i in memory)) memory[i] = initial; return [memory[i], value => { memory[i] = value; }]; };
  fixture.ref = initial => { const i = cursor++; if (!(i in memory)) memory[i] = { current: initial }; return memory[i]; };
  const props = { orders: [order("active", "pending"), order("assigned", "pending", "cashier"), order("cancelled", "cancelled", "cashier")], accountId: "cashier", canClaim: () => true, canComplete: () => true, disabled: false, busy: false, message: "", onClaim: id => claimed.push(id), onReview: id => reviewed.push(id), onRemove: async id => { removed.push(id); props.orders = props.orders.filter(row => row.orderId !== id); return { queueRemoved: true }; }, ...overrides };
  const render = () => { cursor = 0; return nodes(CashierOrderQueue(props)); };
  const button = (label, orderId) => {
    const elements = render();
    const candidates = orderId ? nodes(elements.find(node => node.type === "tr" && node.key === orderId)) : elements;
    return candidates.find(node => node.type === "button" && node.props.children === label);
  };
  return { props, removed, claimed, reviewed, render, button, dialog: () => render().find(node => node.type?.name === "Modal") };
}

test("Unpaid and cancelled rows offer Delete alongside existing claim and payment actions", () => {
  const h = harness();
  const rows = h.render().filter(node => node.type === "tr" && node.key);
  assert.equal(rows.length, 3);
  const labels = row => nodes(row).filter(node => node.type === "button").map(node => node.props.children);
  assert.deepEqual(labels(rows.find(row => row.key === "active")), ["Claim order", "Delete"]);
  assert.deepEqual(labels(rows.find(row => row.key === "assigned")), ["Review payment", "Delete"]);
  assert.deepEqual(labels(rows.find(row => row.key === "cancelled")), ["Delete"]);
  assert(nodes(rows.find(row => row.key === "cancelled")).some(node => node.type === "span" && node.props.children === "Cancelled"));
  h.button("Claim order").props.onClick(); h.button("Review payment").props.onClick();
  assert.deepEqual(h.claimed, ["active"]); assert.deepEqual(h.reviewed, ["assigned"]); assert.deepEqual(h.removed, []);
});

test("Delete opens the specified confirmation and Cancel changes neither queue nor backend", () => {
  const h = harness(); h.button("Delete", "cancelled").props.onClick();
  assert(h.dialog());
  assert(h.render().some(node => node.type === "p" && node.props.children === "Are you sure you want to delete this order? It will also be removed from the customer's My Orders page."));
  assert(h.button("Cancel")); assert(h.button("Confirm Delete"));
  h.button("Cancel").props.onClick();
  assert.equal(h.dialog(), undefined); assert.equal(h.props.orders.length, 3); assert.deepEqual(h.removed, []);
});

test("Confirm Delete dispatches only the selected cancelled reference and closes after successful refresh", async () => {
  const h = harness(); h.button("Delete", "cancelled").props.onClick(); await h.button("Confirm Delete").props.onClick();
  assert.deepEqual(h.removed, ["cancelled"]); assert.equal(h.dialog(), undefined);
  assert.deepEqual(h.props.orders.map(row => row.orderId), ["active", "assigned"]); assert.equal(h.button("Delete", "cancelled"), undefined);
  assert(h.button("Delete", "active")); assert(h.button("Delete", "assigned"));
});

test("duplicate confirmation clicks cannot dispatch multiple queue removals", async () => {
  let release, requests = 0;
  const h = harness({ onRemove: () => { requests++; return new Promise(resolve => { release = resolve; }); } });
  h.button("Delete", "cancelled").props.onClick(); const confirm = h.button("Confirm Delete");
  const first = confirm.props.onClick(); await confirm.props.onClick();
  assert.equal(requests, 1); assert.equal(h.button("Confirm Delete").props.disabled, true); assert.equal(h.button("Cancel").props.disabled, true);
  release({ queueRemoved: true }); await first; assert.equal(h.dialog(), undefined);
});

test("rejected removal keeps the cancelled row and confirmation available; uncertain or busy states block actions", async () => {
  const h = harness({ onRemove: async () => null });
  h.button("Delete", "cancelled").props.onClick(); await h.button("Confirm Delete").props.onClick();
  assert(h.dialog()); assert.equal(h.props.orders.length, 3);
  h.props.disabled = true; assert.equal(h.button("Confirm Delete").props.disabled, true);
  h.props.busy = true; assert.equal(h.button("Cancel").props.disabled, true); assert.equal(h.dialog().props.busy, true);
});

for (const id of ["active", "assigned"]) test(`Unpaid ${id} row can be deleted`, async () => { const h = harness(); h.button("Delete", id).props.onClick(); assert.equal(h.dialog().props.title, "Delete Order?"); await h.button("Confirm Delete").props.onClick(); assert.deepEqual(h.removed, [id]); assert(!h.props.orders.some(row => row.orderId === id)); });

test("completed rows and unauthorized unpaid rows never offer Delete", () => {
  const h = harness({ orders: [order("paid", "completed"), order("denied", "pending")], canClaim: () => false });
  assert.equal(h.button("Delete", "paid"), undefined);
  assert.equal(h.button("Delete", "denied"), undefined);
});

test("a failed delete displays an error and preserves the exact unpaid row", async () => {
  const h = harness({ onRemove: async () => { throw new Error("Order already paid"); } });
  h.button("Delete", "assigned").props.onClick();
  await h.button("Confirm Delete").props.onClick();
  assert(h.dialog()); assert(h.props.orders.some(row => row.orderId === "assigned"));
  assert(h.render().some(node => node.type?.name === "Notice" && node.props.error && node.props.children === "Order already paid"));
});
