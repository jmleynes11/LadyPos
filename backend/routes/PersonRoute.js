import { accountOperation } from "../middleware/accountOperation.js";
import { requireLegacyOperationalAccess } from "../middleware/roleAdmission.js";
import express from "express";
import {
  createPerson,
  getPeople,
  getPersonById,
  updatePerson,
  deletePerson,
  addDebt,
  addPayment,
  payAllDebts,
  updateDebt,
  deleteDebt,
} from "../controllers/PersonController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").post(requireLegacyOperationalAccess, accountOperation(createPerson)).get(requireLegacyOperationalAccess, accountOperation(getPeople));

router.route("/:id").get(requireLegacyOperationalAccess, accountOperation(getPersonById)).put(requireLegacyOperationalAccess, accountOperation(updatePerson)).delete(requireLegacyOperationalAccess, accountOperation(deletePerson));

router.post("/:id/debts", requireLegacyOperationalAccess, accountOperation(addDebt));
router.post("/:id/payments", requireLegacyOperationalAccess, accountOperation(addPayment));
router.post("/:id/pay-all", requireLegacyOperationalAccess, accountOperation(payAllDebts));

router.put("/:id/debts/:debtId", requireLegacyOperationalAccess, accountOperation(updateDebt));
router.delete("/:id/debts/:debtId", requireLegacyOperationalAccess, accountOperation(deleteDebt));

export default router;
