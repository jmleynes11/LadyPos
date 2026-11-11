import { safeErrorMessage } from "../utils/safeErrors.js";
import { AccountMutationIndeterminateError } from "../utils/accountMutationOutcome.js";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const candidate = err.statusCode || err.status || (res.statusCode >= 400 ? res.statusCode : 500);
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
  if (status >= 500) console.error(`Request failed with status ${status}`);
  res.status(status).json({
    success: false,
    message: safeErrorMessage(status, err.message || "Request failed"),
    data: null,
    ...(err instanceof AccountMutationIndeterminateError ? {
      code: "ACCOUNT_MUTATION_OUTCOME_UNKNOWN",
      operationOutcome: "indeterminate",
      retryable: false,
    } : {}),
  });
}
