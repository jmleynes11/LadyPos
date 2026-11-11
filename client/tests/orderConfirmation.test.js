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
const reactHooks = moduleUrl(`import { state } from ${JSON.stringify(fixtureUrl)}; export const useState = initial => [state.message || initial, value => { state.message = value; }];`);
async function compile(path, replacements = {}) {
  const source = await fs.readFile(new URL(path, import.meta.url), "utf8");
  let { code } = await transformWithOxc(source, "Confirmation.jsx", { jsx: { runtime: "automatic", development: false } });
  for (const [name, url] of Object.entries({ react: import.meta.resolve("react"), "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"), ...replacements })) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
  return moduleUrl(code);
}
const ui = await compile("../src/shared/components/BookstoreUI.jsx");
const { default: OrderConfirmation } = await import(await compile("../src/features/kiosk/OrderConfirmation.jsx", { react: reactHooks, "../../shared/components/BookstoreUI.jsx": ui }));
const reference = "UPH-8QR7-M2TX";
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
}
function setup(t, clipboard, fallbackResult = true) {
  state.message = "";
  const copied = [], fields = [];
  let restoredFocus = 0;
  const document = {
    activeElement: { focus() { restoredFocus++; } },
    body: { appendChild(field) { fields.push(field); } },
    createElement(tag) {
      assert.equal(tag, "textarea");
      return { style: {}, focus(options) { assert.deepEqual(options, { preventScroll: true }); }, select() { assert.equal(this.readOnly, true); }, remove() { fields.splice(fields.indexOf(this), 1); } };
    },
    execCommand(command) { assert.equal(command, "copy"); assert.equal(fields.length, 1); if (fallbackResult) copied.push(fields[0].value); return fallbackResult; },
  };
  for (const [name, value] of [["navigator", { clipboard }], ["document", document]]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => { if (previous) Object.defineProperty(globalThis, name, previous); else delete globalThis[name]; });
  }
  const render = (value = reference) => OrderConfirmation({ status: { reference: value, orderStatus: "pending" } });
  return { copied, fields, render, copy(value) { return nodes(render(value)).find(node => node.type === "button").props.onClick(); }, get restoredFocus() { return restoredFocus; } };
}

test("confirmation keeps the design, required wording, readable reference and private credentials off screen", () => {
  state.message = "";
  const html = renderToStaticMarkup(createElement(OrderConfirmation, { status: { reference, orderStatus: "pending", credential: "never-display-this-private-proof" } }));
  for (const text of ["ORDER SUBMITTED", "Your order has been successfully submitted.", "ORDER REFERENCE", reference, "Copy", "Keep this reference for your order inquiries.", "Unpaid · Proceed To Cashier"]) assert(html.includes(text));
  assert(!html.includes("Public order reference")); assert(!html.includes("never-display-this-private-proof"));
  assert(html.includes('class="ui-panel ')); assert(html.includes('aria-label="Copy order reference"'));
  assert(html.includes('class="ui-panel guest-order-confirmation"')); assert(html.includes('class="guest-reference-row"'));
  assert(html.includes('role="status" aria-live="polite"'));
});

test("Copy writes exactly the displayed reference and confirms only after clipboard success", async t => {
  let release; const copied = [];
  const h = setup(t, { writeText(value) { copied.push(value); return new Promise(resolve => { release = resolve; }); } });
  const displayed = nodes(h.render()).find(node => node.type === "strong").props.children;
  const pending = h.copy(); assert.equal(state.message, ""); assert.deepEqual(copied, [displayed]);
  release(); await pending;
  assert.equal(state.message, "Reference copied!");
  assert.equal(nodes(h.render()).find(node => node.type === "strong").props.children, displayed);
  assert.equal(h.fields.length, 0);
});

test("Copy supports existing UUID references without reformatting or replacing them", async t => {
  const copied = [], legacy = "d491ca1e-67a0-4d03-ae64-11c9b5312100";
  const h = setup(t, { async writeText(value) { copied.push(value); } });
  await h.copy(legacy); assert.deepEqual(copied, [legacy]);
  assert.equal(nodes(h.render(legacy)).find(node => node.type === "strong").props.children, legacy);
});

for (const clipboard of [undefined, { async writeText() { throw new Error("Permission denied"); } }]) test("Copy falls back on kiosk browsers without Clipboard API access and cleans up the temporary field", async t => {
  const h = setup(t, clipboard); await h.copy();
  assert.deepEqual(h.copied, [reference]); assert.equal(state.message, "Reference copied!");
  assert.equal(h.fields.length, 0); assert.equal(h.restoredFocus, 1);
});

test("clipboard failure reports manual copying without falsely confirming success or hiding the reference", async t => {
  const h = setup(t, undefined, false); await h.copy();
  assert(state.message.includes("Unable to copy")); assert(!state.message.includes("Reference copied!"));
  assert.equal(nodes(h.render()).find(node => node.type === "strong").props.children, reference);
  assert.equal(h.fields.length, 0); assert.equal(h.restoredFocus, 1);
});
