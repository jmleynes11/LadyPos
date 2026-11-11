import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import { accountTokenVersion, isTokenVersion, matchesTokenVersion } from "../utils/tokenVersion.js";
import { hasValidAccessTokenLifetime } from "../utils/tokenPolicy.js";
import { resolveAccountRole } from "../auth/accountRoles.js";
import { isAccountActive } from "../auth/accountState.js";
import { isStoredMemberships } from "../models/resourceAttribution.js";

export async function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token" });
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ message: "Not authorized" });
  }
  if (!hasValidAccessTokenLifetime(decoded) || !isTokenVersion(decoded?.tokenVersion)) return res.status(401).json({ message: "Not authorized" });
  const id = decoded?.id || decoded?._id;
  if (!mongoose.isValidObjectId(id)) return res.status(401).json({ message: "Not authorized" });
  try {
    const user = await User.findById(id).select("_id role confirmed tokenVersion accountState storeIds");
    if (!user || user.confirmed !== true) return res.status(401).json({ message: "Not authorized" });
    if (!matchesTokenVersion(decoded.tokenVersion, user.tokenVersion)) return res.status(401).json({ message: "Not authorized" });
    const accountRole = resolveAccountRole(user.role);
    if (!accountRole) return res.status(401).json({ message: "Not authorized" });
    if (!isAccountActive(user)) return res.status(401).json({ message: "Not authorized" });
    req.user = { id: String(user._id), role: user.role, tokenVersion: accountTokenVersion(user.tokenVersion) };
    if (isStoredMemberships(user.storeIds)) req.user.storeIds = [...user.storeIds];
    req.accountRole = accountRole;
    return next();
  } catch (error) {
    return next(error);
  }
}

// Restrict by role
export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
}
