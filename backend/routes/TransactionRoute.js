import { accountOperation } from "../middleware/accountOperation.js";
import { requireLegacyOperationalAccess } from "../middleware/roleAdmission.js";
import { requireReversalAliasAccess } from "../middleware/bookstoreAdmission.js";
import { Router } from "express";
import {
  createTransaction,
  getTransactionById,
  getTransactions,
  markAsPaid,
  voidTransaction,
} from "../controllers/OrderController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.use(protect);
router.route("/").post(requireLegacyOperationalAccess, accountOperation(createTransaction)).get(requireLegacyOperationalAccess, accountOperation(getTransactions));
router.get("/:id", requireLegacyOperationalAccess, accountOperation(getTransactionById));
router.patch("/:id/pay", requireLegacyOperationalAccess, accountOperation(markAsPaid));
router.patch("/:id/void", requireReversalAliasAccess, voidTransaction);

export default router;
