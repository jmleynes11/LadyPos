import mongoose from "mongoose";
import { canonicalAccountId } from "../utils/accountIdentity.js";

// Scope predicates only, not role/capability authorization. Callers must load
// memberships from current server-controlled state and authorize the operation.
// This foundation remains unattached until account/schema/route binding lands.
const objectId = value => {
  const id = canonicalAccountId(value);
  if (!id) throw Object.assign(new Error("Invalid resource scope"), { statusCode: 403 });
  return new mongoose.Types.ObjectId(id);
};

export function mappedStoreFilter(storeId, membershipStoreIds) {
  const store = objectId(storeId);
  if (!Array.isArray(membershipStoreIds) || membershipStoreIds.length === 0) {
    throw Object.assign(new Error("Explicit bookstore membership required"), { statusCode: 403 });
  }
  const memberships = new Set();
  for (let index = 0; index < membershipStoreIds.length; index++) {
    if (!Object.hasOwn(membershipStoreIds, index)) {
      throw Object.assign(new Error("Invalid bookstore membership"), { statusCode: 403 });
    }
    const id = objectId(membershipStoreIds[index]).toHexString();
    if (memberships.has(id)) {
      throw Object.assign(new Error("Duplicate bookstore membership"), { statusCode: 403 });
    }
    memberships.add(id);
  }
  if (!memberships.has(store.toHexString())) {
    throw Object.assign(new Error("Bookstore outside membership"), { statusCode: 403 });
  }
  return { storeId: store };
}

// Use only on an independently authorized legacy owner read. Explicit null or
// malformed store attribution must not quietly re-enter legacy compatibility.
export function unmappedOwnerFilter(ownerId) {
  return { owner: objectId(ownerId), storeId: { $exists: false } };
}

// Keep scope outside caller search conditions. An OR/operator supplied in a
// search must never replace the mandatory bookstore/owner predicate.
export function intersectResourceFilter(scope, validatedSearch) {
  return { $and: [scope, validatedSearch] };
}
