// backend/routes/userRoutes.js
import { Router } from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { assignRole, suspendAccount, reactivateAccount, createReview, applyAccountReview, createGrant, revokeGrant, listReviews, listGrants, listAudit, reconcileAccountOperation, recordExpirations } from "../controllers/AccountLifecycleController.js";
import {
  createUser,
  loginUser,
  getProfile,
  updateProfile,
  updatePassword,
  getUsers,
  updateUser,
  deleteUser,
} from "../controllers/UserController.js";

const router = Router();

// ─── Public ──────────────────────────────────────────────────────────────────
router.post("/register", protect, authorizeRoles("admin"), createUser);
router.post("/login", loginUser);

// ─── Self — MUST be registered before /:id ───────────────────────────────────
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/password", protect, updatePassword);
router.get("/operations/:operationId", protect, reconcileAccountOperation);
router.get("/audit-events", protect, authorizeRoles("admin"), listAudit);
router.post("/grant-expirations", protect, authorizeRoles("admin"), recordExpirations);
router.post("/:id/role-assignments", protect, authorizeRoles("admin"), assignRole);
router.post("/:id/suspensions", protect, authorizeRoles("admin"), suspendAccount);
router.post("/:id/reactivations", protect, authorizeRoles("admin"), reactivateAccount);
router.post("/:id/role-reviews", protect, authorizeRoles("admin"), createReview);
router.get("/:id/role-reviews", protect, authorizeRoles("admin"), listReviews);
router.post("/:id/role-reviews/apply", protect, authorizeRoles("admin"), applyAccountReview);
router.post("/:id/conditional-grants", protect, authorizeRoles("admin"), createGrant);
router.get("/:id/conditional-grants", protect, authorizeRoles("admin"), listGrants);
router.post("/:id/conditional-grants/:grantId/revocations", protect, authorizeRoles("admin"), revokeGrant);

// ─── Admin ───────────────────────────────────────────────────────────────────
router.get("/", protect, authorizeRoles("admin"), getUsers);
router.put("/:id", protect, authorizeRoles("admin"), updateUser);
router.delete("/:id", protect, authorizeRoles("admin"), deleteUser);

export default router;
