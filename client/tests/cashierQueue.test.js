import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { setImmediate } from "node:timers/promises";

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const fixtureUrl = moduleUrl("export const fixture = {};");
const { fixture } = await import(fixtureUrl);
const hooksUrl = moduleUrl(`import { fixture } from ${JSON.stringify(fixtureUrl)}; export const useState = value => fixture.state(value); export const useRef = value => fixture.ref(value); export const useCallback = (work, deps) => fixture.callback(work, deps); export const useEffect = (work, deps) => fixture.effect(work, deps);`);
const source = await fs.readFile(new URL("../src/features/bookstore/useCashierQueue.js", import.meta.url), "utf8");
const { useCashierQueue, CASHIER_QUEUE_REFRESH_MS } = await import(moduleUrl(source.replace('"react"', JSON.stringify(hooksUrl))));

function harness(t, role = "cashier") {
  const memory = [], effects = [], timers = new Map(), calls = [];
  let cursor = 0, dirty = false, timerId = 0, result;
  const browser = new EventTarget(), document = new EventTarget();
  document.visibilityState = "visible";
  browser.setInterval = (work, delay) => { assert.equal(delay, 15000); timers.set(++timerId, work); return timerId; };
  browser.clearInterval = id => timers.delete(id);
  t.after(() => memory.forEach(value => value?.cleanup?.()));
  for (const [name, value] of [["window", browser], ["document", document]]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => { if (previous) Object.defineProperty(globalThis, name, previous); else delete globalThis[name]; });
  }
  Object.assign(fixture, {
    state(initial) { const index = cursor++; if (!(index in memory)) memory[index] = typeof initial === "function" ? initial() : initial; return [memory[index], value => { memory[index] = value; dirty = true; }]; },
    ref(initial) { const index = cursor++; if (!(index in memory)) memory[index] = { current: initial }; return memory[index]; },
    callback(work, deps) { const index = cursor++, previous = memory[index]; if (!previous || deps.some((value, i) => value !== previous.deps[i])) memory[index] = { work, deps }; return memory[index].work; },
    effect(work, deps) { const index = cursor++, previous = memory[index]; if (!previous || deps.some((value, i) => value !== previous.deps[i])) { previous?.cleanup?.(); memory[index] = { deps }; effects.push(() => { memory[index].cleanup = work(); }); } },
  });
  const state = { context: { role, accountId: "cashier-a", capabilities: { "order.fulfill": true }, stores: [{ id: "store-a" }, { id: "store-b" }] }, jwt: "session-a", storeId: "store-a", orders: [], failure: null, respond: null };
  const api = { async get(path, options) {
    calls.push({ path, ...options });
    if (state.respond) return state.respond(options);
    if (state.failure) throw state.failure;
    return { data: { data: { orders: [...state.orders] } } };
  } };
  const render = () => { cursor = 0; result = useCashierQueue(state.context, api, state.jwt, state.storeId); return result; };
  const flush = async () => { for (let i = 0; i < 10; i++) { dirty = false; render(); effects.splice(0).forEach(work => work()); await setImmediate(); if (!dirty && !effects.length) return; } throw Error("Queue hook did not settle"); };
  const cleanup = () => memory.forEach(value => value?.cleanup?.());
  return { state, calls, browser, document, timers, render, flush, cleanup, get result() { return result; }, tick() { for (const work of timers.values()) work(); } };
}

test("Cashier queue polls the backend, reflects arrivals and completion, and hides its badge at zero", async t => {
  const h = harness(t);
  assert.equal(CASHIER_QUEUE_REFRESH_MS, 15000);
  h.state.orders = [{ orderId: "guest-order", orderStatus: "pending" }];
  await h.flush(); assert.equal(h.result.count, 1);
  h.state.orders.push({ orderId: "student-order", orderStatus: "pending" });
  h.tick(); await h.flush(); assert.equal(h.result.count, 2);
  h.state.orders.shift();
  await h.result.refresh(); await h.flush(); assert.equal(h.result.count, 1);
  h.state.orders = [];
  await h.result.refresh(); await h.flush(); assert.equal(h.result.count, 0);
  for (const call of h.calls) { assert.equal(call.path, "/bookstore/orders/queue"); assert.deepEqual(call.params, { storeId: "store-a", includeCancelled: true }); }
});

