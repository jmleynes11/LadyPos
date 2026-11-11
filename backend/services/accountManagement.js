import { randomUUID, createHmac } from "node:crypto";
import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Store from "../models/Store.js";
import { isStoredMemberships } from "../models/resourceAttribution.js";
import { AccountAudit, AccountGrant, AccountReview, AccountReceipt, AccountRealm } from "../models/AccountControl.js";
import { ACCOUNT_ROLES, resolveAccountRole } from "../auth/accountRoles.js";
import { CAPABILITIES } from "../auth/capabilities.js";
import { activeAccountFilter, isAccountActive } from "../auth/accountState.js";
import { accountTokenVersion, isTokenVersion } from "../utils/tokenVersion.js";
import { canonicalAccountId } from "../utils/accountIdentity.js";
import { accountTransaction } from "../utils/accountTransaction.js";
import { saveAccountMutation } from "../utils/accountMutationOutcome.js";
import { hasUnknownCommitResult } from "../utils/accountMutationOutcome.js";
import { redactAuditText } from "../auth/auditText.js";
import { validatePassword } from "../utils/passwords.js";

export function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
export function text(value, name) {
  if (typeof value !== "string" || !value.trim() || value.length > 1024) fail(400, `Invalid ${name}`);
  return value.trim();
}
export function accountId(value) {
  const id = canonicalAccountId(value);
  if (!id) fail(400, "Invalid account ID");
  return id;
}
function versionFilter(version) {
  return version === 0 ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] } : { tokenVersion: version };
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
export function publicAccount(user) {
  const value = {};
  for (const field of ["_id", "identifier", "role", "confirmed", "name", "phone", "address", "createdAt", "accountState"]) {
    if (user[field] !== undefined) value[field] = field === "_id" ? String(user[field]) : user[field];
  }
  return value;
}
function administrativeAccount(user) {
  return { ...publicAccount(user), securityVersion: accountTokenVersion(user.tokenVersion) };
}
function snapshot(user) {
  return user ? { role: user.role, confirmed: user.confirmed, accountState: user.accountState ?? "legacy-missing", version: accountTokenVersion(user.tokenVersion) } : { absent: true };
}
export function strictDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) fail(400, "Explicit UTC timestamp required");
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== value) fail(400, "Invalid timestamp");
  return date;
}
export async function fenceAccountActor(actor, session, admin) {
  const role = actor?.role;
  if (!resolveAccountRole(role) || !isTokenVersion(actor?.tokenVersion) || (admin && role !== "admin")) fail(403, "Forbidden");
  const current = await User.findById(accountId(actor.id), null, { session });
  if (!current || String(current._id) !== accountId(actor.id) || current.role !== role || current.confirmed !== true || !isAccountActive(current) || accountTokenVersion(current.tokenVersion) !== actor.tokenVersion || (current.authorityVersion !== undefined && !isTokenVersion(current.authorityVersion))) fail(401, "Not authorized; sign in again");
  const result = await User.updateOne({
    _id: accountId(actor.id), role, confirmed: true,
    $and: [activeAccountFilter(role), versionFilter(actor.tokenVersion)],
  }, { $inc: { __v: 1 } }, { session, timestamps: false });
  if (!result?.acknowledged || result.matchedCount !== 1 || result.modifiedCount !== 1) fail(401, "Not authorized; sign in again");
}

// All security writers and operational fences share this real write. It also
// serializes last-administrator counts; a snapshot count alone is insufficient.
export async function lockAccountRealm(session) {
  const row = await AccountRealm.findOneAndUpdate({ _id: "account-management" }, { $inc: { revision: 1 } }, { upsert: true, new: true, session });
  if (!row) fail(503, "Account administration unavailable");
}

