const EVENTS = new Set([
  "auth.storage_invalid",
  "auth.request_unauthorized",
  "expenses.load_failed",
  "expenses.update_failed",
  "expenses.create_failed",
  "expenses.delete_failed",
  "people.transaction_failed",
  "people.update_failed",
  "people.delete_failed",
]);

const AXIOS_CODES = new Set([
  "ERR_BAD_OPTION_VALUE", "ERR_BAD_OPTION", "ECONNABORTED", "ETIMEDOUT",
  "ERR_NETWORK", "ERR_FR_TOO_MANY_REDIRECTS", "ERR_DEPRECATED",
  "ERR_BAD_RESPONSE", "ERR_BAD_REQUEST", "ERR_CANCELED", "ERR_NOT_SUPPORT", "ERR_INVALID_URL",
]);
const METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);

// Whitelist metadata instead of attempting to redact unknown secrets in arbitrary strings.
export function clientDiagnostic(event, error) {
  const result = { event: EVENTS.has(event) ? event : "client.failure" };
  try {
    const status = error?.response?.status;
    if (Number.isInteger(status) && status >= 100 && status <= 599) result.status = status;
    const code = error?.code;
    if (AXIOS_CODES.has(code)) result.code = code;
    const method = error?.config?.method;
    if (typeof method === "string" && METHODS.has(method.toLowerCase())) result.method = method.toUpperCase();
  } catch {
    // Unexpected objects must not make diagnostics expose data or disrupt error recovery.
  }
  return result;
}

export function logClientError(event, error) {
  console.error("[client]", clientDiagnostic(event, error));
}
