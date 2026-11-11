import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Product from "../models/Product.js";
import Customer from "../models/Person.js";
import Order from "../models/Order.js";
import Invoice from "../models/Invoice.js";
import DebtPayment from "../models/DebtPayment.js";
import Store from "../models/Store.js";
import { BookstoreAudit, BookstoreReceipt } from "../models/BookstoreControl.js";
import { prepareHistoricalMapping, applyHistoricalMapping } from "../services/bookstoreMapping.js";
import { recordReview, applyReview, replaceStoreMemberships, updateAccount } from "../services/accountManagement.js";
import { accountAdapter } from "./accountManagementAdapter.js";

process.env.JWT_SECRET = "synthetic-b03-mapping-rehearsal-key";
const id = () => new mongoose.Types.ObjectId();
const cloneValue = value => {
  if (value instanceof Date) return new Date(value);
  if (value?._bsontype) return mongoose.mongo.BSON.EJSON.deserialize(mongoose.mongo.BSON.EJSON.serialize(value, {relaxed:false}), {relaxed:false});
  if (Array.isArray(value)) return value.map(cloneValue);
  return value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,cloneValue(entry)])) : value;
};
async function fixture(t) {
  const storeId=id(), admin=id(), legacy=id(), uncertain=id(), customer=id(), product=id(), transaction=id(), invoice=id();
  const password=await bcrypt.hash("Synthetic-preserved-password!",4);
  const f=accountAdapter(t,[{_id:admin,identifier:"reviewer",password,role:"admin",confirmed:true,accountState:"active",tokenVersion:0,authorityVersion:0,storeIds:[storeId]},{_id:legacy,identifier:"reviewed-legacy",password,role:"user",confirmed:true,tokenVersion:0,authorityVersion:0},{_id:uncertain,identifier:"unreviewed",password,role:"user",confirmed:false,tokenVersion:0,authorityVersion:0}],{extraModels:[Store,Customer,Invoice,DebtPayment,BookstoreAudit,BookstoreReceipt],cloneValue});
  f.store.get(Store.modelName).set(String(storeId),{_id:storeId,name:"Synthetic mapping target"});
  const sources=[[Customer,customer,{name:"Synthetic historical customer"}],[Product,product,{name:"Historical book",sku:"REVIEWED",price:150,stock:7,isActive:true}],[Order,transaction,{customer,items:[{product,quantity:1,unitPrice:150,subtotal:150}],totalAmount:150,amountPaid:150,paymentStatus:"paid",orderStatus:"completed"}],[Invoice,invoice,{transaction,customer,invoiceNumber:"INV-2025-0001",status:"paid"}]];
  for(const[Model,key,fields]of sources)f.store.get(Model.modelName).set(String(key),{_id:key,owner:legacy,...fields});
  const entries=sources.map(([Model,key])=>({kind:Model===Order?"Transaction":Model===Customer?"Customer":Model.modelName,id:String(key),ownerId:String(legacy)}));
  const actor={id:String(admin),role:"admin",tokenVersion:0};
  const command=extra=>({operationId:randomUUID(),reason:"Reviewed synthetic attribution",...extra});
  return{...f,storeId,admin,legacy,uncertain,password,sources,entries,actor,command};
}