export async function accountCommand(actor, targetId, action, body, work, { self = false } = {}) {
  const target = accountId(targetId);
  const actorId = accountId(actor?.id);
  if (self ? actorId !== target : actor?.role !== "admin") fail(403, "Forbidden");
  const reason = redactAuditText(text(body?.reason, "reason"));
  if (body?.expectedVersion !== undefined && !isTokenVersion(body.expectedVersion)) fail(400, "Invalid expected account version");
  const operationId = body?.operationId ?? randomUUID();
  if (typeof operationId !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(operationId) || operationId.startsWith("expiry_")) fail(400, "Invalid operation ID");
  if (!process.env.JWT_SECRET) fail(503, "Account administration unavailable");
  // Keyed command digest includes secret inputs, but is never exposed in an
  // audit/API/log; plain hashes of low-entropy passwords must not be stored.
  const fingerprint = createHmac("sha256", process.env.JWT_SECRET).update(JSON.stringify(stable({ action, target, body }))).digest("hex");
  try {
    return await accountTransaction(async session => {
      await lockAccountRealm(session);
      await fenceAccountActor(actor, session, !self);
      const previous = await AccountReceipt.findOne({ operationId }).select("+fingerprint").session(session);
      if (previous) {
        if (String(previous.actorId) !== actorId || String(previous.targetId) !== target || previous.fingerprint !== fingerprint) fail(409, "Operation ID conflict");
        return previous.result;
      }
      let sequence = 0;
      const audit = async (eventAction, subject, before, after, extra = {}) => {
        const eventId = randomUUID();
        await AccountAudit.create([{
          schemaVersion: 1, eventId, operationId, sequence: sequence++,
          actor: { id: actorId, role: actor.role, kind: "account" }, subjectAccountId: subject,
          action: eventAction, occurredAt: new Date(), reason, before, after,
          scope: { kind: "account-realm", accountId: subject }, outcome: "applied", ...extra,
        }], { session });
        return eventId;
      };
      const value = await work({ session, audit, target, operationId });
      const result = { ...value, operationId };
      await AccountReceipt.create([{ operationId, actorId, targetId: target, fingerprint, result }], { session });
      return result;
    });
  } catch (error) {
    console.error("Account command did not return acknowledged success");
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000 && !(error instanceof mongoose.mongo.MongoWriteConcernError) && !error.writeConcernError && !hasUnknownCommitResult(error)) fail(409, "Account data conflicts with an existing record");
    throw error;
  }
}

async function protectLastAdministrator(user, next, session) {
  if (user.role !== "admin" || user.confirmed !== true || !isAccountActive(user)) return;
  if (next && next.role === "admin" && next.confirmed === true && isAccountActive(next)) return;
  // Mongo scalar equality also matches arrays. A countDocuments predicate alone
  // can count a malformed, unusable administrator and lose the last real one.
  const candidates = await User.find({ role: "admin", confirmed: true }).session(session);
  const count = candidates.filter(candidate => candidate.role === "admin" && candidate.confirmed === true && isAccountActive(candidate) &&
    (candidate.tokenVersion === undefined || isTokenVersion(candidate.tokenVersion)) &&
    (candidate.authorityVersion === undefined || isTokenVersion(candidate.authorityVersion))).length;
  if (count <= 1) fail(409, "Cannot remove the last active Administrator");
}

async function invalidateGrants(user, before, session, audit) {
  const queue = [String(user._id)], seen = new Set(), revoked = new Set();
  const authorityChanged = before.role !== user.role || before.confirmed !== user.confirmed || before.accountState !== (user.accountState ?? "legacy-missing") || user.$locals.membershipChanged === true;
  if (authorityChanged) {
    const issued = await AccountGrant.find({ grantedBy: user._id, revokedAt: null }).session(session);
    queue.push(...issued.map(grant => String(grant.recipientAccountId)));
  }
  while (queue.length) {
    const recipient = queue.shift();
    if (seen.has(recipient)) continue;
    seen.add(recipient);
    const grants = await AccountGrant.find({ recipientAccountId: recipient, revokedAt: null }).session(session);
    for (const grant of grants) {
      if (revoked.has(String(grant._id))) continue;
      revoked.add(String(grant._id));
      grant.revokedAt = new Date(); grant.revokedBy = user._id;
      grant.revocationReason = "Account security context changed; fresh approval required";
      await grant.save({ session });
      await audit("permission.revoked", recipient, { grantId: String(grant._id), revoked: false }, { grantId: String(grant._id), revoked: true }, { grantId: grant._id, scope: grant.scope });
    }
    if (recipient !== String(user._id) && grants.length) {
      const account = await User.findById(recipient, null, { session });
      if (account) { account.$locals.forceSecurityChange = true; await account.save({ session }); }
    }
  }
}

