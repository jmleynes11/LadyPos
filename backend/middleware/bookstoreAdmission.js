import { mayHoldCapability } from "../services/bookstoreGrants.js";
import { resolveAccountRole } from "../auth/accountRoles.js";
import { evaluateRolePolicy } from "../auth/policy.js";
import { mappedStoreFilter } from "../auth/resourceScope.js";
import { isStoredMemberships } from "../models/resourceAttribution.js";
import Store from "../models/Store.js";
import { requireLegacyOperationalAccess } from "./roleAdmission.js";

export function requireProductCreationAccess(req, res, next) {
  if (req.user?.role !== "store_manager") return requireLegacyOperationalAccess(req, res, next);
  if (!mayHoldCapability(req.user.role, "catalog.create") || !isStoredMemberships(req.user.storeIds)) {
    return res.status(403).json({ message: "Bookstore product creation capability required" });
  }
  try { mappedStoreFilter(req.body?.storeId, req.user.storeIds); }
  catch { return res.status(403).json({ message: "Bookstore outside membership" }); }
  return next();
}

export function requireProductManagementAccess(req, res, next) {
  if (req.user?.role !== "store_manager") return requireLegacyOperationalAccess(req, res, next);
  if (!mayHoldCapability(req.user.role, "product.manage") || !isStoredMemberships(req.user.storeIds)) {
    return res.status(403).json({ message: "Bookstore product management capability required" });
  }
  try { mappedStoreFilter(req.body?.storeId, req.user.storeIds); }
  catch { return res.status(403).json({ message: "Bookstore outside membership" }); }
  return next();
}

export function requireInventoryAdjustmentAccess(req, res, next) {
  if (!mayHoldCapability(req.user?.role, "inventory.adjust") || !isStoredMemberships(req.user?.storeIds)) {
    return res.status(403).json({ message: "Bookstore inventory capability required" });
  }
  try { mappedStoreFilter(req.body?.storeId, req.user.storeIds); }
  catch { return res.status(403).json({ message: "Bookstore outside membership" }); }
  return next();
}

export async function requireProductReadAccess(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role === "user" || (req.user.role === "admin" && req.query.storeId === undefined)) {
    req.productScope = { owner: req.user.id, ...(req.user.role === "admin" ? { storeId: { $exists: false } } : {}) };
    return next();
  }
  const role = resolveAccountRole(req.user.role);
  const action = req.user.role === "admin" ? "catalog.manage" : "catalog.saleRead";
  if (evaluateRolePolicy(role?.businessRole, action).effect !== "eligible" || !isStoredMemberships(req.user.storeIds)) {
    return res.status(403).json({ message: "Bookstore catalog capability required" });
  }
  try { req.productScope = mappedStoreFilter(req.query.storeId, req.user.storeIds); }
  catch { return res.status(403).json({ message: "Bookstore outside membership" }); }
  if (!await Store.findById(req.productScope.storeId)) return res.status(403).json({ message: "Bookstore mapping requires reconciliation" });
  return next();
}

export function requireReversalAliasAccess(req, res, next) {
  if (!mayHoldCapability(req.user?.role, "reversal.apply") || !isStoredMemberships(req.user?.storeIds)) return res.status(403).json({ message: "Mapped reversal approval capability required" });
  try { mappedStoreFilter(req.body?.storeId, req.user.storeIds); }
  catch { return res.status(403).json({ message: "Bookstore outside membership" }); }
  return next();
}
