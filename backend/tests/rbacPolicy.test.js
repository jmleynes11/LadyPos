import test from "node:test";
import assert from "node:assert/strict";
import { ROLES,isBusinessRole } from "../auth/roles.js";
import { CAPABILITIES } from "../auth/capabilities.js";
import { evaluateRolePolicy as evaluate,checkResourceOwnership } from "../auth/policy.js";
import { evaluateFields,FIELD_PROFILES,evaluateOrderItemFields } from "../auth/fieldPolicy.js";
test("R1 sparse/missing/malformed field and grant arrays fail closed",()=>{
 const sparseFields=new Array(2);sparseFields[1]="delta";
 const sparseGrants=new Array(2);sparseGrants[1]="sale.process";
 for(const fields of [undefined,null,[],new Array(1),sparseFields,[undefined],[null],[{}]]) assert.equal(evaluateFields("Store Manager","inventory.adjust",fields).effect,"deny");
 for(const grants of [undefined,null,new Array(1),sparseGrants,[undefined],[null],[{}]]) {
  for(const action of ["sale.process","product.price.write"]) assert.equal(evaluate("Administrator",action,{conditionalActions:grants}).effect,"deny");
 }
 assert.equal(evaluate("Administrator","product.price.write",{}).effect,"eligible");
 assert.equal(evaluate("Administrator","sale.process",{conditionalActions:[]}).effect,"deny");
 assert.equal(evaluate("Administrator","sale.process",{conditionalActions:["sale.process"]}).effect,"eligible");
});
test("R1 catalog and own-status projections cannot become submit payload fields",()=>{
 assert.equal(evaluateFields("Customer / Student","catalog.saleRead",["price"]).effect,"eligible");
 assert.equal(evaluateFields("Customer / Student","order.status.own",["reference","orderStatus"]).purpose,"read-projection");
 const plan=evaluateFields("Customer / Student","order.submit",["items"]);
 assert.equal(plan.effect,"eligible");assert.equal(plan.purpose,"command");assert(plan.requiredGuards.includes("item-validation"));
 for(const field of ["price","sellingPrice","costPrice","owner","studentUser","guestAccess","paymentStatus","amountPaid","stock","orderStatus","reference","name"]) assert.equal(evaluateFields("Customer / Student","order.submit",[field]).effect,"deny");
 assert.equal(evaluateOrderItemFields(["product","quantity"]).effect,"eligible");
 for(const fields of [undefined,null,[],new Array(2),["product"],["product","product"],["product","quantity","price"],["product","quantity","owner"]]) assert.equal(evaluateOrderItemFields(fields).effect,"deny");
});
test("exact four storage-independent labels, strict validation and immutable definitions",()=>{
 assert.deepEqual(ROLES,["Administrator","Store Manager","Cashier","Customer / Student"]);
 for(const value of [null,undefined,"admin","user","Guest","Cashier ",{},[],1]) assert.equal(isBusinessRole(value),false);
 assert.throws(()=>ROLES.push("Guest")); assert.throws(()=>CAPABILITIES["inventory.adjust"].base.push("Cashier"));
 assert.throws(()=>FIELD_PROFILES.sale.push("costPrice"));
});
for(const [action,rule] of Object.entries(CAPABILITIES)) {
 test("role/action matrix: "+action,()=>{
  for(const role of ROLES) {
   const decision=evaluate(role,action);
   assert.equal(decision.effect,rule.base.includes(role)?"eligible":"deny");
   if(decision.effect==="eligible") {assert.equal(decision.requiredScope,rule.scope);assert(decision.requiredGuards.includes("authentication"));assert.equal(decision.allowed,undefined);}
   if(rule.conditional.includes(role)) assert.equal(evaluate(role,action,{conditionalActions:[action]}).effect,"eligible");
  }
 });
}
test("five owner decisions and immutable conditional ceilings",()=>{
 for(const role of ["Store Manager","Cashier","Customer / Student"]) assert.equal(evaluate(role,"product.price.write").effect,"deny");
 assert.equal(evaluate("Administrator","product.price.write").effect,"eligible");
 for(const action of ["inventory.adjust","inventory.receive","reversal.approve","reversal.apply","salesHistory.all"]) assert.equal(evaluate("Store Manager",action).effect,"eligible");
 for(const action of ["inventory.adjust","reversal.approve","salesHistory.all","account.create"]) {
  assert.equal(evaluate("Cashier",action,{conditionalActions:[action]}).effect,"deny");
 }
 assert.equal(evaluate("Cashier","reversal.request").effect,"eligible");
 assert.equal(evaluate("Cashier","salesHistory.own").requiredScope,"own-processor");
 assert.equal(evaluate("Customer / Student","order.submit").requiredScope,"own-subject");
 assert.equal(evaluate("Guest","sale.process").effect,"deny");
 assert(evaluate("Store Manager","inventory.adjust").requiredGuards.includes("reason"));
});
test("malformed and unresolved conditions fail closed without mutation",()=>{
 const c={conditionalActions:["sale.process"]};const before=JSON.stringify(c);
 assert.equal(evaluate("Administrator","sale.process",c).effect,"eligible");assert.equal(JSON.stringify(c),before);
 for(const x of [null,[],true,{conditionalActions:"*"},{conditionalActions:["*"]},{conditionalActions:["account.create"]},{extra:true}])
 assert.equal(evaluate("Administrator","sale.process",x).effect,"deny");
 for(const x of [undefined,"*","expenses","costs",{},[]]) assert.equal(evaluate("Administrator",x).effect,"deny");
});
test("resource identity check is separate, exact and has no coercion",()=>{
 const a="abcdefabcdefabcdefabcdef",b="123456123456123456123456";
 assert.equal(checkResourceOwnership(a,a),true); assert.equal(checkResourceOwnership(a,b),false);
 for(const x of [null,undefined,a.toUpperCase(),{},1]) assert.equal(checkResourceOwnership(x,a),false);
 assert.equal(evaluate("Cashier","salesHistory.own").effect,"eligible"); // NOT proof of record access.
});
test("field profiles separate price/stock/cost aliases and preserve input",()=>{
 const fields=["sellingPrice"];assert.equal(evaluateFields("Administrator","product.price.write",fields).effect,"eligible");assert.deepEqual(fields,["sellingPrice"]);
 for(const field of ["price","sellingPrice","quantity","stock","active","isActive","costPrice","owner","password","token"])
 assert.equal(evaluateFields("Store Manager","inventory.adjust",[field]).effect,"deny");
 assert.equal(evaluateFields("Store Manager","inventory.adjust",["delta","reason"]).effect,"eligible");
 for(const field of ["costPrice","owner","tokenVersion"]) assert.equal(evaluateFields("Cashier","catalog.saleRead",[field]).effect,"deny");
});

