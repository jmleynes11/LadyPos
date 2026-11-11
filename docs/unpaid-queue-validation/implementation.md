# Unpaid order queue deletion

Delete now appears beside Claim order for unassigned unpaid orders and beside Review payment for assigned unpaid orders. Cancelled-order deletion remains supported. The dialog displays the exact order reference, the requested confirmation text, Cancel, and Confirm Delete. Requests are guarded against repeated confirmation. The queue refreshes after backend success; failure keeps the order visible and displays an error.

The previous implementation restricted both the button and backend eligibility to cancelled orders. Customer My Orders applied the shared archive marker only to cancelled orders. These restrictions caused unpaid orders to remain visible.

## Files changed in this task

- `client/src/features/bookstore/CashierOrderQueue.jsx`: unpaid Delete action, confirmation, request guard, success/error feedback.
- `client/src/features/bookstore/BookstorePage.jsx`: unpaid archive command option, queue explanation, deletion success message.
- `backend/services/cashierQueue.js`: permits pending or cancelled unpaid queue orders; rejects payments, ledger-recorded orders, paid/completed orders, POS checkouts, unauthorized roles and resources.
- `backend/services/bookstoreReads.js`: Customer My Orders filters pending and cancelled orders using the exact same persistent `order.queue_removed` marker as the Cashier queue.
- `backend/services/bookstoreOrders.js`: archived orders cannot be claimed, quoted for payment, or completed using a stale quote.
- `client/tests/cashierOrderQueue.test.js`: assigned/unassigned actions, confirmation, Cancel, duplicate requests, success/failure, unauthorized and completed rows.
- `client/tests/directCheckout.test.js`: pending and cancelled archive commands and queue refresh.
- `backend/tests/bookstoreOrders.test.js`: assigned/unassigned archival, record preservation, repeated commands and stale-payment rejection.
- `backend/tests/bookstoreApi.test.js`: persistent same-order filtering, fresh authentication, unaffected own/other-customer orders and preserved audit records.

## Persistence and safety

Reused the existing append-only archival marker in BookstoreAudit, keyed to the original order ID and store. No second deletion state or schema was introduced. The marker contains actor identity, occurrence timestamp, original status and visibility change. The original order, public reference, customer association, items, cancellation information, payment evidence and existing audit events remain intact. Archival leaves the underlying unpaid status unchanged and makes no payment, invoice or inventory changes.

Deletion and sale completion use the existing transaction/realm lock, so their writes serialize. A completed sale cannot be archived. If archival occurs first, payment completion rejects the archive marker, including for a previously issued quote. Existing cashier role, membership and resource permission checks remain enforced. Repeated deletion operations reuse command receipts and do not add duplicate archive events.

Customer My Orders reflects archival on its next fetch, including Refresh, full reload and subsequent sign-in. No cross-browser push notification mechanism was added.

## Validation

- Full backend suite: 911 passed, zero failed.
- Full frontend suite: 182 passed, zero failed.
- Final targeted checkout rerun: 41 passed, zero failed.
- Targeted ESLint on changed frontend source and test files: passed.
- Backend source syntax checks: passed.
- Production build: passed; existing bundle-size advisory remains.
- Repository-wide lint: 15 errors and 12 warnings in untouched files; detailed output is in `lint.txt`. Unrelated lint repairs were outside scope.
- Disposable in-memory browser verification: both unpaid action combinations shown; Cancel kept the order; confirmed assigned and unassigned deletion refreshed the queue; success message appeared; Customer sign-in and page reload hid both deleted references while preserving the other order.

No production data was used for browser verification. Guest Kiosk, Customer storefront/navigation, other-role interfaces, submission, payment and inventory business rules were not redesigned or changed.
