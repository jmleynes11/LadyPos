import { accountOperation } from "../middleware/accountOperation.js";
import { requireLegacyOperationalAccess } from "../middleware/roleAdmission.js";
import { requireReversalAliasAccess } from "../middleware/bookstoreAdmission.js";
import { Router } from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  markAsPaid,
  markAsCompleted,
  voidTransaction,
} from "../controllers/OrderController.js";

import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = Router();

// 🔒 All routes require authentication
router.use(protect);

// Create order (any logged-in user)
router.post("/", requireLegacyOperationalAccess, accountOperation(createOrder));

// Get orders
router.get("/", requireLegacyOperationalAccess, accountOperation(getOrders));

// Get single order
router.get("/:id", requireLegacyOperationalAccess, accountOperation(getOrderById));

// Update order (owner or admin)
router.put("/:id", requireLegacyOperationalAccess, accountOperation(updateOrder));

router.patch("/:id/pay", protect, requireLegacyOperationalAccess, accountOperation(markAsPaid));
router.patch("/:id/complete", protect, requireLegacyOperationalAccess, accountOperation(markAsCompleted));
router.patch("/:id/void", protect, requireReversalAliasAccess, voidTransaction);

// Delete order (owner or admin)
router.delete("/:id", requireReversalAliasAccess, deleteOrder);

export default router;
