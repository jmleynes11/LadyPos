import { accountOperation } from "../middleware/accountOperation.js";
import { requireLegacyOperationalAccess } from "../middleware/roleAdmission.js";
import express from "express";
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../controllers/ExpenseController.js";
import { protect } from "../middleware/authMiddleware.js";
const router = express.Router();
router.use(protect);

router.post("/", requireLegacyOperationalAccess, accountOperation(createExpense));
router.get("/", requireLegacyOperationalAccess, accountOperation(getExpenses));
router.put("/:id", requireLegacyOperationalAccess, accountOperation(updateExpense));
router.delete("/:id", requireLegacyOperationalAccess, accountOperation(deleteExpense));
export default router;
