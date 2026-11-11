import { freeze, isDenseStringArray } from "./roles.js";
import { evaluateRolePolicy } from "./policy.js";
export const FIELD_PROFILES=freeze({
  sale:["name","sku","price","category","availability"],
  orderSubmit:["items"],
  orderStatus:["reference","orderStatus"],
  catalog:["name","sku","price","category"],
  stock:["delta","reason"],
  account:["identifier","name","phone","address","role","confirmed"],
  none:[]
});
export const FIELD_ALIASES=freeze({sellingPrice:"price",quantity:"stock",active:"isActive"});
// Projection and command specifications are distinct; none executes a serializer.
export const ORDER_ITEM_FIELDS=freeze(["product","quantity"]);
export const FIELD_PURPOSES=freeze({sale:"read-projection",orderStatus:"read-projection",orderSubmit:"command",catalog:"command",stock:"command",account:"account-specification",none:"unresolved"});
export function evaluateOrderItemFields(fields) {
  return freeze({effect:isDenseStringArray(fields) && fields.length===ORDER_ITEM_FIELDS.length &&
    ORDER_ITEM_FIELDS.every(field=>fields.includes(field)) ? "eligible" : "deny",
    purpose:"command-item", requiredGuards:["product-validation","quantity-validation","server-price"]});
}
export const EXCLUDED_FIELDS=freeze(["password","token","tokenVersion","authorization","secret","costPrice","owner","studentUser","guestAccess"]);
export function evaluateFields(role, action, fields, conditions={}) {
  const plan=evaluateRolePolicy(role,action,conditions);
  if (plan.effect!=="eligible" || !isDenseStringArray(fields) || fields.length===0) return freeze({effect:"deny"});
  const allowed=FIELD_PROFILES[plan.fieldProfile];
  return freeze({effect:fields.every(f=>allowed.includes(FIELD_ALIASES[f]??f) && !EXCLUDED_FIELDS.includes(f))?"eligible":"deny",
    requiredScope:plan.requiredScope, purpose:FIELD_PURPOSES[plan.fieldProfile], requiredGuards:plan.requiredGuards});
}

