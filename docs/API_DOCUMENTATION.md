# API Documentation

This document describes all 99 explicitly registered HTTP method/path combinations in the current UPHSD Bookstore POS application, inspected on 9 November 2026. Each entry uses Endpoint, Method, Purpose, Request, and Response. Aliases are listed separately. Express-derived HEAD handling and CORS preflight OPTIONS are excluded from this domain-endpoint count. This is source-based documentation; no deployed service, account, or database record was accessed.

## Common Request and Response Rules

Protected routes require `Authorization: Bearer <token>`. The account must remain confirmed, active, and at the token’s current security version. Administrator status does not grant every store operation: membership and the relevant base capability or current bounded conditional grant are checked. `GET /api/bookstore/context` reports memberships and capability context.

Send JSON bodies with `Content-Type: application/json`. Colon-prefixed segments such as `:id` are path parameters. ObjectId parameters use 24-character hexadecimal identifiers. `operationId` is a command identity rather than a database ObjectId: 8–100 ASCII letters, digits, underscores, or hyphens. Account commands reserve the `expiry_` prefix. Unchanged request replay uses the same operationId; conflicting reuse returns 409. Some account commands generate one if omitted; provisioning and versioned lifecycle commands require one. Bookstore commands require one.

Bookstore command writes require a nonempty reason, except where an order route explicitly supplies a default as documented below. `expectedVersion` refers to the target securityVersion, not __v. Administrator account listings/results supply securityVersion where appropriate. Account security or grant changes can invalidate tokens and conditional grants.

Bookstore monetary values are safe integers in PHP centavos: `100 = PHP 1.00`. Server code calculates or checks prices and totals. Clothing sizes: XS, S, M, L, XL, 2XL, 3XL, 4XL. Historical currency units are not inferred from these bookstore rules.

Response descriptions are JSON shapes, not literal sample payloads: explanatory text and optional-field markers must not be copied as JSON. A data transfer object (DTO) is the selected set of fields returned to the client. An order DTO contains orderId, reference, orderStatus, total, moneyUnit, items, and assignedTo (an account ID or null). An item DTO includes productId, optional size, name, sku, quantity, unitPrice, subtotal. Successful bookstore handlers use `{ success: true, data: ... }` and `Cache-Control: no-store`. Older controllers often use `{ success: true, message, data, pagination? }`; user and expense endpoints use their specified shapes. Most bookstore POSTs return 200; account and product creation explicitly return 201.

Guest endpoints require activation settings and apply an in-process per-IP limit. They reject any Authorization header with 401. Submission/tracking use `X-Guest-Order-Credential`. Missing activation can return 503 and limits can return 429. Server configuration selects the public store; there is no client-selected storeId on guest routes.

## Current Legacy Route Availability

Retained people/customer/order/transaction/debt-payment/expense write routes are blocked before their handlers. The legacy guard permits owner-scoped GET/HEAD reads for stored roles admin and user, rejects user writes, and rejects admin operational writes outside /api/products with 403. Other business roles do not inherit these legacy routes. Product commands and reversal aliases use their additional scoped services. A registered route therefore does not imply its historical mutation remains available.

The three embedded-debt handlers are retired 410 tombstones, but current routed writes encounter the 403 guard first. Invoice ensure GET routes only read existing invoices and cannot issue a missing one.

