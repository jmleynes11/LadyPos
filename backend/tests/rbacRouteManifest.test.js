import test, { beforeEach } from "node:test";
import express from "express";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import net from "node:net";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { ROUTE_MANIFEST,HEAD_MANIFEST,OPTIONS_POLICY } from "../auth/routeManifest.js";
import { collectRoutes,validateInventory } from "./routeInventoryAdapter.js";
import { CAPABILITIES } from "../auth/capabilities.js";
test("R2 completion constraints reject serialization spoofing and malformed structure",()=>{
 const actual=collectRoutes();
 const guards=["current-account","server-price","state-validation","atomic-effects","operation-identity","audit"];
 let calls=0;
 const spoof={toJSON(){calls++;return guards;}};
 const sparse=new Array(guards.length);sparse[1]="server-price";
 const accessor=guards.slice();Object.defineProperty(accessor,"0",{get(){throw new Error("Getter must not run");}});
 const custom=guards.slice();custom.toJSON=()=>guards;
 for(const value of [spoof,null,undefined,"guards",{},[],sparse,accessor,custom,[...guards,"extra"],guards.slice(1),[null,...guards.slice(1)]]) {
  const copy=structuredClone(ROUTE_MANIFEST);copy.find(r=>r.handler==="createOrder").completionConstraints=value;
  assert.throws(()=>validateInventory(actual,copy));
 }
 assert.equal(calls,0);
 validateInventory(actual,structuredClone(ROUTE_MANIFEST));
});
test("R2 criteria are dense valid complete per-route references",()=>{
 const actual=collectRoutes();
 const original=ROUTE_MANIFEST.find(r=>r.handler==="createOrder");
 const sparse=new Array(original.criteria.length);sparse[0]="RB01";
 for(const value of ["anything",null,undefined,{},[],sparse,["RB00"],["RB18"],["rb01"],["RB01",null],["RB01",undefined],original.criteria.slice(1),[...original.criteria,"RB16"],[...original.criteria,original.criteria[0]]]) {
  const copy=structuredClone(ROUTE_MANIFEST);copy.find(r=>r.handler==="createOrder").criteria=value;assert.throws(()=>validateInventory(actual,copy));
 }
 const copy=structuredClone(ROUTE_MANIFEST);copy.find(r=>r.handler==="createOrder").criteria.reverse();validateInventory(actual,copy);
 const missing=structuredClone(ROUTE_MANIFEST);delete missing.find(r=>r.handler==="createOrder").criteria;assert.throws(()=>validateInventory(actual,missing));
});
test("R2 Phase15F descriptions cannot be weakened or replaced",()=>{
 const actual=collectRoutes();
 for(const row of ROUTE_MANIFEST.filter(r=>r.protected)) {
  for(const field of ["scope","requiredCapability","proposedPolicy"]) {
   for(const value of [undefined,null,"", "unrestricted", "allow-all",42,{}]) {
    const copy=structuredClone(ROUTE_MANIFEST);copy.find(r=>r.id===row.id)[field]=value;assert.throws(()=>validateInventory(actual,copy));
   }
  }
 }
 validateInventory(actual,ROUTE_MANIFEST);
});
test("R2 sparse inventories and missing route metadata fail closed",()=>{
 const actual=collectRoutes();
 for(const field of ["method","path","handler","effects","bindingStatus","actionRefs","scope","requiredCapability"]) {
  const copy=structuredClone(ROUTE_MANIFEST);delete copy.find(r=>r.handler==="createOrder")[field];assert.throws(()=>validateInventory(actual,copy));
 }
 const incomplete=actual.slice();delete incomplete[incomplete.length-1];assert.throws(()=>validateInventory(incomplete,ROUTE_MANIFEST));
});
beforeEach((t)=>{
 const forbidden=()=>{throw new Error("I/O forbidden");};
 for(const [obj,key] of [[mongoose,"connect"],[mongoose,"createConnection"],[mongoose,"startSession"],[mongoose.Model,"startSession"],[net.Server.prototype,"listen"],[net.Socket.prototype,"connect"],[http,"request"]]) t.mock.method(obj,key,forbidden);
 for(const key of ["find","findOne","insertOne","insertMany","updateOne","updateMany","deleteOne","aggregate","findOneAndUpdate"]) t.mock.method(mongoose.Collection.prototype,key,forbidden);
});
test("actual registration graph matches exact manifest without handlers or database/network I/O",()=>{
 const actual=collectRoutes(); validateInventory(actual,ROUTE_MANIFEST);
 assert.equal(actual.length,62);assert.equal(actual.filter(r=>r.protected).length,59);
 assert.equal(new Set(actual.filter(r=>r.mount).map(r=>r.mount)).size,11);
 assert.equal(mongoose.connection.readyState,0);
 assert.equal(HEAD_MANIFEST.filter(r=>r.protected).length,23);
 assert.equal(HEAD_MANIFEST.filter(r=>r.effects==="invoice-issue").length,2);
 assert.equal(ROUTE_MANIFEST.filter(r=>r.retired).length,3);
 assert.equal(OPTIONS_POLICY.domainHandler,false);
});
test("R1 original public GET-to-POST drift fails observed inventory",()=>{
 const get=express.application.get, use=express.application.use;
 try {
  express.application.get=function(path,...args){return path==="/api/health"&&args.length?this.post(path,...args):get.call(this,path,...args);};
  const observed=collectRoutes();assert(observed.some(r=>r.path==="/api/health"&&r.method==="POST"));
  assert.throws(()=>validateInventory(observed,ROUTE_MANIFEST));
 } finally {express.application.get=get;}
 assert.equal(express.application.use,use);
});
test("R1 erased or partially weakened completion constraints fail for every alias",()=>{
 const observed=collectRoutes();
 for(const handler of ["createOrder","createTransaction","updateOrder","markAsCompleted"]) {
  for(const mutation of [r=>Object.assign(r,{branchSensitive:false,actionRefs:[],actionComposition:"allow"}),r=>delete r.branchSensitive,r=>r.actionRefs.pop(),r=>r.actionRefs=["account.create"],r=>r.actionComposition="OR",r=>delete r.effects,r=>delete r.proposedPolicy,r=>delete r.completionConstraints,r=>r.completionConstraints.pop()]) {
   const copy=structuredClone(ROUTE_MANIFEST);mutation(copy.find(r=>r.handler===handler));assert.throws(()=>validateInventory(observed,copy));
  }
 }
});
test("R1 changed public handler or unsupported registration restores recorder",()=>{
 const get=express.application.get, use=express.application.use;
 try {
  express.application.get=function(path,...args){return path==="/api/health"&&args.length?get.call(this,path,()=>{}):get.call(this,path,...args);};
  assert.throws(()=>collectRoutes(),/Changed public handler/);
 } finally {express.application.get=get;}
 assert.equal(express.application.use,use);
 try {
  express.application.get=function(path,...args){return path==="/api/health"&&args.length?get.call(this,[path],...args):get.call(this,path,...args);};
  assert.throws(()=>collectRoutes());
 } finally {express.application.get=get;}
 assert.equal(express.application.use,use);
});
test("coverage validator rejects observable registration and effect drift",()=>{
 const actual=collectRoutes();
 for(const change of [
 a=>a.pop(), a=>a.push({...a[0]}),a=>a.push({...a[0],path:"/unexpected"}),
 a=>a[0].mount="/changed",a=>a[0].handler="other",a=>a[0].protected=false,
 a=>a[0].method="TRACE"
 ]) {const copy=structuredClone(actual);change(copy);assert.throws(()=>validateInventory(copy,ROUTE_MANIFEST));}
 for(const change of [
 a=>a.find(r=>r.handler==="getOrCreateInvoice").effects="read",
 a=>a.find(r=>r.retired).retired=false,
 a=>a.find(r=>r.protected).scope="",
 a=>a.find(r=>r.protected).allowed=true
 ]) {const copy=structuredClone(ROUTE_MANIFEST);change(copy);assert.throws(()=>validateInventory(actual,copy));}
});
test("HEAD inherits complete policy metadata and pure modules have no runtime imports",async()=>{
 for(const row of ROUTE_MANIFEST) {
  assert.equal(row.bindingStatus,"unattached");
  for(const action of row.actionRefs) assert(Object.hasOwn(CAPABILITIES,action));
  if(["createOrder","createTransaction","updateOrder","markAsCompleted"].includes(row.handler)) {
   assert.equal(row.branchSensitive,true);
   assert.deepEqual(row.actionRefs,["sale.process","payment.record","receipt.issue"]);
  }
 }
 for(const row of HEAD_MANIFEST) {
  const get=ROUTE_MANIFEST.find(r=>r.method==="GET"&&r.path===row.path);
  assert.deepEqual({...row,method:"GET",derivedFrom:undefined},{...get,derivedFrom:undefined});
 }
 for(const name of ["roles","capabilities","policy","fieldPolicy","routeManifest"]) {
  const source=await readFile(new URL("../auth/"+name+".js",import.meta.url),"utf8");
  assert.doesNotMatch(source,/process\.env|console\.|mongoose|from ["'](?:node:|express|axios)/);
 }
});

