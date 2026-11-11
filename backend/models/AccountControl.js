import mongoose from "mongoose";
import { isTokenVersion } from "../utils/tokenVersion.js";
import { redactAuditText } from "../auth/auditText.js";
const { Schema, model } = mongoose;
const ref = { type: Schema.Types.ObjectId, ref: "User", required: true };
const actions = ["account.created", "account.role_assigned", "account.role_changed", "account.confirmation_changed", "account.suspended", "account.reactivated", "account.password_reset", "account.password_changed", "account.profile_changed", "account.deleted", "permission.granted", "permission.revoked", "permission.expired", "account.review_recorded"];
actions.push("account.store_membership_changed");
actions.push("account.bookstore_created");
const audit = new Schema({
  schemaVersion: { type: Number, required: true, enum: [1] },
  eventId: { type: String, required: true, unique: true },
  operationId: { type: String, required: true }, sequence: { type: Number, required: true },
  actor: {
    id: { type: Schema.Types.ObjectId, required: function humanActorId() { return this.actor?.kind === "account"; } },
    role: { type: String, enum: ["admin", "store_manager", "cashier", "customer", "user"], required: function humanActorRole() { return this.actor?.kind === "account"; } },
    kind: { type: String, enum: ["account", "system-expiry"], required: true },
  },
  subjectAccountId: ref, action: { type: String, required: true, enum: actions },
  occurredAt: { type: Date, required: true }, reason: { type: String, required: true, maxlength: 1024, set: redactAuditText },
  before: { type: Schema.Types.Mixed, required: true }, after: { type: Schema.Types.Mixed, required: true },
  scope: { type: Schema.Types.Mixed, required: true }, approvalRef: String, reviewId: Schema.Types.ObjectId, grantId: Schema.Types.ObjectId,
  securityVersionBefore: Number, securityVersionAfter: Number,
  outcome: { type: String, required: true, enum: ["applied", "observed-expired"] },
}, { strict: "throw", versionKey: false });
audit.index({ operationId: 1, sequence: 1 }, { unique: true });
audit.index({ subjectAccountId: 1, occurredAt: -1 });
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete", "findOneAndReplace", "replaceOne", "bulkWrite"]) {
  audit.pre(operation, function immutableAudit() { throw new Error("Audit records are append-only"); });
}
audit.pre("save", function immutableSavedAudit() { if (!this.isNew) throw new Error("Audit records are append-only"); });
audit.pre("deleteOne", { document: true, query: false }, function immutableDocumentAudit() { throw new Error("Audit records are append-only"); });

const grant = new Schema({
  recipientAccountId: ref, capability: { type: String, required: true }, scope: { type: Schema.Types.Mixed, required: true },
  grantedBy: ref, reason: { type: String, required: true, maxlength: 1024, set: redactAuditText }, approvalRef: { type: String, set: redactAuditText },
  effectiveAt: { type: Date, required: true }, expiresAt: { type: Date, required: true },
  recipientVersion: { type: Schema.Types.Mixed, required: true, validate: isTokenVersion }, grantorAuthorityVersion: { type: Schema.Types.Mixed, required: true, validate: isTokenVersion },
  revokedAt: {
    type: Schema.Types.Mixed,
    default: function newGrantRevocationState() { return this.isNew ? null : undefined; },
    validate: value => value === null || (value instanceof Date && Number.isFinite(value.valueOf())),
  }, revokedBy: Schema.Types.ObjectId, revocationReason: String,
  expiredRecordedAt: Date,
  operationId: { type: String, required: true },
}, { strict: "throw", timestamps: true });
grant.index({ recipientAccountId: 1, revokedAt: 1, expiresAt: 1 });

const review = new Schema({
  targetAccountId: ref, reviewerId: ref,
  status: { type: String, enum: ["in-review", "approved", "rejected", "applied", "superseded"], required: true },
  proposedRole: { type: String, required: true, enum: ["admin", "store_manager", "cashier", "customer"] },
  expectedVersion: { type: Number, required: true }, expectedRole: { type: String, required: true },
  reason: { type: String, required: true, maxlength: 1024, set: redactAuditText }, evidenceRefs: { type: [String], required: true, set: values => Array.isArray(values) ? values.map(redactAuditText) : values },
  revision: { type: Number, required: true }, supersedes: Schema.Types.ObjectId,
  verifiedAuthorityVersion: Number,
  operationId: { type: String, required: true },
}, { strict: "throw", timestamps: true });

const receipt = new Schema({
  operationId: { type: String, required: true, unique: true }, actorId: ref, targetId: ref,
  fingerprint: { type: String, required: true, select: false },
  result: { type: Schema.Types.Mixed, required: true },
}, { strict: "throw", timestamps: true });
const realm = new Schema({ _id: String, revision: { type: Number, required: true } }, { strict: "throw" });

export const AccountAudit = model("AccountAuditEvent", audit);
export const AccountGrant = model("ConditionalAccountGrant", grant);
export const AccountReview = model("AccountRoleReview", review);
export const AccountReceipt = model("AccountOperationReceipt", receipt);
export const AccountRealm = model("AccountAdministrationRealm", realm);
