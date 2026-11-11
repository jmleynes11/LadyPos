import test from "node:test";
import assert from "node:assert/strict";
import { createGuestSession, attachGuestSessionEvents, GUEST_IDLE_TIMEOUT_MS } from "../src/features/kiosk/guestSession.js";

function fixture() {
  let clock = 0, next = 0;
  const timers = new Map(), changes = [];
  const session = createGuestSession({ now: () => clock, schedule: callback => { timers.set(++next, callback); return next; }, cancel: id => timers.delete(id), onChange: value => changes.push(value) });
  return { session, timers, changes, advance(ms) { clock += ms; } };
}

test("kiosk clears cart/proof at approved five-minute boundary without changing server orders", () => {
  const f = fixture();
  assert.equal(GUEST_IDLE_TIMEOUT_MS, 300000);
  f.session.setCart([{ product: "synthetic", quantity: 1 }]);
  f.session.acceptProof(f.session.beginSubmission(), { reference: "ORDER", credential: "private" });
  f.advance(299999); assert.equal(f.session.read().proof.credential, "private");
  f.advance(1); assert.deepEqual(f.session.read(), { cart: [], proof: null, generation: 1 });
  assert.equal(f.changes.at(-1).proof, null);
  f.session.dispose(); assert.equal(f.timers.size, 0);
});

test("activity extends active session but cannot restore stale background state", () => {
  const f = fixture(); f.session.setCart(["cart"]);
  f.advance(299999); f.session.activity(); f.advance(299999);
  assert.deepEqual(f.session.read().cart, ["cart"]);
  f.advance(1); f.session.activity();
  assert.deepEqual(f.session.read().cart, []);
  f.session.dispose();
});

test("Finish/New Order reset and idle expiry reject late in-flight credentials", () => {
  const f = fixture(), generation = f.session.beginSubmission();
  f.session.reset();
  assert.equal(f.session.acceptProof(generation, { credential: "old" }), false);
  const next = f.session.beginSubmission(); f.advance(300000);
  assert.equal(f.session.acceptProof(next, { credential: "late" }), false);
  assert.equal(f.session.read().proof, null);
  f.session.dispose();
  assert.equal(f.session.acceptProof(f.session.beginSubmission(), { credential: "disposed" }), false);
});

test("network proof responses cannot extend the idle deadline", () => {
  const f = fixture(), generation = f.session.beginSubmission(); f.advance(299999);
  assert(f.session.acceptProof(generation, { credential: "private", intentId: "intent" }));
  f.advance(1); assert.equal(f.session.read().proof, null); f.session.dispose();
});

test("session snapshots cannot mutate state; fresh page instance has no previous credential", () => {
  const f = fixture(); f.session.setCart([{ quantity: 1 }]);
  f.session.acceptProof(f.session.beginSubmission(), { reference: "ORDER", credential: "private" });
  const copy = f.session.read(); copy.cart[0].quantity = 99; copy.proof.credential = "changed";
  assert.equal(f.session.read().cart[0].quantity, 1);
  assert.equal(f.session.read().proof.credential, "private");
  f.session.dispose(); const fresh = fixture();
  assert.equal(fresh.session.read().proof, null); fresh.session.dispose();
});

test("visibility/pagehide/event cleanup clears memory and prevents listener leaks", () => {
  const f = fixture(), target = new EventTarget(), page = new EventTarget();
  target.defaultView = page;
  const detach = attachGuestSessionEvents(target, f.session);
  f.session.setCart(["cart"]); f.advance(300000);
  target.dispatchEvent(new Event("visibilitychange")); assert.deepEqual(f.session.read().cart, []);
  f.session.acceptProof(f.session.beginSubmission(), { credential: "secret" });
  page.dispatchEvent(new Event("pagehide")); assert.equal(f.session.read().proof, null);
  detach(); assert.equal(f.timers.size, 0);
  target.dispatchEvent(new Event("pointerdown")); assert.equal(f.timers.size, 0);
});
