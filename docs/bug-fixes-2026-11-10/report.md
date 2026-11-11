# UPHSD BookstorePOS bug-fix report — November 10, 2026

## 1. Bug 1 — Authentication

Root cause: AuthProvider always wrote user information to local storage, selected stored user/token independently, and left session credentials after a failed login. The API client already uses the JWT supplied by useApi; it does not select a token from storage.

Fix: Successful login clears both previous credential pairs, then writes matching user/jwt values to the selected persistent or session store. Restoration selects a complete pair from one store, prefers the current session over legacy persistent leftovers, removes conflicting credentials, and discards incomplete/malformed entries. Profile edits retain the chosen persistence. Failed login clears authentication from both stores. Logout still clears both stores while preserving existing account-bound reconciliation barriers. Backend authentication and account checks are unchanged.

Files: AuthContext.jsx and new authPersistence.test.js. The actual apiClient.js and useApi.js were inspected and exercised, without modification.

Regression results: 9/9 new provider/API tests pass: both replacement directions; failed login after session/persistent login; normal session/persistent persistence with profile edits; logout and retained operation barrier; incomplete/legacy storage pairs; matching API Authorization header. Controlled login responses and a controlled Axios adapter make no network requests. Tests execute the actual compiled provider with deterministic hook state and Storage API fakes; they do not launch a browser.

## 2. Bug 2 — Clothing and Returns

Root cause: Sizing depended exclusively on the category display name. Category rename erased sizeStocks. Order pricing and stock changes rejected sizes after a rename, and returns required the sold size to remain in current sizeStocks. Existing tests explicitly expected the destructive size deletion.

Fix: Existing sizeStocks identifies sized products independently of the category label, with Clothing retained as the legacy fallback. Product validation checks valid size keys, quantities and aggregate stock without a display-name restriction. Category and product edits preserve size inventory. Catalog changes reject removal of sizes referenced by pending orders and conversion of outstanding unsized orders/sales into incompatible sized stock. Unallocated category transitions fail before saving when safe preservation is unavailable.

Returns match the exact historical product/size/quantity before stock validation. A valid sold size removed from the current configuration is restored at zero and incremented by exactly the returned quantity. Other sizes remain unchanged. Stock movement records retain the correct product, transaction and size. Historical order items and invoice snapshots are not rewritten.

A read-only reversal preflight validates the request, original sale, receipt, historical returned lines and resulting inventory before the UI enables repayment confirmation. Apply repeats these checks inside the existing transaction. The same manager approval capabilities, original payment method/reference requirements and idempotency checks remain. A recording failure keeps the review open, reports the backend error and never claims success. No real cash or GCash transfer is issued.

Files: backend Product model/controller, clothing utility, category/catalog/order/size-inventory services, reversal route/manifest, and clothing/API/authentication-matrix tests; client size utilities/components, manager editor, catalog/kiosk/inventory views, return handlers and regression tests. Full paths are listed below.

Regression results: The 3 original clothing reproductions pass independently. All 18 clothing service tests pass in the full backend suite, including historical immutability, correct M versus S stock/movements, incompatible edit rollback, return preflight authorization, failed reversal rollback and duplicate-safe retry. The actual page-handler test confirms preflight gating, failure recovery and success only after backend acknowledgment. Expanded HTTP role/authentication coverage includes the new preflight endpoint.

## 3. Bug 3 — Checkout Recovery

Root cause: BookstoreReceipt already persisted the full checkout result, but reconciliation returned only outcome/operationId. The page discarded its marker on any successful reconciliation response without restoring checkout.

Fix: Reconciliation authenticates the current account, retains operation ownership and membership checks, checks current sale capability and original cashier assignment, and returns the authorized persisted direct-order result plus its order ID. It performs no writes and does not rebuild the order from a cart. Other operation acknowledgments retain their existing behavior.

The page persists the operation kind with its existing reconciliation identity, accepts older markers, and restores the original checkout ID, item/total snapshot and payment navigation before clearing the marker. Payment review obtains a fresh server quote. Unknown, missing, mismatched or malformed recovery results retain the marker and block replacement submission. A successful initial direct response also retains its marker until checkout restoration succeeds.

Files: bookstoreReads.js, BookstorePage.jsx, pendingOperation.js, new checkoutRecovery.test.js and expanded directCheckout.test.js.

Regression results: 4/4 backend checkout-recovery tests pass. They include a simulated lost commit acknowledgment after persistence, reconciliation with no additional writes/orders, same-operation replay, current repricing, authorized continuation of the same order, unauthorized cashier/token/membership/assignment denials, and normal direct/customer submissions. Frontend handler tests cover recovery across reload, completion of the recovered order, missing result, unresolved/offline outcome, wrong operation, invalid result and missing initial order ID. Existing guest/customer suites also pass.

## 4. Files Changed

25 source/test files were changed by this task. This list excludes unrelated changes already present in the working directory.