export async function updateAccount(actor, targetId, body, { self = false, action = "account.profile_changed" } = {}) {
  if (body.password !== undefined) validatePassword(body.password);
  return accountCommand(actor, targetId, action, body, async ({ session, audit, target }) => {
    const user = await User.findById(target, null, { session });
    if (!user) fail(404, "User not found");
    if (target === accountId(actor.id) && (user.role !== actor.role || user.confirmed !== true || !isAccountActive(user) || accountTokenVersion(user.tokenVersion) !== actor.tokenVersion)) fail(401, "Not authorized; sign in again");
    const before = snapshot(user);
    const priorState = { role: user.role, confirmed: user.confirmed, accountState: user.accountState };
    const originalWhere = user.$where;
    let appliedReview;
    if (String(user._id) === accountId(actor.id)) {
      user.$where = { role: actor.role, confirmed: true, $and: [activeAccountFilter(actor.role), versionFilter(actor.tokenVersion)] };
    }
    if (body.expectedVersion !== undefined && body.expectedVersion !== before.version) fail(409, "Account changed; review again");
    if (body.role !== undefined) {
      if (action === "account.role_changed" && body.role === user.role) fail(409, "Account already has this role");
      if (self || typeof body.role !== "string" || !(Object.hasOwn(ACCOUNT_ROLES, body.role) || (body.role === "user" && user.role === "user"))) fail(400, "Invalid role assignment");
      if (user.role === "user" && user.role !== body.role) {
        const review = await AccountReview.findById(accountId(body.reviewId), null, { session });
        if (!review || review.status !== "approved" || String(review.targetAccountId) !== target || review.proposedRole !== body.role || review.expectedVersion !== before.version || review.expectedRole !== user.role) fail(409, "Approved current role review required");
        appliedReview = review;
      }
      user.role = body.role;
      if (user.accountState === undefined && user.role !== before.role) user.accountState = "active";
    }
    for (const field of ["confirmed", "accountState"]) {
      if (body[field] === undefined) continue;
      if (self || (field === "confirmed" ? typeof body[field] !== "boolean" : !["active", "suspended"].includes(body[field]))) fail(400, "Invalid account state");
      if (field === "accountState" && body[field] === user[field]) fail(409, "Account already has this state");
      user[field] = body[field];
    }
    const changedFields = [];
    for (const field of ["identifier", "name", "phone", "address"]) {
      if (body[field] === undefined) continue;
      if (typeof body[field] !== "string") fail(400, "Invalid profile field");
      const value = field === "identifier" ? text(body[field], field).toLowerCase() : body[field];
      if (user[field] !== value) changedFields.push(field);
      user[field] = value;
    }
    if (self && body.password !== undefined && !(typeof body.currentPassword === "string" && await user.matchPassword(body.currentPassword))) fail(401, "Current password is incorrect");
    if (body.password !== undefined) {
      if (typeof body.password !== "string" || !body.password) fail(400, "Invalid password");
      user.password = body.password;
    }
    await protectLastAdministrator(priorState, user, session);
    try { await saveAccountMutation(user, { session }); }
    catch (error) {
      if (error.name === "DocumentNotFoundError") fail(String(user._id) === accountId(actor.id) ? 401 : 409, "Account authorization changed");
      throw error;
    } finally { user.$where = originalWhere; }
    if (appliedReview) {
      appliedReview.status = "applied";
      appliedReview.verifiedAuthorityVersion = accountTokenVersion(user.authorityVersion);
      await appliedReview.save({ session });
    }
    const after = snapshot(user);
    if (after.version !== before.version) await invalidateGrants(user, before, session, audit);
    const changes = [];
    if (before.role !== after.role) changes.push(before.role === "user" ? "account.role_assigned" : "account.role_changed");
    if (before.confirmed !== after.confirmed) changes.push("account.confirmation_changed");
    if (before.accountState !== after.accountState) changes.push(after.accountState === "suspended" ? "account.suspended" : "account.reactivated");
    if (body.password !== undefined) changes.push(self ? "account.password_changed" : "account.password_reset");
    if (changedFields.length) changes.push("account.profile_changed");
    for (const type of changes.length ? changes : [action]) {
      const eventBefore = type === "account.profile_changed" ? { ...before, changedFields: [] } : before;
      const eventAfter = type === "account.profile_changed" ? { ...after, changedFields } : type.includes("password") ? { ...after, credentialsChanged: true } : after;
      await audit(type, target, eventBefore, eventAfter, { ...(body.reviewId ? { reviewId: body.reviewId } : {}), securityVersionBefore: before.version, securityVersionAfter: after.version });
    }
    return { account: self ? publicAccount(user) : administrativeAccount(user) };
  }, { self });
}

