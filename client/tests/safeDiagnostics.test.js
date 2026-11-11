import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { AxiosError } from "axios";
import { clientDiagnostic, logClientError } from "../src/shared/utils/safeDiagnostics.js";

function sensitiveError() {
  const config = {
    method: "post",
    url: "https://invalid.example/login?token=synthetic-query-token",
    headers: { Authorization: "Bearer synthetic-bearer-token", Cookie: "synthetic-session-cookie" },
    auth: { username: "synthetic-user", password: "synthetic-password" },
    data: { currentPassword: "synthetic-current-password", newPassword: "synthetic-new-password" },
  };
  const response = { status: 401, headers: { "set-cookie": "synthetic-response-cookie" }, data: {
    message: "synthetic-unknown-server-secret", connectionString: "synthetic-database-secret", token: "synthetic-returned-token",
  } };
  const error = new AxiosError("synthetic-message-secret", "ERR_BAD_REQUEST", config, {}, response);
  error.stack = "synthetic-stack-secret";
  error.cause = { password: "synthetic-cause-secret" };
  return error;
}

test("Axios diagnostics retain useful metadata while excluding headers, passwords, bodies and server secrets", (t) => {
  const error = sensitiveError();
  const before = error.toJSON();
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  logClientError("expenses.create_failed", error);
  assert.deepEqual(logs, [["[client]", {
    event: "expenses.create_failed", status: 401, code: "ERR_BAD_REQUEST", method: "POST",
  }]]);
  assert(!JSON.stringify(logs).includes("synthetic-"));
  assert.deepEqual(error.toJSON(), before, "logging must not mutate errors used by existing callers");
});

test("untrusted event, code, method and status strings cannot become diagnostics", () => {
  assert.deepEqual(clientDiagnostic("synthetic-event-secret", {
    code: "synthetic-code-secret", response: { status: "synthetic-status-secret" },
    config: { method: "synthetic-method-secret" }, message: "synthetic-message-secret",
  }), { event: "client.failure" });
  assert.deepEqual(clientDiagnostic("auth.storage_invalid", "synthetic-stored-user-data"), { event: "auth.storage_invalid" });
  assert.deepEqual(clientDiagnostic("auth.storage_invalid", { get response() { throw new Error("synthetic-getter-secret"); } }), { event: "auth.storage_invalid" });
});

test("network/cancellation diagnostics work without a response; invalid statuses are omitted", () => {
  assert.deepEqual(clientDiagnostic("expenses.load_failed", { code: "ERR_NETWORK", config: { method: "get" } }), {
    event: "expenses.load_failed", code: "ERR_NETWORK", method: "GET",
  });
  assert.deepEqual(clientDiagnostic("expenses.load_failed", { code: "ERR_CANCELED", response: { status: 900 } }), {
    event: "expenses.load_failed", code: "ERR_CANCELED",
  });
});

test("actual Axios interceptor logs safely and rejects the original error without making a network request", async (t) => {
  const source = await fs.readFile(new URL("../src/shared/utils/apiClient.js", import.meta.url), "utf8");
  const code = source
    .replaceAll('"axios"', JSON.stringify(import.meta.resolve("axios")))
    .replaceAll('"./safeDiagnostics.js"', JSON.stringify(new URL("../src/shared/utils/safeDiagnostics.js", import.meta.url).href))
    .replace("import.meta.env.VITE_API_URL", JSON.stringify("https://invalid.example/api"));
  const { createApiClient } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const error = sensitiveError();
  const api = createApiClient("synthetic-client-token");
  let adapterCalls = 0;
  api.defaults.adapter = async () => { adapterCalls++; throw error; };
  await assert.rejects(api.post("/synthetic", { password: "synthetic-request-password" }), (result) => result === error);
  assert.equal(adapterCalls, 1);
  assert.deepEqual(logs, [["[client]", { event: "auth.request_unauthorized", status: 401, code: "ERR_BAD_REQUEST", method: "POST" }]]);
});

test("frontend console output stays centralized; old raw payload/storage/error logging cannot reappear", async () => {
  const root = new URL("../src/", import.meta.url);
  const violations = [];
  async function inspect(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
      if (entry.isDirectory()) await inspect(file);
      else if (/\.[jt]sx?$/.test(entry.name) && entry.name !== "safeDiagnostics.js") {
        const source = await fs.readFile(file, "utf8");
        if (/\bconsole\s*(?:\.|\[)/.test(source)) violations.push(file.pathname);
      }
    }
  }
  await inspect(root);
  assert.deepEqual(violations, []);
});
