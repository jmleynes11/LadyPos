import { resolveAccountRole } from "./accountRoles.js";

export function isAccountActive(account) {
  if (!resolveAccountRole(account?.role)) return false;
  if (account.accountState === "active") return true;
  return account.accountState === undefined && ["admin", "user"].includes(account.role);
}

export function activeAccountFilter(role) {
  return ["admin", "user"].includes(role)
    ? { $or: [{ accountState: "active" }, { accountState: { $exists: false } }] }
    : { accountState: "active" };
}
