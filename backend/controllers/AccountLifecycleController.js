import asyncHandler from "express-async-handler";
import { AccountAudit, AccountGrant, AccountReview, AccountReceipt } from "../models/AccountControl.js";
import { updateAccount, recordReview, applyReview, grantPermission, revokePermission, accountId, sweepExpiredGrants, fail } from "../services/accountManagement.js";
import { isTokenVersion } from "../utils/tokenVersion.js";
import { redactAuditText } from "../auth/auditText.js";
import { ACCOUNT_ROLES } from "../auth/accountRoles.js";

const command = handler => asyncHandler(async (req, res) => res.json(await handler(req)));
const versioned = handler => command(req => {
  if (!isTokenVersion(req.body?.expectedVersion)) fail(400, "Expected account version required");
  if (typeof req.body?.operationId !== "string") fail(400, "Stable operation ID required");
  return handler(req);
});
export const assignRole = versioned(req => {
  if (typeof req.body.role !== "string" || !Object.hasOwn(ACCOUNT_ROLES, req.body.role)) fail(400, "Explicit approved role required");
  return updateAccount(req.user, req.params.id, {
  role: req.body.role, reason: req.body.reason, reviewId: req.body.reviewId,
  operationId: req.body.operationId, expectedVersion: req.body.expectedVersion,
}, { action: "account.role_changed" });
});
export const suspendAccount = versioned(req => updateAccount(req.user, req.params.id, {
  accountState: "suspended", reason: req.body.reason, operationId: req.body.operationId, expectedVersion: req.body.expectedVersion,
}));
export const reactivateAccount = versioned(req => updateAccount(req.user, req.params.id, {
  accountState: "active", reason: req.body.reason, operationId: req.body.operationId, expectedVersion: req.body.expectedVersion,
}));
export const createReview = versioned(req => recordReview(req.user, req.params.id, req.body));
export const applyAccountReview = versioned(req => applyReview(req.user, req.params.id, req.body));
export const createGrant = versioned(req => grantPermission(req.user, req.params.id, req.body));
export const revokeGrant = versioned(req => revokePermission(req.user, req.params.id, req.params.grantId, req.body));
export const listReviews = command(async req => ({ reviews: (await AccountReview.find({ targetAccountId: accountId(req.params.id) }).sort({ createdAt: -1 }).limit(100)).map(review => ({
  _id: review._id, targetAccountId: review.targetAccountId, reviewerId: review.reviewerId, status: review.status,
  proposedRole: review.proposedRole, expectedVersion: review.expectedVersion, revision: review.revision,
  reason: redactAuditText(review.reason), evidenceRefs: review.evidenceRefs.map(redactAuditText), supersedes: review.supersedes,
})) }));
export const listGrants = command(async req => ({ grants: (await AccountGrant.find({ recipientAccountId: accountId(req.params.id) }).sort({ createdAt: -1 }).limit(100)).map(grant => ({
  _id: grant._id, recipientAccountId: grant.recipientAccountId, capability: grant.capability, scope: grant.scope,
  grantedBy: grant.grantedBy, reason: redactAuditText(grant.reason), approvalRef: redactAuditText(grant.approvalRef),
  effectiveAt: grant.effectiveAt, expiresAt: grant.expiresAt, revokedAt: grant.revokedAt,
})) }));
export const listAudit = command(async req => {
  const filter = req.query.accountId ? { subjectAccountId: accountId(req.query.accountId) } : {};
  const allowed = new Set(["role","confirmed","accountState","version","absent","reviewId","status","proposedRole","revision","changedFields","credentialsChanged","grantId","capability","effectiveAt","expiresAt","revoked","expired","storeIds"]);
  const project = value => Object.fromEntries(Object.entries(value || {}).filter(([key]) => allowed.has(key)).map(([key,item]) => [key, typeof item === "string" ? redactAuditText(item) : item]));
  return { events: (await AccountAudit.find(filter).sort({ occurredAt: -1 }).limit(100)).map(event => ({
    schemaVersion:event.schemaVersion, eventId:event.eventId, operationId:event.operationId, sequence:event.sequence,
    actor:event.actor, subjectAccountId:event.subjectAccountId, action:event.action, occurredAt:event.occurredAt,
    reason:redactAuditText(event.reason), before:project(event.before), after:project(event.after), scope:event.scope,
    approvalRef:redactAuditText(event.approvalRef), reviewId:event.reviewId, grantId:event.grantId, outcome:event.outcome,
  })) };
});
export const reconcileAccountOperation = command(async req => {
  if (typeof req.params.operationId !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(req.params.operationId)) fail(400, "Invalid operation ID");
  const filter = { operationId: req.params.operationId };
  if (req.user.role !== "admin") {
    filter.actorId = req.user.id;
    filter.targetId = req.user.id;
  }
  const operation = await AccountReceipt.findOne(filter);
  if (!operation) fail(404, "Operation not found; outcome must be reconciled before resubmission");
  return { outcome: "applied", operationId: operation.operationId, result: operation.result };
});
export const recordExpirations = command(async () => ({ observed: await sweepExpiredGrants() }));
