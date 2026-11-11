# Cashier Product Catalog direct checkout

Superseded by [the actual browser navigation fix and verification](CASHIER_DIRECT_CHECKOUT_FIX_VERIFICATION.md). This earlier report did not verify the running browser/backend combination and did not establish that the live checkout transition worked.

Implemented November 6, 2026 (Asia/Manila).

## Result and scope

The Cashier Product Catalog uses **Submit Order** to open **Review Order / Payment** directly. It reuses the existing server-created POS checkout draft, server quote, payment completion command and receipt component. Cashier drafts have server-assigned `origin: "pos"`, `directPayment: true`, and the originating cashier assignment. They do not reserve or deduct stock when submitted.

The queue now explicitly admits only pending guest/student orders and excludes direct-payment drafts, including older POS drafts without the direct-payment marker. Guest and student submission payloads, responses, assignment, payment and queue fulfillment remain unchanged. Administrator and Store Manager catalog controls, navigation and permissions remain unchanged.

Cashier review compares the returned server prices with the cart estimate. A price change, including individual price changes that leave the total unchanged, requires revised-total confirmation before payment controls are enabled. Quote refresh and rejected completion clear payment verification and total confirmation. A closed review can be resumed within the current workspace without creating another draft; further cashier catalog submission is blocked while that checkout remains active.

The existing backend rechecks active products, stock, current prices, signed quote and confirmed full total inside the completion transaction. Only Cash and GCash are accepted. GCash requires the cashier's explicit full-payment attestation and a nonblank verified payment reference. The UI instructs the cashier to verify the actual authorized GCash account; a screenshot is insufficient. No automatic GCash verification or funds transfer is claimed or added.

Existing operation receipts, transaction state checks, atomic stock updates, stock movement records, payment uniqueness and receipt issuance are reused. Retries of the same operation return the original result; another completion operation against a completed sale is rejected.

## Exact source and test files changed in this task

| File | Change |
| --- | --- |
| `backend/services/bookstoreReads.js` | Restrict queue reads to guest/student origins while retaining direct-payment exclusion and existing authorization/store scope. |
| `client/src/features/bookstore/BookstorePage.jsx` | Cashier Submit Order label, cart-estimate comparison, direct review state, same-checkout resumption, quote refresh and confirmation reset; reuse extracted payment review. |
| `client/src/features/bookstore/PaymentReview.jsx` | Extract existing shared payment review; add cashier-direct title and revised-total consent while preserving queue review controls. |
| `client/src/features/bookstore/directCheckout.js` | Compare displayed cart/quote prices with server prices; retain price-change notice across refreshes. |
| `backend/tests/bookstoreApi.test.js` | Verify direct cashier submission stays outside the queue while both guest and student orders remain present; exclude legacy POS drafts. |
| `backend/tests/bookstoreOrders.test.js` | Add direct-checkout tests for price reconfirmation, GCash attestation/reference, stock/deactivation rejection, backend role/identity isolation and repeat completion. |
| `client/tests/directCheckout.test.js` | Add payment form regressions and actual catalog-handler tests using deterministic hook state and API fakes. |

No dependency, route, database schema, guest kiosk, student catalog, Administrator catalog, or Store Manager management implementation files were changed by this task. The checkout creation and payment safeguards already present in `backend/services/bookstoreOrders.js` and the `directPayment` model field were reused. The repository contained extensive existing uncommitted work; it was preserved.

## Verification

| Command | Result |
| --- | --- |
| `cd backend; npm test` | **847 passed, 0 failed, 0 skipped.** Run with loopback HTTP access after the sandboxed baseline encountered `EACCES` on local test-server connections. |
| `cd client; npm test` | **48 passed, 0 failed, 0 skipped.** |
| `cd client; npm run build` | **Passed**, 684 modules transformed. Vite reports a minified JavaScript chunk above its 500 kB warning threshold. |
| `cd client; npx eslint src/features/bookstore/BookstorePage.jsx src/features/bookstore/PaymentReview.jsx src/features/bookstore/directCheckout.js tests/directCheckout.test.js` | **Passed**, no errors or warnings. |
| `cd client; npm run lint` | **Fails in unchanged files:** 13 errors and 12 warnings. Existing auth, legacy order/product/person components and shared hooks/utilities are outside this task. Exact locations are in the lint log. |
| `git diff --check -- client/src/features/bookstore/BookstorePage.jsx backend/services/bookstoreReads.js backend/tests/bookstoreOrders.test.js backend/tests/bookstoreApi.test.js` | **Passed**. |

## Acceptance coverage

| Requirement | Evidence |
| --- | --- |
| Cashier adds products and submits directly to review | Frontend handler tests add an item, inspect its submitted quantity, then verify the direct payment review without queue navigation. |
| Cashier orders excluded; guest/student orders queued | HTTP queue regression submits all three origins and verifies the queue contains exactly guest/student orders; older POS drafts are also excluded. |
| Cash and GCash completion | Backend direct-payment tests complete both methods and assert one payment, one receipt and one stock deduction; frontend handlers verify both receipt paths. |
| Actual GCash verification required | Backend rejects missing/false/nonboolean attestation and missing/blank/nonstring reference; frontend blocks completion until verified full payment and reference are supplied. |
| Changed prices require confirmation | Frontend tests cart-to-server changes, line-price changes with unchanged totals, refreshed prices and cleared consent; backend rejects stale quote/old total and accepts the revised confirmed quote. |
| Unavailable stock prevents sale | Backend rejects stock depletion and product deactivation after submission with no payment, receipt or stock movement. Existing last-item competition test has one winner. |
| Exactly one deduction/payment/receipt | Backend tests replay, a new completion operation after sale, transaction rollback on audit failure and competing cashiers. Frontend uncertain-response test blocks a second dispatch and retains reconciliation identity. |
| Backend authorization | Tests reject other cashiers' quote/claim/payment attempts, cross-store reads, forged origin/direct-payment/assignee fields, and unauthorized Administrator/Manager submissions. |
| Other account workflows preserved | Student frontend submission remains unpaid without quote/payment requests. Full suites cover guest private/idempotent ordering, student ownership, Administrator catalog pricing, Store Manager product/category management, navigation and bounded conditional permissions. |

Backend tests use the existing staged in-memory transaction adapter with real application routes, service logic, schemas and validation. They do not connect to a live MongoDB replica set. Frontend interaction tests execute the real page handlers with deterministic hook state and mocked API responses, plus rendered payment-form checks. No live GCash transaction or native-browser visual inspection was performed.

## Report and validation artifacts

This report is `docs/CASHIER_DIRECT_CHECKOUT_RESULTS.md`. Added validation files:

- `docs/cashier-direct-checkout-validation/backend-tests.txt`
- `docs/cashier-direct-checkout-validation/client-tests.txt`
- `docs/cashier-direct-checkout-validation/build.txt`
- `docs/cashier-direct-checkout-validation/lint.txt`
- `docs/cashier-direct-checkout-validation/changed-files-lint.txt`
- `docs/cashier-direct-checkout-validation/backend-baseline-sandbox.txt`
- `docs/cashier-direct-checkout-validation/client-baseline.txt`
