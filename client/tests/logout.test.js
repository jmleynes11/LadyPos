import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

// Execute the actual provider's logout callback through an SSR context capture.
// Effects/navigation and browser state rerenders are not simulated here.
const source = await fs.readFile(new URL("../src/shared/hooks/AuthContext.jsx", import.meta.url), "utf8");
const noNetworkAuth = `data:text/javascript;base64,${Buffer.from('export const loginUser = () => { throw new Error("Unexpected authentication request during logout"); };').toString("base64")}`;
const transformed = await transformWithOxc(source, "AuthContext.jsx", { jsx: { runtime: "automatic", development: false } });
const code = transformed.code
  .replaceAll('"../../features/bookstore/pendingOperation.js"', JSON.stringify(new URL("../src/features/bookstore/pendingOperation.js", import.meta.url).href))
  .replaceAll('"react"', JSON.stringify(import.meta.resolve("react")))
  .replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
  .replaceAll('"../../features/auth/api/authApi"', JSON.stringify(noNetworkAuth))
  .replaceAll('"../utils/safeDiagnostics.js"', JSON.stringify(new URL("../src/shared/utils/safeDiagnostics.js", import.meta.url).href));
const { AuthProvider, useAuth } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

test("actual frontend logout clears both browser stores locally without calling authentication APIs", (t) => {
  const stores = {};
  for (const name of ["localStorage", "sessionStorage"]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    const values = new Map([["jwt", "synthetic-cached-token"], ["user", "synthetic-cached-user"], ["theme", "synthetic-theme"]]);
    stores[name] = { values, clears: 0 };
    const storage = {
      clear() { stores[name].clears++; values.clear(); },
      removeItem(key) { values.delete(key); },
      setItem(key, value) { values.set(key, value); },
      getItem(key) { return values.get(key) ?? null; },
    };
    Object.defineProperty(globalThis, name, { configurable: true, value: storage });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else delete globalThis[name];
    });
  }
  let auth;
  function CaptureContext() { auth = useAuth(); return null; }
  renderToStaticMarkup(createElement(AuthProvider, null, createElement(CaptureContext)));
  auth.logout();
  for (const name of Object.keys(stores)) {
    assert.equal(stores[name].values.size, 0);
    assert.equal(stores[name].clears, 1);
  }
});
