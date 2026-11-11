import { isBusinessRole, freeze, isDenseStringArray } from "./roles.js";
import { CAPABILITIES } from "./capabilities.js";
const deny=reason=>freeze({effect:"deny",reason});
export function evaluateRolePolicy(role, action, conditions={}) {
  if (!isBusinessRole(role) || typeof action!=="string" || !Object.hasOwn(CAPABILITIES,action)) return deny("unknown-role-or-action");
  if (!conditions || Object.getPrototypeOf(conditions)!==Object.prototype ||
      Reflect.ownKeys(conditions).some(k=>k!=="conditionalActions") ||
      (Object.hasOwn(conditions,"conditionalActions") && (!isDenseStringArray(conditions.conditionalActions) ||
      conditions.conditionalActions.some(a=>typeof a!=="string" || !Object.hasOwn(CAPABILITIES,a) || !CAPABILITIES[a].conditional.includes(role))))) return deny("invalid-conditions");
  const rule=CAPABILITIES[action];
  if (!rule.base.includes(role) && !(rule.conditional.includes(role) && Object.hasOwn(conditions,"conditionalActions") && conditions.conditionalActions.includes(action))) return deny("role-or-condition-denied");
  // Eligibility is a constraint plan, NEVER an executable authorization permit.
  return freeze({effect:"eligible", requiredScope:rule.scope, fieldProfile:rule.fields,
    requiredGuards:["authentication","current-account",...rule.guards]});
}
export function checkResourceOwnership(actual, expected) {
  // Pure exact identity comparison; no database lookup, scope resolver or ID coercion.
  return typeof actual==="string" && /^[a-f0-9]{24}$/.test(actual) &&
    typeof expected==="string" && actual===expected;
}

