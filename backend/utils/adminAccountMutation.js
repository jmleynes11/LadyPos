import mongoose from "mongoose";
import User from "../models/User.js";
import { isTokenVersion } from "./tokenVersion.js";
import { canonicalAccountId } from "./accountIdentity.js";
import { hasUnknownCommitResult, indeterminateAccountMutation } from "./accountMutationOutcome.js";
import { observeAccountCommits } from "./accountCommitBoundary.js";
import { activeAccountFilter } from "../auth/accountState.js";

function denied() {
  return Object.assign(new Error("Not authorized; sign in again"), { statusCode: 401 });
}

// actor comes only from protect, never from a request body or JWT role claim.
export function adminAccountFilter(actor) {
  const actorId = canonicalAccountId(actor?.id);
  if (!actorId || !isTokenVersion(actor?.tokenVersion)) throw denied();
  if (actor.role !== "admin") {
    throw Object.assign(new Error("Forbidden: insufficient role"), { statusCode: 403 });
  }
  return {
    _id: new mongoose.Types.ObjectId(actorId), role: "admin", confirmed: true,
    $and: [activeAccountFilter("admin")],
    ...(actor.tokenVersion === 0
      ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] }
      : { tokenVersion: actor.tokenVersion }),
  };
}

export async function runAdminAccountMutation(actor, targetId, work) {
  const guard = adminAccountFilter(actor);
  const target = targetId === null ? null : canonicalAccountId(targetId);
  if (targetId !== null && !target) {
    throw Object.assign(new Error("Invalid account ID"), { statusCode: 400 });
  }
  if (target === guard._id.toHexString()) {
    // The caller must attach this condition to the target save itself. The User
    // save hook combines it with its expected-version condition in one write.
    try {
      return await work({ guard, session: undefined });
    } catch (error) {
      if (error.name === "DocumentNotFoundError") throw denied();
      throw error;
    }
  }

  const session = await User.startSession();
  let callbackCompleted = false;
  let callbackFailure;
  let commits;
  try {
    commits = observeAccountCommits(session);
    return await session.withTransaction(async () => {
      callbackCompleted = false;
      callbackFailure = undefined;
      try {
        // A driver may re-enter here after handling a commit error internally.
        // Deny unsafe replay before the actor fence or any target work runs.
        commits.beforeCallback();
        // A real write is necessary: a second read or a no-op $inc:0 would not
        // serialize revocation with a different target's mutation. __v already
        // exists in the User schema. Do not advance the actor's tokenVersion or
        // updatedAt merely because they administer another account.
        const locked = await User.updateOne(guard, { $inc: { __v: 1 } }, { session, timestamps: false });
        if (!locked?.acknowledged || locked.matchedCount !== 1 || locked.modifiedCount !== 1) throw denied();
        const result = await work({ session });
        callbackCompleted = true;
        return result;
      } catch (error) {
        // Unknown commit takes precedence even if the driver error also carries
        // TransientTransactionError. Do not replay an uncertain callback.
        callbackFailure = hasUnknownCommitResult(error) ? indeterminateAccountMutation(error) : error;
        throw callbackFailure;
      }
    }, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } catch (error) {
    if (callbackFailure) {
      if (error !== callbackFailure) {
        // A driver abort/finalization failure must not discard the primary
        // callback error or claim that rollback was confirmed.
        console.error("Account transaction finalization failed");
        throw indeterminateAccountMutation(callbackFailure);
      }
      throw callbackFailure;
    }
    if (callbackCompleted || hasUnknownCommitResult(error)) {
      throw indeterminateAccountMutation(commits ? commits.primaryFailure(error) : error);
    }
    throw error;
  } finally {
    try {
      commits?.restore();
    } catch {
      console.error("Account commit observer cleanup failed");
    }
    try {
      await session.endSession();
    } catch {
      // Cleanup cannot turn an acknowledged commit into a reported failure or
      // replace the primary failure. Never log the driver error or account data.
      console.error("Account mutation session cleanup failed");
    }
  }
}
