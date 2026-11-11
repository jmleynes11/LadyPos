// Missing account state is the only legacy value interpreted as zero.
// Do not coerce strings, null, fractions, negative values or overflowing numbers.
export function isTokenVersion(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function accountTokenVersion(value) {
  if (value === undefined) return 0;
  if (!isTokenVersion(value)) throw new Error("Invalid account security version");
  return value;
}

export function matchesTokenVersion(claim, stored) {
  // Claim-less legacy tokens require fresh login; no indefinite version-zero fallback.
  if (!isTokenVersion(claim)) return false;
  return claim === accountTokenVersion(stored);
}
