import test from "node:test";
import assert from "node:assert/strict";
import { issueGuestOrderCredential, verifyGuestOrderCredential, GUEST_TRACKING_LIFETIME_MS } from "../auth/guestOrderAccess.js";

const order = "aaaaaaaaaaaaaaaaaaaaaaaa", other = "bbbbbbbbbbbbbbbbbbbbbbbb";
const issued = new Date("2026-11-04T00:00:00.000Z");

test("D3 guest proof is random, verifier-only and bound to its order", () => {
  const a = issueGuestOrderCredential(order, issued), b = issueGuestOrderCredential(order, issued);
  assert.match(a.credential, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.credential, b.credential);
  assert(!JSON.stringify(a.verification).includes(a.credential));
  assert.deepEqual(Object.keys(a.verification).sort(), ["digest", "expiresAt", "issuedAt"]);
  assert(verifyGuestOrderCredential(order.toUpperCase(), a.credential, a.verification, issued));
  assert(!verifyGuestOrderCredential(other, a.credential, a.verification, issued));
  assert(!verifyGuestOrderCredential(order, b.credential, a.verification, issued));
});

test("D3 seven-day lifetime rejects exact expiry, future issuance and altered expiry", () => {
  const a = issueGuestOrderCredential(order, issued);
  assert.equal(a.verification.expiresAt.toISOString(), "2026-11-11T00:00:00.000Z");
  assert.equal(GUEST_TRACKING_LIFETIME_MS, 604800000);
  for (const [offset, expected] of [[-1, false], [0, true], [604799999, true], [604800000, false], [604800001, false]]) {
    assert.equal(verifyGuestOrderCredential(order, a.credential, a.verification, new Date(issued.valueOf() + offset)), expected);
  }
  assert(!verifyGuestOrderCredential(order, a.credential, { ...a.verification, expiresAt: new Date("2026-12-01") }, issued));
  assert.equal(issued.toISOString(), "2026-11-04T00:00:00.000Z");
});

test("D3 malformed credential/context/verification fails closed without coercion", () => {
  const a = issueGuestOrderCredential(order, issued);
  for (const token of [null, undefined, {}, [], 1, "", "public-reference", a.credential + "a"]) assert(!verifyGuestOrderCredential(order, token, a.verification, issued));
  for (const verification of [null, {}, { ...a.verification, digest: "z".repeat(64) }, { ...a.verification, digest: [] }, { ...a.verification, issuedAt: issued.toISOString() }, { ...a.verification, expiresAt: new Date(NaN) }]) {
    assert(!verifyGuestOrderCredential(order, a.credential, verification, issued));
  }
  for (const clock of [null, "2026-11-04", new Date(NaN)]) {
    assert.throws(() => issueGuestOrderCredential(order, clock));
    assert(!verifyGuestOrderCredential(order, a.credential, a.verification, clock));
  }
  for (const id of [null, { $ne: null }, [order]]) assert.throws(() => issueGuestOrderCredential(id, issued));
  assert.throws(() => issueGuestOrderCredential(order, new Date(8640000000000000)));
});
