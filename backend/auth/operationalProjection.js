import { redactAuditText } from "./auditText.js";

// Operational histories have no approved credential or customer-contact payload.
// Writers must pass explicit DTOs, not model documents or raw request bodies.
export function operationalProjection(value, depth = 0) {
  if (depth > 20) throw new Error("Operational projection is too deeply nested");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return redactAuditText(value);
  if (Array.isArray(value)) {
    const result = [];
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index)) throw new Error("Invalid operational projection array");
      result.push(operationalProjection(value[index], depth + 1));
    }
    return result;
  }
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) throw new Error("Explicit operational DTO required");
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/password|credential|token|secret|authorization|fingerprint|digest|guestaccess|verification|^phone$|^email$|^address$|^costprice$|^__proto__$|^constructor$/i.test(key)) throw new Error("Protected field in operational projection");
    result[key] = operationalProjection(entry, depth + 1);
  }
  return result;
}
