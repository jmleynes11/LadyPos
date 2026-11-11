import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import { hasUnknownCommitResult } from "./accountMutationOutcome.js";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const MAX_ATTEMPTS = 5;

export function generateOrderReference() {
  // 32 symbols divide the byte range evenly: eight unbiased symbols, 40 bits.
  const code = Array.from(randomBytes(8), byte => ALPHABET[byte & 31]).join("");
  return `UPH-${code.slice(0, 4)}-${code.slice(4)}`;
}

export async function unusedOrderReference(session) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const reference = generateOrderReference();
    if (!await Order.findOne({ bookstoreReference: reference }).select("_id").session(session)) return reference;
  }
  throw Object.assign(new Error("Order reference allocation unavailable"), { statusCode: 503 });
}

export async function withOrderReferenceRetry(work) {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); }
    catch (error) {
      // A duplicate insert aborts its transaction. Retry the entire submission,
      // retaining its operation ID and existing idempotency/verification checks.
      // Commit uncertainty and duplicates on any other key must never replay.
      const referenceCollision = error instanceof mongoose.mongo.MongoServerError &&
        !(error instanceof mongoose.mongo.MongoWriteConcernError) && !error.writeConcernError &&
        !hasUnknownCommitResult(error) && error.code === 11000 &&
        Object.keys(error.keyPattern || {}).length === 1 && error.keyPattern.bookstoreReference === 1;
      if (!referenceCollision || attempt >= MAX_ATTEMPTS - 1) throw error;
    }
  }
}
