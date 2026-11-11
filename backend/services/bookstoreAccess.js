import User from "../models/User.js";
import Store from "../models/Store.js";
import { accountId, fail } from "./accountManagement.js";
import { isAccountActive } from "../auth/accountState.js";
import { accountTokenVersion } from "../utils/tokenVersion.js";
import { isStoredMemberships } from "../models/resourceAttribution.js";
import { mappedStoreFilter } from "../auth/resourceScope.js";
import { hasBaseCapability, grantedResources } from "./bookstoreGrants.js";
import mongoose from "mongoose";

export async function bookstoreReadScope(actor, storeId, capability, resourceId) {
  const current = await User.findById(accountId(actor?.id));
  if (!current || current.role !== actor.role || current.confirmed !== true || !isAccountActive(current) || accountTokenVersion(current.tokenVersion) !== actor.tokenVersion) fail(401, "Not authorized; sign in again");
  if (!isStoredMemberships(current.storeIds)) fail(403, "Operational capability denied");
  const scope = mappedStoreFilter(storeId, current.storeIds);
  if (!await Store.findById(scope.storeId)) fail(409, "Bookstore mapping requires reconciliation");
  if (!hasBaseCapability(current.role, capability)) {
    const ids = await grantedResources(actor, capability);
    if (!ids.length || (resourceId && !ids.includes(String(resourceId)))) fail(403, "Current bounded conditional grant required");
    if (!resourceId) scope.$and = [{ [capability.startsWith("salesHistory.") ? "processedBy" : "_id"]: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) } }];
  }
  return scope;
}
