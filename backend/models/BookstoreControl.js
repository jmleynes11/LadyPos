import mongoose from "mongoose";
import { redactAuditText } from "../auth/auditText.js";
import { operationalProjection } from "../auth/operationalProjection.js";
import { CLOTHING_SIZES } from "../utils/clothingSizes.js";
const { Schema, model } = mongoose;
const objectId = { type: Schema.Types.ObjectId, required: true };

export const BOOKSTORE_ACTIONS = Object.freeze([
  "guest.intent_issued",
  "store.created", "resource.mapped", "product.created", "product.updated", "product.price_changed", "product.archived",
  "category.created", "category.renamed", "category.deleted",
  "inventory.adjusted", "order.submitted", "order.claimed", "order.cancelled", "order.queue_removed", "sale.completed", "payment.recorded",
  "receipt.issued", "reversal.requested", "reversal.applied",
]);
const audit = new Schema({
  actorKey: { type: String, required: true }, operationId: { type: String, required: true }, sequence: { type: Number, required: true },
  storeId: objectId, actorId: { type: Schema.Types.ObjectId, required: function accountActorRequired() { return this.actorKind === "account"; } },
  actorKind: { type: String, required: true, enum: ["account", "guest"] },
  action: { type: String, required: true, enum: BOOKSTORE_ACTIONS },
  targetKind: { type: String, required: true, enum: ["Store", "Product", "Transaction", "Invoice", "Reversal", "GuestIntent", "Customer", "DebtPayment"] },
  targetId: objectId, occurredAt: { type: Date, required: true },
  reason: { type: String, required: true, set: redactAuditText },
  before: { type: Schema.Types.Mixed, required: true }, after: { type: Schema.Types.Mixed, required: true },
}, { strict: "throw", versionKey: false, minimize: false });
audit.index({ actorKey: 1, operationId: 1, sequence: 1 }, { unique: true });
audit.index({ storeId: 1, occurredAt: -1 });
audit.pre("validate", function sanitizeAuditProjection() {
  this.before = operationalProjection(this.before);
  this.after = operationalProjection(this.after);
});

const receipt = new Schema({
  actorKey: { type: String, required: true }, operationId: { type: String, required: true },
  capability: { type: String, required: true }, storeId: objectId,
  fingerprint: { type: String, required: true, select: false },
  result: { type: Schema.Types.Mixed, required: true },
}, { strict: "throw", timestamps: true });
receipt.index({ actorKey: 1, operationId: 1 }, { unique: true });

const movement = new Schema({
  storeId: objectId, productId: objectId, actorId: objectId,
  operationId: { type: String, required: true },
  delta: { type: Number, required: true, validate: Number.isSafeInteger },
  before: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  after: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  reason: { type: String, required: true, set: redactAuditText },
  source: { type: String, required: true, enum: ["adjustment", "sale", "return"] },
  occurredAt: { type: Date, required: true }, transactionId: Schema.Types.ObjectId,
  sizeChanges: { type: [new Schema({
    size: { type: String, enum: CLOTHING_SIZES, required: true },
    before: { type: Number, min: 0, required: true, validate: Number.isSafeInteger },
    after: { type: Number, min: 0, required: true, validate: Number.isSafeInteger },
    delta: { type: Number, required: true, validate: Number.isSafeInteger },
  }, { _id: false })], default: undefined },
}, { strict: "throw", versionKey: false });
movement.index({ actorId: 1, operationId: 1, productId: 1 }, { unique: true });
movement.index({ storeId: 1, productId: 1, occurredAt: -1 });
movement.pre("validate", function validateDelta() {
  if (this.before + this.delta !== this.after || this.delta === 0) throw new Error("Inconsistent stock movement");
  if (this.sizeChanges && (this.sizeChanges.some(row => row.before + row.delta !== row.after || !row.delta) ||
    this.sizeChanges.reduce((sum, row) => sum + row.delta, 0) !== this.delta)) throw new Error("Inconsistent size stock movement");
});

function appendOnly(schema) {
  for (const method of ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete", "findOneAndReplace", "replaceOne", "bulkWrite"]) {
    schema.pre(method, function rejectMutation() { throw new Error("Operational ledger is append-only"); });
  }
  schema.pre("save", function rejectSavedMutation() { if (!this.isNew) throw new Error("Operational ledger is append-only"); });
  schema.pre("deleteOne", { document: true, query: false }, function rejectDocumentDelete() { throw new Error("Operational ledger is append-only"); });
}
appendOnly(audit); appendOnly(movement); appendOnly(receipt);
export const BookstoreAudit = model("BookstoreAuditEvent", audit);
export const BookstoreReceipt = model("BookstoreOperationReceipt", receipt);
export const StockMovement = model("StockMovement", movement);

const payment = new Schema({
  storeId: objectId, transactionId: { ...objectId, unique: true }, actorId: objectId,
  operationId: { type: String, required: true }, amount: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  method: { type: String, required: true, enum: ["cash", "gcash"] }, reference: { type: String, default: "", set: redactAuditText },
  occurredAt: { type: Date, required: true },
}, { strict: "throw", versionKey: false });
const request = new Schema({
  storeId: objectId, transactionId: objectId, requestedBy: objectId,
  reason: { type: String, required: true, set: redactAuditText },
  status: { type: String, required: true, enum: ["requested", "applied"] },
  approvedBy: Schema.Types.ObjectId, appliedAt: Date,
}, { strict: "throw", timestamps: true });
const reversal = new Schema({
  storeId: objectId, transactionId: { ...objectId, unique: true }, requestId: objectId, approvedBy: objectId,
  operationId: { type: String, required: true }, amount: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  method: { type: String, required: true, enum: ["cash", "gcash"] }, reference: { type: String, default: "", set: redactAuditText },
  reason: { type: String, required: true, set: redactAuditText }, returned: { type: [Schema.Types.Mixed], required: true },
  occurredAt: { type: Date, required: true },
}, { strict: "throw", versionKey: false });
const intent = new Schema({
  storeId: objectId, verification: { type: Schema.Types.Mixed, required: true, select: false },
}, { strict: "throw", timestamps: true });
const sequence = new Schema({
  storeId: objectId, year: { type: Number, required: true }, seq: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
}, { strict: "throw" });
sequence.index({ storeId: 1, year: 1 }, { unique: true });
appendOnly(payment); appendOnly(reversal);
export const BookstorePayment = model("BookstorePayment", payment);
export const ReversalRequest = model("BookstoreReversalRequest", request);
export const SaleReversal = model("BookstoreSaleReversal", reversal);
export const GuestOrderIntent = model("GuestOrderIntent", intent);
export const BookstoreSequence = model("BookstoreSequence", sequence);
