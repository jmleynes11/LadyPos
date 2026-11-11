import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import { generateOrderReference, unusedOrderReference, withOrderReferenceRetry } from "../utils/orderReference.js";
import { indeterminateAccountMutation } from "../utils/accountMutationOutcome.js";

const collision = () => new mongoose.mongo.MongoServerError({ code: 11000, keyPattern: { bookstoreReference: 1 }, keyValue: { bookstoreReference: "UPH-AAAA-AAAA" } });

test("generated public references use eight random unambiguous symbols and the existing unique index", () => {
  const references = Array.from({ length: 1000 }, generateOrderReference);
  for (const reference of references) assert.match(reference, /^UPH-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(new Set(references).size, references.length);
  assert(Order.schema.indexes().some(([keys, options]) => keys.bookstoreReference === 1 && options.unique && options.sparse));
});

test("allocation checks existing references and regenerates occupied candidates in the same session", async t => {
  const candidates = [], session = {};
  t.mock.method(Order, "findOne", filter => ({ select(value) { assert.equal(value, "_id"); return this; }, session(value) { assert.equal(value, session); candidates.push(filter.bookstoreReference); return Promise.resolve(candidates.length < 3 ? { _id: "occupied" } : null); } }));
  const allocated = await unusedOrderReference(session);
  assert.equal(candidates.length, 3); assert.equal(allocated, candidates[2]);
  assert.equal(new Set(candidates).size, 3);
});

test("allocation fails safely after repeated occupied candidates", async t => {
  let checks = 0;
  t.mock.method(Order, "findOne", () => ({ select() { return this; }, session() { checks++; return Promise.resolve({ _id: "occupied" }); } }));
  await assert.rejects(unusedOrderReference({}), error => error.statusCode === 503);
  assert.equal(checks, 5);
});

test("reference unique-index collisions retry the entire submission and stop after a bounded number", async () => {
  let attempts = 0;
  const result = await withOrderReferenceRetry(async () => { if (++attempts === 1) throw collision(); return "saved"; });
  assert.equal(result, "saved"); assert.equal(attempts, 2);
  attempts = 0;
  await assert.rejects(withOrderReferenceRetry(async () => { attempts++; throw collision(); }), error => error.code === 11000);
  assert.equal(attempts, 5);
});

test("other duplicate keys, uncertain commits, write concern and authorization errors never replay", async () => {
  const unknown = collision(); unknown.addErrorLabel("UnknownTransactionCommitResult");
  const writeConcern = collision(); writeConcern.writeConcernError = { code: 64 };
  const otherKey = collision(); otherKey.keyPattern = { _id: 1 };
  const errors = [otherKey, unknown, writeConcern, indeterminateAccountMutation(collision()), Object.assign(new Error("Denied"), { statusCode: 403 }), new Error("Disconnected")];
  for (const error of errors) {
    let attempts = 0;
    await assert.rejects(withOrderReferenceRetry(async () => { attempts++; throw error; }), thrown => thrown === error);
    assert.equal(attempts, 1);
  }
});
