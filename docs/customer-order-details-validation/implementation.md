# Customer My Orders details

My Orders retains Public Order Reference and Status, with a Customer-only Actions column containing View Order. The existing modal component provides focus trapping, Escape dismissal and Close. Loading/error states and aborted-request guards prevent late responses from reopening a dismissed view. Tables scroll within the modal on narrow screens; order information stacks on mobile.

The read-only authenticated endpoint `GET /api/bookstore/orders/own/:id?storeId=...` validates the Customer role, current account/session, store membership, order-status capability and exact `studentUser` ownership. Another customer's order returns 404. Public references cannot substitute for internal order IDs. Any existing `order.queue_removed` archive marker also returns 404. The response is an explicit DTO without account contact details, guest credentials or payment references.

Names, sizes, quantities, unit prices, subtotals and totals come from the saved order snapshot. The catalog supplies optional images only; unavailable products retain their saved order information and use the existing image fallback. Reads do not create orders or change payments, stock or audit records.

## Files modified

- `client/src/features/bookstore/CustomerOrders.jsx` (new): Customer table and details modal.
- `client/src/features/bookstore/customer-orders.css` (new): scoped responsive detail styling.
- `client/src/features/bookstore/BookstorePage.jsx`: mounts the component only for Customer My Orders.
- `backend/services/bookstoreReads.js`: owned order-details DTO, snapshot data, optional product images, archive denial.
- `backend/routes/BookstoreRoute.js`: Customer-only read route.
- `backend/auth/bookstoreRouteManifest.js`: registers the new protected endpoint.
- `client/tests/customerOrders.test.js` (new): display, retrieval, quantities/prices/sizes, Close, loading/errors, aborts and mismatched responses.
- `client/tests/directCheckout.test.js`: component wiring and preserved Customer submission/navigation assertions.
- `backend/tests/bookstoreApi.test.js`: ownership, historical snapshots, removed products, archive denial, read-only effects, route and role coverage.
- `backend/tests/b03AuthenticationMatrix.test.js`: updates complete-graph counts for the new endpoint and inherited HEAD; all invalid-session denials remain tested.

## Validation

- Full frontend suite: 186 passed, zero failed.
- Full backend suite: 920 passed, zero failed.
- Targeted ESLint on changed frontend source and tests: passed.
- Backend source syntax and diff whitespace checks: passed.
- Production build: passed; existing bundle-size advisory remains.
- Disposable in-memory browser: three visible orders each had View Order; selected reference and actual saved product, amount, date, branch and payment status appeared; Close dismissed the modal and preserved all three table actions.

No production data was used. No database schema, Guest Kiosk, Customer storefront/navigation, Cashier interface, Administrator/Store Manager interface, submission, payment or inventory behavior was changed.
