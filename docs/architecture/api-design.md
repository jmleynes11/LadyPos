# API audit and proposed contracts

All paths below are relative to `/api` unless shown otherwise. **Existing** describes source, not successful runtime verification. **Proposed** describes future changes only. Controllers mostly scope records to req.user.id through ownerIdFrom. Current access checks are weakened by F01 and F13.

## Existing HTTP routes

| Method and route | Handler / current auth | Request, response and database effects |
| --- | --- | --- |
| POST `/users/register` | createUser; public | identifier/password, optional profile, **accepts role/confirmed**; raw user DTO+JWT201; writes User without hash hook |
| POST `/users/login` | loginUser; public | identifier/password; compares bcrypt, checks confirmed; raw user DTO+JWT; status-setting errors become500 in middleware |
| GET `/users/profile` | getProfile; bearer | raw User minus password; uses missing req.user._id |
| PUT `/users/profile` | updateProfile; bearer | identifier/name/phone/address allowlist; saves User; raw User; same ID defect |
| PUT `/users/password` | updatePassword; bearer | currentPassword/newPassword; missing matchPassword/hashing and ID; message response |
| GET `/users` | getUsers; admin | search/page/limit (cap100); raw `{users,total,page,totalPages}`; regex identifier query |
| PUT `/users/:id` | updateUser; admin | identifier/role/confirmed/profile/password; explicit bcrypt for reset; raw DTO; no token invalidation |
| DELETE `/users/:id` | deleteUser; admin | hard User delete; self-check uses undefined `_id`; `{message}` |
| POST `/products` | createProduct; admin/user | name, sku, price or sellingPrice, stock or quantity, category, active aliases, costPrice; envelope/product201 |
| GET `/products` | getProducts; admin/user | page/limit/search/category/isActive/sortBy(name or stock); owner-filtered list+pagination |
| GET `/products/:id` | getProductById; admin/user | owner-filtered single envelope; malformed IDs usually500 |
| PUT `/products/:id` | updateProduct; admin/user | full productPayload, defaults overwrite omitted fields; envelope/product |
| DELETE `/products/:id` | deleteProduct; admin/user | soft deactivate; envelope/product |
| PATCH `/products/:id/stock` | adjustStock; admin/user | delta or quantity; parseInt, nonzero check; read/add/clamp/save; envelope/product |
| POST `/products/set-active` | setActiveProducts; bearer | productIds array; deactivates owner catalog then activates IDs in separate writes; null envelope |
| POST `/customers` and `/people` | createCustomer/createPerson; bearer | name, phone/contactInfo, email/address; owner from auth; Customer201 envelope |
| GET `/customers` and `/people` | getCustomers/getPeople; bearer | page/limit/search/debtStatus/sortBy; customer/debt aggregation+pagination |
| GET `/customers/:id` and `/people/:id` | getCustomerById aliases; bearer | customer, transactions, recent payments, summary and nested pagination envelope |
| PUT same customer item paths | updateCustomer aliases; bearer | profile allowlist; owner and nondeleted filter; envelope |
| DELETE same customer item paths | deleteCustomer aliases; bearer | rejects unpaid completed balance409 then soft-deletes; check and mutation separate |
| POST `/people/:id/debts` | addDebt; bearer | intentionally410: use debt transaction |
| PUT `/people/:id/debts/:debtId` | updateDebt; bearer | intentionally410: immutable transaction/payment records |
| DELETE `/people/:id/debts/:debtId` | deleteDebt; bearer | intentionally410 |
| POST `/people/:id/payments` | addPayment -> createDebtPayment; bearer | amountPaid/amount, optional transaction/orderId, method/reference/date/notes; customer comes from route ID; payment201 envelope |
| POST `/people/:id/pay-all` | payAllDebts; bearer | computes balance then delegates; rewrites body and drops supplied paymentReference; current credit collection defaults cash |
| POST `/orders` and `/transactions` | createTransaction/createOrder; bearer | items/products, product/productId, quantity, customer/personId, customerType, orderStatus, payment fields/reference/notes; authoritative product prices; transaction/customer/stock/invoice session;201 `{transaction,invoice,invoiceNumber}` envelope |
| GET `/orders` and `/transactions` | getTransactions aliases; bearer | page/limit, orderStatus/customer/paymentStatus/method/from/to/sort; excludes voided; list+invoices+pagination |
| GET `/orders/:id` and `/transactions/:id` | getTransactionById aliases; bearer | owner-filtered populated transaction, invoice, payments envelope |
| PUT `/orders/:id` | updateOrder; bearer | pending item/customer/profile updates or completion branch; session; completed edits rejected; completion ignores submitted cart edits |
| PATCH `/orders/:id/complete` | markAsCompleted; bearer | forces completion, default paymentStatus paid; delegates updateOrder |
| PATCH `/orders/:id/pay` and `/transactions/:id/pay` | markAsPaid; bearer | paymentMethod/reference; settles full balance through debt handler with wrong route ID; F06 then F05 |
| PATCH `/orders/:id/void` and `/transactions/:id/void` | voidTransaction; bearer | optional reason; session restores recorded stock, marks transaction/invoice void; no payment reversal |
| DELETE `/orders/:id` | deleteOrder -> voidTransaction; bearer | same void, no hard transaction delete |
| POST `/debt-payments` | createDebtPayment; bearer | customer/personId, transaction/orderId optional, amountPaid/amount, method/reference/paidAt/notes; linked double application or oldest-first unallocated collection; session |
| GET `/debt-payments` | getDebtPayments; bearer | page/limit/customer/transaction; populated payment list+pagination |
| POST `/invoices/create/:orderId` | createInvoiceFromOrder -> ensure; bearer | owner sale lookup; creates/returns invoice without completion-state guard |
| GET `/invoices/order/:orderId/ensure` | getOrCreateInvoice; bearer | mutating GET; invoice/counter writes, no session |
| GET `/invoices/transaction/:transactionId/ensure` | same; bearer | alias to mutating ensure |
| GET `/invoices` | getInvoices; bearer | page/limit/status/customer/from/to; issuedAt filters, populated transaction; envelope list |
| GET `/invoices/:id` | getInvoiceById; bearer | owner-filtered invoice with customer/transaction populated |
| PATCH `/invoices/:id/void` | markVoid; bearer | updates invoice only; sale/stock/payment unaffected |
| POST `/expenses` | createExpense; bearer | itemName/amount/category/note/date; userId/createdBy from auth; raw Expense200; only create checks amount positive |
| GET `/expenses` | getExpenses; bearer | from/to; own expenses sorted date, no pagination; raw array |
| PUT `/expenses/:id` | updateExpense; bearer creator/admin | allowed fields; no positive-amount check; raw Expense |
| DELETE `/expenses/:id` | deleteExpense; bearer creator/admin | hard delete; raw message |
| GET `/dashboard/summary` | getSummary; bearer | current collected amount, outstanding debt, counts, recent transactions; envelope |
| GET `/dashboard/revenue` | getRevenueByRange; bearer | range daily/weekly/monthly, from/to (defaults30days); sums current paid by sale createdAt; envelope array |
| GET `/financials/summary` | getFinanceSummary; bearer | aliases getSummary; does not use Financial model |
| GET `/financials/dashboard-summary` | getSummary; bearer | dashboard alias |
| GET `/financials/revenue` | getRevenueByRange; bearer | dashboard revenue alias |
| GET `/health` | inline; public | database readiness503 or ping ok200 |

