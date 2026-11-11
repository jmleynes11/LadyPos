import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { canonicalAccountId } from "../utils/accountIdentity.js";

export const GUEST_TRACKING_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const credentialPattern = /^[A-Za-z0-9_-]{43}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const validDate = date => date instanceof Date && Number.isFinite(date.valueOf());
const digest = (orderId, credential) => createHash("sha256").update(`${orderId}:${credential}`).digest("hex");

// Issuance returns the secret once to the caller; only verification belongs in
// persistence. No logger, browser storage, staff JWT or public reference reuse.
// Order submission/tracking routes remain unbound pending remaining contracts.
export function issueGuestOrderCredential(orderId, now = new Date()) {
  const canonicalId = canonicalAccountId(orderId);
  if (!canonicalId || !validDate(now)) throw new Error("Invalid guest credential context");
  const expiresAt = new Date(now.valueOf() + GUEST_TRACKING_LIFETIME_MS);
  if (!validDate(expiresAt)) throw new Error("Invalid guest credential expiry");
  const credential = randomBytes(32).toString("base64url");
  return {
    credential,
    verification: { digest: digest(canonicalId, credential), issuedAt: new Date(now.valueOf()), expiresAt },
  };
}

// The order and verification record must be loaded server-side for the requested
// order. This proves possession only, never staff capability/payment authority.
export function verifyGuestOrderCredential(orderId, credential, verification, now = new Date()) {
  const canonicalId = canonicalAccountId(orderId);
  if (!canonicalId || typeof credential !== "string" || !credentialPattern.test(credential) || !validDate(now)) return false;
  if (!verification || typeof verification.digest !== "string" || !digestPattern.test(verification.digest) ||
      !validDate(verification.issuedAt) || !validDate(verification.expiresAt)) return false;
  const issued = verification.issuedAt.valueOf(), expiry = verification.expiresAt.valueOf();
  if (expiry - issued !== GUEST_TRACKING_LIFETIME_MS || now.valueOf() < issued || now.valueOf() >= expiry) return false;
  return timingSafeEqual(Buffer.from(digest(canonicalId, credential), "hex"), Buffer.from(verification.digest, "hex"));
}
