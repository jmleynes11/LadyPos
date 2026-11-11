import test from "node:test";
import assert from "node:assert/strict";
import { createGuestSession } from "../src/features/kiosk/guestSession.js";
import { createGuestCheckout } from "../src/features/kiosk/guestCheckout.js";

function fixture(t) {
  let clock = 0, issued = 0, fail = null;
  const calls = [], orders = new Map();
  const session = createGuestSession({ now: () => clock, schedule: () => 0, cancel() {} });
  t.after(() => session.dispose());
  const request = async (path, options) => {
    calls.push({ path, ...structuredClone({ body: options.body, credential: options.credential }) });
    if (path === "/intents") return { intentId: `intent-${++issued}`, credential: `private-${issued}`, expiresAt: "2026-11-16T00:00:00.000Z" };
    if (fail?.status === 403) throw fail;
    const result = { reference: "ORDER", orderStatus: "pending" };
    orders.set(options.body.operationId, result);
    if (fail) throw fail;
    return orders.get(options.body.operationId);
  };
  const checkout = createGuestCheckout(session, request, () => `operation-${issued}`);
  return { session, checkout, calls, orders, fail(error) { fail = error; }, advance(ms) { clock += ms; } };
}

test("guest checkout submits cart quantities and sizes and accepts confirmation proof", async t => {
  const f = fixture(t);
  f.session.setCart([{ product: "book", quantity: 1 }, { product: "uniform", quantity: 2, size: "M" }]);
  const result = await f.checkout.submit();
  assert.equal(result.orderStatus, "pending"); assert.equal(f.session.read().proof.reference, "ORDER");
  assert.deepEqual(f.calls[1].body.items, [{ product: "book", quantity: 1 }, { product: "uniform", quantity: 2, size: "M" }]);
});

test("lost order response retries the identical operation, intent, credential and cart without duplicate orders", async t => {
  const f = fixture(t); f.session.setCart([{ product: "book", quantity: 2 }]);
  f.fail(new TypeError("lost response"));
  await assert.rejects(f.checkout.submit(), error => error.uncertain === true);
  const first = structuredClone(f.calls[1]);
  f.session.setCart([{ product: "book", quantity: 99 }]); f.fail(null);
  assert.equal((await f.checkout.submit()).reference, "ORDER");
  assert.deepEqual(f.calls[2], first); assert.equal(f.orders.size, 1);
  assert.equal(f.calls.filter(call => call.path === "/intents").length, 1);
});

test("expired or invalid proof permits fresh initialization only after definitive submission denial", async t => {
  const f = fixture(t); f.session.setCart([{ product: "book", quantity: 1 }]);
  f.fail(Object.assign(new Error("expired"), { status: 403 }));
  await assert.rejects(f.checkout.submit(), error => error.uncertain === false);
  f.fail(null); await f.checkout.submit();
  assert.equal(f.calls[1].credential, "private-1"); assert.equal(f.calls[3].credential, "private-2");
  assert.equal(f.orders.size, 1);
});

test("throttling or denial of a replay cannot erase the original uncertain outcome", async t => {
  const f = fixture(t); f.session.setCart([{ product: "book", quantity: 1 }]);
  f.fail(new Error("lost response")); await assert.rejects(f.checkout.submit());
  const original = structuredClone(f.calls[1]);
  for (const status of [429, 403, 409, 503]) {
    f.fail(Object.assign(new Error("denied replay"), { status }));
    await assert.rejects(f.checkout.submit(), error => error.uncertain === true);
    assert.deepEqual(f.calls.at(-1), original);
  }
  f.fail(null); await f.checkout.submit();
  assert.deepEqual(f.calls.at(-1), original); assert.equal(f.orders.size, 1);
});

test("five-minute cleanup and Finish invalidate pending replays and never revive cart or proof", async t => {
  for (const reset of [f => f.advance(300000), f => f.session.reset()]) {
    const f = fixture(t); f.session.setCart([{ product: "book", quantity: 1 }]);
    f.fail(new Error("offline")); await assert.rejects(f.checkout.submit()); reset(f);
    await assert.rejects(f.checkout.submit(), /Add products/);
    assert.equal(f.session.read().proof, null);
    f.session.setCart([{ product: "other", quantity: 1 }]); f.fail(null);
    await f.checkout.submit();
    assert.equal(f.calls.at(-1).credential, "private-2");
    assert.deepEqual(f.calls.at(-1).body.items, [{ product: "other", quantity: 1 }]);
  }
});

test("late intent and order responses after session clearing cannot expose private proof", async t => {
  for (const clearAt of ["/intents", "/orders"]) {
    const f = fixture(t); f.session.setCart([{ product: "book", quantity: 1 }]);
    const checkout = createGuestCheckout(f.session, async path => {
      if (path === clearAt) f.session.reset();
      return path === "/intents" ? { intentId: "old", credential: "old", expiresAt: "2026-11-16T00:00:00.000Z" } : { reference: "OLD", orderStatus: "pending" };
    });
    assert.equal(await checkout.submit(), null);
    assert.equal(f.session.read().proof, null); assert.deepEqual(f.session.read().cart, []);
  }
});
