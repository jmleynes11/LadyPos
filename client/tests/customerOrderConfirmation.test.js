import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const fixtureUrl = moduleUrl('export const state = { message: "" };');
const { state } = await import(fixtureUrl);
const hooks = moduleUrl(`import { state } from ${JSON.stringify(fixtureUrl)}; export const useState = initial => [state.message || initial, value => { state.message = value; }];`);
async function compile(path, replacements = {}) {
  const source = (await fs.readFile(new URL(path, import.meta.url), "utf8")).replace('import "./customer-order-confirmation.css";', "");
  let { code } = await transformWithOxc(source, "CustomerConfirmation.jsx", { jsx: { runtime: "automatic", development: false } });
  for (const [name, url] of Object.entries({ react: import.meta.resolve("react"), "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"), ...replacements })) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
  return moduleUrl(code);
}
const ui = await compile("../src/shared/components/BookstoreUI.jsx");
const { default: CustomerOrderConfirmation } = await import(await compile("../src/features/bookstore/CustomerOrderConfirmation.jsx", { react: hooks, "../../shared/components/BookstoreUI.jsx": ui }));
const order = { orderId: "a".repeat(24), reference: "UPH-8KRW-N7Q4", orderStatus: "pending" };
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
}
function setup(t, clipboard, fallbackResult = true) {
  state.message = "";
  const copied = [], fields = [];
  const document = {
    activeElement: { focus() {} }, body: { appendChild(field) { fields.push(field); } },
    createElement(tag) {
      assert.equal(tag, "textarea");
      return { style: {}, focus() {}, select() { assert.equal(this.readOnly, true); }, remove() { fields.splice(fields.indexOf(this), 1); } };
    },
    execCommand(command) { assert.equal(command, "copy"); if (fallbackResult) copied.push(fields[0].value); return fallbackResult; },
  };
  for (const [name, value] of [["navigator", { clipboard }], ["document", document]]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => { if (previous) Object.defineProperty(globalThis, name, previous); else delete globalThis[name]; });
  }
  const render = value => CustomerOrderConfirmation({ order: value || order });
  return { copied, fields, render, copy(value) { return nodes(render(value)).find(node => node.type === "button").props.onClick(); } };
}

test("Customer confirmation matches the public card content without guest-specific controls or instructions", () => {
  state.message = "";
  const html = renderToStaticMarkup(createElement(CustomerOrderConfirmation, { order }));
  for (const text of ["ORDER SUBMITTED", "Your order has been successfully submitted.", "ORDER REFERENCE", order.reference, "Copy", "Keep this reference for your order inquiries.", "Unpaid · Proceed To Cashier"]) assert(html.includes(text));
  assert(html.includes('class="ui-panel customer-order-confirmation"'));
  assert(html.includes('aria-label="Copy order reference"')); assert(html.includes('role="status" aria-live="polite"'));
  for (const text of ["Student / staff sign in", "Finish / New Order", "kiosk clears", "private tracking"]) assert(!html.includes(text));
});

test("Customer Copy uses the exact returned reference and confirms only after successful copying", async t => {
  let release; const copied = [];
  const h = setup(t, { writeText(value) { copied.push(value); return new Promise(resolve => { release = resolve; }); } });
  const displayed = nodes(h.render()).find(node => node.type === "strong").props.children;
  const pending = h.copy(); assert.equal(state.message, ""); assert.deepEqual(copied, [displayed]);
  release(); await pending; assert.equal(state.message, "Order reference copied.");
  assert.equal(nodes(h.render()).find(node => node.type === "strong").props.children, displayed);
});

test("Customer Copy preserves original UUID references verbatim", async t => {
  const copied = [], legacy = { ...order, reference: "d491ca1e-67a0-4d03-ae64-11c9b5312100" };
  const h = setup(t, { async writeText(value) { copied.push(value); } });
  await h.copy(legacy); assert.deepEqual(copied, [legacy.reference]);
});

for (const clipboard of [undefined, { async writeText() { throw new Error("Permission denied"); } }]) test("Customer copy fallback copies only the public reference and removes its temporary field", async t => {
  const h = setup(t, clipboard); await h.copy(); assert.deepEqual(h.copied, [order.reference]);
  assert.equal(h.fields.length, 0); assert.equal(state.message, "Order reference copied.");
});

test("Customer clipboard errors keep the reference visible and never report success", async t => {
  const h = setup(t, undefined, false); await h.copy(); assert(state.message.includes("Unable to copy"));
  assert.equal(h.fields.length, 0); assert.equal(nodes(h.render()).find(node => node.type === "strong").props.children, order.reference);
});

test("missing or incomplete order responses never produce a placeholder reference or usable Copy button", () => {
  for (const value of [null, {}, { ...order, reference: "" }, { ...order, reference: "   " }]) {
    state.message = "";
    const html = renderToStaticMarkup(createElement(CustomerOrderConfirmation, { order: value, loading: false }));
    assert(!html.includes("ORDER SUBMITTED")); assert(!html.includes("Copy order reference")); assert(html.includes("My Orders"));
  }
});

test("confirmation reload reflects the actual owned status after the cashier completes payment", () => {
  state.message = "";
  const html = renderToStaticMarkup(createElement(CustomerOrderConfirmation, { order: { ...order, orderStatus: "completed" } }));
  assert(html.includes("completed")); assert(!html.includes("Unpaid · Proceed To Cashier")); assert(html.includes(order.reference));
});
