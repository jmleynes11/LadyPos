// Business labels only. No persisted User.role adapter or runtime attachment.
export const ROLES = Object.freeze(["Administrator", "Store Manager", "Cashier", "Customer / Student"]);
export const isBusinessRole = value => typeof value === "string" && ROLES.includes(value);
export function isDenseStringArray(value) {
  if (!Array.isArray(value)) return false;
  for (let i=0;i<value.length;i++) {
    if (!Object.hasOwn(value,i) || typeof value[i]!=="string" || value[i].length===0) return false;
  }
  return true;
}
export function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

