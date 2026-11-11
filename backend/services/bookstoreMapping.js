import { createHash } from "node:crypto";
import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Customer from "../models/Person.js";
import Order from "../models/Order.js";
import Invoice from "../models/Invoice.js";
import DebtPayment from "../models/DebtPayment.js";
import { bookstoreCommand } from "./bookstoreCommand.js";
import { accountId, fail } from "./accountManagement.js";

const models = { Product, Customer, Transaction: Order, Invoice, DebtPayment };
const normalize = value => Array.isArray(value) ? value.map(normalize) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, normalize(entry)])) : value;
const digest = record => createHash("sha256").update(JSON.stringify(normalize(mongoose.mongo.BSON.EJSON.serialize(record, { relaxed: false })))).digest("hex");
function entries(input) {
  if (!Array.isArray(input) || !input.length || input.length > 100 || Object.keys(input).length !== input.length) fail(400, "Explicit bounded mapping list required");
  const seen = new Set();
  return input.map(entry => {
    if (!entry || !Object.hasOwn(models, entry.kind) || Object.keys(entry).some(key => !["kind", "id", "ownerId", "digest"].includes(key))) fail(400, "Invalid mapping entry");
    const id = accountId(entry.id), ownerId = accountId(entry.ownerId), key = `${entry.kind}:${id}`;
    if (seen.has(key)) fail(400, "Duplicate mapping identity"); seen.add(key);
    return { kind: entry.kind, id, ownerId, ...(entry.digest ? { digest: entry.digest } : {}) };
  });
}

async function inspect(scope, requested, session, requireDigest) {
  const selected = new Map(requested.map(entry => [`${entry.kind}:${entry.id}`, entry]));
  const records = [];
  const related = async (kind, id) => {
    if (!id) fail(409, "Missing historical relation; manual review required");
    const record = await models[kind].findById(id).session(session).setOptions({ promoteValues: false, promoteLongs: false }).lean();
    if (!record || (!selected.has(`${kind}:${id}`) && String(record.storeId) !== String(scope.storeId))) fail(409, "Unmapped or foreign historical relation");
  };
  const collisions = new Set();
  for (const entry of requested) {
    const record = await models[entry.kind].findById(entry.id).session(session).setOptions({ promoteValues: false, promoteLongs: false }).lean();
    if (!record || String(record.owner) !== entry.ownerId || Object.hasOwn(record, "storeId")) fail(409, "Historical attribution changed or already mapped");
    if (!await User.findById(entry.ownerId).session(session)) fail(409, "Historical owner requires review");
    const currentDigest = digest(record);
    if (requireDigest && entry.digest !== currentDigest) fail(409, "Mapping snapshot changed; review again");
    const uniqueField = entry.kind === "Product" ? "sku" : entry.kind === "Invoice" ? "invoiceNumber" : null;
    if (uniqueField && record[uniqueField]) {
      const key = `${entry.kind}:${record[uniqueField]}`;
      if (collisions.has(key) || await models[entry.kind].findOne({ ...scope, [uniqueField]: record[uniqueField] }).session(session)) fail(409, "Duplicate SKU or receipt requires manual review");
      collisions.add(key);
    }
    if (entry.kind === "Transaction") {
      await related("Customer", record.customer);
      for (const item of record.items) await related("Product", item.product);
    }
    if (entry.kind === "Invoice") { await related("Transaction", record.transaction); await related("Customer", record.customer); }
    if (entry.kind === "DebtPayment") { await related("Customer", record.customer); await related("Transaction", record.transaction); }
    records.push({ entry: { kind: entry.kind, id: entry.id, ownerId: entry.ownerId, digest: currentDigest }, record });
  }
  return records;
}

// Internal preparation only: no default database, CLI, startup execution or public
// migration endpoint. Actual data mapping still requires its own reviewed manifest,
// backup/recovery evidence and explicit target authorization.
export async function prepareHistoricalMapping(actor, storeId, input) {
  const { bookstoreReadScope } = await import("./bookstoreAccess.js");
  const scope = await bookstoreReadScope(actor, storeId, "catalog.manage");
  const records = await inspect(scope, entries(input), undefined, false);
  return { storeId: String(scope.storeId), count: records.length, entries: records.map(row => row.entry) };
}
export async function applyHistoricalMapping(actor, body) {
  if (!body || Object.keys(body).some(key => !["entries", "count", "reviewRef", "storeId", "reason", "operationId"].includes(key))) fail(400, "Unsupported mapping field");
  const requested = entries(body?.entries);
  if (typeof body?.reviewRef !== "string" || !body.reviewRef.trim() || body.count !== requested.length) fail(400, "Reviewed mapping reference and exact count required");
  return bookstoreCommand(actor, body.storeId, "catalog.manage", body, async ({ session, scope, audit }) => {
    const records = await inspect(scope, requested, session, true);
    for (const { entry } of records) {
      const update = await models[entry.kind].updateOne({ _id: entry.id, owner: entry.ownerId, storeId: { $exists: false } }, { $set: { storeId: scope.storeId } }, { session, runValidators: true, timestamps: false });
      if (update.matchedCount !== 1 || update.modifiedCount !== 1) fail(409, "Mapping changed; no partial attribution permitted");
      await audit("resource.mapped", entry.kind, entry.id, { unmapped: true }, { storeId: String(scope.storeId), reviewRef: body.reviewRef });
    }
    return { count: records.length, mappedIds: records.map(row => row.entry.id) };
  });
}
