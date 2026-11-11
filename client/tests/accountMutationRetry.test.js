import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import axios, { AxiosError } from "axios";

// Execute the actual account API module; substitute only its Vite env binding
// and module resolution. The Axios adapter below forbids network requests.
const source = await fs.readFile(new URL("../src/features/auth/api/authApi.js", import.meta.url), "utf8");
const code = source.replace('"axios"', JSON.stringify(import.meta.resolve("axios")))
  .replace("import.meta.env.VITE_API_URL", JSON.stringify("https://invalid.example/api"));
const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const token = "synthetic-client-token";
const payload = { _id: "000000000000000000000001", password: "synthetic-password" };

for (const [name, call] of [
  ["registration", () => api.registerUser(payload, token)],
  ["edit", () => api.editUser(payload, token)],
  ["deletion", () => api.deleteUser(payload._id, token)],
  ["profile change", () => api.updateProfile(payload, token)],
  ["password change", () => api.updatePassword(payload, token)],
  ["creation", () => api.createUser(payload, token)],
  ["administrator update", () => api.adminUpdateUser(payload._id, payload, token)],
  ["administrator deletion", () => api.adminDeleteUser(payload._id, token)],
]) {
  test(`actual account API ${name} preserves an indeterminate failure without automatically retrying`, async (t) => {
    const previous = axios.defaults.adapter;
    t.after(() => { axios.defaults.adapter = previous; });
    let calls = 0;
    let original;
    axios.defaults.adapter = async (config) => {
      calls++;
      original = new AxiosError("Synthetic uncertain response", "ERR_BAD_RESPONSE", config, {}, {
        status: 500, headers: {}, data: { success: false, message: "Internal server error", data: null,
          code: "ACCOUNT_MUTATION_OUTCOME_UNKNOWN", operationOutcome: "indeterminate", retryable: false },
      });
      throw original;
    };
    await assert.rejects(call(), (error) => error === original && error.response.data.retryable === false &&
      error.response.data.operationOutcome === "indeterminate");
    assert.equal(calls, 1);
  });
}
