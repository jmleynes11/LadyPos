const base = (import.meta.env?.VITE_API_URL || "/api").replace(/\/$/, "");
export async function guestRequest(path, { method = "GET", body, credential, signal, timeoutMs = 15000 } = {}) {
  let response;
  try {
    response = await fetch(`${base}/bookstore/guest${path}`, {
      method, credentials: "omit", cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(credential ? { "X-Guest-Order-Credential": credential } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Unable to reach guest ordering. Retry when the connection is available.");
  }
  let result;
  try { result = await response.json(); } catch { /* Proxies can return HTML or an empty body. */ }
  if (!response.ok) {
    const code = result?.code;
    const message = code === "GUEST_ORDERING_NOT_CONFIGURED" ? "Guest ordering setup is incomplete. Contact the bookstore."
      : response.status === 429 ? "Too many requests. Wait briefly before retrying."
      : response.status >= 500 ? "Ordering is temporarily unavailable. Retry shortly."
      : result?.message || "Order request failed";
    throw Object.assign(new Error(message), { status: response.status, code, operationOutcome: result?.operationOutcome });
  }
  if (result?.success !== true || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) throw new Error("Guest ordering returned an invalid response. Retry shortly.");
  return result.data;
}
