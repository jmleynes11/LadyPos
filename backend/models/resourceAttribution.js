import mongoose from "mongoose";
import { canonicalAccountId } from "../utils/accountIdentity.js";

export function isStoredResourceId(value) {
  return value instanceof mongoose.Types.ObjectId && canonicalAccountId(value) !== null;
}

export function isStoredMemberships(value) {
  if (!Array.isArray(value)) return false;
  const ids = new Set();
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(value, index) || !isStoredResourceId(value[index])) return false;
    const id = value[index].toHexString();
    if (ids.has(id)) return false;
    ids.add(id);
  }
  return true;
}

export function addStoreAttribution(schema) {
  // Mixed deliberately preserves malformed persisted values instead of casting
  // them into missing legacy attribution. Writers use validated BSON IDs.
  schema.add({ storeId: { type: mongoose.Schema.Types.Mixed, validate: isStoredResourceId } });
  // Explicit marker only; never infer or convert historical amounts on read.
  if (schema.path("price") || schema.path("totalAmount") || schema.path("invoiceNumber") || schema.path("amountPaid")) {
    schema.add({ moneyUnit: { type: mongoose.Schema.Types.Mixed, validate: value => value === "PHP-centavos" } });
  }
  schema.index({ storeId: 1, createdAt: -1 });
}
