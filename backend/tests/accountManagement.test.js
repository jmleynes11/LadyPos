import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { AccountAudit, AccountGrant, AccountReview, AccountReceipt } from "../models/AccountControl.js";
import { accountAdapter } from "./accountManagementAdapter.js";
import { createAccount, updateAccount, recordReview, applyReview, grantPermission, revokePermission, resolveConditionalGrant, sweepExpiredGrants, deleteAccount } from "../services/accountManagement.js";
import { generateToken } from "../utils/generateToken.js";
import { protect } from "../middleware/authMiddleware.js";
import { createApp } from "../app.js";
import { collectRoutes, validateInventory } from "./routeInventoryAdapter.js";
import { ROUTE_MANIFEST } from "../auth/routeManifest.js";
import { ACCOUNT_ROUTE_MANIFEST } from "../auth/accountRouteManifest.js";
import { accountOperation } from "../middleware/accountOperation.js";
import { redactAuditText } from "../auth/auditText.js";

process.env.JWT_SECRET="b02-complete-synthetic-key";
const id=()=>new mongoose.Types.ObjectId().toHexString();
const command=extra=>({reason:"Synthetic authorized account action",operationId:randomUUID(),...extra});
async function fixture(t,{singleAdmin=false}={}){
  const password=await bcrypt.hash("synthetic-password",4);
  const rows=[
    {_id:id(),identifier:"admin-a",password,role:"admin",confirmed:true,accountState:"active",tokenVersion:0,authorityVersion:0},
    {_id:id(),identifier:"admin-b",password,role:singleAdmin?"cashier":"admin",confirmed:true,accountState:"active",tokenVersion:0,authorityVersion:0},
    {_id:id(),identifier:"legacy",password,role:"user",confirmed:true,tokenVersion:0},
    {_id:id(),identifier:"manager",password,role:"store_manager",confirmed:true,accountState:"active",tokenVersion:0,authorityVersion:0},
  ];
  const f=accountAdapter(t,rows);
  const actor=index=>({id:rows[index]._id,role:f.load(rows[index]._id).role,tokenVersion:f.load(rows[index]._id).tokenVersion});
  return{...f,ids:rows.map(row=>row._id),actor};
}
async function access(user,token){
  const req={headers:{authorization:`Bearer ${token}`}};
  const res={status(n){this.code=n;return this;},json(){}};
  let reached=false;await protect(req,res,error=>{if(error)throw error;reached=true;});
  return reached?200:res.code;
}
async function verifyAdmin(f){
  const review=await recordReview(f.actor(1),f.ids[0],command({proposedRole:"admin",expectedVersion:0,status:"approved",evidenceRefs:["owner-verified-synthetic-person"]}));
  await applyReview(f.actor(1),f.ids[0],command({reviewId:review.reviewId}));
}
async function grant(f,extra={}){
  return grantPermission(f.actor(0),f.ids[1],command({capability:"salesHistory.own",scope:{kind:"own-processor",resourceIds:[f.ids[1]]},approvalRef:"verified-synthetic-approval",effectiveAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),...extra}));
}

