import express from "express";
import { readFileSync } from "node:fs";
import { createApp } from "../app.js";
import { protect } from "../middleware/authMiddleware.js";
import * as userHandlers from "../controllers/UserController.js";
import * as lifecycleHandlers from "../controllers/AccountLifecycleController.js";
import { ACCOUNT_ROUTE_MANIFEST } from "../auth/accountRouteManifest.js";
import { BOOKSTORE_ROUTE_MANIFEST } from "../auth/bookstoreRouteManifest.js";
export function collectRoutes({ includeAccountRoutes = false, includeBookstoreRoutes = false } = {}) {
  const mounts=[]; const use=express.application.use;
  express.application.use=function(...args) {
    if(typeof args[0]==="string") {
      for(const handler of args.slice(1)) {
        if(!handler?.stack) throw new Error("Unsupported mount");
        mounts.push({prefix:args[0],router:handler});
      }
    } else if(args.some(a=>typeof a!=="function")) throw new Error("Unsupported middleware");
    return use.apply(this,args);
  };
  let app;
  try {app=createApp();} finally {express.application.use=use;}
  const result=[];
  for(const {prefix,router} of mounts) {
    let guarded=false;
    for(const layer of router.stack) {
      if(layer.handle===protect) guarded=true;
      if(!layer.route) {
        if(layer.handle!==protect) throw new Error("Unsupported router middleware");
        continue;
      }
      const route=layer.route;
      if(typeof route.path!=="string") throw new Error("Unsupported route shape");
      for(const method of Object.keys(route.methods)) {
        if(!["get","post","put","patch","delete"].includes(method)) throw new Error("Unsupported method");
        const handlers=route.stack.filter(p=>!p.method||p.method===method).map(p=>p.handle);
        result.push({method:method.toUpperCase(),path:prefix+(route.path==="/"?"":route.path),
          mount:prefix,handler:Object.keys({ ...userHandlers, ...lifecycleHandlers }).find(k=>({ ...userHandlers, ...lifecycleHandlers })[k]===handlers.at(-1)) ?? handlers.at(-1).name,protected:guarded||handlers[0]===protect});
      }
    }
  }
  for(const layer of app.router.stack) {
    if(layer.handle?.stack && !mounts.some(m=>m.router===layer.handle)) throw new Error("Unclassified mount");
    if(layer.route) {
      if(layer.route.path!=="/" && layer.route.path!=="/api/health") throw new Error("Unclassified public route");
      for(const method of Object.keys(layer.route.methods)) {
        if(!["get","post","put","patch","delete"].includes(method)) throw new Error("Unsupported public method");
        const handlers=layer.route.stack.filter(p=>!p.method||p.method===method).map(p=>p.handle);
        // Anonymous diagnostics are pinned by their registration source as well as metadata.
        if(handlers.length!==1 || !createApp.toString().includes(handlers[0].toString())) throw new Error("Changed public handler");
        result.push({method:method.toUpperCase(),path:layer.route.path,mount:null,
          handler:layer.route.path==="/"?"diagnostic":"health",protected:handlers[0]===protect});
      }
    }
  }
  // Exact additive identities only; missing/altered additions are checked by
  // B02's full-inventory tests. Any unrecognized drift remains in the baseline
  // and fails B01 validation. No changed historical row is filtered out.
  return result.filter(row =>
    (includeAccountRoutes || !ACCOUNT_ROUTE_MANIFEST.some(expected => ["method","path","handler","protected","mount"].every(key => row[key] === expected[key]))) &&
    (includeBookstoreRoutes || !BOOKSTORE_ROUTE_MANIFEST.some(expected => ["method","path","handler","protected","mount"].every(key => row[key] === expected[key]))));
}
// Phase15F applies Phase15C business boundaries and Phase15E architecture to each route.
// The oracle is deliberately not imported from the mutable manifest under validation.
const approvedCriteria = new Set(Array.from({length:17},(_,i)=>"RB"+String(i+1).padStart(2,"0")));
const specification = readFileSync(new URL("../../docs/UPHSD_BOOKSTORE_PHASE_15F_TECHNICAL_CONTRACT_REVIEW.md",import.meta.url),"utf8");
const approvedRoutes = new Map();
for (const line of specification.split(/\r?\n/)) {
  if (!/^\| R\d{2} \|/.test(line)) continue;
  const cells=line.split("|").slice(1,-1).map(cell=>cell.trim());
  if(cells.length!==9) throw new Error("Unsupported authoritative route table");
  const [id,method,path,,,capability,scope,policy,criteria]=cells;
  const key=method+" "+path.replaceAll("`","");
  if(approvedRoutes.has(key)) throw new Error("Duplicate authoritative route");
  const refs=criteria.split("/");
  if(refs.some(ref=>!approvedCriteria.has(ref))) throw new Error("Unknown authoritative criterion");
  approvedRoutes.set(key,{id,capability,scope,policy,criteria:refs});
}
if(approvedRoutes.size!==59) throw new Error("Incomplete authoritative route inventory");

