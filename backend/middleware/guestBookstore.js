import { canonicalAccountId } from "../utils/accountIdentity.js";

// Explicit finite activation settings, no guessed production defaults. Per-IP
// in-process limiting needs deployment topology review before production use.
export function guestBookstoreGuard(config) {
  const buckets = new Map();
  return function requireGuestBookstore(req, res, next) {
    if (req.headers.authorization !== undefined) return res.status(401).json({ message: "Guest requests must not downgrade an authenticated credential" });
    const { publicStoreId, guestRateLimit, guestWindowMs } = config;
    if (!canonicalAccountId(publicStoreId) || !Number.isSafeInteger(guestRateLimit) || guestRateLimit <= 0 || !Number.isSafeInteger(guestWindowMs) || guestWindowMs <= 0) return res.status(503).json({ code: "GUEST_ORDERING_NOT_CONFIGURED", message: "Guest ordering activation settings required" });
    const now = Date.now(), key = req.ip;
    for (const [id, bucket] of buckets) if (now >= bucket.until) buckets.delete(id);
    if (!buckets.has(key) && buckets.size >= 4096) return res.status(429).json({ message: "Guest request capacity reached" });
    const bucket = buckets.get(key) || { count: 0, until: now + guestWindowMs };
    bucket.count++; buckets.set(key, bucket);
    if (bucket.count > guestRateLimit) {
      res.set("Retry-After", String(Math.ceil((bucket.until - now) / 1000)));
      return res.status(429).json({ message: "Guest request limit reached" });
    }
    req.publicStoreId = canonicalAccountId(publicStoreId);
    return next();
  };
}
