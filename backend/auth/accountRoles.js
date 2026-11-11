// Stored account vocabulary. This adapter grants no operational capabilities.
export const ACCOUNT_ROLES = Object.freeze({
  admin: "Administrator",
  store_manager: "Store Manager",
  cashier: "Cashier",
  customer: "Customer / Student",
});
export const STORED_ROLES = Object.freeze([...Object.keys(ACCOUNT_ROLES), "user"]);

export function resolveAccountRole(value) {
  if (value === "user") return Object.freeze({ kind: "legacy-unassigned", businessRole: null });
  if (typeof value !== "string" || !Object.hasOwn(ACCOUNT_ROLES, value)) return null;
  return Object.freeze({ kind: "business", businessRole: ACCOUNT_ROLES[value] });
}

export function isLegacyOperationalRole(value) {
  // Existing access is retained pending the approved legacy cutover. This is
  // neither a Customer mapping nor activation of any four-role capability.
  return value === "admin" || value === "user";
}
