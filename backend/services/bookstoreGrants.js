import { AccountGrant } from "../models/AccountControl.js";
import { CAPABILITIES } from "../auth/capabilities.js";
import { resolveAccountRole } from "../auth/accountRoles.js";
import { evaluateRolePolicy } from "../auth/policy.js";
import { resolveConditionalGrant, fail } from "./accountManagement.js";

export const hasBaseCapability = (role, action) => evaluateRolePolicy(resolveAccountRole(role)?.businessRole, action).effect === "eligible";
export const mayHoldCapability = (role, action) => hasBaseCapability(role, action) || Boolean(CAPABILITIES[action]?.conditional.includes(resolveAccountRole(role)?.businessRole));

// Discover existing B02 grants; clients never supply an authority assertion.
export async function grantedResources(actor, action, session) {
  if (!mayHoldCapability(actor.role, action)) return [];
  const grants = await AccountGrant.find({ recipientAccountId: actor.id, capability: action, revokedAt: null }).session(session);
  const resources = new Set();
  for (const grant of grants) for (const resource of grant.scope?.resourceIds || []) {
    if (await resolveConditionalGrant(actor.id, String(grant._id), action, String(resource), new Date(), { session, materializeExpiry: false })) resources.add(String(resource));
  }
  return [...resources];
}
export async function requireResourceCapability(actor, action, resourceId, session) {
  if (hasBaseCapability(actor.role, action)) return;
  if (!resourceId || !(await grantedResources(actor, action, session)).includes(String(resourceId))) fail(403, "Current bounded conditional grant required");
}
