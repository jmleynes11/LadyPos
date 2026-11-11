import { accountOperation } from "../middleware/accountOperation.js";
import { requireLegacyOperationalAccess } from "../middleware/roleAdmission.js";
import express from "express";
import { getRevenueByRange, getSummary } from "../controllers/FinancialController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/summary", requireLegacyOperationalAccess, accountOperation(getSummary));
router.get("/revenue", requireLegacyOperationalAccess, accountOperation(getRevenueByRange));

export default router;
