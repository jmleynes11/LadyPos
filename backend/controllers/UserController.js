// backend/controllers/userController.js
import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { canonicalAccountId } from "../utils/accountIdentity.js";
import { resolveAccountRole } from "../auth/accountRoles.js";
import { isAccountActive } from "../auth/accountState.js";
import { createAccount, updateAccount, deleteAccount, publicAccount } from "../services/accountManagement.js";


// ─── Public ──────────────────────────────────────────────────────────────────

// POST /api/users/register — administrator-only staff provisioning.
export const createUser = asyncHandler(async (req, res) => {
  const result = await createAccount(req.user, req.body || {});
  res.status(201).json({ ...result.account, operationId: result.operationId });
});

// POST /api/users/login
export const loginUser = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body || {};

  if (typeof identifier !== "string" || !identifier || typeof password !== "string" || !password) {
    res.status(400);
    throw new Error("Identifier and password are required");
  }

  const user = await User.findOne({ identifier: identifier.toLowerCase() });
  const passwordCorrect = user
    ? await user.matchPassword(password)
    : false;

  if (!user || !passwordCorrect) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  if (!resolveAccountRole(user.role) || !isAccountActive(user)) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  if (user.confirmed !== true) {
    res.status(403);
    throw new Error("Account not confirmed");
  }

  res.json({
    _id: user._id,
    identifier: user.identifier,
    role: user.role,
    confirmed: user.confirmed,
    name: user.name,
    phone: user.phone,
    address: user.address,
    createdAt: user.createdAt,
    token: await generateToken(user),
  });
});

// ─── Self (authenticated) ─────────────────────────────────────────────────────

// GET /api/users/profile
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("_id identifier role confirmed accountState name phone address createdAt tokenVersion");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  res.json(publicAccount(user));
});

// PUT /api/users/profile
export const updateProfile = asyncHandler(async (req, res) => {
  const body = Object.fromEntries(["identifier", "name", "phone", "address", "reason", "operationId"].filter(field => req.body?.[field] !== undefined).map(field => [field, req.body[field]]));
  body.reason ??= "Self-service profile update";
  const result = await updateAccount(req.user, req.user.id, body, { self: true });
  res.json({ ...result.account, operationId: result.operationId });
});

// PUT /api/users/password
export const updatePassword = asyncHandler(async (req, res) => {
  const body = { password: req.body?.newPassword, currentPassword: req.body?.currentPassword, reason: req.body?.reason, operationId: req.body?.operationId };
  body.reason ??= "Self-service password change";
  if (typeof body.password !== "string" || !body.password || typeof body.currentPassword !== "string" || !body.currentPassword) { res.status(400); throw new Error("Current and new password are required"); }
  await updateAccount(req.user, req.user.id, body, { self: true, action: "account.password_changed" });
  res.json({ message: "Password updated" });
});

// ─── Admin ───────────────────────────────────────────────────────────────────

// GET /api/users
export const getUsers = asyncHandler(async (req, res) => {
  const { search = "", page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const query = search.trim()
    ? { identifier: { $regex: search.trim(), $options: "i" } }
    : {};

  const [users, total] = await Promise.all([
    User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    User.countDocuments(query),
  ]);

  res.json({
    users: users.map(user => ({ ...publicAccount(user), securityVersion: user.tokenVersion ?? 0 })),
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

// PUT /api/users/:id
export const updateUser = asyncHandler(async (req, res) => {
  if (!canonicalAccountId(req.params.id)) { res.status(400); throw new Error("Invalid account ID"); }
  if (["role", "confirmed", "password"].some(field => req.body?.[field] !== undefined) && !Number.isSafeInteger(req.body?.expectedVersion)) {
    res.status(400); throw new Error("Expected account version required");
  }
  if (req.body?.accountState !== undefined) { res.status(400); throw new Error("Use the lifecycle command"); }
  const body = Object.fromEntries(["identifier", "role", "confirmed", "name", "phone", "address", "password", "reason", "operationId", "expectedVersion", "reviewId"].filter(field => req.body?.[field] !== undefined).map(field => [field, req.body[field]]));
  const result = await updateAccount(req.user, req.params.id, body);
  res.json({ ...result.account, operationId: result.operationId });
});

// DELETE /api/users/:id
export const deleteUser = asyncHandler(async (req, res) => {
  const target = canonicalAccountId(req.params.id);
  if (!target) { res.status(400); throw new Error("Invalid account ID"); }
  if (target === canonicalAccountId(req.user?.id)) { res.status(400); throw new Error("Cannot delete your own account"); }
  res.json(await deleteAccount(req.user, target, req.body || {}));
});
