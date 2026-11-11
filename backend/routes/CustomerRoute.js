import { accountOperation } from "../middleware/accountOperation.js";
import { requireLegacyOperationalAccess } from "../middleware/roleAdmission.js";
import express from "express";
import {
  createCustomer,
  deleteCustomer,
  getCustomerById,
  getCustomers,
  updateCustomer,
} from "../controllers/PersonController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.route("/").post(requireLegacyOperationalAccess, accountOperation(createCustomer)).get(requireLegacyOperationalAccess, accountOperation(getCustomers));
router.route("/:id").get(requireLegacyOperationalAccess, accountOperation(getCustomerById)).put(requireLegacyOperationalAccess, accountOperation(updateCustomer)).delete(requireLegacyOperationalAccess, accountOperation(deleteCustomer));

export default router;