- [backend/auth/bookstoreRouteManifest.js](C:/Users/jmley/Desktop/LadyPos/backend/auth/bookstoreRouteManifest.js)
- [backend/controllers/ProductController.js](C:/Users/jmley/Desktop/LadyPos/backend/controllers/ProductController.js)
- [backend/models/Product.js](C:/Users/jmley/Desktop/LadyPos/backend/models/Product.js)
- [backend/routes/BookstoreRoute.js](C:/Users/jmley/Desktop/LadyPos/backend/routes/BookstoreRoute.js)
- [backend/services/bookstoreOrders.js](C:/Users/jmley/Desktop/LadyPos/backend/services/bookstoreOrders.js)
- [backend/services/bookstoreReads.js](C:/Users/jmley/Desktop/LadyPos/backend/services/bookstoreReads.js)
- [backend/services/catalogService.js](C:/Users/jmley/Desktop/LadyPos/backend/services/catalogService.js)
- [backend/services/categoryService.js](C:/Users/jmley/Desktop/LadyPos/backend/services/categoryService.js)
- [backend/services/sizeInventory.js](C:/Users/jmley/Desktop/LadyPos/backend/services/sizeInventory.js)
- [backend/utils/clothingSizes.js](C:/Users/jmley/Desktop/LadyPos/backend/utils/clothingSizes.js)
- [backend/tests/b03AuthenticationMatrix.test.js](C:/Users/jmley/Desktop/LadyPos/backend/tests/b03AuthenticationMatrix.test.js)
- [backend/tests/bookstoreApi.test.js](C:/Users/jmley/Desktop/LadyPos/backend/tests/bookstoreApi.test.js)
- [backend/tests/clothingSizes.test.js](C:/Users/jmley/Desktop/LadyPos/backend/tests/clothingSizes.test.js)
- [backend/tests/checkoutRecovery.test.js](C:/Users/jmley/Desktop/LadyPos/backend/tests/checkoutRecovery.test.js) — new
- [client/src/shared/hooks/AuthContext.jsx](C:/Users/jmley/Desktop/LadyPos/client/src/shared/hooks/AuthContext.jsx)
- [client/src/features/bookstore/BookstorePage.jsx](C:/Users/jmley/Desktop/LadyPos/client/src/features/bookstore/BookstorePage.jsx)
- [client/src/features/bookstore/InventoryOverview.jsx](C:/Users/jmley/Desktop/LadyPos/client/src/features/bookstore/InventoryOverview.jsx)
- [client/src/features/bookstore/pendingOperation.js](C:/Users/jmley/Desktop/LadyPos/client/src/features/bookstore/pendingOperation.js)
- [client/src/features/kiosk/KioskPage.jsx](C:/Users/jmley/Desktop/LadyPos/client/src/features/kiosk/KioskPage.jsx)
- [client/src/features/products/clothingSizes.js](C:/Users/jmley/Desktop/LadyPos/client/src/features/products/clothingSizes.js)
- [client/src/features/products/components/ClothingSizes.jsx](C:/Users/jmley/Desktop/LadyPos/client/src/features/products/components/ClothingSizes.jsx)
- [client/src/features/products/components/ManagerProductManagement.jsx](C:/Users/jmley/Desktop/LadyPos/client/src/features/products/components/ManagerProductManagement.jsx)
- [client/tests/authPersistence.test.js](C:/Users/jmley/Desktop/LadyPos/client/tests/authPersistence.test.js) — new
- [client/tests/clothingSizes.test.js](C:/Users/jmley/Desktop/LadyPos/client/tests/clothingSizes.test.js)
- [client/tests/directCheckout.test.js](C:/Users/jmley/Desktop/LadyPos/client/tests/directCheckout.test.js)

New report and validation evidence:

- [report.md](C:/Users/jmley/Desktop/LadyPos/docs/bug-fixes-2026-11-10/report.md)
- [backend-tests.log](C:/Users/jmley/Desktop/LadyPos/docs/bug-fixes-2026-11-10/backend-tests.log)
- [client-tests.log](C:/Users/jmley/Desktop/LadyPos/docs/bug-fixes-2026-11-10/client-tests.log)
- [client-build.log](C:/Users/jmley/Desktop/LadyPos/docs/bug-fixes-2026-11-10/client-build.log)
- [lint-before.log](C:/Users/jmley/Desktop/LadyPos/docs/bug-fixes-2026-11-10/lint-before.log)
- [lint-after.log](C:/Users/jmley/Desktop/LadyPos/docs/bug-fixes-2026-11-10/lint-after.log)
- [original-clothing-cases.log](C:/Users/jmley/Desktop/LadyPos/docs/bug-fixes-2026-11-10/original-clothing-cases.log)
- [targeted-regressions.log](C:/Users/jmley/Desktop/LadyPos/docs/bug-fixes-2026-11-10/targeted-regressions.log)

The production build regenerated ignored client/dist output. No dependency or environment files were changed by this task.

## 5. Database Changes

No stored fields, indexes, collections or migrations were added or removed. Existing Product schema validation was adjusted to allow valid sizeStocks under renamed categories; its field structure is unchanged. Existing order item sizes and operation receipt results provide the historical/recovery data. No production data or production database was used.

## 6. Testing Results

| Check | Current result |
|---|---:|
| Backend npm test | 909 passed, 0 failed |
| Frontend npm test | 161 passed, 0 failed |
| Original clothing reproduction groups | 3 passed, 0 failed |
| Targeted auth/checkout/page regressions | 48 passed, 0 failed |
| Client npm run build | Passed |
| Client npm run lint | 15 errors, 12 warnings; unchanged from captured pre-change baseline |

Backend tests used the established staged in-memory adapter and local HTTP test servers. Restricted loopback access required running the full backend suite with local-network permission. These tests establish service/route behavior, not native MongoDB transaction-engine behavior. Frontend tests use actual compiled components/handlers with deterministic hooks and controlled APIs/storage.

## 7. Remaining Issues

All three confirmed bug groups and their regression tests pass. Lint still fails on the same pre-existing findings: state-in-effect/immutability rules in existing account/order/people/product components, missing effect dependencies, unused variables, the existing AuthContext mixed-export refresh rule, and existing cashierQueue/gcashReviewFixture test lint. There are no newly introduced lint findings. The build retains its bundle-size warning.

Previously erased size allocations cannot be inferred from aggregate stock; inconsistent legacy data remains rejected for reviewed reconciliation instead of assigning returned stock to an arbitrary size. No historical data repair or destructive migration was performed.
