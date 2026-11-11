// Additive B02 account commands. The historical B01/Phase15F inventory is retained.
export const ACCOUNT_ROUTE_MANIFEST = Object.freeze([
  ["GET", "/api/users/operations/:operationId", "reconcileAccountOperation", "self-or-admin"],
  ["GET", "/api/users/audit-events", "listAudit", "admin"],
  ["POST", "/api/users/grant-expirations", "recordExpirations", "admin"],
  ["POST", "/api/users/:id/role-assignments", "assignRole", "admin"],
  ["POST", "/api/users/:id/suspensions", "suspendAccount", "admin"],
  ["POST", "/api/users/:id/reactivations", "reactivateAccount", "admin"],
  ["POST", "/api/users/:id/role-reviews", "createReview", "admin"],
  ["GET", "/api/users/:id/role-reviews", "listReviews", "admin"],
  ["POST", "/api/users/:id/role-reviews/apply", "applyAccountReview", "admin"],
  ["POST", "/api/users/:id/conditional-grants", "createGrant", "admin"],
  ["GET", "/api/users/:id/conditional-grants", "listGrants", "admin"],
  ["POST", "/api/users/:id/conditional-grants/:grantId/revocations", "revokeGrant", "admin"],
].map(([method,path,handler,policy])=>Object.freeze({ method,path,handler,policy,protected:true,mount:"/api/users" })));