test("B02 creation is explicit, active/unconfirmed, hashed and audited atomically",async t=>{
  const f=await fixture(t);
  for(const role of ["admin","store_manager","cashier","customer"]){
    const body=command({identifier:`new-${role}`,password:"synthetic-password",role});
    const result=await createAccount(f.actor(0),body);
    const row=f.load(result.account._id);
    assert.equal(row.confirmed,false);assert.equal(row.accountState,"active");assert(await row.matchPassword("synthetic-password"));
    assert.equal(row.role,role);assert.equal(result.account.password,undefined);
    assert.equal((await createAccount(f.actor(0),body)).account._id,result.account._id);
  }
  assert.equal(f.rows(AccountAudit).length,4);assert.equal(f.rows(AccountReceipt).length,4);
});
test("B02 creation rejects malformed roles, privilege defaults and missing reason",async t=>{
  const f=await fixture(t);
  for(const role of [undefined,"user","Admin",null,{},["admin"],"unknown"]){await assert.rejects(createAccount(f.actor(0),command({identifier:"bad",password:"synthetic-password",role})),error=>error.statusCode===400);}
  await assert.rejects(createAccount(f.actor(0),command({identifier:"bad",password:"synthetic-password",role:"admin",confirmed:true})));
  await assert.rejects(createAccount(f.actor(3),command({identifier:"bad",password:"synthetic-password",role:"admin"})));
  await assert.rejects(updateAccount(f.actor(0),f.ids[1],{}));
  assert.equal(f.rows(User).length,4);
});
test("B02 legacy review is evidence, not authority; only approved current review applies",async t=>{
  const f=await fixture(t), old=f.load(f.ids[2]).password;
  await assert.rejects(updateAccount(f.actor(0),f.ids[2],command({role:"cashier"})));
  const review=await recordReview(f.actor(0),f.ids[2],command({proposedRole:"cashier",expectedVersion:0,status:"approved",evidenceRefs:["verified-duty-reference"]}));
  assert.equal(f.load(f.ids[2]).role,"user");
  const result=await applyReview(f.actor(0),f.ids[2],command({reviewId:review.reviewId}));
  assert.equal(result.account.role,"cashier");assert.equal(f.load(f.ids[2]).tokenVersion,1);assert.equal(f.load(f.ids[2]).password,old);
  await assert.rejects(applyReview(f.actor(0),f.ids[2],command({reviewId:review.reviewId})));
  assert.equal(f.rows(AccountReview)[0].status,"applied");
});
test("B02 rejected review preserves legacy access and correction retains evidence",async t=>{
  const f=await fixture(t);
  const first=await recordReview(f.actor(0),f.ids[2],command({proposedRole:"cashier",expectedVersion:0,status:"rejected",evidenceRefs:["insufficient-duty-evidence"]}));
  await recordReview(f.actor(0),f.ids[2],command({proposedRole:"customer",expectedVersion:0,status:"approved",supersedes:first.reviewId,evidenceRefs:["corrected-student-evidence"]}));
  assert.equal(f.load(f.ids[2]).role,"user");assert.equal(f.rows(AccountReview).length,2);assert.equal(f.rows(AccountReview)[0].status,"superseded");
});
test("B02 suspension and reactivation invalidate tokens without deleting history",async t=>{
  const f=await fixture(t), token=await generateToken(f.load(f.ids[3]));
  assert.equal(await access(f.load(f.ids[3]),token),200);
  await updateAccount(f.actor(0),f.ids[3],command({accountState:"suspended"}));
  assert.equal(await access(f.load(f.ids[3]),token),401);
  const suspendedToken=await generateToken(f.load(f.ids[3]));
  assert.equal(await access(f.load(f.ids[3]),suspendedToken),401);
  await updateAccount(f.actor(0),f.ids[3],command({accountState:"active"}));
  assert.equal(await access(f.load(f.ids[3]),suspendedToken),401);assert.equal(await access(f.load(f.ids[3]),await generateToken(f.load(f.ids[3]))),200);
  assert.equal(f.rows(User).length,4);assert.equal(f.load(f.ids[3]).tokenVersion,2);
});
test("B02 missing lifecycle state preserves admin/user only, not new business roles",async t=>{
  const f=await fixture(t);
  for(const index of [0,2,3]){delete f.store.get(User.modelName).get(f.ids[index]).accountState;const user=f.load(f.ids[index]);assert.equal(await access(user,await generateToken(user)),index===3?401:200);}
});
test("B02 last-administrator protection is serialized and self deletion has no side effects",async t=>{
  const f=await fixture(t,{singleAdmin:true});
  for(const body of [command({role:"cashier"}),command({confirmed:false}),command({accountState:"suspended"})])await assert.rejects(updateAccount(f.actor(0),f.ids[0],body),/last active Administrator/);
  const count=f.stats.callbacks;
  await assert.rejects(deleteAccount(f.actor(0),f.ids[0].toUpperCase(),command({})),/own account/);
  assert.equal(f.stats.callbacks,count);assert.equal(f.load(f.ids[0]).role,"admin");
});
test("B02 conditional grant requires independent verified admin and excludes self-grants",async t=>{
  const f=await fixture(t);
  await assert.rejects(grant(f),/verified Administrator/);
  await verifyAdmin(f);
  await assert.rejects(grantPermission(f.actor(0),f.ids[0],command({})),/Self-grants/);
  const result=await grant(f);assert(result.grantId);
  assert.equal(await resolveConditionalGrant(f.ids[1],result.grantId,"salesHistory.own",f.ids[1]),true);
});
test("B02 grants reject invalid capabilities, roles, scope and expiry without writes",async t=>{
  const f=await fixture(t);await verifyAdmin(f);
  for(const extra of [{capability:"account.assignRole"},{capability:"unknown"},{expiresAt:undefined},{expiresAt:"tomorrow"},{expiresAt:new Date(0).toISOString()},{scope:{}},{scope:{kind:"own-processor",resourceIds:[f.ids[0]]}}])await assert.rejects(grant(f,extra));
  await assert.rejects(grantPermission(f.actor(3),f.ids[1],command({capability:"salesHistory.own",effectiveAt:new Date().toISOString(),expiresAt:new Date(Date.now()+1000).toISOString()})));
  assert.equal(f.rows(AccountGrant).length,0);
});
test("B02 early revocation is audited, invalidates tokens and stays revoked after reactivation",async t=>{
  const f=await fixture(t);await verifyAdmin(f);const issued=await grant(f);
  const token=await generateToken(f.load(f.ids[1]));
  await revokePermission(f.actor(0),f.ids[1],issued.grantId,command({}));
  assert.equal(await resolveConditionalGrant(f.ids[1],issued.grantId,"salesHistory.own",f.ids[1]),false);
  assert.equal(await access(f.load(f.ids[1]),token),401);
  await updateAccount(f.actor(0),f.ids[1],command({accountState:"suspended"}));
  await updateAccount(f.actor(0),f.ids[1],command({accountState:"active"}));
  assert.equal(await resolveConditionalGrant(f.ids[1],issued.grantId,"salesHistory.own",f.ids[1]),false);
  assert(f.rows(AccountAudit).some(row=>row.action==="permission.revoked"));
});
test("B02 expiration denies independently of audit delivery and records one event",async t=>{
  const f=await fixture(t);await verifyAdmin(f);const issued=await grant(f);
  f.store.get(AccountGrant.modelName).get(issued.grantId).expiresAt=new Date(Date.now()-1000).toISOString();
  f.faults.audit=true;
  assert.equal(await resolveConditionalGrant(f.ids[1],issued.grantId,"salesHistory.own",f.ids[1]),false);
  assert.equal(f.rows(AccountAudit).filter(row=>row.action==="permission.expired").length,0);
  f.faults.audit=false;await sweepExpiredGrants();await sweepExpiredGrants();
  assert.equal(f.rows(AccountAudit).filter(row=>row.action==="permission.expired").length,1);
});
test("B02 grantor suspension invalidates issued grants and they cannot revive",async t=>{
  const f=await fixture(t);await verifyAdmin(f);const issued=await grant(f);
  await updateAccount(f.actor(1),f.ids[0],command({accountState:"suspended"}));
  assert.equal(await resolveConditionalGrant(f.ids[1],issued.grantId,"salesHistory.own",f.ids[1]),false);
  await updateAccount(f.actor(1),f.ids[0],command({accountState:"active"}));
  assert.equal(await resolveConditionalGrant(f.ids[1],issued.grantId,"salesHistory.own",f.ids[1]),false);
});
test("B02 required audit failure rolls back target, events, receipt and security version",async t=>{
  const f=await fixture(t);f.faults.audit=true;
  await assert.rejects(updateAccount(f.actor(0),f.ids[3],command({accountState:"suspended"})));
  assert.equal(f.load(f.ids[3]).accountState,"active");assert.equal(f.load(f.ids[3]).tokenVersion,0);assert.equal(f.rows(AccountReceipt).length,0);assert.equal(f.rows(AccountAudit).length,0);
});
test("B02 acknowledged cleanup failure preserves success; unknown commit never repeats effects",async t=>{
  const f=await fixture(t);f.faults.cleanup=true;
  await updateAccount(f.actor(0),f.ids[3],command({accountState:"suspended"}));
  f.faults.cleanup=false;f.faults.afterCommit=Object.assign(new Error("Synthetic lost commit acknowledgement"),{errorLabels:["UnknownTransactionCommitResult","TransientTransactionError"]});
  const count=f.stats.callbacks;
  await assert.rejects(updateAccount(f.actor(0),f.ids[3],command({accountState:"active"})),error=>error.name==="AccountMutationIndeterminateError");
  assert.equal(f.stats.callbacks,count+1);assert.equal(f.load(f.ids[3]).tokenVersion,2);
});
test("B02 audit is redacted, append-only and associated with actual actor and target",async t=>{
  const f=await fixture(t);
  await updateAccount(f.actor(0),f.ids[3],command({password:"synthetic-new-password"}));
  const events=f.rows(AccountAudit);assert.equal(events[0].actor.id,f.ids[0]);assert.equal(events[0].subjectAccountId,f.ids[3]);assert.equal(events[0].action,"account.password_reset");
  const serialized=JSON.stringify(events);assert(!serialized.includes("synthetic-new-password"));assert(!serialized.includes("$2b$"));assert(!serialized.includes(process.env.JWT_SECRET));
  await assert.rejects(AccountAudit.updateOne({},{$set:{reason:"rewrite"}}),/append-only/);
  await assert.rejects(AccountAudit.deleteMany({}),/append-only/);
});
test("B02 account operation identity rejects conflicting reuse",async t=>{
  const f=await fixture(t), body=command({accountState:"suspended"});
  await updateAccount(f.actor(0),f.ids[3],body);
  await assert.rejects(updateAccount(f.actor(0),f.ids[3],{...body,accountState:"active"}),/Operation ID conflict/);
});
test("B02 complete route inventory retains 59 historical routes plus 12 guarded commands",()=>{
  validateInventory(collectRoutes(),ROUTE_MANIFEST);
  const actual=collectRoutes({includeAccountRoutes:true});assert.equal(actual.filter(row=>row.protected).length,71);
  for(const expected of ACCOUNT_ROUTE_MANIFEST)assert.equal(actual.filter(row=>row.method===expected.method&&row.path===expected.path&&row.handler===expected.handler&&row.protected).length,1);
  assert.equal(ACCOUNT_ROUTE_MANIFEST.filter(row=>row.method==="GET").length,4);
});
test("B02 suspension-first operational fence rejects before domain mutation",async t=>{
  const f=await fixture(t), old=f.actor(3);
  await updateAccount(f.actor(0),f.ids[3],command({accountState:"suspended"}));
  let calls=0,error;
  const handler=accountOperation(async(req,res)=>{calls++;res.json({ok:true});});
  await handler({method:"POST",user:old,params:{},query:{},body:{}},{},value=>{error=value;});
  assert.equal(calls,0);assert.equal(error.statusCode,401);
});
test("B02 approved fence-first ordering finishes one atomic effect before suspension acknowledges",async t=>{
  const f=await fixture(t);let resume,reached;
  const ready=new Promise(resolve=>{reached=resolve;}), wait=new Promise(resolve=>{resume=resolve;});
  const handler=accountOperation(async(req,res)=>{
    reached();await wait;await Product.create([{owner:f.ids[3],name:"Synthetic",price:1,stock:1}],{session:req.accountSession});res.json({ok:true});
  });
  const response={status(){return this;},json(){}};
  const active=handler({method:"POST",user:f.actor(3),params:{},query:{},body:{}},response,error=>{throw error;});
  await ready;let acknowledged=false;
  const suspend=updateAccount(f.actor(0),f.ids[3],command({accountState:"suspended"})).then(()=>{acknowledged=true;});
  await new Promise(resolve=>setTimeout(resolve,10));assert.equal(acknowledged,false);
  resume();await active;await suspend;
  assert.equal(f.rows(Product).length,1);assert.equal(acknowledged,true);
});