// Internal reviewed command foundation. No membership route or live mapping is
// enabled until bookstore administration is bound and independently tested.
export async function replaceStoreMemberships(actor, targetId, body) {
  if (!isTokenVersion(body?.expectedVersion) || typeof body?.operationId !== "string" || !Array.isArray(body?.storeIds)) fail(400, "Versioned explicit memberships required");
  const memberships = [];
  for (let index = 0; index < body.storeIds.length; index++) {
    if (!Object.hasOwn(body.storeIds, index)) fail(400, "Invalid membership list");
    memberships.push(new mongoose.Types.ObjectId(accountId(body.storeIds[index])));
  }
  if (!isStoredMemberships(memberships)) fail(400, "Invalid or duplicate memberships");
  return accountCommand(actor, targetId, "account.store_membership_changed", body, async ({ session, audit, target }) => {
    const user = await User.findById(target, null, { session });
    if (!user) fail(404, "User not found");
    const before = snapshot(user);
    if (before.version !== body.expectedVersion) fail(409, "Account changed; review again");
    if (user.storeIds !== undefined && !isStoredMemberships(user.storeIds)) fail(409, "Existing membership attribution requires reconciliation");
    const oldIds = (user.storeIds || []).map(value => value.toHexString()).sort();
    const newIds = memberships.map(value => value.toHexString()).sort();
    if (JSON.stringify(oldIds) === JSON.stringify(newIds)) fail(409, "Membership already matches");
    if (memberships.length && await Store.countDocuments({ _id: { $in: memberships } }).session(session) !== memberships.length) fail(400, "Unknown bookstore membership");
    user.storeIds = memberships;
    await user.save({ session });
    user.$locals.membershipChanged = true;
    await invalidateGrants(user, before, session, audit);
    await audit("account.store_membership_changed", target, { storeIds: oldIds }, { storeIds: newIds }, { securityVersionBefore: before.version, securityVersionAfter: accountTokenVersion(user.tokenVersion) });
    return { account: administrativeAccount(user), storeIds: newIds };
  });
}

export async function createAccount(actor, body) {
  validatePassword(body?.password);
  if (typeof body?.role !== "string" || !Object.hasOwn(ACCOUNT_ROLES, body.role)) fail(400, "Explicit approved role required");
  if ((body.confirmed !== undefined && body.confirmed !== false) || (body.accountState !== undefined && body.accountState !== "active")) fail(400, "New accounts must be active and unconfirmed");
  text(body.operationId, "operation ID");
  if (!process.env.JWT_SECRET) fail(503, "Account administration unavailable");
  const target = new mongoose.Types.ObjectId(createHmac("sha256", process.env.JWT_SECRET).update(`create:${actor.id}:${body.operationId}`).digest("hex").slice(0,24));
  return accountCommand(actor, String(target), "account.created", body, async ({ session, audit }) => {
    const [user] = await User.create([{
      _id: target, identifier: text(body.identifier, "identifier").toLowerCase(), password: body.password,
      role: body.role, confirmed: false, accountState: "active", name: body.name, phone: body.phone, address: body.address,
    }], { session });
    await audit("account.created", target, { absent: true }, snapshot(user));
    return { account: administrativeAccount(user) };
  });
}

