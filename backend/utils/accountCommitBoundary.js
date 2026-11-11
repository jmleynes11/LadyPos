import { hasTransactionErrorLabel, hasUnknownCommitResult, indeterminateAccountMutation } from "./accountMutationOutcome.js";

// Observe this owned session's public commit method without changing its result,
// error, labels, receiver or arguments. The driver still owns commit retries.
export function observeAccountCommits(session) {
  const commit = session.commitTransaction;
  if (typeof commit !== "function") throw new Error("Account session does not support commit observation");
  const descriptor = Object.getOwnPropertyDescriptor(session, "commitTransaction");
  let failed = false;
  let failure;
  Object.defineProperty(session, "commitTransaction", {
    configurable: true, enumerable: descriptor?.enumerable ?? false, writable: true,
    value: async function (...args) {
      try {
        const result = await commit.apply(this, args);
        failed = false;
        failure = undefined;
        return result;
      } catch (error) {
        failed = true;
        failure = error;
        throw error;
      }
    },
  });
  return {
    beforeCallback() {
      if (failed) {
        // Only a transient-only commit failure permits a whole-transaction
        // retry under the driver's contract. Unknown wins over compound labels.
        if (hasUnknownCommitResult(failure) || !hasTransactionErrorLabel(failure, "TransientTransactionError")) {
          throw indeterminateAccountMutation(failure);
        }
        failed = false;
        failure = undefined;
      }
    },
    primaryFailure(fallback) {
      return failed ? failure : fallback;
    },
    restore() {
      if (descriptor) Object.defineProperty(session, "commitTransaction", descriptor);
      else delete session.commitTransaction;
    },
  };
}