test("cancelled queue rows remain visible but never inflate the pending-order notification badge", async t => {
  const h = harness(t);
  h.state.orders = [{ orderId: "pending", orderStatus: "pending" }, { orderId: "cancelled", orderStatus: "cancelled" }];
  await h.flush(); assert.equal(h.result.orders.length, 2); assert.equal(h.result.count, 1);
  h.state.orders = [h.state.orders[1]]; await h.result.refresh(); await h.flush();
  assert.equal(h.result.orders.length, 1); assert.equal(h.result.count, 0);
  h.state.orders = []; await h.result.refresh(); await h.flush(); assert.equal(h.result.count, 0);
});

test("Cashier polling pauses while hidden and refreshes on focus and visibility recovery", async t => {
  const h = harness(t); await h.flush(); const initial = h.calls.length;
  h.document.visibilityState = "hidden"; h.tick(); await h.flush(); assert.equal(h.calls.length, initial);
  h.state.orders = [{ orderId: "new-order", orderStatus: "pending" }]; h.document.visibilityState = "visible";
  h.document.dispatchEvent(new Event("visibilitychange")); await h.flush(); assert.equal(h.result.count, 1);
  h.state.orders = []; h.browser.dispatchEvent(new Event("focus")); await h.flush(); assert.equal(h.result.count, 0);
  h.cleanup(); assert.equal(h.timers.size, 0);
  const finalCalls = h.calls.length; h.browser.dispatchEvent(new Event("focus")); h.tick(); await setImmediate(); assert.equal(h.calls.length, finalCalls);
});

test("store/session changes discard stale in-flight results and polling failures never show a false count", async t => {
  const h = harness(t); h.state.orders = [{ orderId: "old-order", orderStatus: "pending" }]; await h.flush();
  let release;
  h.state.respond = () => new Promise(resolve => { release = resolve; });
  const pending = h.result.refresh(); const oldSignal = h.calls.at(-1).signal;
  h.state.respond = null; h.state.storeId = "store-b"; h.state.orders = [];
  assert.equal(h.render().count, null); await h.flush(); assert.equal(oldSignal.aborted, true);
  release({ data: { data: { orders: [{ orderId: "stale-order", orderStatus: "pending" }] } } }); await pending; await h.flush();
  assert.equal(h.result.count, 0); assert.equal(h.calls.at(-1).params.storeId, "store-b");
  h.state.failure = new Error("offline"); await h.result.refresh(); await h.flush(); assert.equal(h.result.count, null); assert(h.result.error);
  h.state.failure = null; h.state.jwt = "session-b"; h.state.orders = [{ orderId: "current-order", orderStatus: "pending" }];
  assert.equal(h.render().count, null); await h.flush(); assert.equal(h.result.count, 1);
});

for (const role of ["admin", "store_manager", "customer", "user"]) test(`${role} never starts queue notification polling`, async t => {
  const h = harness(t, role); await h.flush(); await h.result.refresh(); h.tick();
  assert.equal(h.calls.length, 0); assert.equal(h.timers.size, 0); assert.equal(h.result.count, null);
});

test("logout aborts an outstanding queue read and clears account counts", async t => {
  const h = harness(t); await h.flush();
  let release; h.state.respond = () => new Promise(resolve => { release = resolve; });
  const pending = h.result.refresh(), signal = h.calls.at(-1).signal;
  h.state.context = null; h.state.jwt = null; assert.equal(h.render().count, null); await h.flush();
  assert.equal(signal.aborted, true); assert.equal(h.timers.size, 0);
  release({ data: { data: { orders: [{ orderId: "old-account-order", orderStatus: "pending" }] } } }); await pending; await h.flush(); assert.equal(h.result.count, null);
});
