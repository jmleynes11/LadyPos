// Existing issuer contract: seven days, in seconds. Shared with verification.
export const ACCESS_TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

export function hasValidAccessTokenLifetime(claims, now = Math.floor(Date.now() / 1000)) {
  const issued = claims?.iat;
  const expires = claims?.exp;
  return Number.isSafeInteger(issued) && issued >= 0 &&
    Number.isSafeInteger(expires) && expires > issued &&
    issued <= now && expires > now &&
    expires - issued <= ACCESS_TOKEN_LIFETIME_SECONDS;
}
