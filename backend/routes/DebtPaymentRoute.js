import { accountOperation } from "../middleware/accountOperation.js";
import { requireLegacyOperationalAccess } from "../middleware/roleAdmission.js";
import express from "express";
import { createDebtPayment, getDebtPayments } from "../controllers/DebtPaymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.route("/").post(requireLegacyOperationalAccess, accountOperation(createDebtPayment)).get(requireLegacyOperationalAccess, accountOperation(getDebtPayments));

export default router;
