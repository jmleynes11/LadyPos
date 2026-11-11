const prefix = "bookstore.pending.";
const id = value => typeof value === "string" && /^[a-f0-9]{24}$/.test(value);
function validate(value, accountId) {
  return value && ["accountId,operationId,setup,storeId", "accountId,kind,operationId,setup,storeId"].includes(Object.keys(value).sort().join(",")) &&
    (value.kind === undefined || ["command", "directCheckout"].includes(value.kind)) &&
    value.accountId === accountId && id(accountId) && (value.storeId === "" || id(value.storeId)) &&
    typeof value.setup === "boolean" && typeof value.operationId === "string" && /^[a-zA-Z0-9_-]{8,100}$/.test(value.operationId);
}
// Contains reconciliation identity only. Never store request bodies or payment data.
export function readPending(storage, accountId) {
  const raw = storage.getItem(prefix + accountId);
  if (raw === null) return null;
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error("Pending operation metadata requires reconciliation"); }
  if (!validate(value, accountId)) throw new Error("Pending operation metadata requires reconciliation");
  return value;
}
export function savePending(storage, value) {
  if (!validate(value, value?.accountId)) throw new Error("Invalid operation metadata");
  storage.setItem(prefix + value.accountId, JSON.stringify(value));
  if (JSON.stringify(readPending(storage, value.accountId)) !== JSON.stringify(value)) throw new Error("Operation identity could not be retained");
}
export function clearPending(storage, accountId) { storage.removeItem(prefix + accountId); }

export function clearSessionPreservingPending(storage) {
  const retained = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const accountId = key.slice(prefix.length);
    // An invalid marker remains a fail-closed barrier after sign-in.
    if (!id(accountId)) continue;
    let raw = "invalid-operation-metadata";
    try { const marker = readPending(storage, accountId); if (marker) raw = JSON.stringify(marker); } catch { /* Retain a barrier, never arbitrary contents. */ }
    retained.push([key, raw]);
  }
  storage.clear();
  for (const [key, raw] of retained) if (raw !== null) storage.setItem(key, raw);
}
