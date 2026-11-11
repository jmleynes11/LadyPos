import { isLegacyOperationalRole } from "../auth/accountRoles.js";

// Temporary restrictive perimeter, separate from authentication. New business
// roles must not inherit the legacy protect-only handlers before later binding.
export function requireLegacyOperationalAccess(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (!isLegacyOperationalRole(req.user.role)) {
    return res.status(403).json({ message: "Operational access is not enabled for this role" });
  }
  // Approved local D2 cutover: legacy accounts retain owner-scoped reads,
  // not operational writes. Effectful receipt GET/HEAD is made read-only in
  // accountOperation/getOrCreateInvoice, rather than trusting HTTP method alone.
  if (req.user.role === "user" && !["GET", "HEAD"].includes(req.method)) {
    return res.status(403).json({ message: "Legacy account is read-only pending Administrator role review" });
  }
  if (req.user.role === "admin" && !["GET", "HEAD"].includes(req.method) && req.baseUrl !== "/api/products") {
    return res.status(403).json({ message: "Use the scoped bookstore operational command" });
  }
  return next();
}
