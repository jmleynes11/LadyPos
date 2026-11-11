import test from "node:test";
import assert from "node:assert/strict";
import { guestRequest } from "../src/features/kiosk/guestApi.js";

test("guest API uses configured API path without staff cookies or Authorization", async t => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/bookstore/guest/orders");
    assert.equal(options.credentials, "omit"); assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers["X-Guest-Order-Credential"], "private");
    assert.deepEqual(JSON.parse(options.body), { intentId: "intent" });
    return Response.json({ success: true, data: { reference: "ORDER" } });
  });
  assert.deepEqual(await guestRequest("/orders", { method: "POST", body: { intentId: "intent" }, credential: "private" }), { reference: "ORDER" });
});

test("guest API distinguishes setup, throttling, server failures and malformed responses", async t => {
  let response;
  t.mock.method(globalThis, "fetch", async () => response);
  for (const [value, pattern, status] of [
    [Response.json({ code: "GUEST_ORDERING_NOT_CONFIGURED", message: "Internal server error" }, { status: 503 }), /setup is incomplete/, 503],
    [Response.json({ message: "limit" }, { status: 429 }), /Wait briefly/, 429],
    [new Response("<html>Bad gateway</html>", { status: 502 }), /temporarily unavailable/, 502],
    [Response.json({ message: "Private guest proof required" }, { status: 403 }), /Private guest proof/, 403],
    [new Response("<html>frontend fallback</html>"), /invalid response/, undefined],
    [Response.json({ success: true }), /invalid response/, undefined],
  ]) {
    response = value;
    await assert.rejects(guestRequest("/catalog"), error => pattern.test(error.message) && error.status === status);
  }
});

test("guest API network failure, timeout and caller abort settle without automatic POST replay", async t => {
  let calls = 0;
  const mock = t.mock.method(globalThis, "fetch", async () => { calls++; throw new TypeError("network failure"); });
  await assert.rejects(guestRequest("/orders", { method: "POST", body: {} }), /Unable to reach/);
  assert.equal(calls, 1);
  mock.mock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  // Keep the test alive while the platform's unref'ed timeout signal fires.
  const keepAlive = setTimeout(() => {}, 1000);
  try { await assert.rejects(guestRequest("/catalog", { timeoutMs: 1 }), /Unable to reach/); }
  finally { clearTimeout(keepAlive); }
  const controller = new AbortController(), pending = guestRequest("/catalog", { signal: controller.signal });
  controller.abort(); await assert.rejects(pending, { name: "AbortError" });
});
