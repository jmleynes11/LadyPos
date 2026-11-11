import User from "../models/User.js";
import { observeAccountCommits } from "./accountCommitBoundary.js";
import { hasUnknownCommitResult, indeterminateAccountMutation } from "./accountMutationOutcome.js";

// The owned session observes the actual commit boundary. Unknown commit wins
// over transient labels; driver commit retries remain distinct from callbacks.
export async function accountTransaction(work) {
  const session = await User.startSession();
  let observer, completed = false, primary;
  try {
    observer = observeAccountCommits(session);
    return await session.withTransaction(async () => {
      completed = false; primary = undefined;
      try {
        observer.beforeCallback();
        const value = await work(session);
        completed = true;
        return value;
      } catch (error) {
        primary = hasUnknownCommitResult(error) ? indeterminateAccountMutation(error) : error;
        throw primary;
      }
    }, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } catch (error) {
    if (primary) throw error === primary ? primary : indeterminateAccountMutation(primary);
    if (completed || hasUnknownCommitResult(error)) throw indeterminateAccountMutation(observer?.primaryFailure(error) || error);
    throw error;
  } finally {
    try { observer?.restore(); } catch { console.error("Account commit observer cleanup failed"); }
    try { await session.endSession(); } catch { console.error("Account mutation session cleanup failed"); }
  }
}
