import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { AccountAudit, AccountGrant, AccountReview, AccountReceipt, AccountRealm } from "../models/AccountControl.js";

const clone = value => JSON.parse(JSON.stringify(value));
const equal = (a,b) => String(a) === String(b);
export function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$and") return value.every(item => matches(row,item));
    if (key === "$or") return value.some(item => matches(row,item));
    if (value && typeof value === "object" && !(value instanceof mongoose.Types.ObjectId) && !(value instanceof Date)) {
      if ("$exists" in value) return Object.hasOwn(row,key) === value.$exists;
      if ("$in" in value) return value.$in.some(item => equal(row[key],item));
      if ("$ne" in value) return !equal(row[key],value.$ne);
      if ("$lte" in value) return new Date(row[key]) <= value.$lte;
    }
    return value === null ? row[key] == null : equal(row[key],value);
  });
}

// Local staged-state/concurrency model, NOT native MongoDB proof. Real schema
// validation, User security hooks, query predicates and command code execute.
export function accountAdapter(t, accounts, { extraModels = [], cloneValue = clone } = {}) {
  const clone = cloneValue;
  const Models = [User,Product,Order,AccountAudit,AccountGrant,AccountReview,AccountReceipt,AccountRealm,...extraModels];
  const store = new Map(Models.map(Model => [Model.modelName,new Map()]));
  for (const row of accounts) store.get(User.modelName).set(String(row._id),clone(row));
  const stats = { callbacks:0, commits:0, effects:0 }, faults = {};
  let holder, release;
  const table = (Model,session) => (session?.staged || store).get(Model.modelName);
  function query(get) {
    let session, limit = Infinity, lean = false;
    const raw = doc => { if (!doc) return doc; if (doc.$locals.adapterRaw) return clone(doc.$locals.adapterRaw); const value = doc.toObject({virtuals:false}); for (const key of Object.keys(doc.$__.activePaths.states.default || {})) delete value[key]; return value; };
    const q = { populate(){return q;}, setOptions(){return q;}, lean(value=true){lean=value;return q;}, session(value){session=value;return q;},select(){return q;},sort(){return q;},skip(){return q;},limit(value){limit=value;return q;},then(ok,no){return Promise.resolve().then(()=>get(session,limit)).then(value=>lean?(Array.isArray(value)?value.map(raw):raw(value)):value).then(ok,no);} };
    return q;
  }
  const hydrate = (Model,row) => { const doc=Model.hydrate(clone(row)); doc.$locals.adapterRaw=clone(row); return doc; };
  for (const Model of Models) {
    t.mock.method(Model,"findById",(id,projection,options)=>query(session=>{
      const row=table(Model,options?.session||session).get(String(id)); return row?hydrate(Model,row):null;
    }));
    t.mock.method(Model,"findOne",(filter)=>query(session=>{
      const row=[...table(Model,session).values()].find(row=>matches(row,filter));return row?hydrate(Model,row):null;
    }));
    t.mock.method(Model,"find",filter=>query((session,limit)=>[...table(Model,session).values()].filter(row=>matches(row,filter||{})).slice(0,limit).map(row=>hydrate(Model,row))));
    t.mock.method(Model,"countDocuments",filter=>query(session=>[...table(Model,session).values()].filter(row=>matches(row,filter||{})).length));
    t.mock.method(Model.collection,"insertOne",async(doc,options)=>{
      if (Model===AccountAudit && faults.audit) throw new Error("Synthetic audit persistence failure");
      const rows=table(Model,options?.session), key=String(doc._id);
      if (Model===AccountReceipt && [...rows.values()].some(row=>row.operationId===doc.operationId)) throw new Error("Duplicate command");
      rows.set(key,clone(doc));stats.effects++;return {acknowledged:true,insertedId:doc._id};
    });
    t.mock.method(Model.collection,"updateOne",async(filter,update,options)=>{
      if (Model===User && faults.beforeWrite) await faults.beforeWrite(filter,update);
      const rows=table(Model,options?.session), row=[...rows.values()].find(row=>matches(row,filter));
      if (!row) return {acknowledged:true,matchedCount:0,modifiedCount:0};
      Object.assign(row,clone(update.$set||{}));
      for(const[key,n]of Object.entries(update.$inc||{}))row[key]=(row[key]||0)+n;
      for(const key of Object.keys(update.$unset||{}))delete row[key];
      stats.effects++;return{acknowledged:true,matchedCount:1,modifiedCount:1};
    });
    t.mock.method(Model.collection,"deleteOne",async(filter,options)=>{
      const rows=table(Model,options?.session), row=[...rows.values()].find(row=>matches(row,filter));
      if(row)rows.delete(String(row._id));return{acknowledged:true,deletedCount:row?1:0};
    });
  }
  t.mock.method(AccountRealm,"findOneAndUpdate",async(filter,update,options)=>{
    const session=options.session;
    if(holder && holder!==session)await release.promise;
    if(holder!==session){holder=session;release={};release.promise=new Promise(resolve=>{release.resolve=resolve;});}
    // Snapshot after the serialized realm lock, like retrying a write conflict.
    if(!session.staged)session.staged=new Map([...store].map(([name,rows])=>[name,new Map([...rows].map(([id,row])=>[id,clone(row)]))]));
    if(faults.afterRealm)await faults.afterRealm(session);
    return {_id:filter._id,revision:1};
  });
  class Session {
    inTransaction(){return true;}
    async withTransaction(work){
      try{
        stats.callbacks++;
        const value=await work();
        await this.commitTransaction();return value;
      }finally{
        if(holder===this){holder=undefined;release.resolve();}
      }
    }
    async commitTransaction(){
      if(faults.beforeCommit)throw faults.beforeCommit;
      for(const[name,rows]of this.staged||[])store.set(name,new Map([...rows].map(([id,row])=>[id,clone(row)])));
      stats.commits++;
      if(faults.afterCommit)throw faults.afterCommit;
    }
    async endSession(){if(faults.cleanup)throw new Error("Synthetic cleanup failure");}
  }
  t.mock.method(User,"startSession",async()=>new Session());
  t.mock.method(mongoose,"connect",()=>{throw new Error("Database forbidden");});
  t.mock.method(mongoose,"createConnection",()=>{throw new Error("Database forbidden");});
  t.mock.method(console,"error",()=>{});
  t.mock.method(console,"log",()=>{});
  t.after(()=>{if(mongoose.connection.readyState!==0)throw new Error("Unexpected database connection");});
  return {store,stats,faults,rows:Model=>[...store.get(Model.modelName).values()],load:id=>User.hydrate(clone(store.get(User.modelName).get(String(id))))};
}