Outside API: GET `/` public log HTML and GET `/logs-stream` unauthenticated log SSE. Both are registered before CORS. Remove or explicitly protect them as F03 remediation; do not treat as production monitoring.

## Current response/error assessment

Most domains use `{success,message,data,pagination?}` from responseHelpers. Auth emits raw DTO/JWT; expenses raw objects/arrays and `{error}` failures. Controllers frequently return500 for malformed data. User handlers call res.status then throw, while global middleware reads only err.statusCode, producing500 instead of intended401/403/409. There is no consistently documented404 fallback. List helpers often accept NaN, unbounded limits, invalid date ranges and raw regex strings. No OpenAPI document or request schema system exists.

Canonicalize through tested adapters; changing all shapes at once without client compatibility would cause regressions. Alias endpoints share implementation, not duplicate models. Prefer `/orders` for pending/complete operations and retain `/transactions` as a documented compatibility alias until consumers migrate; no wholesale route rename is needed.

## Proposed shared API contract — not implemented

Use JSON requests with primitive allowlisted fields. Success: `{success:true,data:...,message:"...",pagination?:{page,limit,total,pages}}`. Error: `{success:false,data:null,error:{code,message,fields?},requestId}`. Return201 for creation,200 for successful actions/replay,401 for missing/invalid session,403 for denied capability,404 for inaccessible/missing resource,409 for stock/state/key/unique conflict,400 or422 consistently for request validation,429 for throttling and500 with safe message for unexpected errors.

