import { readCategories, manageCategory } from "../services/categoryService.js";
import { Router } from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { guestBookstoreGuard } from "../middleware/guestBookstore.js";
import { replaceStoreMemberships } from "../services/accountManagement.js";
import { createBookstore } from "../services/bookstoreAdministration.js";
import { submitAuthenticatedOrder, claimOrder, quoteOrder, completeOrder, cancelOrder, requestReversal, validateReversal, applyReversal } from "../services/bookstoreOrders.js";
import { bookstoreContext, ownStudentOrders, ownStudentOrderDetails, pendingQueue, transactionHistory, readReceipt, inventoryHistory, reversalRequests, operationalAudit, reconcileBookstoreOperation } from "../services/bookstoreReads.js";
import { guestCatalog, issueGuestIntent, submitGuestOrder, trackGuestOrder } from "../services/guestOrders.js";
import { removeOrderFromQueue } from "../services/cashierQueue.js";

const route = (name, work) => {
  const handler = async (req, res) => {
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, data: await work(req) });
  };
  Object.defineProperty(handler, "name", { value: name });
  return handler;
};
export function createBookstoreRoutes(config = {}) {
  const router = Router(), guest = guestBookstoreGuard(config);
  const credential = req => req.get("X-Guest-Order-Credential");
  router.get("/guest/catalog", guest, route("guestCatalogRead", req => guestCatalog(req.publicStoreId)));
  router.post("/guest/intents", guest, route("guestIntentCreate", req => issueGuestIntent(req.publicStoreId)));
  router.post("/guest/orders", guest, route("guestOrderSubmit", req => submitGuestOrder(req.publicStoreId, credential(req), req.body)));
  router.get("/guest/orders/:id", guest, route("guestOrderTrack", req => trackGuestOrder(req.publicStoreId, req.params.id, credential(req))));
  router.use(protect);
  router.get("/categories", route("bookstoreCategoriesRead", req => readCategories(req.user, req.query.storeId)));
  router.post("/categories", route("bookstoreCategoryManage", req => manageCategory(req.user, req.body)));
  router.get("/context", route("bookstoreContextRead", req => bookstoreContext(req.user)));
  router.post("/stores", authorizeRoles("admin"), route("bookstoreCreate", req => createBookstore(req.user, req.body)));
  router.post("/accounts/:id/memberships", authorizeRoles("admin"), route("bookstoreMembershipReplace", req => replaceStoreMemberships(req.user, req.params.id, req.body)));
  router.post("/orders", route("bookstoreOrderSubmit", req => submitAuthenticatedOrder(req.user, req.body)));
  router.get("/orders/own", route("studentOrdersRead", req => ownStudentOrders(req.user, req.query.storeId)));
  router.get("/orders/own/:id", authorizeRoles("customer"), route("studentOrderDetailsRead", req => ownStudentOrderDetails(req.user, req.query.storeId, req.params.id)));
  router.get("/orders/queue", route("bookstoreQueueRead", req => pendingQueue(req.user, req.query.storeId, req.query.includeCancelled === "true")));
  router.post("/orders/:id/remove-from-queue", authorizeRoles("cashier"), route("cashierQueueRemove", req => removeOrderFromQueue(req.user, req.params.id, req.body)));
  router.post("/orders/:id/claim", route("bookstoreOrderClaim", req => claimOrder(req.user, req.params.id, req.body)));
  router.get("/orders/:id/quote", route("bookstoreOrderQuote", req => quoteOrder(req.user, req.params.id, req.query.storeId)));
  router.post("/orders/:id/complete", route("bookstoreOrderComplete", req => completeOrder(req.user, req.params.id, req.body)));
  router.post("/orders/:id/cancel", route("bookstoreOrderCancel", req => cancelOrder(req.user, req.params.id, req.body)));
  router.post("/orders/:id/reversals", route("bookstoreReversalRequest", req => requestReversal(req.user, req.params.id, req.body)));
  router.post("/reversals/:id/apply", route("bookstoreReversalApply", req => applyReversal(req.user, req.params.id, req.body)));
  router.post("/reversals/:id/validate", route("bookstoreReversalValidate", req => validateReversal(req.user, req.params.id, req.body)));
  router.get("/reversals", route("bookstoreReversalsRead", req => reversalRequests(req.user, req.query.storeId)));
  router.get("/transactions", route("bookstoreHistoryRead", req => transactionHistory(req.user, req.query.storeId)));
  router.get("/transactions/:id", route("bookstoreTransactionRead", req => transactionHistory(req.user, req.query.storeId, req.params.id)));
  router.get("/receipts/:id", route("bookstoreReceiptRead", req => readReceipt(req.user, req.query.storeId, req.params.id)));
  router.get("/movements", route("bookstoreMovementsRead", req => inventoryHistory(req.user, req.query.storeId)));
  router.get("/audit", route("bookstoreAuditRead", req => operationalAudit(req.user, req.query.storeId)));
  router.get("/operations/:id", route("bookstoreOperationRead", req => reconcileBookstoreOperation(req.user, req.query.storeId, req.params.id)));
  return router;
}
