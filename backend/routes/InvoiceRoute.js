import { accountOperation } from "../middleware/accountOperation.js";
import { requireLegacyOperationalAccess } from "../middleware/roleAdmission.js";
import { requireReversalAliasAccess } from "../middleware/bookstoreAdmission.js";
import express from "express";
import {
  createInvoiceFromOrder,
  getOrCreateInvoice,
  getInvoices,
  getInvoiceById,
  markVoid,
} from "../controllers/InvoiceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/create/:orderId", requireLegacyOperationalAccess, accountOperation(createInvoiceFromOrder));
router.get("/", requireLegacyOperationalAccess, accountOperation(getInvoices));
router.get("/order/:orderId/ensure", requireLegacyOperationalAccess, accountOperation(getOrCreateInvoice));
router.get("/transaction/:transactionId/ensure", requireLegacyOperationalAccess, accountOperation(getOrCreateInvoice));
router.get("/:id", requireLegacyOperationalAccess, accountOperation(getInvoiceById));
router.patch("/:id/void", requireReversalAliasAccess, markVoid);

export default router;