All protected operations require a valid current account plus authorized owner/store membership. Actor/scope come from auth, never request owner or processedBy. Permissions named below are proposed **capabilities**, not approved new roles; map them to existing admin/user only after R01/R10 and F22 policy review. Baseline account provisioning is admin-only as stated by the current login UI.

Limits: proposed defaults page1/limit20, maximum100 (actual ceiling must be confirmed against POS lookup needs), bounded search/notes/cart lines, finite ordered date range and positive safe integer quantities. Money is integer PHP centavos. Use ISO8601 timestamps; business-date windows explicitly use Asia/Manila if approved. Idempotency-Key is required for financial creation/actions; same key+request replays committed result, different payload409. Persist key and effects together, never rely on button state.

## Proposed endpoint contracts — not implemented

Existing routes can adopt these semantics without an immediate version/path rewrite. Any new route is explicitly identified.

| Endpoint | Permission | Request | Success data | Validation, errors and business rules |
| --- | --- | --- | --- | --- |
| POST `/users/register` (harden existing provisioning route) | admin/account.manage | identifier,password,name?,phone?,address?,role?,confirmed? | sanitized User DTO201; no new user's session token to caller | Primitive normalized identifier, approved role/confirmation, password policy;401/403/409/422; no public privilege fields |
| POST `/users/login` | public with throttling | identifier,password | sanitized user plus token/expiry under chosen bearer policy | Reject malformed credentials422, invalid401, unconfirmed/inactive403, throttled429; no account enumeration detail |
| GET/PUT `/users/profile` | self | PUT optional profile fields | sanitized current User | Canonical user.id; unique normalized fields409; missing account revokes session; no role/status/password changes |
| PUT `/users/password` | self + current password | currentPassword,newPassword | changed confirmation and chosen session outcome | Verify current hash, hash once, revoke sessions per policy;401/422; never return hash |
| GET `/users` | account.manage | search/page/limit | user DTO array+pagination | Bound limits, literal search, no password fields |
| PUT `/users/:id` | account.manage | allowlisted profile, role/confirmed, password? | updated sanitized User | Last-admin/self-deactivation policy; role allowlist, hash reset once, invalidate affected sessions;404/409/422 |
| POST `/users/logout` **new** | current session | no body | loggedOut true | Invalidate server session/token version as chosen; replay safe; browser clears only auth keys |
| GET `/products` / `/:id` | catalog.read | search/category/isActive/page/limit | Product DTO(s)+pagination | Bounded literal lookup, owner scope,404/422; inactive visible only per operational need |
| POST `/products` | catalog.write | name,sku?,category?,price,initialStock?,costPrice?,isActive? | Product201 | Integer money/count; initial stock creates opening movement; unique nonempty SKU only if approved;409/422 |
| PUT `/products/:id` | catalog.write | optional metadata/price/cost/active fields; no stock overwrite | updated Product | Preserve omitted fields, audit price changes, reject stock field directing to adjustment command;404/409/422 |
| PATCH `/products/:id/stock` | inventory.adjust | delta,reason; Idempotency-Key | product plus movement ID | Atomic bounded increment, nonzero integer, nonnegative result, reason required; insufficient409; actor audit and same-session movement |
| POST `/products/set-active` | catalog.write | productIds; optionally expected catalog version | selected IDs/count | Validate owned IDs before changes; one atomic session/version policy;404/409/422 |
| GET/POST `/customers`; GET/PUT/DELETE `/:id` | customer.read/write as appropriate | profile fields or list filters; delete reason if policy requires | Customer DTO/summary/list; soft-delete status | Required trimmed name; ID/scope validation; debt/pending state rules;409 if cannot delete; immutable history preserved |
| POST `/orders` | sale.create | customer?,customerType,items:[{product,quantity}],orderStatus pending/completed,payment?; Idempotency-Key | transaction, invoice if completed, receipt reference201 | Price/total from DB, bounded nonempty cart, named customer for credit if approved; pending has no recorded collection; invalid422, inactive/stock409, owner404; complete atomically |
| GET `/orders`; GET `/orders/:id` | sale.read | server-side state/customer/date/payment/search/page filters | transaction summaries/detail+pagination | Explicit void visibility and permission, safe bounds; no GET mutation |
| PUT `/orders/:id` | sale.edit.pending | items/customer/notes with expected version | pending transaction | Reject completed/void409; reprice under approved policy; no money collection or implicit completion;422/404 |
| PATCH `/orders/:id/complete` | sale.complete | payment:{method,amountPaid,paymentReference?,tendered?},expectedVersion?; Idempotency-Key | completed transaction, invoice and receipt reference | Revalidate stock/active/customer policy; authoritative total; exact/partial/debt rules; amount paid excludes change;409 conflict and422 invalid; replay no second deduction |
| PATCH `/orders/:id/pay` | payment.record | method,reference?,expectedBalance?; Idempotency-Key | collection and allocations, updated balance | Explicitly pass actual transaction/customer IDs to service; completed nonvoid sale only; atomically settle once;409 overpay/state |
| POST `/debt-payments` | payment.record | customer,amountPaid,method,reference?,allocations? or transaction?,paidAt?; Idempotency-Key | collection plus allocation list201 | Positive integer <=eligible balance; reference for gcash/bank; oldest-first only if approved, recorded per sale; duplicate/reversal policy;404/409/422 |
| GET `/debt-payments` | payment.read | customer/transaction/from/to/page/limit | collection/allocations+pagination | Filter by paidAt for collection reports; scope-check each referenced sale |
| PATCH `/orders/:id/void` | sale.void | reason,expectedVersion; Idempotency-Key | void result plus movement/reversal references | Pending cancellation no stock increment; completed reversal follows paid/refund policy; one restoration maximum; unsupported paid-sale refund rejected409 until implemented |
| POST `/invoices/create/:orderId` | invoice.issue | no body; Idempotency-Key | invoice DTO/receipt reference201, replay200 | Completed eligible sale only; one invoice per sale, unique scoped number;400/404/409; no direct invoice-only void |
| GET `/invoices`; GET `/invoices/:id` | invoice.read | status/customer/date/page/limit | stable invoice DTO(s), transaction IDs and amount snapshots | Read only, actual unpaid/partial/paid/void enums; bounded filters; no shape-dependent virtual IDs |
| GET `/invoices/:id/receipt` **new** | invoice.read | no body | receipt:{invoiceNumber,issuedAt,storeSnapshot,customerSnapshot,items:[{name,sku,quantity,unitPrice,subtotal}],totalAmount,amountPaid,balance,paymentMethod} | Money centavos, immutable issue values;404; reprint never issues another invoice or reads today's product prices |
| POST/GET `/expenses`; PUT/DELETE `/:id` | expense.write/read | itemName,amount,category,note?,date?; reason for edits/reversal per policy | canonical Expense DTO(s)/change event | Same positive integer rule on create/update, approved financial retention/reversal instead of silent hard delete;404/409/422; owner/capability guard |
| GET `/dashboard/summary` and `/dashboard/revenue` | report.read | approved basis=sales or collections, range/from/to/business timezone | explicit totalSales/collections/outstanding and dated buckets | Sales use completion time, collections use dated payment events; no unsupported income statement; invalid422, forbidden403 |
| GET `/health` plus GET `/live` **new** | public minimal diagnostic | none | readiness status or process liveness | No credentials/PII; readiness503 if DB unusable; short bounded ping; startup env validation |

GET invoice ensure aliases should become read-only lookups after a documented transition or return an explicit deprecation response; client issue must move to POST first. Legacy debt mutations remain410 until callers are removed. `/people`, `/transactions` and `/financials` compatibility aliases must use identical authorization, validation and service behavior to canonical paths. No kiosk endpoint or refund route is proposed as approved scope.

## Business logic ownership and compatibility plan

Controller -> validated command -> account/sales/payment/inventory/invoice service -> Mongoose. Service takes `{actor,scope,command,idempotencyKey}` and owns the transaction session. Model validation is pure and cannot apply a second collection. No controller mutates req and calls a second controller. Errors include stable code and correlation ID, never raw connection strings or stacks. DTO builders avoid virtual alias ambiguity.

Repair auth/payment defects first, then add contract tests around old and new client adapters. Change canonical envelopes behind adapters, update active pages, compare old/new behavior and retire aliases only after consumer inventory. Migration/index readiness precedes endpoints that rely on uniqueness. Proposed endpoints are specifications, not files scaffolded during this audit.