export async function recordReview(actor, targetId, body) {
  if (typeof body?.proposedRole !== "string" || !Object.hasOwn(ACCOUNT_ROLES, body.proposedRole)) fail(400, "Invalid proposed role");
  if (!isTokenVersion(body.expectedVersion)) fail(400, "Expected account version required");
  if (!Array.isArray(body.evidenceRefs) || !body.evidenceRefs.length || body.evidenceRefs.length > 20 || body.evidenceRefs.some(value => typeof value !== "string" || !value.trim() || value.length > 256)) fail(400, "Review evidence references required");
  if (!["in-review", "approved", "rejected"].includes(body.status)) fail(400, "Invalid review decision");
  if (accountId(actor.id) === accountId(targetId)) fail(403, "Independent account review required");
  return accountCommand(actor, targetId, "account.review_recorded", body, async ({ session, audit, target, operationId }) => {
    const user = await User.findById(target, null, { session });
    if (!user) fail(404, "User not found");
    if (accountTokenVersion(user.tokenVersion) !== body.expectedVersion) fail(409, "Account changed; review again");
    let revision = 1;
    if (body.supersedes) {
      const previous = await AccountReview.findById(accountId(body.supersedes), null, { session });
      if (!previous || String(previous.targetAccountId) !== target || previous.status === "superseded") fail(409, "Invalid prior review");
      revision = previous.revision + 1;
      const oldStatus = previous.status;
      previous.status = "superseded"; await previous.save({ session });
      await audit("account.review_recorded", target, { reviewId: String(previous._id), status: oldStatus }, { reviewId: String(previous._id), status: "superseded" }, { reviewId: previous._id });
    }
    const [review] = await AccountReview.create([{
      targetAccountId: target, reviewerId: actor.id, status: body.status, proposedRole: body.proposedRole,
      expectedVersion: body.expectedVersion, expectedRole: user.role, reason: redactAuditText(body.reason),
      evidenceRefs: body.evidenceRefs.map(redactAuditText), revision, supersedes: body.supersedes, operationId,
    }], { session });
    await audit("account.review_recorded", target, { status: "awaiting-review" }, { reviewId: String(review._id), status: review.status, proposedRole: review.proposedRole, revision }, { reviewId: review._id });
    return { reviewId: String(review._id), status: review.status, revision };
  });
}

export async function applyReview(actor, targetId, body) {
  return accountCommand(actor, targetId, "account.role_assigned", body, async ({ session, audit, target }) => {
    const user = await User.findById(target, null, { session });
    const review = await AccountReview.findById(accountId(body.reviewId), null, { session });
    if (!user || !review || review.status !== "approved" || String(review.targetAccountId) !== target || review.expectedRole !== user.role || review.expectedVersion !== accountTokenVersion(user.tokenVersion) || (body.expectedVersion !== undefined && body.expectedVersion !== accountTokenVersion(user.tokenVersion))) fail(409, "Approved current account review required");
    if (String(review.reviewerId) === target) fail(403, "Independent review required");
    const before = snapshot(user);
    const prior = { role: user.role, confirmed: user.confirmed, accountState: user.accountState };
    user.role = review.proposedRole;
    if (user.accountState === undefined) user.accountState = "active";
    user.$locals.forceSecurityChange = true;
    await protectLastAdministrator(prior, user, session);
    await user.save({ session });
    await invalidateGrants(user, before, session, audit);
    review.status = "applied"; review.verifiedAuthorityVersion = accountTokenVersion(user.authorityVersion);
    await review.save({ session });
    await audit("account.role_assigned", target, before, snapshot(user), { reviewId: review._id });
    return { account: administrativeAccount(user), reviewId: String(review._id) };
  });
}

async function validateScope(capability, scope, recipient, session) {
  const rule = CAPABILITIES[capability];
  if (!scope || Object.getPrototypeOf(scope) !== Object.prototype || Object.keys(scope).sort().join(",") !== "kind,resourceIds" || scope.kind !== rule.scope || !Array.isArray(scope.resourceIds) || !scope.resourceIds.length || scope.resourceIds.length > 100) fail(400, "Explicit bounded scope required");
  const ids = scope.resourceIds.map(accountId);
  if (new Set(ids).size !== ids.length) fail(400, "Duplicate scope resource");
  if (rule.scope === "own-processor") {
    if (ids.length !== 1 || ids[0] !== String(recipient._id)) fail(403, "Own-processor scope required");
  } else {
    const productScope = capability.startsWith("inventory.") || capability === "catalog.saleRead";
    const Model = productScope ? Product : Order;
    const membership = isStoredMemberships(recipient.storeIds) ? recipient.storeIds : [];
    const bounds = [{ owner: recipient._id, storeId: { $exists: false } }];
    if (membership.length) bounds.push({ storeId: { $in: membership }, ...(capability === "order.fulfill" ? { $or: [{ assignedTo: recipient._id }, { assignedTo: { $exists: false } }, { assignedTo: null }] } : {}) });
    const found = await Model.countDocuments({ _id: { $in: ids }, $or: bounds }).session(session);
    if (found !== ids.length) fail(403, "Scope outside recipient's authorized legacy ownership");
  }
  return { kind: scope.kind, resourceIds: ids };
}