test("RB16 staged exact-ID dry-run, commit and recovery preserve hashes/confirmation/history/ownership and advance epochs",async t=>{
  const f=await fixture(t), backup=f.sources.map(([Model,key])=>cloneValue(f.store.get(Model.modelName).get(String(key))));
  const untouched=cloneValue(f.store.get("User").get(String(f.uncertain)));
  const plan=await prepareHistoricalMapping(f.actor,f.storeId,f.entries);
  assert.equal(plan.count,4);assert.equal(f.rows(BookstoreAudit).length,0);assert.equal(f.stats.commits,0);
  const body=f.command({...plan,reviewRef:"synthetic-explicit-owner-reviewed-IDs"});
  await applyHistoricalMapping(f.actor,body);await applyHistoricalMapping(f.actor,body);
  assert.equal(f.rows(BookstoreAudit).length,4);assert.equal(f.rows(BookstoreReceipt).length,1);
  for(let i=0;i<f.sources.length;i++){
    const[Model,key]=f.sources[i],after=cloneValue(f.store.get(Model.modelName).get(String(key)));
    assert.equal(String(after.storeId),String(f.storeId));delete after.storeId;assert.deepEqual(after,backup[i]);
    assert.equal(after.moneyUnit,undefined);assert.equal(after.processedBy,undefined);
  }
  const review=await recordReview(f.actor,String(f.legacy),f.command({expectedVersion:0,proposedRole:"cashier",status:"approved",evidenceRefs:["synthetic-explicit-legacy-account-review"]}));
  await applyReview(f.actor,String(f.legacy),f.command({reviewId:review.reviewId,expectedVersion:0}));
  await replaceStoreMemberships(f.actor,String(f.legacy),f.command({expectedVersion:1,storeIds:[String(f.storeId)]}));
  assert.equal(f.load(f.legacy).tokenVersion,2);assert.equal(f.load(f.legacy).authorityVersion,2);
  assert.equal(f.load(f.legacy).password,f.password);assert.equal(f.load(f.legacy).confirmed,true);
  await assert.rejects(replaceStoreMemberships(f.actor,String(f.legacy),f.command({expectedVersion:1,storeIds:[]})),e=>e.statusCode===409);
  // Recovery uses a new audited suspension, never rolls epochs/history back or
  // silently restores the legacy operational role.
  await updateAccount(f.actor,String(f.legacy),f.command({expectedVersion:2,accountState:"suspended"}));
  assert.equal(f.load(f.legacy).accountState,"suspended");assert.equal(f.load(f.legacy).tokenVersion,3);
  assert.deepEqual(f.store.get("User").get(String(f.uncertain)),untouched);
  await assert.rejects(updateAccount(f.actor,String(f.admin),f.command({accountState:"suspended",expectedVersion:0})),e=>[400,409].includes(e.statusCode));
  assert.equal(f.load(f.admin).role,"admin");assert.equal(f.load(f.admin).accountState,"active");
});
test("RB16 mapping stale plans, wrong owners, missing relations and collisions cannot partially commit",async t=>{
  const f=await fixture(t),plan=await prepareHistoricalMapping(f.actor,f.storeId,f.entries);
  const product=f.store.get(Product.modelName).values().next().value;
  product.stock++;
  await assert.rejects(applyHistoricalMapping(f.actor,f.command({...plan,reviewRef:"synthetic-reviewed"})),e=>e.statusCode===409);
  assert.equal(f.rows(BookstoreAudit).length,0);assert(f.sources.every(([Model,key])=>!Object.hasOwn(f.store.get(Model.modelName).get(String(key)),"storeId")));
  await assert.rejects(prepareHistoricalMapping(f.actor,f.storeId,f.entries.slice(1)),e=>e.statusCode===409);
  await assert.rejects(prepareHistoricalMapping(f.actor,f.storeId,[{...f.entries[0],ownerId:String(id())}]),e=>e.statusCode===409);
  f.store.get(Product.modelName).set(String(id()),{_id:id(),owner:f.admin,storeId:f.storeId,sku:product.sku});
  await assert.rejects(prepareHistoricalMapping(f.actor,f.storeId,f.entries),e=>e.statusCode===409);
  assert.equal(f.stats.commits,0);
});
test("RB16 required mapping audit failure rolls back every attribution and can recover with same identity",async t=>{
  const f=await fixture(t),plan=await prepareHistoricalMapping(f.actor,f.storeId,f.entries),body=f.command({...plan,reviewRef:"synthetic-reviewed"});
  const original=BookstoreAudit.collection.insertOne;
  const fault=t.mock.method(BookstoreAudit.collection,"insertOne",()=>{throw Error("Required mapping audit unavailable");});
  await assert.rejects(applyHistoricalMapping(f.actor,body));
  assert.equal(f.rows(BookstoreReceipt).length,0);assert(f.sources.every(([Model,key])=>!Object.hasOwn(f.store.get(Model.modelName).get(String(key)),"storeId")));
  fault.mock.restore(); assert.equal(BookstoreAudit.collection.insertOne,original);
  await applyHistoricalMapping(f.actor,body);assert.equal(f.rows(BookstoreAudit).length,4);
});

test("RB16 strict raw BSON digest detects adjacent unsafe Long and numeric type changes", async t => {
  const f=await fixture(t),product=f.store.get(Product.modelName).values().next().value;
  product.historicalNativeValue=mongoose.mongo.BSON.Long.fromString("9007199254740992");
  const plan=await prepareHistoricalMapping(f.actor,f.storeId,f.entries);
  product.historicalNativeValue=mongoose.mongo.BSON.Long.fromString("9007199254740993");
  await assert.rejects(applyHistoricalMapping(f.actor,f.command({...plan,reviewRef:"synthetic-reviewed"})),e=>e.statusCode===409);
  product.historicalNativeValue=new mongoose.mongo.BSON.Int32(1);
  const typed=await prepareHistoricalMapping(f.actor,f.storeId,f.entries);
  product.historicalNativeValue=new mongoose.mongo.BSON.Double(1);
  await assert.rejects(applyHistoricalMapping(f.actor,f.command({...typed,reviewRef:"synthetic-reviewed"})),e=>e.statusCode===409);
  assert.equal(f.stats.commits,0);
});
test("RB16 exact-count, duplicate identity/receipt, deleted owner and foreign linked records fail closed",async t=>{
  const f=await fixture(t),plan=await prepareHistoricalMapping(f.actor,f.storeId,f.entries);
  await assert.rejects(applyHistoricalMapping(f.actor,f.command({...plan,count:3,reviewRef:"synthetic-reviewed"})),e=>e.statusCode===400);
  await assert.rejects(prepareHistoricalMapping(f.actor,f.storeId,[f.entries[0],f.entries[0]]),e=>e.statusCode===400);
  const owner=f.store.get("User").get(String(f.legacy));f.store.get("User").delete(String(f.legacy));
  await assert.rejects(prepareHistoricalMapping(f.actor,f.storeId,f.entries),e=>e.statusCode===409);
  f.store.get("User").set(String(f.legacy),owner);
  const invoice=f.rows(Invoice)[0],collision=id();
  f.store.get(Invoice.modelName).set(String(collision),{...invoice,_id:collision,storeId:f.storeId});
  await assert.rejects(prepareHistoricalMapping(f.actor,f.storeId,f.entries),e=>e.statusCode===409);
  f.store.get(Invoice.modelName).delete(String(collision));
  const customer=f.store.get(Customer.modelName).values().next().value;customer.storeId=id();
  await assert.rejects(prepareHistoricalMapping(f.actor,f.storeId,f.entries.slice(1)),e=>e.statusCode===409);
  assert.equal(f.stats.commits,0);assert.equal(f.rows(BookstoreAudit).length,0);
});
