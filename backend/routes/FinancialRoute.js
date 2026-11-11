import { accountOperation } from "../middleware/accountOperation.js";
import { requireLegacyOperationalAccess } from "../middleware/roleAdmission.js";
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getFinanceSummary, getRevenueByRange, getSummary } from "../controllers/FinancialController.js";

const router = express.Router();

router.get("/summary", protect, requireLegacyOperationalAccess, accountOperation(getFinanceSummary));
router.get("/dashboard-summary", protect, requireLegacyOperationalAccess, accountOperation(getSummary));
router.get("/revenue", protect, requireLegacyOperationalAccess, accountOperation(getRevenueByRange));

export default router;
