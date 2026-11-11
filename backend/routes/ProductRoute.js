import { accountOperation } from "../middleware/accountOperation.js";
import { requireLegacyOperationalAccess } from "../middleware/roleAdmission.js";
import { requireInventoryAdjustmentAccess, requireProductReadAccess, requireProductCreationAccess, requireProductManagementAccess } from "../middleware/bookstoreAdmission.js";
import { Router } from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  setActiveProducts,
  adjustStock,
} from "../controllers/ProductController.js";

import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = Router();

router.use(protect);

router
  .route("/")
  .post(authorizeRoles("admin", "user", "store_manager"), requireProductCreationAccess, createProduct)
  .get(requireProductReadAccess, accountOperation(getProducts));

router
  .route("/:id")
  .get(requireProductReadAccess, accountOperation(getProductById))
  .put(authorizeRoles("admin", "user", "store_manager"), requireProductManagementAccess, updateProduct)
  .delete(authorizeRoles("admin", "user", "store_manager"), requireProductManagementAccess, deleteProduct);

router.patch("/:id/stock", requireInventoryAdjustmentAccess, adjustStock);
router.post("/set-active", protect, requireLegacyOperationalAccess, setActiveProducts);

export default router;