test("B02 HTTP account routes deny public/non-admin escalation and require versioned command IDs",async t=>{
  const f=await fixture(t), server=createApp().listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const request=async(path,method,actor,body)=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{"Content-Type":"application/json",...(actor?{Authorization:`Bearer ${await generateToken(f.load(actor))}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return response.status;
  };
  for(const role of ["user","store_manager","cashier","customer"]){
    const record=f.store.get(User.modelName).get(f.ids[3]);record.role=role;
    for(const row of ACCOUNT_ROUTE_MANIFEST.filter(row=>row.policy==="admin")){
      const path=row.path.replace(":id",f.ids[2]).replace(":grantId",id());
      assert.equal(await request(path,row.method,f.ids[3],row.method==="POST"?command({expectedVersion:0}):undefined),403);
      if(row.method==="GET")assert.equal(await request(path,"HEAD",f.ids[3]),403);
    }
  }
  assert.equal(await request("/api/users/register","POST",null,command({role:"admin",identifier:"attacker",password:"synthetic-password"})),401);
  assert.equal(await request(`/api/users/${f.ids[2]}/suspensions`,"POST",f.ids[0],command({})),400);
  assert.equal(await request(`/api/users/${f.ids[2]}/suspensions`,"POST",f.ids[0],{reason:"Synthetic",expectedVersion:0}),400);
  assert.equal(await request("/api/users/audit-events","GET",f.ids[0]),200);
});

test("B02 grant-set replacement permits multiple fresh approvals at one epoch",async t=>{
  const f=await fixture(t);await verifyAdmin(f);
  const saleId=id();f.store.get((await import("../models/Order.js")).default.modelName).set(saleId,{_id:saleId,owner:f.ids[1]});
  const grants=["sale.process","payment.record","receipt.issue"].map(capability=>({capability,scope:{kind:"authorized-transaction",resourceIds:[saleId]},approvalRef:"explicit-fresh-approval",effectiveAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()}));
  const result=await grantPermission(f.actor(0),f.ids[1],command({grants}));
  assert.equal(result.grantIds.length,3);
  for(let i=0;i<3;i++)assert.equal(await resolveConditionalGrant(f.ids[1],result.grantIds[i],grants[i].capability,saleId),true);
  assert.equal(f.load(f.ids[1]).tokenVersion,1);
});

test("B02 independent review regression: redact stored metadata and reject invalid clock/assigned scope",async t=>{
  const f=await fixture(t);
  await recordReview(f.actor(0),f.ids[2],command({proposedRole:"cashier",expectedVersion:0,status:"approved",reason:process.env.JWT_SECRET,evidenceRefs:["Bearer synthetic-sensitive-token"]}));
  assert(!JSON.stringify(f.rows(AccountReview)).includes(process.env.JWT_SECRET));
  assert(!JSON.stringify(f.rows(AccountReview)).includes("synthetic-sensitive-token"));
  await verifyAdmin(f);const issued=await grant(f);
  assert.equal(await resolveConditionalGrant(f.ids[1],issued.grantId,"salesHistory.own",f.ids[1],new Date(NaN)),false);
  await assert.rejects(grant(f,{capability:"order.fulfill",scope:{kind:"assigned-order",resourceIds:[id()]}}),/Scope outside/);
  const event=AccountAudit.hydrate(f.rows(AccountAudit)[0]);
  await assert.rejects(event.deleteOne(),/append-only/);
  await assert.rejects(AccountAudit.findOneAndReplace({},{}),/append-only/);
  await assert.rejects(AccountAudit.bulkWrite([{deleteMany:{filter:{}}}]),/append-only/);
});

test("B02 grant expiry is rechecked after queueing and rolls back replacement effects",async t=>{
  const f=await fixture(t);await verifyAdmin(f);
  const expiresAt=new Date(Date.now()+100).toISOString();
  f.faults.afterRealm=async()=>{await new Promise(resolve=>setTimeout(resolve,Math.max(0,new Date(expiresAt).valueOf()-Date.now()+10)));};
  await assert.rejects(grant(f,{expiresAt}),/expired before mutation/);
  assert.equal(f.load(f.ids[1]).tokenVersion,0);assert.equal(f.rows(AccountGrant).length,0);
});

test("B02 duplicate rejection is409 while unknown commit labels preserve indeterminate outcomes",async t=>{
  const f=await fixture(t);
  const duplicate=new mongoose.mongo.MongoServerError({message:"Synthetic duplicate",code:11000});
  t.mock.method(User,"create",async()=>{throw duplicate;});
  await assert.rejects(createAccount(f.actor(0),command({identifier:"duplicate",password:"synthetic-password",role:"customer"})),error=>error.statusCode===409);
  duplicate.addErrorLabel("UnknownTransactionCommitResult");
  await assert.rejects(createAccount(f.actor(0),command({identifier:"duplicate",password:"synthetic-password",role:"customer"})),error=>error.name==="AccountMutationIndeterminateError");
});

test("B02 reserved expiry identities cannot collide with human commands",async t=>{
  const f=await fixture(t);
  await assert.rejects(updateAccount(f.actor(0),f.ids[3],command({accountState:"suspended",operationId:`expiry_${id()}`})),/Invalid operation ID/);
  assert.equal(f.stats.callbacks,0);
});

test("B02 profile audit uses field names without PII values, including compound changes",async t=>{
  const f=await fixture(t);
  await updateAccount(f.actor(0),f.ids[3],command({name:"Synthetic private name",confirmed:false}));
  const events=f.rows(AccountAudit);
  const profile=events.find(row=>row.action==="account.profile_changed");
  assert.deepEqual(profile.after.changedFields,["name"]);
  assert(events.some(row=>row.action==="account.confirmation_changed"));
  assert(!JSON.stringify(events).includes("Synthetic private name"));
  const event=new AccountAudit({schemaVersion:1,eventId:randomUUID(),operationId:randomUUID(),sequence:0,actor:{kind:"account"},subjectAccountId:f.ids[3],action:"account.profile_changed",occurredAt:new Date(),reason:"Synthetic",before:{},after:{},scope:{kind:"account-realm"},outcome:"applied"});
  await assert.rejects(event.validate());
});

test("B02 independent malformed-state probes fail closed without hydration fallback",async t=>{
  const f=await fixture(t);
  for(const state of [[],{},null,0,"invalid"]){
    f.store.get(User.modelName).get(f.ids[0]).accountState=state;
    const user=f.load(f.ids[0]);assert.deepEqual(user.accountState,state);
    assert.equal(await access(user,await generateToken(user)),401);
  }
  f.store.get(User.modelName).get(f.ids[0]).accountState="active";
  for(const confirmed of ["true",[true],{},null,1]){
    f.store.get(User.modelName).get(f.ids[0]).confirmed=confirmed;
    const user=f.load(f.ids[0]);assert.equal(await access(user,await generateToken(user)),401);
  }
  f.store.get(User.modelName).get(f.ids[0]).confirmed=true;
  await verifyAdmin(f);const issued=await grant(f);
  for(const state of [undefined,"malformed",{},[],0]){
    const row=f.store.get(AccountGrant.modelName).get(issued.grantId);
    if(state===undefined)delete row.revokedAt;else row.revokedAt=state;
    assert.equal(await resolveConditionalGrant(f.ids[1],issued.grantId,"salesHistory.own",f.ids[1]),false);
  }
});

test("B02 HTTP positive review/assignment, grant/revocation and suspension flows persist audit",async t=>{
  const f=await fixture(t);await verifyAdmin(f);
  const server=createApp().listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const token=await generateToken(f.load(f.ids[0]));
  const post=async(path,body)=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
    const value=await response.json();assert(response.status<300,JSON.stringify(value));return value;
  };
  const review=await post(`/api/users/${f.ids[2]}/role-reviews`,command({expectedVersion:0,proposedRole:"cashier",status:"approved",evidenceRefs:["verified-duty-reference"]}));
  await post(`/api/users/${f.ids[2]}/role-reviews/apply`,command({expectedVersion:0,reviewId:review.reviewId}));
  const beforeSuspend=await generateToken(f.load(f.ids[2]));
  await post(`/api/users/${f.ids[2]}/suspensions`,command({expectedVersion:1}));
  assert.equal(await access(f.load(f.ids[2]),beforeSuspend),401);
  await post(`/api/users/${f.ids[2]}/reactivations`,command({expectedVersion:2}));
  assert.equal(await access(f.load(f.ids[2]),beforeSuspend),401);
  const issued=await post(`/api/users/${f.ids[1]}/conditional-grants`,command({expectedVersion:0,capability:"salesHistory.own",scope:{kind:"own-processor",resourceIds:[f.ids[1]]},approvalRef:"verified-approval",effectiveAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()}));
  await post(`/api/users/${f.ids[1]}/conditional-grants/${issued.grantId}/revocations`,command({expectedVersion:1}));
  const created=await post("/api/users/register",command({role:"customer",identifier:"http-created",password:"synthetic-password"}));
  assert.equal(created.confirmed,false);
  assert.equal(created.securityVersion,0);
  await post(`/api/users/${created._id}/role-assignments`,command({expectedVersion:0,role:"cashier"}));
  const changed=await fetch(`http://127.0.0.1:${server.address().port}/api/users/${created._id}`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(command({expectedVersion:1,confirmed:true}))});
  assert.equal(changed.status,200);assert.equal((await changed.json()).securityVersion,2);
  const profile=await fetch(`http://127.0.0.1:${server.address().port}/api/users/profile`,{headers:{Authorization:`Bearer ${await generateToken(f.load(created._id))}`}});
  assert.equal(profile.status,200);assert.equal((await profile.json()).securityVersion,undefined);
  assert(f.rows(AccountAudit).some(row=>row.action==="account.suspended"));
  assert(f.rows(AccountAudit).some(row=>row.action==="permission.revoked"));
});

test("B02 final independent review: audit free text removes credential assignments, hashes and JWTs",async t=>{
  const f=await fixture(t);
  const hash=await bcrypt.hash("synthetic-inline-password",4);
  const jwt=await generateToken(f.load(f.ids[0]));
  const reason=`password=synthetic-inline-password secret='synthetic-inline-secret' ${hash} ${jwt}`;
  const safe=redactAuditText(reason);
  for(const value of ["synthetic-inline-password","synthetic-inline-secret",hash,jwt])assert(!safe.includes(value));
  await recordReview(f.actor(0),f.ids[2],command({proposedRole:"cashier",expectedVersion:0,status:"approved",reason,evidenceRefs:["password=synthetic-inline-password",hash,jwt]}));
  const serialized=JSON.stringify([...f.rows(AccountReview),...f.rows(AccountAudit)]);
  for(const value of ["synthetic-inline-password","synthetic-inline-secret",hash,jwt])assert(!serialized.includes(value));
});

test("B02 independent last-admin probe excludes malformed and unusable alternate administrators",async t=>{
  for(const invalid of [{accountState:["active"]},{confirmed:[true]},{confirmed:"true"},{tokenVersion:"0"},{authorityVersion:null}]){
    const f=await fixture(t);
    Object.assign(f.store.get(User.modelName).get(f.ids[1]),invalid);
    await assert.rejects(updateAccount(f.actor(0),f.ids[0],command({role:"cashier"})),/last active Administrator/);
    assert.equal(f.load(f.ids[0]).role,"admin");
  }
});

test("B02 demoted administrators cannot reconcile privileged results about another account",async t=>{
  const f=await fixture(t);
  const body=command({role:"customer",identifier:"private-target",password:"synthetic-password"});
  await createAccount(f.actor(0),body);
  await updateAccount(f.actor(1),f.ids[0],command({role:"cashier"}));
  const server=createApp().listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/users/operations/${body.operationId}`,{headers:{Authorization:`Bearer ${await generateToken(f.load(f.ids[0]))}`}});
  assert.equal(response.status,404);assert(!(await response.text()).includes("private-target"));
});

test("B02 simultaneous Administrator self-demotions leave one usable Administrator",async t=>{
  const f=await fixture(t), actors=[f.actor(0),f.actor(1)];
  const results=await Promise.allSettled(actors.map(actor=>updateAccount(actor,actor.id,command({role:"cashier"}))));
  assert.equal(results.filter(result=>result.status==="fulfilled").length,1);
  assert.equal(results.filter(result=>result.status==="rejected"&&result.reason.statusCode===409).length,1);
  assert.equal(f.rows(User).filter(row=>row.role==="admin"&&row.confirmed===true&&row.accountState==="active").length,1);
});
