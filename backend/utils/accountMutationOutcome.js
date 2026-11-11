import mongoose from "mongoose";

// This error deliberately carries no driver labels: an uncertain operation must
// not become a reason for withTransaction to replay the application callback.
export class AccountMutationIndeterminateError extends Error {
  constructor(cause) {
    super("Account change outcome is unknown", { cause });
    this.name = "AccountMutationIndeterminateError";
    this.statusCode = 500;
  }
}

export function hasTransactionErrorLabel(error, label) {
  return (typeof error?.hasErrorLabel === "function" && error.hasErrorLabel(label) === true) ||
    (Array.isArray(error?.errorLabels) && error.errorLabels.includes(label));
}

export function hasUnknownCommitResult(error) {
  return hasTransactionErrorLabel(error, "UnknownTransactionCommitResult");
}

export function indeterminateAccountMutation(error) {
  return error instanceof AccountMutationIndeterminateError ? error : new AccountMutationIndeterminateError(error);
}

// A single-document write may have committed even if its acknowledgement was
// lost. Never retry here or infer rollback from an arbitrary save exception.
export async function saveAccountMutation(user, options) {
  try {
    return await user.save(options);
  } catch (error) {
    if (!hasUnknownCommitResult(error) && (
      error instanceof mongoose.Error.ValidationError ||
      error instanceof mongoose.Error.CastError ||
      error instanceof mongoose.Error.DocumentNotFoundError ||
      error instanceof mongoose.Error.VersionError ||
      error instanceof mongoose.Error.ParallelSaveError ||
      (error instanceof mongoose.mongo.MongoServerError && error.code === 11000 &&
        !(error instanceof mongoose.mongo.MongoWriteConcernError) && !error.writeConcernError)
    )) throw error;
    throw indeterminateAccountMutation(error);
  }
}