export async function grantPermission(actor, targetId, body) {
  if (accountId(actor.id) === accountId(targetId)) fail(403, "Self-grants are prohibited");
  const inputs = body.grants === undefined ? [body] : body.grants;
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 13 || Object.keys(inputs).length !== inputs.length) fail(400, "Explicit grant set required");
  const prepared = inputs.map(input => {
    const capability = input?.capability;
    if (typeof capability !== "string" || !Object.hasOwn(CAPABILITIES, capability)) fail(400, "Invalid capability");
    const effectiveAt = strictDate(input.effectiveAt), expiresAt = strictDate(input.expiresAt);
    if (expiresAt <= effectiveAt || expiresAt <= new Date()) fail(400, "Invalid grant expiration");
    return { capability, effectiveAt, expiresAt, input };
  });
  if (new Set(prepared.map(item => item.capability)).size !== prepared.length) fail(400, "Duplicate grant capability");
  return accountCommand(actor, targetId, "permission.granted", body, async ({ session, audit, target, operationId }) => {
    const grantor = await User.findById(actor.id, null, { session });
    const verification = await AccountReview.findOne({ targetAccountId: actor.id, proposedRole: "admin", status: "applied", verifiedAuthorityVersion: accountTokenVersion(grantor?.authorityVersion), reviewerId: { $ne: actor.id } }).session(session);
    if (!grantor || !verification) fail(403, "Independently verified Administrator required");
    const user = await User.findById(target, null, { session });
    const role = resolveAccountRole(user?.role)?.businessRole;
    if (!user || user.confirmed !== true || !isAccountActive(user)) fail(403, "Invalid grant recipient");
    if (body.expectedVersion !== undefined && body.expectedVersion !== accountTokenVersion(user.tokenVersion)) fail(409, "Account changed; review again");
    const requests = [];
    for (const entry of prepared) {
      if (!CAPABILITIES[entry.capability].conditional.includes(role)) fail(403, "Capability exceeds recipient role boundaries");
      const scope = await validateScope(entry.capability, entry.input.scope, user, session);
      requests.push({ ...entry, scope, approvalRef: redactAuditText(text(entry.input.approvalRef, "approval reference")) });
    }
    const before = snapshot(user);
    user.$locals.forceSecurityChange = true; await user.save({ session });
    await invalidateGrants(user, before, session, audit);
    if (requests.some(entry => entry.expiresAt <= new Date())) fail(400, "Grant expired before mutation");
    const grants = await AccountGrant.create(requests.map(entry => ({
      recipientAccountId: target, capability: entry.capability, scope: entry.scope, grantedBy: actor.id, reason: redactAuditText(body.reason), approvalRef: entry.approvalRef,
      effectiveAt: entry.effectiveAt, expiresAt: entry.expiresAt, recipientVersion: accountTokenVersion(user.tokenVersion), grantorAuthorityVersion: accountTokenVersion(grantor.authorityVersion), operationId,
    })), { session, ordered: true });
    for (let index = 0; index < grants.length; index++) {
      const grant = grants[index], entry = requests[index];
      await audit("permission.granted", target, { absent: true }, { grantId: String(grant._id), capability: entry.capability, effectiveAt: entry.effectiveAt.toISOString(), expiresAt: entry.expiresAt.toISOString() }, { grantId: grant._id, scope: entry.scope, approvalRef: entry.approvalRef });
    }
    return { grantIds: grants.map(grant => String(grant._id)), ...(grants.length === 1 ? { grantId: String(grants[0]._id), expiresAt: requests[0].expiresAt.toISOString() } : {}) };
  });
}

export async function revokePermission(actor, targetId, grantId, body) {
  return accountCommand(actor, targetId, "permission.revoked", body, async ({ session, audit, target }) => {
    const grant = await AccountGrant.findById(accountId(grantId), null, { session });
    const user = await User.findById(target, null, { session });
    if (!grant || !user || String(grant.recipientAccountId) !== target) fail(404, "Grant not found");
    if (body.expectedVersion !== undefined && body.expectedVersion !== accountTokenVersion(user.tokenVersion)) fail(409, "Account changed; review again");
    if (grant.revokedAt !== null) fail(409, "Grant is not active");
    const before = snapshot(user);
    user.$locals.forceSecurityChange = true; await user.save({ session });
    await invalidateGrants(user, before, session, audit);
    return { grantId: String(grant._id), revoked: true };
  });
}