## Endpoint Index

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/users/register` | Provision an active, unconfirmed account. |
| POST | `/api/users/login` | Authenticate an account and issue an access token. |
| GET | `/api/users/profile` | Retrieve the signed-in account profile. |
| PUT | `/api/users/profile` | Update the signed-in account profile. |
| PUT | `/api/users/password` | Change the signed-in account password. |
| GET | `/api/users/operations/:operationId` | Retrieve a saved account operation result. |
| GET | `/api/users/audit-events` | Retrieve account administration audit events. |
| POST | `/api/users/grant-expirations` | Record observed conditional-grant expirations. |
| POST | `/api/users/:id/role-assignments` | Assign or change an approved business role. |
| POST | `/api/users/:id/suspensions` | Suspend an account and advance its security context. |
| POST | `/api/users/:id/reactivations` | Reactivate a suspended account. |
| POST | `/api/users/:id/role-reviews` | Create an independent account-role review. |
| GET | `/api/users/:id/role-reviews` | List account-role reviews. |
| POST | `/api/users/:id/role-reviews/apply` | Apply an approved account-role review. |
| POST | `/api/users/:id/conditional-grants` | Issue bounded, time-limited conditional capability grants. |
| GET | `/api/users/:id/conditional-grants` | List an account’s conditional grants. |
| POST | `/api/users/:id/conditional-grants/:grantId/revocations` | Revoke an account’s active conditional grant. |
| GET | `/api/users` | Retrieve paginated user accounts. |
| PUT | `/api/users/:id` | Update permitted account profile and security fields. |
| DELETE | `/api/users/:id` | Delete another account with administrative audit. |
| GET | `/api/bookstore/guest/catalog` | Retrieve the public bookstore catalog. |
| POST | `/api/bookstore/guest/intents` | Issue private proof for a guest-order intent. |
| POST | `/api/bookstore/guest/orders` | Submit a guest order with private intent proof. |
| GET | `/api/bookstore/guest/orders/:id` | Retrieve the privately proved guest order status. |
| GET | `/api/bookstore/categories` | Retrieve store categories and product counts. |
| POST | `/api/bookstore/categories` | Create, rename, or delete a store category. |
| GET | `/api/bookstore/context` | Retrieve memberships, capabilities, and bookstore readiness. |
| POST | `/api/bookstore/stores` | Create a bookstore and its designated order customer. |
| POST | `/api/bookstore/accounts/:id/memberships` | Replace an account’s explicit store memberships. |
| POST | `/api/bookstore/orders` | Submit a student order or start an authorized POS order. |
| GET | `/api/bookstore/orders/own` | Retrieve the signed-in student’s own order statuses. |
| GET | `/api/bookstore/orders/queue` | Retrieve pending guest/student orders for fulfillment. |
| POST | `/api/bookstore/orders/:id/claim` | Assign an eligible pending order to the acting account. |
| GET | `/api/bookstore/orders/:id/quote` | Calculate current prices and issue an assigned-order payment quote. |
| POST | `/api/bookstore/orders/:id/complete` | Complete an assigned order with full payment and receipt issuance. |
| POST | `/api/bookstore/orders/:id/cancel` | Cancel an unpaid pending order. |
| POST | `/api/bookstore/orders/:id/reversals` | Request reversal of a fully paid completed sale. |
| POST | `/api/bookstore/reversals/:id/apply` | Apply whole-sale repayment and assessed inventory returns. |
| GET | `/api/bookstore/reversals` | Retrieve visible reversal requests. |
| GET | `/api/bookstore/transactions` | Retrieve completed bookstore sales and gross/refund/net totals. |
| GET | `/api/bookstore/transactions/:id` | Retrieve one completed bookstore sale and its summary. |
| GET | `/api/bookstore/receipts/:id` | Retrieve the stored bookstore receipt snapshot. |
| GET | `/api/bookstore/movements` | Retrieve store inventory movement history. |
| GET | `/api/bookstore/audit` | Retrieve bookstore operational audit events. |
| GET | `/api/bookstore/operations/:id` | Check whether the current account’s bookstore command was applied. |
| POST | `/api/products` | Create a bookstore product. |
| GET | `/api/products` | Retrieve products with role-dependent fields. |
| GET | `/api/products/:id` | Retrieve one accessible product. |
| PUT | `/api/products/:id` | Update product metadata, availability, or an authorized price. |
| DELETE | `/api/products/:id` | Archive a product by setting isActive to false. |
| PATCH | `/api/products/:id/stock` | Apply a recorded inventory quantity adjustment. |
| POST | `/api/products/set-active` | Replace the active-product set in a store. |
| POST | `/api/customers` | Retained legacy customer creation; currently blocked. |
| GET | `/api/customers` | Retrieve legacy customers and transaction summaries. |
| GET | `/api/customers/:id` | Retrieve a legacy customer, paginated sales, and recent payments. |
| PUT | `/api/customers/:id` | Retained legacy customer update; currently blocked. |
| DELETE | `/api/customers/:id` | Retained legacy customer soft deletion; currently blocked. |
| POST | `/api/people` | Retained legacy customer creation; currently blocked. |
| GET | `/api/people` | Retrieve legacy customers and transaction summaries. |
| GET | `/api/people/:id` | Retrieve a legacy customer, paginated sales, and recent payments. |
| PUT | `/api/people/:id` | Retained legacy customer update; currently blocked. |
| DELETE | `/api/people/:id` | Retained legacy customer soft deletion; currently blocked. |
| POST | `/api/people/:id/debts` | Retired embedded-debt creation. |
| POST | `/api/people/:id/payments` | Retained legacy customer debt-payment alias; currently blocked. |
| POST | `/api/people/:id/pay-all` | Retained legacy full-debt settlement; currently blocked. |
| PUT | `/api/people/:id/debts/:debtId` | Retired embedded-debt editing. |
| DELETE | `/api/people/:id/debts/:debtId` | Retired embedded-debt deletion. |
| POST | `/api/orders` | Retained legacy order or sale creation; currently blocked. |
| GET | `/api/orders` | Retrieve legacy owner-scoped orders or transactions. |
| GET | `/api/orders/:id` | Retrieve one legacy transaction, invoice, and payments. |
| PUT | `/api/orders/:id` | Retained legacy order edit/completion; currently blocked. |
| PATCH | `/api/orders/:id/pay` | Retained legacy order payment; currently blocked. |
| PATCH | `/api/orders/:id/complete` | Retained legacy order completion; currently blocked. |
| PATCH | `/api/orders/:id/void` | Apply scoped cancellation or reversal through a retained alias. |
| DELETE | `/api/orders/:id` | Apply scoped cancellation or reversal through the DELETE alias. |
| POST | `/api/transactions` | Retained legacy order or sale creation; currently blocked. |
| GET | `/api/transactions` | Retrieve legacy owner-scoped orders or transactions. |
| GET | `/api/transactions/:id` | Retrieve one legacy transaction, invoice, and payments. |
| PATCH | `/api/transactions/:id/pay` | Retained legacy order payment; currently blocked. |
| PATCH | `/api/transactions/:id/void` | Apply scoped cancellation or reversal through a retained alias. |
| POST | `/api/invoices/create/:orderId` | Retained legacy invoice-issuance alias; currently blocked. |
| GET | `/api/invoices` | Retrieve legacy owner-scoped invoices. |
| GET | `/api/invoices/order/:orderId/ensure` | Read an existing legacy invoice by transaction; issuance is disabled here. |
| GET | `/api/invoices/transaction/:transactionId/ensure` | Read an existing legacy invoice by transaction; issuance is disabled here. |
| GET | `/api/invoices/:id` | Retrieve one legacy owner-scoped invoice. |
| PATCH | `/api/invoices/:id/void` | Apply the sale reversal/cancellation workflow through an invoice alias. |
| POST | `/api/debt-payments` | Retained legacy debt collection; currently blocked. |
| GET | `/api/debt-payments` | Retrieve legacy owner-scoped debt payments. |
| GET | `/api/financials/summary` | Retrieve the legacy financial summary. |
| GET | `/api/financials/dashboard-summary` | Retrieve the legacy owner dashboard summary. |
| GET | `/api/financials/revenue` | Retrieve legacy revenue grouped by date period. |
| GET | `/api/dashboard/summary` | Retrieve the legacy owner dashboard summary. |
| GET | `/api/dashboard/revenue` | Retrieve legacy revenue grouped by date period. |
| POST | `/api/expenses` | Retained legacy expense creation; currently blocked. |
| GET | `/api/expenses` | Retrieve the current user’s legacy expenses. |
| PUT | `/api/expenses/:id` | Retained legacy expense editing; currently blocked. |
| DELETE | `/api/expenses/:id` | Retained legacy expense deletion; currently blocked. |
| GET | `/` | Retrieve public application status. |
| GET | `/api/health` | Check database connection readiness and ping. |

## User Accounts and Administration

### 1. Provision an active, unconfirmed account.

**Endpoint:** `/api/users/register`

**Method:** `POST`

**Purpose:** Provision an active, unconfirmed account.

**Request:** `Authorization: Bearer <token>`. Administrator required. JSON: identifier, password, role, operationId, reason; optional name, phone, address. role: admin, store_manager, cashier, or customer. confirmed, if supplied, must be false; accountState, if supplied, must be active.

**Response:** 201 Created; JSON public account fields, securityVersion, and operationId. Account confirmation is required before login.

### 2. Authenticate an account and issue an access token.

**Endpoint:** `/api/users/login`

**Method:** `POST`

**Purpose:** Authenticate an account and issue an access token.

**Request:** No authentication token required. JSON: identifier, password.

**Response:** 200 OK; JSON { _id, identifier, role, confirmed, name?, phone?, address?, createdAt, token }. Invalid credentials return 401; an otherwise valid unconfirmed account returns 403.

### 3. Retrieve the signed-in account profile.

**Endpoint:** `/api/users/profile`

**Method:** `GET`

**Purpose:** Retrieve the signed-in account profile.

**Request:** `Authorization: Bearer <token>`. No request body.

**Response:** 200 OK; JSON public account fields: _id, identifier, role, confirmed, accountState when present, optional name/phone/address, and createdAt.

### 4. Update the signed-in account profile.

**Endpoint:** `/api/users/profile`

**Method:** `PUT`

**Purpose:** Update the signed-in account profile.

**Request:** `Authorization: Bearer <token>`. JSON changes to identifier, name, phone, or address; optional operationId and reason. The controller supplies a default reason. Privilege fields are not forwarded.

**Response:** 200 OK; JSON updated public account fields and operationId. Changes that advance the security version require a fresh login.

### 5. Change the signed-in account password.

**Endpoint:** `/api/users/password`

**Method:** `PUT`

**Purpose:** Change the signed-in account password.

**Request:** `Authorization: Bearer <token>`. JSON: currentPassword, newPassword; optional operationId and reason. New password: at least 6 characters, at most 72 UTF-8 bytes.

**Response:** 200 OK; JSON { message: "Password updated" }. Prior authentication tokens become stale.

### 6. Retrieve a saved account operation result.

**Endpoint:** `/api/users/operations/:operationId`

**Method:** `GET`

**Purpose:** Retrieve a saved account operation result.

**Request:** `Authorization: Bearer <token>`. Path: operationId. Administrator can inspect administrative operations; other accounts must be both actor and target.

**Response:** 200 OK; JSON { outcome: "applied", operationId, result }. Unknown or inaccessible operation returns 404.

### 7. Retrieve account administration audit events.

**Endpoint:** `/api/users/audit-events`

**Method:** `GET`

**Purpose:** Retrieve account administration audit events.

**Request:** `Authorization: Bearer <token>`. Administrator required. Optional query: accountId.

**Response:** 200 OK; JSON { events: [...] }; up to 100 newest events, with redacted reasons and filtered before/after data.

### 8. Record observed conditional-grant expirations.

**Endpoint:** `/api/users/grant-expirations`

**Method:** `POST`

**Purpose:** Record observed conditional-grant expirations.

**Request:** `Authorization: Bearer <token>`. Administrator required. No required body.

**Response:** 200 OK; JSON { observed: count }.

### 9. Assign or change an approved business role.

**Endpoint:** `/api/users/:id/role-assignments`

**Method:** `POST`

**Purpose:** Assign or change an approved business role.

**Request:** `Authorization: Bearer <token>`. Administrator required. Path: id. JSON: operationId, reason, expectedVersion (current target securityVersion). Also role; reviewId is required for a legacy-role assignment needing an approved review.

**Response:** 200 OK; JSON { account, operationId }. account contains public administrative fields including securityVersion.

### 10. Suspend an account and advance its security context.

**Endpoint:** `/api/users/:id/suspensions`

**Method:** `POST`

**Purpose:** Suspend an account and advance its security context.

**Request:** `Authorization: Bearer <token>`. Administrator required. Path: id. JSON: operationId, reason, expectedVersion (current target securityVersion).

**Response:** 200 OK; JSON { account, operationId }; accountState becomes suspended. Last-active-Administrator protection can return 409.

### 11. Reactivate a suspended account.

**Endpoint:** `/api/users/:id/reactivations`

**Method:** `POST`

**Purpose:** Reactivate a suspended account.

**Request:** `Authorization: Bearer <token>`. Administrator required. Path: id. JSON: operationId, reason, expectedVersion (current target securityVersion).

**Response:** 200 OK; JSON { account, operationId }; accountState becomes active. Confirmation remains a separate condition.

### 12. Create an independent account-role review.

**Endpoint:** `/api/users/:id/role-reviews`

**Method:** `POST`

**Purpose:** Create an independent account-role review.

**Request:** `Authorization: Bearer <token>`. Administrator required. Path: id; reviewer must differ from target. JSON: operationId, reason, expectedVersion (current target securityVersion). Also proposedRole, status (in-review, approved, rejected), evidenceRefs (1–20 nonempty strings, each at most 256 characters); optional supersedes (prior review ObjectId).

**Response:** 200 OK; JSON { reviewId, status, revision, operationId }.

### 13. List account-role reviews.

**Endpoint:** `/api/users/:id/role-reviews`

**Method:** `GET`

**Purpose:** List account-role reviews.

**Request:** `Authorization: Bearer <token>`. Administrator required. Path: id.

**Response:** 200 OK; JSON { reviews: [...] }; up to 100 newest reviews with status, proposed role, revision, and redacted evidence/reason.

### 14. Apply an approved account-role review.

**Endpoint:** `/api/users/:id/role-reviews/apply`

**Method:** `POST`

**Purpose:** Apply an approved account-role review.

**Request:** `Authorization: Bearer <token>`. Administrator required. Path: id. JSON: operationId, reason, expectedVersion (current target securityVersion). Also reviewId. The review must match the target and current account security version/role.

**Response:** 200 OK; JSON { account, reviewId, operationId }. Stale or invalid approval returns 409.

### 15. Issue bounded, time-limited conditional capability grants.

**Endpoint:** `/api/users/:id/conditional-grants`

**Method:** `POST`

**Purpose:** Issue bounded, time-limited conditional capability grants.

**Request:** `Authorization: Bearer <token>`. Administrator required. Grantor needs a current independently applied Administrator review; self-grants are prohibited. Path: id. JSON: operationId, reason, expectedVersion (current target securityVersion). Also capability, scope: { kind, resourceIds }, effectiveAt, expiresAt, approvalRef; alternatively put those grant fields in grants[] (1–13 distinct capabilities). Timestamps use exact UTC form YYYY-MM-DDTHH:mm:ss.sssZ. Scope kind must match the capability, and referenced resources/recipient eligibility are validated.

**Response:** 200 OK; JSON { grantIds, operationId }; one grant also returns grantId and expiresAt. Recipient security context advances and dependent grants can be revoked.

### 16. List an account’s conditional grants.

**Endpoint:** `/api/users/:id/conditional-grants`

**Method:** `GET`

**Purpose:** List an account’s conditional grants.

**Request:** `Authorization: Bearer <token>`. Administrator required. Path: id.

**Response:** 200 OK; JSON { grants: [...] }; up to 100 newest grants including capability, scope, effective/expiry dates, and revokedAt.

### 17. Revoke an account’s active conditional grant.

**Endpoint:** `/api/users/:id/conditional-grants/:grantId/revocations`

**Method:** `POST`

**Purpose:** Revoke an account’s active conditional grant.

**Request:** `Authorization: Bearer <token>`. Administrator required. Path: id and grantId. JSON: operationId, reason, expectedVersion (current target securityVersion).

**Response:** 200 OK; JSON { grantId, revoked: true, operationId }. Recipient security context advances and dependent grants are invalidated.

### 18. Retrieve paginated user accounts.

**Endpoint:** `/api/users`

**Method:** `GET`

**Purpose:** Retrieve paginated user accounts.

**Request:** `Authorization: Bearer <token>`. Administrator required. Optional query: search (identifier), page (default 1), limit (default 10; maximum 100).

**Response:** 200 OK; JSON { users: [public account fields plus securityVersion], total, page, totalPages }. Password hashes are excluded.

### 19. Update permitted account profile and security fields.

**Endpoint:** `/api/users/:id`

**Method:** `PUT`

**Purpose:** Update permitted account profile and security fields.

**Request:** `Authorization: Bearer <token>`. Administrator required. Path: id. JSON: changes to identifier, name, phone, address, role, confirmed, or password; reason required; optional operationId and reviewId. expectedVersion is required for role/confirmed/password inputs. accountState is rejected here. Legacy-role assignment requires an approved review.

**Response:** 200 OK; JSON updated public account fields, securityVersion, and operationId. State/version and last-administrator conflicts can return 409.

### 20. Delete another account with administrative audit.

**Endpoint:** `/api/users/:id`

**Method:** `DELETE`

**Purpose:** Delete another account with administrative audit.

**Request:** `Authorization: Bearer <token>`. Administrator required. Path: id. JSON: reason; optional operationId and expectedVersion. Self-deletion is prohibited.

**Response:** 200 OK; JSON { message: "User deleted", operationId }. Self-deletion returns 400; last-active-Administrator protection can return 409.

## Bookstore Operations and Guest Ordering

### 21. Retrieve the public bookstore catalog.

**Endpoint:** `/api/bookstore/guest/catalog`

**Method:** `GET`

**Purpose:** Retrieve the public bookstore catalog.

**Request:** No Authorization header. Guest activation settings/rate limit apply. No body or client store selector; the server selects the public store.

**Response:** 200 OK; JSON { success: true, data: { name, products: [{ productId, name, sku, category, imageUrl?, sizes?, price, moneyUnit, availability }] } }.

### 22. Issue private proof for a guest-order intent.

**Endpoint:** `/api/bookstore/guest/intents`

**Method:** `POST`

**Purpose:** Issue private proof for a guest-order intent.

**Request:** No Authorization header. Guest activation settings/rate limit apply. No required body.

**Response:** 200 OK; JSON { success: true, data: { intentId, credential, expiresAt } }.

### 23. Submit a guest order with private intent proof.

**Endpoint:** `/api/bookstore/guest/orders`

**Method:** `POST`

**Purpose:** Submit a guest order with private intent proof.

**Request:** No Authorization header. Header: `X-Guest-Order-Credential: <credential>`. JSON: intentId, operationId, items: [{ product, quantity, size? }]. quantity must be a positive safe integer; Clothing requires size. Server selects the store and calculates prices.

**Response:** 200 OK; JSON { success: true, data: { orderId, reference, orderStatus: "pending", operationId } }. Order identifier equals intentId. Conflicting replay or a second distinct submission returns 409.

### 24. Retrieve the privately proved guest order status.

**Endpoint:** `/api/bookstore/guest/orders/:id`

**Method:** `GET`

**Purpose:** Retrieve the privately proved guest order status.

**Request:** No Authorization header. Header: `X-Guest-Order-Credential: <credential>`. Path: id (guest intent/order ObjectId).

**Response:** 200 OK; JSON { success: true, data: { reference, orderStatus } }. orderStatus can be reversed when a reversal exists.

### 25. Retrieve store categories and product counts.

**Endpoint:** `/api/bookstore/categories`

**Method:** `GET`

**Purpose:** Retrieve store categories and product counts.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Query: storeId (required). Requires category.manage (Store Manager base capability).

**Response:** 200 OK; JSON { success: true, data: { categories: [{ name, productCount }] } }.

### 26. Create, rename, or delete a store category.

**Endpoint:** `/api/bookstore/categories`

**Method:** `POST`

**Purpose:** Create, rename, or delete a store category.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Requires category.manage. JSON: storeId, operationId, reason. Also action and name. create needs name; rename also needs newName; delete accepts replacement and requires it if products use the category. Category names: trimmed, 1–100 characters, no control characters.

**Response:** 200 OK; JSON { success: true, data: { categories: [category names], operationId } }. Assigned products are updated in the command transaction.

### 27. Retrieve memberships, capabilities, and bookstore readiness.

**Endpoint:** `/api/bookstore/context`

**Method:** `GET`

**Purpose:** Retrieve memberships, capabilities, and bookstore readiness.

**Request:** `Authorization: Bearer <token>`. No required body or query.

**Response:** 200 OK; JSON { success: true, data: { accountId, role, legacyReadOnly, capabilities, conditionalResources, stores: [{ id, name, orderingReady }], canManageAccounts } }.

### 28. Create a bookstore and its designated order customer.

**Endpoint:** `/api/bookstore/stores`

**Method:** `POST`

**Purpose:** Create a bookstore and its designated order customer.

**Request:** `Authorization: Bearer <token>`. Administrator required. JSON: name, operationId, reason. Creation does not assign membership.

**Response:** 200 OK; JSON { success: true, data: { storeId, name, operationId } }.

### 29. Replace an account’s explicit store memberships.

**Endpoint:** `/api/bookstore/accounts/:id/memberships`

**Method:** `POST`

**Purpose:** Replace an account’s explicit store memberships.

**Request:** `Authorization: Bearer <token>`. Administrator required. Path: id. JSON: operationId, reason, expectedVersion, storeIds (distinct existing Store ObjectIds; [] removes all memberships).

**Response:** 200 OK; JSON { success: true, data: { account, storeIds, operationId } }. Advances target security version and invalidates dependent grants.

### 30. Submit a student order or start an authorized POS order.

**Endpoint:** `/api/bookstore/orders`

**Method:** `POST`

**Purpose:** Submit a student order or start an authorized POS order.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Student uses order.submit; POS actor requires sale.process. JSON: storeId, operationId, items: [{ product, quantity, size? }]. Clothing requires size; quantity is a positive safe integer. Prices/totals are server-derived. The service supplies reason internally; do not send it. Extra fields are rejected.

**Response:** 200 OK; JSON { success: true, data: order result with orderId, reference, orderStatus, operationId }. Student output is minimal. Staff output also includes total, moneyUnit, items, assignedTo when set; Cashier direct-POS output includes a payment quote.

### 31. Retrieve the signed-in student’s own order statuses.

**Endpoint:** `/api/bookstore/orders/own`

**Method:** `GET`

**Purpose:** Retrieve the signed-in student’s own order statuses.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Query: storeId (required). Requires order.status.own.

**Response:** 200 OK; JSON { success: true, data: { orders: [{ orderId, reference, orderStatus }] } }. Only the current studentUser’s orders are matched.

### 32. Retrieve pending guest/student orders for fulfillment.

**Endpoint:** `/api/bookstore/orders/queue`

**Method:** `GET`

**Purpose:** Retrieve pending guest/student orders for fulfillment.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Query: storeId (required). Requires order.oversee or order.fulfill as evaluated for the actor.

**Response:** 200 OK; JSON { success: true, data: { orders: [order DTOs] } }. Oldest first; direct-payment POS orders are excluded.

### 33. Assign an eligible pending order to the acting account.

**Endpoint:** `/api/bookstore/orders/:id/claim`

**Method:** `POST`

**Purpose:** Assign an eligible pending order to the acting account.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Requires order.fulfill. Path: id. JSON: storeId, operationId, reason. reason is optional here; a default is supplied.

**Response:** 200 OK; JSON { success: true, data: order DTO plus operationId }. Assignment to another account produces 409.

### 34. Calculate current prices and issue an assigned-order payment quote.

**Endpoint:** `/api/bookstore/orders/:id/quote`

**Method:** `GET`

**Purpose:** Calculate current prices and issue an assigned-order payment quote.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Requires sale.process. Path: id. Query: storeId (required). Actor must be assigned to the order.

**Response:** 200 OK; JSON { success: true, data: order DTO plus items, total, quote }. Cashier direct payment can also include directPayment, previousTotal, pricesChanged.

### 35. Complete an assigned order with full payment and receipt issuance.

**Endpoint:** `/api/bookstore/orders/:id/complete`

**Method:** `POST`

**Purpose:** Complete an assigned order with full payment and receipt issuance.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Requires sale.process, payment.record, receipt.issue. Path: id. JSON: storeId, operationId, reason. Also quote, confirmedTotal, paymentConfirmed: true, paymentMethod (cash/gcash), paymentReference for GCash. quote/confirmedTotal must match current server pricing. reason is optional here with a default.

**Response:** 200 OK; JSON { success: true, data: completed order DTO, receipt, operationId }. receipt includes invoiceId, invoiceNumber, issuedAt, paymentMethod, paymentReference, cashierId. Stock movements and payment are recorded atomically with completion. Quote/state conflict returns 409.

### 36. Cancel an unpaid pending order.

**Endpoint:** `/api/bookstore/orders/:id/cancel`

**Method:** `POST`

**Purpose:** Cancel an unpaid pending order.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Requires order.oversee. Path: id. JSON: storeId, operationId, reason.

**Response:** 200 OK; JSON { success: true, data: { orderId, orderStatus: "cancelled", operationId } }. Completed or payment-linked orders are ineligible.

### 37. Request reversal of a fully paid completed sale.

**Endpoint:** `/api/bookstore/orders/:id/reversals`

**Method:** `POST`

**Purpose:** Request reversal of a fully paid completed sale.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Requires reversal.request. Path: id. JSON: storeId, operationId, reason. Cashier may request only for a sale they processed.

**Response:** 200 OK; JSON { success: true, data: { requestId, orderId, status: "requested", operationId } }.

### 38. Apply whole-sale repayment and assessed inventory returns.

**Endpoint:** `/api/bookstore/reversals/:id/apply`

**Method:** `POST`

**Purpose:** Apply whole-sale repayment and assessed inventory returns.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Requires reversal.apply and reversal.approve. Path: id (request ObjectId). JSON: storeId, operationId, reason, repaymentConfirmed: true, repaymentMethod (original cash/gcash), returnsConfirmed: true, returned: [{ productId, quantity, size? }]; refundReference required for GCash. returned may be empty; listed quantities must be positive integers within sold quantities.

**Response:** 200 OK; JSON { success: true, data: { reversalId, orderId, amount, method, returned, operationId } }. amount is the entire sale total; only assessed listed units are restocked.

### 39. Retrieve visible reversal requests.

**Endpoint:** `/api/bookstore/reversals`

**Method:** `GET`

**Purpose:** Retrieve visible reversal requests.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Query: storeId (required). Requires reversal.request or reversal.apply as evaluated by the service.

**Response:** 200 OK; JSON { success: true, data: { requests: [{ requestId, orderId, reason, requestedBy, status }] } }. Cashiers see their own requests.

### 40. Retrieve completed bookstore sales and gross/refund/net totals.

**Endpoint:** `/api/bookstore/transactions`

**Method:** `GET`

**Purpose:** Retrieve completed bookstore sales and gross/refund/net totals.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Query: storeId (required). Cashier uses salesHistory.own and is limited to own processed sales; oversight requires salesHistory.all.

**Response:** 200 OK; JSON { success: true, data: { transactions: [...], summary: { gross, refunded, net, sales, moneyUnit } } }. Entries include order details, processor/time, invoiceId when found, payment details, reversal summaries.

### 41. Retrieve one completed bookstore sale and its summary.

**Endpoint:** `/api/bookstore/transactions/:id`

**Method:** `GET`

**Purpose:** Retrieve one completed bookstore sale and its summary.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Path: id. Query: storeId (required). Same own-sales versus oversight checks as the transaction list.

**Response:** 200 OK; JSON { success: true, data: { transactions: [matching sale], summary: { gross, refunded, net, sales, moneyUnit } } }. Detail still returns an array under transactions.

### 42. Retrieve the stored bookstore receipt snapshot.

**Endpoint:** `/api/bookstore/receipts/:id`

**Method:** `GET`

**Purpose:** Retrieve the stored bookstore receipt snapshot.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Path: id (Invoice ObjectId). Query: storeId (required). Linked sale must pass own-sales/oversight authorization.

**Response:** 200 OK; JSON { success: true, data: { receipt: { invoiceId, stored snapshot fields, reversed } } }.

### 43. Retrieve store inventory movement history.

**Endpoint:** `/api/bookstore/movements`

**Method:** `GET`

**Purpose:** Retrieve store inventory movement history.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Query: storeId (required). Requires inventory.history.read.

**Response:** 200 OK; JSON { success: true, data: { movements: [{ id, productId, actorId, delta, before, after, sizeChanges?, reason, source, occurredAt }] } }.

### 44. Retrieve bookstore operational audit events.

**Endpoint:** `/api/bookstore/audit`

**Method:** `GET`

**Purpose:** Retrieve bookstore operational audit events.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Administrator only; requires catalog.manage. Query: storeId (required).

**Response:** 200 OK; JSON { success: true, data: { events: [{ id, actorKind, actorId, operationId, action, targetKind, targetId, occurredAt, reason, before, after }] } }.

### 45. Check whether the current account’s bookstore command was applied.

**Endpoint:** `/api/bookstore/operations/:id`

**Method:** `GET`

**Purpose:** Check whether the current account’s bookstore command was applied.

**Request:** `Authorization: Bearer <token>`. Path: id (operationId). Query: storeId (required). Current membership is checked; only this account’s command receipt is matched.

**Response:** 200 OK; JSON { success: true, data: { outcome: "applied", operationId } }. This endpoint does not return the saved result.

## Products and Inventory

### 46. Create a bookstore product.

**Endpoint:** `/api/products`

**Method:** `POST`

**Purpose:** Create a bookstore product.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Administrator needs catalog.manage; Store Manager needs catalog.create; legacy user writes are rejected. JSON: storeId, operationId, reason, name, price; optional sku, category, isActive, sizeStocks, imageUrl. price: nonnegative integer centavos; sellingPrice/active aliases accepted. Clothing needs valid sizeStocks and inventory.adjust for quantity changes. imageUrl: validated PNG data URL, decoded ≤512 KiB, dimensions ≤1024×1024. stock/costPrice inputs are rejected.

**Response:** 201 Created; JSON { success: true, message: "Product created", data: { productId, name, sku, price, category, isActive, stock, sizeStocks when applicable, moneyUnit, operationId } }. Non-clothing stock starts at zero.

### 47. Retrieve products with role-dependent fields.

**Endpoint:** `/api/products`

**Method:** `GET`

**Purpose:** Retrieve products with role-dependent fields.

**Request:** `Authorization: Bearer <token>`. Query storeId for mapped bookstore reads; optional search, category, isActive, sortBy (name/stock, otherwise newest), page (default 1), limit (default 20). Administrator without storeId reads owned unattributed products; legacy user reads owned products. Other business-role reads require store membership. Cashier/customer results are restricted to active PHP-centavos products.

**Response:** 200 OK; JSON { success: true, message, data: [product DTOs], pagination: { page, limit, total, pages } }. Management output includes stock/isActive; Cashier/Customer output omits costPrice/owner and reports availability. Legacy user retains owner-read output.

### 48. Retrieve one accessible product.

**Endpoint:** `/api/products/:id`

**Method:** `GET`

**Purpose:** Retrieve one accessible product.

**Request:** `Authorization: Bearer <token>`. Path: id. Query: storeId for mapped reads. Product-list role and field rules apply.

**Response:** 200 OK; JSON { success: true, message, data: product DTO }. Missing or inaccessible record returns 404 after admission.

### 49. Update product metadata, availability, or an authorized price.

**Endpoint:** `/api/products/:id`

**Method:** `PUT`

**Purpose:** Update product metadata, availability, or an authorized price.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Path: id. JSON: storeId, operationId, reason, plus changed name, sku, category, isActive/active, price/sellingPrice, or sizeStocks. Administrator required for price edits; Store Manager cannot change price. Size quantity changes require inventory.adjust. imageUrl, stock, costPrice are rejected.

**Response:** 200 OK; JSON { success: true, message, data: { productId, name, sku, price, category, isActive, moneyUnit, operationId, and clothing stock/size details when applicable } }.

### 50. Archive a product by setting isActive to false.

**Endpoint:** `/api/products/:id`

**Method:** `DELETE`

**Purpose:** Archive a product by setting isActive to false.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Path: id. JSON: storeId, operationId, reason. Requires Administrator catalog.manage or Store Manager product.manage. Product record is retained.

**Response:** 200 OK; JSON { success: true, message, data: updated product command result including productId, isActive: false, operationId }.

### 51. Apply a recorded inventory quantity adjustment.

**Endpoint:** `/api/products/:id/stock`

**Method:** `PATCH`

**Purpose:** Apply a recorded inventory quantity adjustment.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Requires inventory.adjust: Store Manager base eligibility; Administrator needs a valid bounded grant. Path: id. JSON: storeId, operationId, reason, delta (nonzero safe integer), size for Clothing. Resulting quantities cannot be negative.

**Response:** 200 OK; JSON { success: true, message, data: { productId, stock, sizeStocks when applicable, operationId } }.

### 52. Replace the active-product set in a store.

**Endpoint:** `/api/products/set-active`

**Method:** `POST`

**Purpose:** Replace the active-product set in a store.

**Request:** `Authorization: Bearer <token>`. Only Administrator passes both the retained guard and catalog.manage service check. JSON: storeId, operationId, reason, productIds (distinct in-store Product ObjectIds). Unlisted products are deactivated.

**Response:** 200 OK; JSON { success: true, message, data: { activeProductIds, operationId } }. Legacy user is read-only; Store Manager/Cashier/Customer are rejected by this route guard.

## Legacy Customers

### 53. Retained legacy customer creation; currently blocked.

**Endpoint:** `/api/customers`

**Method:** `POST`

**Purpose:** Retained legacy customer creation; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Legacy handler fields: name, phone/contactInfo, email, address.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 54. Retrieve legacy customers and transaction summaries.

**Endpoint:** `/api/customers`

**Method:** `GET`

**Purpose:** Retrieve legacy customers and transaction summaries.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Optional query: search, debtStatus (withDebt/paid), sortBy (totalDebt or default name), page (default 1), limit (default 20).

**Response:** 200 OK; JSON { success: true, message, data: [customers with summary totals], pagination: { page, limit, total, pages } }. Summary transactions exclude bookstore-origin records.

### 55. Retrieve a legacy customer, paginated sales, and recent payments.

**Endpoint:** `/api/customers/:id`

**Method:** `GET`

**Purpose:** Retrieve a legacy customer, paginated sales, and recent payments.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Path: id. Optional page (default 1), limit (default 20) for transaction pagination.

**Response:** 200 OK; JSON { success: true, message, data: { customer, transactions with invoices, payments, debtSummary, pagination } }.

### 56. Retained legacy customer update; currently blocked.

**Endpoint:** `/api/customers/:id`

**Method:** `PUT`

**Purpose:** Retained legacy customer update; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id. Legacy fields: name, phone/contactInfo, email, address.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 57. Retained legacy customer soft deletion; currently blocked.

**Endpoint:** `/api/customers/:id`

**Method:** `DELETE`

**Purpose:** Retained legacy customer soft deletion; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

## Legacy People and Debt Aliases

### 58. Retained legacy customer creation; currently blocked.

**Endpoint:** `/api/people`

**Method:** `POST`

**Purpose:** Retained legacy customer creation; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Legacy handler fields: name, phone/contactInfo, email, address.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 59. Retrieve legacy customers and transaction summaries.

**Endpoint:** `/api/people`

**Method:** `GET`

**Purpose:** Retrieve legacy customers and transaction summaries.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Optional query: search, debtStatus (withDebt/paid), sortBy (totalDebt or default name), page (default 1), limit (default 20).

**Response:** 200 OK; JSON { success: true, message, data: [customers with summary totals], pagination: { page, limit, total, pages } }. Summary transactions exclude bookstore-origin records.

### 60. Retrieve a legacy customer, paginated sales, and recent payments.

**Endpoint:** `/api/people/:id`

**Method:** `GET`

**Purpose:** Retrieve a legacy customer, paginated sales, and recent payments.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Path: id. Optional page (default 1), limit (default 20) for transaction pagination.

**Response:** 200 OK; JSON { success: true, message, data: { customer, transactions with invoices, payments, debtSummary, pagination } }.

### 61. Retained legacy customer update; currently blocked.

**Endpoint:** `/api/people/:id`

**Method:** `PUT`

**Purpose:** Retained legacy customer update; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id. Legacy fields: name, phone/contactInfo, email, address.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 62. Retained legacy customer soft deletion; currently blocked.

**Endpoint:** `/api/people/:id`

**Method:** `DELETE`

**Purpose:** Retained legacy customer soft deletion; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 63. Retired embedded-debt creation.

**Endpoint:** `/api/people/:id/debts`

**Method:** `POST`

**Purpose:** Retired embedded-debt creation.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id. No currently accepted mutation contract.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401. Underlying handler is a 410 Gone tombstone; routed traffic is rejected before it.

### 64. Retained legacy customer debt-payment alias; currently blocked.

**Endpoint:** `/api/people/:id/payments`

**Method:** `POST`

**Purpose:** Retained legacy customer debt-payment alias; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id. Legacy fields: amountPaid/amount, optional transaction/orderId, paymentMethod, paymentReference/referenceNumber, paidAt, notes.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 65. Retained legacy full-debt settlement; currently blocked.

**Endpoint:** `/api/people/:id/pay-all`

**Method:** `POST`

**Purpose:** Retained legacy full-debt settlement; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id. Legacy handler accepts paymentMethod and calculates the outstanding amount.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 66. Retired embedded-debt editing.

**Endpoint:** `/api/people/:id/debts/:debtId`

**Method:** `PUT`

**Purpose:** Retired embedded-debt editing.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id, debtId. No currently accepted mutation contract.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401. Underlying retired handler returns 410 if invoked past the guard.

### 67. Retired embedded-debt deletion.

**Endpoint:** `/api/people/:id/debts/:debtId`

**Method:** `DELETE`

**Purpose:** Retired embedded-debt deletion.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id, debtId. No currently accepted mutation contract.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401. Underlying retired handler returns 410 if invoked past the guard.

## Legacy Orders and Scoped Reversal Aliases

### 68. Retained legacy order or sale creation; currently blocked.

**Endpoint:** `/api/orders`

**Method:** `POST`

**Purpose:** Retained legacy order or sale creation; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Legacy fields include customer/personId, items/products, payment inputs, customerType, reference, notes, orderStatus. Current bookstore submission: POST /api/bookstore/orders.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 69. Retrieve legacy owner-scoped orders or transactions.

**Endpoint:** `/api/orders`

**Method:** `GET`

**Purpose:** Retrieve legacy owner-scoped orders or transactions.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Optional query: orderStatus, customer, paymentStatus, paymentMethod, from, to, sort (asc or default descending), page (default 1), limit (default 50).

**Response:** 200 OK; JSON { success: true, message, data: [transactions with customer/product/processor details and invoice], pagination: { page, limit, total, pages } }. Excludes bookstore-origin and voidedAt records.

### 70. Retrieve one legacy transaction, invoice, and payments.

**Endpoint:** `/api/orders/:id`

**Method:** `GET`

**Purpose:** Retrieve one legacy transaction, invoice, and payments.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Path: id.

**Response:** 200 OK; JSON { success: true, message, data: { transaction, invoice, payments } }. Excludes bookstore-origin transactions.

### 71. Retained legacy order edit/completion; currently blocked.

**Endpoint:** `/api/orders/:id`

**Method:** `PUT`

**Purpose:** Retained legacy order edit/completion; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id. Legacy fields include items, customer, reference, notes, payment/order status. Current completion: POST /api/bookstore/orders/:id/complete.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 72. Retained legacy order payment; currently blocked.

**Endpoint:** `/api/orders/:id/pay`

**Method:** `PATCH`

**Purpose:** Retained legacy order payment; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id. Legacy handler uses paymentMethod/paymentReference. Current bookstore payment occurs in the completion command.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 73. Retained legacy order completion; currently blocked.

**Endpoint:** `/api/orders/:id/complete`

**Method:** `PATCH`

**Purpose:** Retained legacy order completion; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id. Current completion uses the scoped bookstore quote/completion APIs.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 74. Apply scoped cancellation or reversal through a retained alias.

**Endpoint:** `/api/orders/:id/void`

**Method:** `PATCH`

**Purpose:** Apply scoped cancellation or reversal through a retained alias.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Route requires reversal.apply eligibility; service enforces the corresponding cancellation/reversal capabilities. Path: id. JSON: storeId, operationId, reason, requestId, repaymentConfirmed: true, repaymentMethod, returnsConfirmed: true, returned: [{ productId, quantity, size? }]; refundReference is required for GCash. repaymentMethod must match the original cash/gcash method. For an unpaid pending order, send only storeId, operationId, reason to cancel it.

**Response:** 200 OK; JSON { success: true, message, data: { reversalId, orderId, amount, method, returned, operationId } for reversal, or { orderId, orderStatus: cancelled, operationId } for pending-order cancellation }.

### 75. Apply scoped cancellation or reversal through the DELETE alias.

**Endpoint:** `/api/orders/:id`

**Method:** `DELETE`

**Purpose:** Apply scoped cancellation or reversal through the DELETE alias.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Route requires reversal.apply eligibility. Path: id. JSON: storeId, operationId, reason, requestId, repaymentConfirmed: true, repaymentMethod, returnsConfirmed: true, returned: [{ productId, quantity, size? }]; refundReference is required for GCash. repaymentMethod must match the original cash/gcash method. For an unpaid pending order, send only storeId, operationId, reason to cancel it.

**Response:** 200 OK; JSON { success: true, message, data: { reversalId, orderId, amount, method, returned, operationId } for reversal, or { orderId, orderStatus: cancelled, operationId } for pending-order cancellation }. This endpoint does not hard-delete a sale.

## Legacy Transactions and Scoped Reversal Alias

### 76. Retained legacy order or sale creation; currently blocked.

**Endpoint:** `/api/transactions`

**Method:** `POST`

**Purpose:** Retained legacy order or sale creation; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Legacy fields include customer/personId, items/products, payment inputs, customerType, reference, notes, orderStatus. Current bookstore submission: POST /api/bookstore/orders.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 77. Retrieve legacy owner-scoped orders or transactions.

**Endpoint:** `/api/transactions`

**Method:** `GET`

**Purpose:** Retrieve legacy owner-scoped orders or transactions.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Optional query: orderStatus, customer, paymentStatus, paymentMethod, from, to, sort (asc or default descending), page (default 1), limit (default 50).

**Response:** 200 OK; JSON { success: true, message, data: [transactions with customer/product/processor details and invoice], pagination: { page, limit, total, pages } }. Excludes bookstore-origin and voidedAt records.

### 78. Retrieve one legacy transaction, invoice, and payments.

**Endpoint:** `/api/transactions/:id`

**Method:** `GET`

**Purpose:** Retrieve one legacy transaction, invoice, and payments.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Path: id.

**Response:** 200 OK; JSON { success: true, message, data: { transaction, invoice, payments } }. Excludes bookstore-origin transactions.

### 79. Retained legacy order payment; currently blocked.

**Endpoint:** `/api/transactions/:id/pay`

**Method:** `PATCH`

**Purpose:** Retained legacy order payment; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id. Legacy handler uses paymentMethod/paymentReference. Current bookstore payment occurs in the completion command.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 80. Apply scoped cancellation or reversal through a retained alias.

**Endpoint:** `/api/transactions/:id/void`

**Method:** `PATCH`

**Purpose:** Apply scoped cancellation or reversal through a retained alias.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Route requires reversal.apply eligibility; service enforces the corresponding cancellation/reversal capabilities. Path: id. JSON: storeId, operationId, reason, requestId, repaymentConfirmed: true, repaymentMethod, returnsConfirmed: true, returned: [{ productId, quantity, size? }]; refundReference is required for GCash. repaymentMethod must match the original cash/gcash method. For an unpaid pending order, send only storeId, operationId, reason to cancel it.

**Response:** 200 OK; JSON { success: true, message, data: { reversalId, orderId, amount, method, returned, operationId } for reversal, or { orderId, orderStatus: cancelled, operationId } for pending-order cancellation }.

## Legacy Invoices and Scoped Reversal Alias

### 81. Retained legacy invoice-issuance alias; currently blocked.

**Endpoint:** `/api/invoices/create/:orderId`

**Method:** `POST`

**Purpose:** Retained legacy invoice-issuance alias; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: orderId. New bookstore invoices are issued within authorized sale completion.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401. Current shared handler only reads an existing invoice and does not issue one.

### 82. Retrieve legacy owner-scoped invoices.

**Endpoint:** `/api/invoices`

**Method:** `GET`

**Purpose:** Retrieve legacy owner-scoped invoices.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Optional query: status, customer, from, to, page (default 1), limit (default 20).

**Response:** 200 OK; JSON { success: true, message, data: [invoice DTOs with transaction/item/payment details], pagination: { page, limit, total, pages } }. Matches only invoices without a moneyUnit marker.

### 83. Read an existing legacy invoice by transaction; issuance is disabled here.

**Endpoint:** `/api/invoices/order/:orderId/ensure`

**Method:** `GET`

**Purpose:** Read an existing legacy invoice by transaction; issuance is disabled here.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Path: orderId or transactionId according to the endpoint.

**Response:** 200 OK; JSON { success: true, message, data: existing invoice DTO }. Missing transaction: 404. Transaction without an eligible existing invoice: 403. GET does not issue an invoice.

### 84. Read an existing legacy invoice by transaction; issuance is disabled here.

**Endpoint:** `/api/invoices/transaction/:transactionId/ensure`

**Method:** `GET`

**Purpose:** Read an existing legacy invoice by transaction; issuance is disabled here.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Path: orderId or transactionId according to the endpoint.

**Response:** 200 OK; JSON { success: true, message, data: existing invoice DTO }. Missing transaction: 404. Transaction without an eligible existing invoice: 403. GET does not issue an invoice.

### 85. Retrieve one legacy owner-scoped invoice.

**Endpoint:** `/api/invoices/:id`

**Method:** `GET`

**Purpose:** Retrieve one legacy owner-scoped invoice.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Path: id.

**Response:** 200 OK; JSON { success: true, message, data: invoice DTO with linked transaction, items, totals, payment details, cashier }. Matches only invoices without a moneyUnit marker.

### 86. Apply the sale reversal/cancellation workflow through an invoice alias.

**Endpoint:** `/api/invoices/:id/void`

**Method:** `PATCH`

**Purpose:** Apply the sale reversal/cancellation workflow through an invoice alias.

**Request:** `Authorization: Bearer <token>`. Explicit store membership and the endpoint capability are required. Route requires reversal.apply eligibility. Path: id (Invoice ObjectId). JSON: storeId, operationId, reason, requestId, repaymentConfirmed: true, repaymentMethod, returnsConfirmed: true, returned: [{ productId, quantity, size? }]; refundReference is required for GCash. repaymentMethod must match the original cash/gcash method. For an unpaid pending order, send only storeId, operationId, reason to cancel it.

**Response:** 200 OK; JSON { success: true, message, data: { reversalId, orderId, amount, method, returned, operationId } for reversal, or { orderId, orderStatus: cancelled, operationId } for pending-order cancellation }. Resolves the linked sale; it does not independently void only the invoice.

## Legacy Debt Payments

### 87. Retained legacy debt collection; currently blocked.

**Endpoint:** `/api/debt-payments`

**Method:** `POST`

**Purpose:** Retained legacy debt collection; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Legacy fields: customer/personId, amountPaid/amount, optional transaction/orderId, paymentMethod, paymentReference/referenceNumber, paidAt, notes.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 88. Retrieve legacy owner-scoped debt payments.

**Endpoint:** `/api/debt-payments`

**Method:** `GET`

**Purpose:** Retrieve legacy owner-scoped debt payments.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Optional query: customer, transaction, page (default 1), limit (default 20).

**Response:** 200 OK; JSON { success: true, message, data: [debt payments with customer/transaction details], pagination: { page, limit, total, pages } }.

## Legacy Financial Reports

### 89. Retrieve the legacy financial summary.

**Endpoint:** `/api/financials/summary`

**Method:** `GET`

**Purpose:** Retrieve the legacy financial summary.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. No required query.

**Response:** 200 OK; JSON { success: true, message, data: { totalRevenue, totalOutstandingDebt, totalOrders, totalCustomers, recentTransactions } }. Same result as dashboard summary; excludes bookstore-origin sale totals.

### 90. Retrieve the legacy owner dashboard summary.

**Endpoint:** `/api/financials/dashboard-summary`

**Method:** `GET`

**Purpose:** Retrieve the legacy owner dashboard summary.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. No required query.

**Response:** 200 OK; JSON { success: true, message, data: { totalRevenue, totalOutstandingDebt, totalOrders, totalCustomers, recentTransactions } }. Sale totals exclude bookstore-origin transactions; bookstore summaries use /api/bookstore/transactions.

### 91. Retrieve legacy revenue grouped by date period.

**Endpoint:** `/api/financials/revenue`

**Method:** `GET`

**Purpose:** Retrieve legacy revenue grouped by date period.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Optional query: range (daily default, weekly, monthly), from, to. Default interval: previous 30 days through now.

**Response:** 200 OK; JSON { success: true, message, data: [{ label, revenue, orders, outstandingDebt }] }. Includes completed nonvoid owner transactions without bookstore origin.

## Legacy Dashboard Reports

### 92. Retrieve the legacy owner dashboard summary.

**Endpoint:** `/api/dashboard/summary`

**Method:** `GET`

**Purpose:** Retrieve the legacy owner dashboard summary.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. No required query.

**Response:** 200 OK; JSON { success: true, message, data: { totalRevenue, totalOutstandingDebt, totalOrders, totalCustomers, recentTransactions } }. Sale totals exclude bookstore-origin transactions; bookstore summaries use /api/bookstore/transactions.

### 93. Retrieve legacy revenue grouped by date period.

**Endpoint:** `/api/dashboard/revenue`

**Method:** `GET`

**Purpose:** Retrieve legacy revenue grouped by date period.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Optional query: range (daily default, weekly, monthly), from, to. Default interval: previous 30 days through now.

**Response:** 200 OK; JSON { success: true, message, data: [{ label, revenue, orders, outstandingDebt }] }. Includes completed nonvoid owner transactions without bookstore origin.

## Legacy Expenses

### 94. Retained legacy expense creation; currently blocked.

**Endpoint:** `/api/expenses`

**Method:** `POST`

**Purpose:** Retained legacy expense creation; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Legacy fields: itemName, amount, category, note, date.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 95. Retrieve the current user’s legacy expenses.

**Endpoint:** `/api/expenses`

**Method:** `GET`

**Purpose:** Retrieve the current user’s legacy expenses.

**Request:** `Authorization: Bearer <token>`. Legacy read access is limited to stored roles admin and user; records are owner-scoped. Optional query: from, to (date bounds).

**Response:** 200 OK; JSON array of expense documents ordered newest expense date first; a bare array, not a success/data envelope.

### 96. Retained legacy expense editing; currently blocked.

**Endpoint:** `/api/expenses/:id`

**Method:** `PUT`

**Purpose:** Retained legacy expense editing; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id. Legacy fields: itemName, amount, category, note, date.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

### 97. Retained legacy expense deletion; currently blocked.

**Endpoint:** `/api/expenses/:id`

**Method:** `DELETE`

**Purpose:** Retained legacy expense deletion; currently blocked.

**Request:** `Authorization: Bearer <token>`. Registered legacy write route: the current guard rejects writes for admin/user and rejects other roles. Path: id.

**Response:** 403 Forbidden for authenticated requests under the current legacy guard; no mutation or successful result is exposed by this route. Missing or invalid authentication returns 401.

## Public Diagnostics

### 98. Retrieve public application status.

**Endpoint:** `/`

**Method:** `GET`

**Purpose:** Retrieve public application status.

**Request:** No authentication required. No body.

**Response:** 200 OK; JSON { service: "UPHSD Bookstore POS", status: "running" }.

### 99. Check database connection readiness and ping.

**Endpoint:** `/api/health`

**Method:** `GET`

**Purpose:** Check database connection readiness and ping.

**Request:** No authentication required. No body.

**Response:** 200 OK; JSON { status: "ok" } after successful ping. 503 returns { status: "connecting" } or { status: "db not ready" }.

## Common Error Responses

| Status | Meaning in this application |
| --- | --- |
| 400 | Invalid inputs, identifiers, versions, or payment confirmation. |
| 401 | Missing, invalid, stale, unconfirmed, or suspended-account authentication; also any Authorization header on a guest route. |
| 403 | Role/capability or membership denial, invalid guest proof, blocked legacy mutation, or unauthorized missing-invoice issuance. |
| 404 | Authorized resource or saved operation not found. |
| 409 | State/version conflict, conflicting operation ID, unavailable stock, changed quote, duplicate account data, or reconciliation required. |
| 410 | Retired embedded-debt handler; current routed traffic ordinarily receives 403 first. |
| 413 | JSON body exceeds its parser limit. |
| 429 | Guest request/capacity limit. |
| 500 | Sanitized internal server error. |
| 503 | Dependency or guest activation settings unavailable. |

Global errors use `{ success: false, message, data: null }`; authorization middleware may use `{ message }`, and older handlers may use `{ error }`. Clients cannot assume a universal error envelope. An uncertain account transaction can include `code: ACCOUNT_MUTATION_OUTCOME_UNKNOWN`, `operationOutcome: indeterminate`, `retryable: false`. Saved-operation lookup supports reconciliation; a 404 lookup is not proof that a blind repeat is safe.

## Verification and Sources

Coverage was checked against `collectRoutes({ includeAccountRoutes: true, includeBookstoreRoutes: true })`, which constructs the app without a listener or MongoDB connection. Requests and responses were traced through current route middleware, controllers, and services rather than older policy-manifest descriptions. No live authentication, service deployment, or database execution was performed.

- [Application mounts](../backend/app.js)
- [User routes](../backend/routes/UserRoute.js)
- [Bookstore routes](../backend/routes/BookstoreRoute.js)
- [Product routes](../backend/routes/ProductRoute.js)
- [Customer routes](../backend/routes/CustomerRoute.js)
- [Person routes](../backend/routes/PersonRoute.js)
- [Order routes](../backend/routes/OrderRoute.js)
- [Transaction routes](../backend/routes/TransactionRoute.js)
- [Invoice routes](../backend/routes/InvoiceRoute.js)
- [DebtPayment routes](../backend/routes/DebtPaymentRoute.js)
- [Financial routes](../backend/routes/FinancialRoute.js)
- [Dashboard routes](../backend/routes/DashboardRoute.js)
- [Expense routes](../backend/routes/ExpenseRoute.js)
- [User controller](../backend/controllers/UserController.js)
- [AccountLifecycle controller](../backend/controllers/AccountLifecycleController.js)
- [Product controller](../backend/controllers/ProductController.js)
- [Person controller](../backend/controllers/PersonController.js)
- [Order controller](../backend/controllers/OrderController.js)
- [Invoice controller](../backend/controllers/InvoiceController.js)
- [DebtPayment controller](../backend/controllers/DebtPaymentController.js)
- [Financial controller](../backend/controllers/FinancialController.js)
- [Expense controller](../backend/controllers/ExpenseController.js)
- [accountManagement service](../backend/services/accountManagement.js)
- [bookstoreOrders service](../backend/services/bookstoreOrders.js)
- [bookstoreReads service](../backend/services/bookstoreReads.js)
- [guestOrders service](../backend/services/guestOrders.js)
- [bookstoreAdministration service](../backend/services/bookstoreAdministration.js)
- [bookstoreCommand service](../backend/services/bookstoreCommand.js)
- [categoryService service](../backend/services/categoryService.js)
- [catalogService service](../backend/services/catalogService.js)
- [inventoryService service](../backend/services/inventoryService.js)
- [bookstoreAliases service](../backend/services/bookstoreAliases.js)
- [roleAdmission middleware](../backend/middleware/roleAdmission.js)
- [bookstoreAdmission middleware](../backend/middleware/bookstoreAdmission.js)
- [guestBookstore middleware](../backend/middleware/guestBookstore.js)
- [authMiddleware middleware](../backend/middleware/authMiddleware.js)
- [errorMiddleware middleware](../backend/middleware/errorMiddleware.js)
- [Capabilities](../backend/auth/capabilities.js)
- [Product photo validation](../backend/utils/productPhoto.js)
- [Route inventory adapter](../backend/tests/routeInventoryAdapter.js)