function denseStrings(value) {
  if(!Array.isArray(value) || Object.getPrototypeOf(value)!==Array.prototype ||
    Reflect.ownKeys(value).length!==value.length+1) return false;
  for(let i=0;i<value.length;i++) {
    const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
    if(!descriptor || !Object.hasOwn(descriptor,"value") || typeof descriptor.value!=="string" || !descriptor.value) return false;
  }
  return true;
}
function exactList(value, expected) {
  if(!denseStrings(value) || value.length!==expected.length) return false;
  for(let i=0;i<expected.length;i++) if(value[i]!==expected[i]) return false;
  return true;
}
function identity(row) {
  if(!row || typeof row!=="object" || !["GET","POST","PUT","PATCH","DELETE"].includes(row.method) ||
    typeof row.path!=="string" || !row.path || typeof row.handler!=="string" || !row.handler ||
    !(row.mount===null || typeof row.mount==="string") || typeof row.protected!=="boolean") throw new Error("Invalid route identity");
  const aliases={createOrder:"createTransaction",getOrders:"getTransactions",getOrderById:"getTransactionById",createPerson:"createCustomer",getPeople:"getCustomers",getPersonById:"getCustomerById",updatePerson:"updateCustomer",deletePerson:"deleteCustomer"};
  return [row.method,row.path,row.mount,aliases[row.handler]??row.handler,row.protected].join("\u0000");
}
export function validateInventory(actual, expected) {
  for(const rows of [actual,expected]) {
    if(!Array.isArray(rows) || Reflect.ownKeys(rows).length!==rows.length+1) throw new Error("Invalid inventory");
    for(let i=0;i<rows.length;i++) {
      const slot=Object.getOwnPropertyDescriptor(rows,String(i));
      if(!slot || !Object.hasOwn(slot,"value")) throw new Error("Incomplete inventory");
    }
  }
  const actualKeys=actual.map(identity),expectedKeys=expected.map(identity);
  if(new Set(actualKeys).size!==actualKeys.length || new Set(expectedKeys).size!==expectedKeys.length ||
    actualKeys.length!==expectedKeys.length || actualKeys.slice().sort().some((key,i)=>key!==expectedKeys.slice().sort()[i])) throw new Error("Route inventory mismatch");
  for(const row of expected) {
    for(const field of ["method","path","handler","effects","bindingStatus"]) if(typeof row[field]!=="string" || !row[field]) throw new Error("Missing route metadata");
    if(!denseStrings(row.actionRefs) || row.bindingStatus!=="unattached") throw new Error("Missing action metadata");
    if(["createOrder","createTransaction","updateOrder","markAsCompleted"].includes(row.handler)) {
      if(row.branchSensitive!==true || row.effects!=="mutation" ||
        !exactList(row.actionRefs,["sale.process","payment.record","receipt.issue"]) ||
        row.actionComposition!=="per-effect conjunction; conditional completion" ||
        !exactList(row.completionConstraints,["current-account","server-price","state-validation","atomic-effects","operation-identity","audit"])) throw new Error("Weakened completion requirements");
    }
    if(Object.hasOwn(row,"completionConstraints") && !denseStrings(row.completionConstraints)) throw new Error("Invalid completion constraints");
    if(row.protected) {
      const reference=approvedRoutes.get(row.method+" "+row.path);
      if(!reference || row.id!==reference.id || row.runtimeAttached!==false) throw new Error("Unapproved protected route");
      if(!denseStrings(row.criteria) || new Set(row.criteria).size!==row.criteria.length ||
        row.criteria.some(ref=>!approvedCriteria.has(ref)) || row.criteria.length!==reference.criteria.length ||
        reference.criteria.some(ref=>!row.criteria.includes(ref))) throw new Error("Invalid or incomplete criterion mapping");
      if(row.scope!==reference.scope || row.requiredCapability!==reference.capability || row.proposedPolicy!==reference.policy) throw new Error("Altered scope/capability policy description");
    }
    if(row.handler==="getOrCreateInvoice" && row.effects!=="invoice-issue") throw new Error("Lost write effect");
    if(["addDebt","updateDebt","deleteDebt"].includes(row.handler) && (!row.retired||row.effects!=="retired")) throw new Error("Revived tombstone");
    if(row.allowed===true) throw new Error("Unsafe unresolved policy");
  }
  const user=actual.filter(r=>r.mount==="/api/users");
  for(const name of ["getProfile","updateProfile","updatePassword"]) {
    const at=user.findIndex(r=>r.handler===name),target=user.findIndex(r=>r.handler==="updateUser");
    if(at<0 || target<0 || at>target) throw new Error("User route precedence");
  }
}