export async function recordGrantExpiration(grantId) {
  return accountTransaction(async session => {
    await lockAccountRealm(session);
    const grant = await AccountGrant.findById(accountId(grantId), null, { session });
    if (!grant || grant.expiredRecordedAt || !(grant.expiresAt <= new Date())) return;
    grant.expiredRecordedAt = new Date(); await grant.save({ session });
    await AccountAudit.create([{
      schemaVersion: 1, eventId: randomUUID(), operationId: `expiry_${grant._id}`, sequence: 0,
      actor: { kind: "system-expiry" }, subjectAccountId: grant.recipientAccountId, action: "permission.expired", occurredAt: new Date(),
      reason: "Explicit grant expiration reached", before: { grantId: String(grant._id), expiresAt: grant.expiresAt.toISOString() },
      after: { expired: true }, scope: grant.scope, grantId: grant._id, outcome: "observed-expired",
    }], { session });
  });
}

// Server-side resolver only; never accepts client conditionalActions and never
// attaches permissions to the existing operational routes.
export async function resolveConditionalGrant(recipientId, grantId, capability, resourceId, now = new Date(), { session, materializeExpiry = true } = {}) {
  try {
    if (!(now instanceof Date) || !Number.isFinite(now.valueOf())) return false;
    const recipient = accountId(recipientId), resource = accountId(resourceId);
    const grant = await AccountGrant.findById(accountId(grantId)).session(session);
    if (!grant || String(grant.grantedBy) === recipient || String(grant.recipientAccountId) !== recipient || grant.capability !== capability || grant.revokedAt !== null || !Array.isArray(grant.scope?.resourceIds) || !grant.scope.resourceIds.includes(resource)) return false;
    if (!(grant.expiresAt instanceof Date) || !Number.isFinite(grant.expiresAt.valueOf()) || grant.expiresAt <= now) {
      try { if (materializeExpiry) await recordGrantExpiration(grant._id); } catch { console.error("Grant expiration audit pending"); }
      return false;
    }
    if (!(grant.effectiveAt instanceof Date) || !Number.isFinite(grant.effectiveAt.valueOf()) || grant.effectiveAt > now || grant.effectiveAt >= grant.expiresAt) return false;
    const user = await User.findById(recipient).session(session), grantor = await User.findById(grant.grantedBy).session(session);
    const role = resolveAccountRole(user?.role)?.businessRole;
    if (user?.confirmed !== true || !isAccountActive(user) || !CAPABILITIES[capability]?.conditional.includes(role) || accountTokenVersion(user.tokenVersion) !== grant.recipientVersion) return false;
    if (grantor?.confirmed !== true || !isAccountActive(grantor) || grantor.role !== "admin" || accountTokenVersion(grantor.authorityVersion) !== grant.grantorAuthorityVersion) return false;
    await validateScope(capability, grant.scope, user, session);
    return true;
  } catch { return false; }
}

export async function sweepExpiredGrants() {
  // Explicit internal maintenance entry point; no scheduler/network startup.
  const due = await AccountGrant.find({ expiresAt: { $lte: new Date() }, expiredRecordedAt: { $exists: false } }).limit(100);
  for (const grant of due) await recordGrantExpiration(grant._id);
  return due.length;
}

export async function deleteAccount(actor, targetId, body) {
  const target = accountId(targetId);
  if (target === accountId(actor?.id)) fail(400, "Cannot delete your own account");
  return accountCommand(actor, target, "account.deleted", body, async ({ session, audit }) => {
    const user = await User.findById(target, null, { session });
    if (!user) fail(404, "User not found");
    await protectLastAdministrator(user, null, session);
    const before = snapshot(user);
    await invalidateGrants({ ...user.toObject(), role: "deleted" }, before, session, audit);
    await user.deleteOne({ session });
    await audit("account.deleted", target, before, { absent: true });
    return { message: "User deleted" };
  });
}
