# UPHSD BookstorePOS — actual database schema audit

Audit date: 2026-11-11 (Asia/Manila). Scope: current on-disk implementation, including pre-existing uncommitted changes. Read-only source inspection; only documentation artifacts were written. No environment values were read or published, no application listener started, and no database connection/query/index creation/migration/seed ran.

## 1. Database Overview

**23 model declarations map to 23 distinct collection names. The application import graph registers 22 of them; `Financial`/`financials` is defined but not loaded by `backend/app.js`. These are code-resolved collection names, not a live collection inventory. Actual physical collection existence, counts, contents, and deployed indexes were not verified.**

There is no independent Order, Person, TransactionItem, Category, Payment (generic), or Reversal (generic) model. `Order.js` registers `Transaction`; `Person.js` registers `Customer`. Account and bookstore control files each register multiple models.

## 2. Database Technology

MongoDB with Mongoose. Installed Mongoose inspected offline: **9.3.3**; dependency declares `^9.3.3`. Native `mongodb` and `pg` are dependencies, but no separate PostgreSQL schema/connection or alternative persistence model was found in application source. [backend/package.json:15](../../backend/package.json#L15)

Startup loads dotenv, creates the Express app/listener, then calls `connectDB()`. Configuration uses `mongoose.connect(process.env.MONGO_URI)` with no explicit database/collection override. The database name, server version/topology, environment-specific auto-index behavior, and production configuration are unverified. [backend/index.js:5](../../backend/index.js#L5); [backend/config/config.js:5](../../backend/config/config.js#L5)

All model names below were resolved with the installed Mongoose pluralizer. No custom collection override, discriminator, pluralizer change, raw collection creation, or additional model registration was found in project source. Model-only/offline import disables autoCreate/autoIndex and blocks connect/createConnection; connection readyState remained 0. `app.js` import has no listener or connection side effects. [backend/app.js:20](../../backend/app.js#L20)

## 3. Complete Collection Inventory

| Collection name | Registered model | Loaded through app.js | Purpose | Registration evidence |
|---|---|---|---|---|
| accountadministrationrealms | AccountAdministrationRealm | Yes | Shared account-administration serialization record; application uses string ID account-management. | [backend/models/AccountControl.js:70](../../backend/models/AccountControl.js#L70) |
| accountauditevents | AccountAuditEvent | Yes | Append-only account/permission administration event ledger. | [backend/models/AccountControl.js:66](../../backend/models/AccountControl.js#L66) |
| accountoperationreceipts | AccountOperationReceipt | Yes | Account command idempotency identity, private fingerprint, and stored result. | [backend/models/AccountControl.js:69](../../backend/models/AccountControl.js#L69) |
| accountrolereviews | AccountRoleReview | Yes | Independent account-role review decisions and revision/supersession history. | [backend/models/AccountControl.js:68](../../backend/models/AccountControl.js#L68) |
| bookstoreauditevents | BookstoreAuditEvent | Yes | Append-only scoped operational events for account and guest actors, including queue-removal markers. | [backend/models/BookstoreControl.js:72](../../backend/models/BookstoreControl.js#L72) |
| bookstoreoperationreceipts | BookstoreOperationReceipt | Yes | Append-only scoped operation idempotency/reconciliation record and response DTO. | [backend/models/BookstoreControl.js:73](../../backend/models/BookstoreControl.js#L73) |
| bookstorepayments | BookstorePayment | Yes | Append-only full cash/GCash payment record; one declared unique transactionId. | [backend/models/BookstoreControl.js:103](../../backend/models/BookstoreControl.js#L103) |
| bookstorereversalrequests | BookstoreReversalRequest | Yes | Request and approval/application state for reversal of a fully paid sale. | [backend/models/BookstoreControl.js:104](../../backend/models/BookstoreControl.js#L104) |
| bookstoresalereversals | BookstoreSaleReversal | Yes | Append-only whole-sale repayment record, request pointer, and embedded return selections. | [backend/models/BookstoreControl.js:105](../../backend/models/BookstoreControl.js#L105) |
| bookstoresequences | BookstoreSequence | Yes | Store/year receipt-number counter with declared unique store/year pair. | [backend/models/BookstoreControl.js:107](../../backend/models/BookstoreControl.js#L107) |
| conditionalaccountgrants | ConditionalAccountGrant | Yes | Explicit, expiring, scoped conditional capabilities tied to recipient security and grantor authority versions. | [backend/models/AccountControl.js:67](../../backend/models/AccountControl.js#L67) |
| customers | Customer | Yes | Owner-scoped customer/contact records, including the bookstore placeholder contact; independent of login accounts. | [backend/models/Person.js:51](../../backend/models/Person.js#L51) |
| debtpayments | DebtPayment | Yes | Legacy customer debt settlements; may reference one transaction or represent a settlement distributed across several transactions. | [backend/models/DebtPayment.js:56](../../backend/models/DebtPayment.js#L56) |
| expenses | Expense | Yes | Owner/creator expense records used by legacy expense endpoints. | [backend/models/Expense.js:19](../../backend/models/Expense.js#L19) |
| financials | Financial | No — declaration only | Apparently unused financial-summary model with its own embedded expense records; not loaded by app.js. | [backend/models/Financial.js:19](../../backend/models/Financial.js#L19) |
| guestorderintents | GuestOrderIntent | Yes | Guest proof verifier and store context, created before submission; its ID becomes the guest transaction ID. | [backend/models/BookstoreControl.js:106](../../backend/models/BookstoreControl.js#L106) |
| invoices | Invoice | Yes | Receipt/invoice identity, transaction/customer linkage, status, optional immutable-by-convention sale snapshot, and reversal pointer. | [backend/models/Invoice.js:58](../../backend/models/Invoice.js#L58) |
| invoicecounters | InvoiceCounter | Yes | Legacy owner/type/year invoice-number counter. | [backend/models/InvoiceCounter.js:23](../../backend/models/InvoiceCounter.js#L23) |
| products | Product | Yes | Catalog, prices, aggregate stock, optional clothing size quantities, and archival availability. | [backend/models/Product.js:67](../../backend/models/Product.js#L67) |
| stockmovements | StockMovement | Yes | Append-only aggregate stock deltas with optional embedded clothing-size deltas. | [backend/models/BookstoreControl.js:74](../../backend/models/BookstoreControl.js#L74) |
| stores | Store | Yes | Bookstore identity, category labels, creator, and compatibility customer used for bookstore orders. | [backend/models/Store.js:11](../../backend/models/Store.js#L11) |
| transactions | Transaction | Yes | Pending orders and completed sales, embedded item snapshots, payments summary, cashier assignments, cancellations, and reversal linkage. | [backend/models/Order.js:169](../../backend/models/Order.js#L169) |
| users | User | Yes | Authentication accounts, business roles, security versions, and explicit store memberships. | [backend/models/User.js:104](../../backend/models/User.js#L104) |


## 4. Collection Structures

All defined persisted paths, including automatic `_id`, `__v`, timestamp fields, plugin-added attribution, nested paths, and embedded array paths, appear below. `id` and named virtual aliases are not persisted fields. `Mixed` is the actual schema type even when service logic expects an ObjectId, Boolean, integer, or structured object. Required subfields apply to existing elements; an array itself need not be nonempty.

Index tables list **declared** indexes only. `_id` is MongoDB’s primary document identity (normally uniquely indexed on ordinary collections); its server index was not inspected. `unique:true` declares an index, not a Mongoose validator or foreign-key constraint. No guarantee is made that deployed indexes were created.

### accountadministrationrealms — `AccountAdministrationRealm`

Shared account-administration serialization record; application uses string ID account-management. [backend/models/AccountControl.js:70](../../backend/models/AccountControl.js#L70)

Schema options: `{"strict":"throw","timestamps":"<undefined>","versionKey":"__v","minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| _id | String | No | None declared | — | No field-level unique declaration | — | — |
| revision | Number | Yes | None declared | — | No field-level unique declaration | — | — |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


No secondary indexes declared.

### accountauditevents — `AccountAuditEvent`

Append-only account/permission administration event ledger. [backend/models/AccountControl.js:66](../../backend/models/AccountControl.js#L66)

Schema options: `{"strict":"throw","timestamps":"<undefined>","versionKey":false,"minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| schemaVersion | Number | Yes | None declared | [1] | No field-level unique declaration | — | — |
| eventId | String | Yes | None declared | — | Yes (declared index) | — | — |
| operationId | String | Yes | None declared | — | No field-level unique declaration | — | — |
| sequence | Number | Yes | None declared | — | No field-level unique declaration | — | — |
| actor.id | ObjectId | Conditional: function humanActorId() { return this.actor?.kind === "account"; } | None declared | — | No field-level unique declaration | — | — |
| actor.role | String | Conditional: function humanActorRole() { return this.actor?.kind === "account"; } | None declared | ["admin","store_manager","cashier","customer","user"] | No field-level unique declaration | — | — |
| actor.kind | String | Yes | None declared | ["account","system-expiry"] | No field-level unique declaration | — | — |
| subjectAccountId | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| action | String | Yes | None declared | ["account.created","account.role_assigned","account.role_changed","account.confirmation_changed","account.suspended","account.reactivated","account.password_reset","account.password_changed","account.profile_changed","account.deleted","permission.granted","permission.revoked","permission.expired","account.review_recorded","account.store_membership_changed","account.bookstore_created"] | No field-level unique declaration | — | — |
| occurredAt | Date | Yes | None declared | — | No field-level unique declaration | — | — |
| reason | String | Yes | None declared | — | No field-level unique declaration | — | {"maxlength":1024,"set":"function redactAuditText(value) {\n  return redactSensitive(value)\n    .replace(/\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{20,}/g, \"[REDACTED HASH]\")\n    .replace(/\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b/g, \"[REDACTED TOKEN]\")\n    .replace(/\\b(password&#124;passwd&#124;pwd&#124;secret&#124;(?:access[_-]?)?token&#124;authorization&#124;api[_-]?key)\\s*[:=]\\s*(?:\"[^\"]*\"&#124;'[^']*'&#124;[^\\s,;]+)/gi, \"$1=[REDACTED]\");\n}"} |
| before | Mixed | Yes | None declared | — | No field-level unique declaration | — | — |
| after | Mixed | Yes | None declared | — | No field-level unique declaration | — | — |
| scope | Mixed | Yes | None declared | — | No field-level unique declaration | — | — |
| approvalRef | String | No | None declared | — | No field-level unique declaration | — | — |
| reviewId | ObjectId | No | None declared | — | No field-level unique declaration | — | — |
| grantId | ObjectId | No | None declared | — | No field-level unique declaration | — | — |
| securityVersionBefore | Number | No | None declared | — | No field-level unique declaration | — | — |
| securityVersionAfter | Number | No | None declared | — | No field-level unique declaration | — | — |
| outcome | String | Yes | None declared | ["applied","observed-expired"] | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"eventId":1} | {"unique":true} |
| {"operationId":1,"sequence":1} | {"unique":true} |
| {"subjectAccountId":1,"occurredAt":-1} | {} |


### accountoperationreceipts — `AccountOperationReceipt`

Account command idempotency identity, private fingerprint, and stored result. [backend/models/AccountControl.js:69](../../backend/models/AccountControl.js#L69)

Schema options: `{"strict":"throw","timestamps":true,"versionKey":"__v","minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| operationId | String | Yes | None declared | — | Yes (declared index) | — | — |
| actorId | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| targetId | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| fingerprint | String | Yes | None declared | — | No field-level unique declaration | — | {"select":false} |
| result | Mixed | Yes | None declared | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| createdAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | {"immutable":true} |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"operationId":1} | {"unique":true} |


### accountrolereviews — `AccountRoleReview`

Independent account-role review decisions and revision/supersession history. [backend/models/AccountControl.js:68](../../backend/models/AccountControl.js#L68)

Schema options: `{"strict":"throw","timestamps":true,"versionKey":"__v","minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| targetAccountId | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| reviewerId | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| status | String | Yes | None declared | ["in-review","approved","rejected","applied","superseded"] | No field-level unique declaration | — | — |
| proposedRole | String | Yes | None declared | ["admin","store_manager","cashier","customer"] | No field-level unique declaration | — | — |
| expectedVersion | Number | Yes | None declared | — | No field-level unique declaration | — | — |
| expectedRole | String | Yes | None declared | — | No field-level unique declaration | — | — |
| reason | String | Yes | None declared | — | No field-level unique declaration | — | {"maxlength":1024,"set":"function redactAuditText(value) {\n  return redactSensitive(value)\n    .replace(/\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{20,}/g, \"[REDACTED HASH]\")\n    .replace(/\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b/g, \"[REDACTED TOKEN]\")\n    .replace(/\\b(password&#124;passwd&#124;pwd&#124;secret&#124;(?:access[_-]?)?token&#124;authorization&#124;api[_-]?key)\\s*[:=]\\s*(?:\"[^\"]*\"&#124;'[^']*'&#124;[^\\s,;]+)/gi, \"$1=[REDACTED]\");\n}"} |
| evidenceRefs | Array<Mixed> | Yes | [] (Mongoose array default) | — | No field-level unique declaration | — | {"set":"values => Array.isArray(values) ? values.map(redactAuditText) : values"} |
| revision | Number | Yes | None declared | — | No field-level unique declaration | — | — |
| supersedes | ObjectId | No | None declared | — | No field-level unique declaration | — | — |
| verifiedAuthorityVersion | Number | No | None declared | — | No field-level unique declaration | — | — |
| operationId | String | Yes | None declared | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| createdAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | {"immutable":true} |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


No secondary indexes declared.

### bookstoreauditevents — `BookstoreAuditEvent`

Append-only scoped operational events for account and guest actors, including queue-removal markers. [backend/models/BookstoreControl.js:72](../../backend/models/BookstoreControl.js#L72)

Schema options: `{"strict":"throw","timestamps":"<undefined>","versionKey":false,"minimize":false}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| actorKey | String | Yes | None declared | — | No field-level unique declaration | — | — |
| operationId | String | Yes | None declared | — | No field-level unique declaration | — | — |
| sequence | Number | Yes | None declared | — | No field-level unique declaration | — | — |
| storeId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| actorId | ObjectId | Conditional: function accountActorRequired() { return this.actorKind === "account"; } | None declared | — | No field-level unique declaration | — | — |
| actorKind | String | Yes | None declared | ["account","guest"] | No field-level unique declaration | — | — |
| action | String | Yes | None declared | ["guest.intent_issued","store.created","resource.mapped","product.created","product.updated","product.price_changed","product.archived","category.created","category.renamed","category.deleted","inventory.adjusted","order.submitted","order.claimed","order.cancelled","order.queue_removed","sale.completed","payment.recorded","receipt.issued","reversal.requested","reversal.applied"] | No field-level unique declaration | — | — |
| targetKind | String | Yes | None declared | ["Store","Product","Transaction","Invoice","Reversal","GuestIntent","Customer","DebtPayment"] | No field-level unique declaration | — | — |
| targetId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| occurredAt | Date | Yes | None declared | — | No field-level unique declaration | — | — |
| reason | String | Yes | None declared | — | No field-level unique declaration | — | {"set":"function redactAuditText(value) {\n  return redactSensitive(value)\n    .replace(/\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{20,}/g, \"[REDACTED HASH]\")\n    .replace(/\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b/g, \"[REDACTED TOKEN]\")\n    .replace(/\\b(password&#124;passwd&#124;pwd&#124;secret&#124;(?:access[_-]?)?token&#124;authorization&#124;api[_-]?key)\\s*[:=]\\s*(?:\"[^\"]*\"&#124;'[^']*'&#124;[^\\s,;]+)/gi, \"$1=[REDACTED]\");\n}"} |
| before | Mixed | Yes | None declared | — | No field-level unique declaration | — | — |
| after | Mixed | Yes | None declared | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"actorKey":1,"operationId":1,"sequence":1} | {"unique":true} |
| {"storeId":1,"occurredAt":-1} | {} |


### bookstoreoperationreceipts — `BookstoreOperationReceipt`

Append-only scoped operation idempotency/reconciliation record and response DTO. [backend/models/BookstoreControl.js:73](../../backend/models/BookstoreControl.js#L73)

Schema options: `{"strict":"throw","timestamps":true,"versionKey":"__v","minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| actorKey | String | Yes | None declared | — | No field-level unique declaration | — | — |
| operationId | String | Yes | None declared | — | No field-level unique declaration | — | — |
| capability | String | Yes | None declared | — | No field-level unique declaration | — | — |
| storeId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| fingerprint | String | Yes | None declared | — | No field-level unique declaration | — | {"select":false} |
| result | Mixed | Yes | None declared | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| createdAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | {"immutable":true} |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"actorKey":1,"operationId":1} | {"unique":true} |


### bookstorepayments — `BookstorePayment`

Append-only full cash/GCash payment record; one declared unique transactionId. [backend/models/BookstoreControl.js:103](../../backend/models/BookstoreControl.js#L103)

Schema options: `{"strict":"throw","timestamps":"<undefined>","versionKey":false,"minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| storeId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| transactionId | ObjectId | Yes | None declared | — | Yes (declared index) | — | — |
| actorId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| operationId | String | Yes | None declared | — | No field-level unique declaration | — | — |
| amount | Number | Yes | None declared | — | No field-level unique declaration | — | {"min":0,"validate":"function isSafeInteger() { [native code] }"} |
| method | String | Yes | None declared | ["cash","gcash"] | No field-level unique declaration | — | — |
| reference | String | No | "" | — | No field-level unique declaration | — | {"set":"function redactAuditText(value) {\n  return redactSensitive(value)\n    .replace(/\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{20,}/g, \"[REDACTED HASH]\")\n    .replace(/\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b/g, \"[REDACTED TOKEN]\")\n    .replace(/\\b(password&#124;passwd&#124;pwd&#124;secret&#124;(?:access[_-]?)?token&#124;authorization&#124;api[_-]?key)\\s*[:=]\\s*(?:\"[^\"]*\"&#124;'[^']*'&#124;[^\\s,;]+)/gi, \"$1=[REDACTED]\");\n}"} |
| occurredAt | Date | Yes | None declared | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"transactionId":1} | {"unique":true} |


### bookstorereversalrequests — `BookstoreReversalRequest`

Request and approval/application state for reversal of a fully paid sale. [backend/models/BookstoreControl.js:104](../../backend/models/BookstoreControl.js#L104)

Schema options: `{"strict":"throw","timestamps":true,"versionKey":"__v","minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| storeId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| transactionId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| requestedBy | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| reason | String | Yes | None declared | — | No field-level unique declaration | — | {"set":"function redactAuditText(value) {\n  return redactSensitive(value)\n    .replace(/\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{20,}/g, \"[REDACTED HASH]\")\n    .replace(/\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b/g, \"[REDACTED TOKEN]\")\n    .replace(/\\b(password&#124;passwd&#124;pwd&#124;secret&#124;(?:access[_-]?)?token&#124;authorization&#124;api[_-]?key)\\s*[:=]\\s*(?:\"[^\"]*\"&#124;'[^']*'&#124;[^\\s,;]+)/gi, \"$1=[REDACTED]\");\n}"} |
| status | String | Yes | None declared | ["requested","applied"] | No field-level unique declaration | — | — |
| approvedBy | ObjectId | No | None declared | — | No field-level unique declaration | — | — |
| appliedAt | Date | No | None declared | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| createdAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | {"immutable":true} |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


No secondary indexes declared.

### bookstoresalereversals — `BookstoreSaleReversal`

Append-only whole-sale repayment record, request pointer, and embedded return selections. [backend/models/BookstoreControl.js:105](../../backend/models/BookstoreControl.js#L105)

Schema options: `{"strict":"throw","timestamps":"<undefined>","versionKey":false,"minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| storeId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| transactionId | ObjectId | Yes | None declared | — | Yes (declared index) | — | — |
| requestId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| approvedBy | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| operationId | String | Yes | None declared | — | No field-level unique declaration | — | — |
| amount | Number | Yes | None declared | — | No field-level unique declaration | — | {"min":0,"validate":"function isSafeInteger() { [native code] }"} |
| method | String | Yes | None declared | ["cash","gcash"] | No field-level unique declaration | — | — |
| reference | String | No | "" | — | No field-level unique declaration | — | {"set":"function redactAuditText(value) {\n  return redactSensitive(value)\n    .replace(/\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{20,}/g, \"[REDACTED HASH]\")\n    .replace(/\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b/g, \"[REDACTED TOKEN]\")\n    .replace(/\\b(password&#124;passwd&#124;pwd&#124;secret&#124;(?:access[_-]?)?token&#124;authorization&#124;api[_-]?key)\\s*[:=]\\s*(?:\"[^\"]*\"&#124;'[^']*'&#124;[^\\s,;]+)/gi, \"$1=[REDACTED]\");\n}"} |
| reason | String | Yes | None declared | — | No field-level unique declaration | — | {"set":"function redactAuditText(value) {\n  return redactSensitive(value)\n    .replace(/\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{20,}/g, \"[REDACTED HASH]\")\n    .replace(/\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b/g, \"[REDACTED TOKEN]\")\n    .replace(/\\b(password&#124;passwd&#124;pwd&#124;secret&#124;(?:access[_-]?)?token&#124;authorization&#124;api[_-]?key)\\s*[:=]\\s*(?:\"[^\"]*\"&#124;'[^']*'&#124;[^\\s,;]+)/gi, \"$1=[REDACTED]\");\n}"} |
| returned | Array<Mixed> | Yes | [] (Mongoose array default) | — | No field-level unique declaration | — | — |
| occurredAt | Date | Yes | None declared | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"transactionId":1} | {"unique":true} |


### bookstoresequences — `BookstoreSequence`

Store/year receipt-number counter with declared unique store/year pair. [backend/models/BookstoreControl.js:107](../../backend/models/BookstoreControl.js#L107)

Schema options: `{"strict":"throw","timestamps":"<undefined>","versionKey":"__v","minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| storeId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| year | Number | Yes | None declared | — | No field-level unique declaration | — | — |
| seq | Number | Yes | None declared | — | No field-level unique declaration | — | {"min":1,"validate":"function isSafeInteger() { [native code] }"} |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"storeId":1,"year":1} | {"unique":true} |


### conditionalaccountgrants — `ConditionalAccountGrant`

Explicit, expiring, scoped conditional capabilities tied to recipient security and grantor authority versions. [backend/models/AccountControl.js:67](../../backend/models/AccountControl.js#L67)

Schema options: `{"strict":"throw","timestamps":true,"versionKey":"__v","minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| recipientAccountId | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| capability | String | Yes | None declared | — | No field-level unique declaration | — | — |
| scope | Mixed | Yes | None declared | — | No field-level unique declaration | — | — |
| grantedBy | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| reason | String | Yes | None declared | — | No field-level unique declaration | — | {"maxlength":1024,"set":"function redactAuditText(value) {\n  return redactSensitive(value)\n    .replace(/\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{20,}/g, \"[REDACTED HASH]\")\n    .replace(/\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b/g, \"[REDACTED TOKEN]\")\n    .replace(/\\b(password&#124;passwd&#124;pwd&#124;secret&#124;(?:access[_-]?)?token&#124;authorization&#124;api[_-]?key)\\s*[:=]\\s*(?:\"[^\"]*\"&#124;'[^']*'&#124;[^\\s,;]+)/gi, \"$1=[REDACTED]\");\n}"} |
| approvalRef | String | No | None declared | — | No field-level unique declaration | — | {"set":"function redactAuditText(value) {\n  return redactSensitive(value)\n    .replace(/\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{20,}/g, \"[REDACTED HASH]\")\n    .replace(/\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b/g, \"[REDACTED TOKEN]\")\n    .replace(/\\b(password&#124;passwd&#124;pwd&#124;secret&#124;(?:access[_-]?)?token&#124;authorization&#124;api[_-]?key)\\s*[:=]\\s*(?:\"[^\"]*\"&#124;'[^']*'&#124;[^\\s,;]+)/gi, \"$1=[REDACTED]\");\n}"} |
| effectiveAt | Date | Yes | None declared | — | No field-level unique declaration | — | — |
| expiresAt | Date | Yes | None declared | — | No field-level unique declaration | — | — |
| recipientVersion | Mixed | Yes | None declared | — | No field-level unique declaration | — | {"validate":"function isTokenVersion(value) {\n  return Number.isSafeInteger(value) && value >= 0;\n}"} |
| grantorAuthorityVersion | Mixed | Yes | None declared | — | No field-level unique declaration | — | {"validate":"function isTokenVersion(value) {\n  return Number.isSafeInteger(value) && value >= 0;\n}"} |
| revokedAt | Mixed | No | function newGrantRevocationState() { return this.isNew ? null : undefined; } | — | No field-level unique declaration | — | {"validate":"value => value === null &#124;&#124; (value instanceof Date && Number.isFinite(value.valueOf()))"} |
| revokedBy | ObjectId | No | None declared | — | No field-level unique declaration | — | — |
| revocationReason | String | No | None declared | — | No field-level unique declaration | — | — |
| expiredRecordedAt | Date | No | None declared | — | No field-level unique declaration | — | — |
| operationId | String | Yes | None declared | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| createdAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | {"immutable":true} |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"recipientAccountId":1,"revokedAt":1,"expiresAt":1} | {} |


### customers — `Customer`

Owner-scoped customer/contact records, including the bookstore placeholder contact; independent of login accounts. [backend/models/Person.js:51](../../backend/models/Person.js#L51)

Schema options: `{"strict":true,"timestamps":{"createdAt":true,"updatedAt":true},"versionKey":"__v","minimize":true}`. Virtuals (not columns): `userId, contactInfo, totalDebt, totalPaid, totalOrders, id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| owner | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| name | String | Yes | None declared | — | No field-level unique declaration | — | {"trim":true} |
| phone | String | No | "" | — | No field-level unique declaration | — | {"trim":true} |
| email | String | No | "" | — | No field-level unique declaration | — | {"trim":true} |
| address | String | No | "" | — | No field-level unique declaration | — | {"trim":true} |
| isDeleted | Boolean | No | false | — | No field-level unique declaration | — | — |
| deletedAt | Date | No | None declared | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| createdAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | {"immutable":true} |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| storeId | Mixed | No | None declared | — | No field-level unique declaration | — | {"validate":"function isStoredResourceId(value) {\n  return value instanceof mongoose.Types.ObjectId && canonicalAccountId(value) !== null;\n}"} |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"owner":1} | {} |
| {"isDeleted":1} | {} |
| {"owner":1,"name":1} | {} |
| {"owner":1,"phone":1} | {} |
| {"storeId":1,"createdAt":-1} | {} |


`storeId` and its validator/index are added by [backend/models/resourceAttribution.js:20](../../backend/models/resourceAttribution.js#L20). `moneyUnit` is added to Product, Transaction, Invoice, and DebtPayment, not Customer.

### debtpayments — `DebtPayment`

Legacy customer debt settlements; may reference one transaction or represent a settlement distributed across several transactions. [backend/models/DebtPayment.js:56](../../backend/models/DebtPayment.js#L56)

Schema options: `{"strict":true,"timestamps":true,"versionKey":"__v","minimize":true}`. Virtuals (not columns): `userId, personId, id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| owner | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| customer | ObjectId | Yes | None declared | — | No field-level unique declaration | Customer | — |
| transaction | ObjectId | No | None declared | — | No field-level unique declaration | Transaction | — |
| amountPaid | Number | Yes | None declared | — | No field-level unique declaration | — | {"min":1} |
| paymentMethod | String | No | cash | ["cash","gcash","bank","credit"] | No field-level unique declaration | — | — |
| paymentReference | String | No | "" | — | No field-level unique declaration | — | {"trim":true} |
| paidAt | Date | No | function now() { [native code] } | — | No field-level unique declaration | — | — |
| notes | String | No | "" | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| createdAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | {"immutable":true} |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| storeId | Mixed | No | None declared | — | No field-level unique declaration | — | {"validate":"function isStoredResourceId(value) {\n  return value instanceof mongoose.Types.ObjectId && canonicalAccountId(value) !== null;\n}"} |
| moneyUnit | Mixed | No | None declared | — | No field-level unique declaration | — | {"validate":"value => value === \"PHP-centavos\""} |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"owner":1} | {} |
| {"customer":1} | {} |
| {"transaction":1} | {} |
| {"paidAt":1} | {} |
| {"owner":1,"customer":1,"paidAt":-1} | {} |
| {"owner":1,"transaction":1,"paidAt":-1} | {} |
| {"storeId":1,"createdAt":-1} | {} |


`storeId` and its validator/index are added by [backend/models/resourceAttribution.js:20](../../backend/models/resourceAttribution.js#L20). `moneyUnit` is added to Product, Transaction, Invoice, and DebtPayment, not Customer.

### expenses — `Expense`

Owner/creator expense records used by legacy expense endpoints. [backend/models/Expense.js:19](../../backend/models/Expense.js#L19)

Schema options: `{"strict":true,"timestamps":"<undefined>","versionKey":"__v","minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| userId | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| itemName | String | Yes | None declared | — | No field-level unique declaration | — | — |
| amount | Number | Yes | None declared | — | No field-level unique declaration | — | — |
| category | String | No | misc | ["inventory","rent","utilities","salary","misc"] | No field-level unique declaration | — | — |
| note | String | No | None declared | — | No field-level unique declaration | — | — |
| date | Date | No | function now() { [native code] } | — | No field-level unique declaration | — | — |
| createdBy | ObjectId | No | None declared | — | No field-level unique declaration | User | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


No secondary indexes declared.

### financials — `Financial`

Apparently unused financial-summary model with its own embedded expense records; not loaded by app.js. [backend/models/Financial.js:19](../../backend/models/Financial.js#L19)

Schema options: `{"strict":true,"timestamps":true,"versionKey":"__v","minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| userId | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| capitalInvested | Number | No | 0 | — | No field-level unique declaration | — | — |
| grossIncome | Number | No | 0 | — | No field-level unique declaration | — | — |
| netIncome | Number | No | 0 | — | No field-level unique declaration | — | — |
| expenses | Array<EmbeddedDocument> | No | [] (Mongoose array default) | — | No field-level unique declaration | — | — |
| expenses[].type | String | Yes | None declared | — | No field-level unique declaration | — | — |
| expenses[].amount | Number | Yes | None declared | — | No field-level unique declaration | — | — |
| expenses[].date | Date | No | function now() { [native code] } | — | No field-level unique declaration | — | — |
| expenses[]._id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| notes | String | No | None declared | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| createdAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | {"immutable":true} |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


No secondary indexes declared.

### guestorderintents — `GuestOrderIntent`

Guest proof verifier and store context, created before submission; its ID becomes the guest transaction ID. [backend/models/BookstoreControl.js:106](../../backend/models/BookstoreControl.js#L106)

Schema options: `{"strict":"throw","timestamps":true,"versionKey":"__v","minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| storeId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| verification | Mixed | Yes | None declared | — | No field-level unique declaration | — | {"select":false} |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| createdAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | {"immutable":true} |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


No secondary indexes declared.

### invoices — `Invoice`

Receipt/invoice identity, transaction/customer linkage, status, optional immutable-by-convention sale snapshot, and reversal pointer. [backend/models/Invoice.js:58](../../backend/models/Invoice.js#L58)

Schema options: `{"strict":true,"timestamps":true,"versionKey":"__v","minimize":true}`. Virtuals (not columns): `userId, orderId, id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| owner | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| customer | ObjectId | Yes | None declared | — | No field-level unique declaration | Customer | — |
| transaction | ObjectId | Yes | None declared | — | No field-level unique declaration | Transaction | — |
| invoiceNumber | String | Yes | None declared | — | No field-level unique declaration | — | — |
| issuedAt | Date | No | function now() { [native code] } | — | No field-level unique declaration | — | — |
| dueDate | Date | No | None declared | — | No field-level unique declaration | — | — |
| status | String | No | unpaid | ["unpaid","partial","paid","void"] | No field-level unique declaration | — | — |
| notes | String | No | "" | — | No field-level unique declaration | — | — |
| snapshot | Mixed | No | None declared | — | No field-level unique declaration | — | — |
| reversalId | ObjectId | No | None declared | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| createdAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | {"immutable":true} |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| storeId | Mixed | No | None declared | — | No field-level unique declaration | — | {"validate":"function isStoredResourceId(value) {\n  return value instanceof mongoose.Types.ObjectId && canonicalAccountId(value) !== null;\n}"} |
| moneyUnit | Mixed | No | None declared | — | No field-level unique declaration | — | {"validate":"value => value === \"PHP-centavos\""} |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"owner":1} | {} |
| {"customer":1} | {} |
| {"transaction":1} | {} |
| {"issuedAt":1} | {} |
| {"status":1} | {} |
| {"owner":1,"invoiceNumber":1} | {} |
| {"owner":1,"transaction":1} | {} |
| {"storeId":1,"createdAt":-1} | {} |


`storeId` and its validator/index are added by [backend/models/resourceAttribution.js:20](../../backend/models/resourceAttribution.js#L20). `moneyUnit` is added to Product, Transaction, Invoice, and DebtPayment, not Customer.

### invoicecounters — `InvoiceCounter`

Legacy owner/type/year invoice-number counter. [backend/models/InvoiceCounter.js:23](../../backend/models/InvoiceCounter.js#L23)

Schema options: `{"strict":true,"timestamps":"<undefined>","versionKey":"__v","minimize":true}`. Virtuals (not columns): `userId, id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| owner | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| type | String | Yes | invoice | — | No field-level unique declaration | — | — |
| year | Number | Yes | None declared | — | No field-level unique declaration | — | — |
| seq | Number | No | 0 | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"owner":1,"type":1,"year":1} | {} |


### products — `Product`

Catalog, prices, aggregate stock, optional clothing size quantities, and archival availability. [backend/models/Product.js:67](../../backend/models/Product.js#L67)

Schema options: `{"strict":true,"timestamps":true,"versionKey":"__v","minimize":true}`. Virtuals (not columns): `userId, sellingPrice, quantity, active, id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| owner | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| name | String | Yes | None declared | — | No field-level unique declaration | — | {"trim":true} |
| sku | String | No | "" | — | No field-level unique declaration | — | {"trim":true} |
| price | Number | Yes | None declared | — | No field-level unique declaration | — | {"min":0} |
| stock | Number | No | 0 | — | No field-level unique declaration | — | {"min":0} |
| sizeStocks | Mixed | No | undefined (explicit) | — | No field-level unique declaration | — | — |
| category | String | No | General | — | No field-level unique declaration | — | {"trim":true} |
| isActive | Boolean | No | true | — | No field-level unique declaration | — | — |
| imageUrl | String | No | undefined (explicit) | — | No field-level unique declaration | — | — |
| costPrice | Number | No | 0 | — | No field-level unique declaration | — | {"min":0} |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| createdAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | {"immutable":true} |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| storeId | Mixed | No | None declared | — | No field-level unique declaration | — | {"validate":"function isStoredResourceId(value) {\n  return value instanceof mongoose.Types.ObjectId && canonicalAccountId(value) !== null;\n}"} |
| moneyUnit | Mixed | No | None declared | — | No field-level unique declaration | — | {"validate":"value => value === \"PHP-centavos\""} |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"owner":1} | {} |
| {"isActive":1} | {} |
| {"owner":1,"name":1} | {} |
| {"owner":1,"sku":1} | {} |
| {"owner":1,"category":1,"isActive":1} | {} |
| {"storeId":1,"createdAt":-1} | {} |


`storeId` and its validator/index are added by [backend/models/resourceAttribution.js:20](../../backend/models/resourceAttribution.js#L20). `moneyUnit` is added to Product, Transaction, Invoice, and DebtPayment, not Customer.

### stockmovements — `StockMovement`

Append-only aggregate stock deltas with optional embedded clothing-size deltas. [backend/models/BookstoreControl.js:74](../../backend/models/BookstoreControl.js#L74)

Schema options: `{"strict":"throw","timestamps":"<undefined>","versionKey":false,"minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| storeId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| productId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| actorId | ObjectId | Yes | None declared | — | No field-level unique declaration | — | — |
| operationId | String | Yes | None declared | — | No field-level unique declaration | — | — |
| delta | Number | Yes | None declared | — | No field-level unique declaration | — | {"validate":"function isSafeInteger() { [native code] }"} |
| before | Number | Yes | None declared | — | No field-level unique declaration | — | {"min":0,"validate":"function isSafeInteger() { [native code] }"} |
| after | Number | Yes | None declared | — | No field-level unique declaration | — | {"min":0,"validate":"function isSafeInteger() { [native code] }"} |
| reason | String | Yes | None declared | — | No field-level unique declaration | — | {"set":"function redactAuditText(value) {\n  return redactSensitive(value)\n    .replace(/\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{20,}/g, \"[REDACTED HASH]\")\n    .replace(/\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b/g, \"[REDACTED TOKEN]\")\n    .replace(/\\b(password&#124;passwd&#124;pwd&#124;secret&#124;(?:access[_-]?)?token&#124;authorization&#124;api[_-]?key)\\s*[:=]\\s*(?:\"[^\"]*\"&#124;'[^']*'&#124;[^\\s,;]+)/gi, \"$1=[REDACTED]\");\n}"} |
| source | String | Yes | None declared | ["adjustment","sale","return"] | No field-level unique declaration | — | — |
| occurredAt | Date | Yes | None declared | — | No field-level unique declaration | — | — |
| transactionId | ObjectId | No | None declared | — | No field-level unique declaration | — | — |
| sizeChanges | Array<EmbeddedDocument> | No | undefined (explicit) | — | No field-level unique declaration | — | — |
| sizeChanges[].size | String | Yes | None declared | ["XS","S","M","L","XL","2XL","3XL","4XL"] | No field-level unique declaration | — | — |
| sizeChanges[].before | Number | Yes | None declared | — | No field-level unique declaration | — | {"min":0,"validate":"function isSafeInteger() { [native code] }"} |
| sizeChanges[].after | Number | Yes | None declared | — | No field-level unique declaration | — | {"min":0,"validate":"function isSafeInteger() { [native code] }"} |
| sizeChanges[].delta | Number | Yes | None declared | — | No field-level unique declaration | — | {"validate":"function isSafeInteger() { [native code] }"} |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"actorId":1,"operationId":1,"productId":1} | {"unique":true} |
| {"storeId":1,"productId":1,"occurredAt":-1} | {} |


### stores — `Store`

Bookstore identity, category labels, creator, and compatibility customer used for bookstore orders. [backend/models/Store.js:11](../../backend/models/Store.js#L11)

Schema options: `{"strict":"throw","timestamps":true,"versionKey":"__v","minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| name | String | Yes | None declared | — | No field-level unique declaration | — | {"trim":true} |
| categoryNames | Array<Mixed> | No | undefined (explicit) | — | No field-level unique declaration | — | — |
| createdBy | ObjectId | No | None declared | — | No field-level unique declaration | User | — |
| orderCustomer | ObjectId | No | None declared | — | No field-level unique declaration | Customer | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| createdAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | {"immutable":true} |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


No secondary indexes declared.

### transactions — `Transaction`

Pending orders and completed sales, embedded item snapshots, payments summary, cashier assignments, cancellations, and reversal linkage. [backend/models/Order.js:169](../../backend/models/Order.js#L169)

Schema options: `{"strict":true,"timestamps":{"createdAt":false,"updatedAt":true},"versionKey":"__v","minimize":true}`. Virtuals (not columns): `userId, personId, products, total, date, id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| owner | ObjectId | Yes | None declared | — | No field-level unique declaration | User | — |
| customer | ObjectId | Yes | None declared | — | No field-level unique declaration | Customer | — |
| items | Array<EmbeddedDocument> | No | [] (Mongoose array default) | — | No field-level unique declaration | — | — |
| items[].product | ObjectId | Yes | None declared | — | No field-level unique declaration | Product | — |
| items[].quantity | Number | Yes | None declared | — | No field-level unique declaration | — | {"min":1} |
| items[].unitPrice | Number | Yes | None declared | — | No field-level unique declaration | — | {"min":0} |
| items[].name | String | No | None declared | — | No field-level unique declaration | — | — |
| items[].sku | String | No | None declared | — | No field-level unique declaration | — | — |
| items[].category | String | No | None declared | — | No field-level unique declaration | — | — |
| items[].size | String | No | undefined (explicit) | ["XS","S","M","L","XL","2XL","3XL","4XL"] | No field-level unique declaration | — | — |
| items[].subtotal | Number | Yes | None declared | — | No field-level unique declaration | — | {"min":0} |
| totalAmount | Number | Yes | None declared | — | No field-level unique declaration | — | {"min":0} |
| amountPaid | Number | No | 0 | — | No field-level unique declaration | — | {"min":0} |
| balance | Number | No | 0 | — | No field-level unique declaration | — | {"min":0} |
| paymentStatus | String | No | debt | ["paid","partial","debt","unpaid"] | No field-level unique declaration | — | — |
| paymentMethod | String | No | cash | ["cash","gcash","bank","credit"] | No field-level unique declaration | — | — |
| paymentReference | String | No | "" | — | No field-level unique declaration | — | {"trim":true} |
| customerType | String | No | customer | ["walkin","customer","grab","foodpanda"] | No field-level unique declaration | — | — |
| reference | String | No | "" | — | No field-level unique declaration | — | {"trim":true} |
| orderStatus | String | No | completed | ["pending","completed","void","cancelled"] | No field-level unique declaration | — | — |
| ledgerRecorded | Boolean | No | false | — | No field-level unique declaration | — | — |
| completedAt | Date | No | None declared | — | No field-level unique declaration | — | — |
| processedBy | ObjectId | No | None declared | — | No field-level unique declaration | User | — |
| origin | String | No | None declared | ["guest","student","pos"] | No field-level unique declaration | — | — |
| directPayment | Boolean | No | undefined (explicit) | — | No field-level unique declaration | — | — |
| studentUser | ObjectId | No | None declared | — | No field-level unique declaration | User | {"select":false} |
| assignedTo | ObjectId | No | None declared | — | No field-level unique declaration | User | — |
| bookstoreReference | String | No | None declared | — | No field-level unique declaration | — | — |
| cancelledAt | Date | No | None declared | — | No field-level unique declaration | — | — |
| cancelledBy | ObjectId | No | None declared | — | No field-level unique declaration | — | — |
| cancellationReason | String | No | None declared | — | No field-level unique declaration | — | — |
| reversalId | ObjectId | No | None declared | — | No field-level unique declaration | — | — |
| reversedAt | Date | No | None declared | — | No field-level unique declaration | — | — |
| notes | String | No | "" | — | No field-level unique declaration | — | — |
| voidedAt | Date | No | None declared | — | No field-level unique declaration | — | — |
| voidReason | String | No | None declared | — | No field-level unique declaration | — | — |
| createdAt | Date | No | function now() { [native code] } | — | No field-level unique declaration | — | — |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| storeId | Mixed | No | None declared | — | No field-level unique declaration | — | {"validate":"function isStoredResourceId(value) {\n  return value instanceof mongoose.Types.ObjectId && canonicalAccountId(value) !== null;\n}"} |
| moneyUnit | Mixed | No | None declared | — | No field-level unique declaration | — | {"validate":"value => value === \"PHP-centavos\""} |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"owner":1} | {} |
| {"customer":1} | {} |
| {"paymentStatus":1} | {} |
| {"orderStatus":1} | {} |
| {"ledgerRecorded":1} | {} |
| {"createdAt":1} | {} |
| {"owner":1,"customer":1,"createdAt":-1,"paymentStatus":1} | {} |
| {"owner":1,"createdAt":-1} | {} |
| {"storeId":1,"createdAt":-1} | {} |
| {"bookstoreReference":1} | {"unique":true,"sparse":true} |


`storeId` and its validator/index are added by [backend/models/resourceAttribution.js:20](../../backend/models/resourceAttribution.js#L20). `moneyUnit` is added to Product, Transaction, Invoice, and DebtPayment, not Customer.

### users — `User`

Authentication accounts, business roles, security versions, and explicit store memberships. [backend/models/User.js:104](../../backend/models/User.js#L104)

Schema options: `{"strict":true,"timestamps":true,"versionKey":"__v","minimize":true}`. Virtuals (not columns): `id`.

| Field | Type | Required | Default | Enum | Unique | Mongoose ref model | Other declared rules/setters |
|---|---|---|---|---|---|---|---|
| identifier | String | Yes | None declared | — | Yes (declared index) | — | — |
| password | String | Yes | None declared | — | No field-level unique declaration | — | — |
| role | String | Yes | function defaultNewAccountRole() { return this.isNew ? "user" : undefined; } | ["admin","store_manager","cashier","customer","user"] | No field-level unique declaration | — | — |
| name | String | No | None declared | — | No field-level unique declaration | — | — |
| phone | String | No | None declared | — | Yes (declared index) | — | — |
| address | String | No | None declared | — | No field-level unique declaration | — | — |
| storeIds | Mixed | No | None declared | — | No field-level unique declaration | — | {"validate":"function isStoredMemberships(value) {\n  if (!Array.isArray(value)) return false;\n  const ids = new Set();\n  for (let index = 0; index < value.length; index++) {\n    if (!Object.hasOwn(value, index) &#124;&#124; !isStoredResourceId(value[index])) return false;\n    const id = value[index].toHexString();\n    if (ids.has(id)) return false;\n    ids.add(id);\n  }\n  return true;\n}"} |
| confirmed | Mixed | No | function newConfirmationState() { return this.isNew ? false : undefined; } | — | No field-level unique declaration | — | {"validate":"value => typeof value === \"boolean\""} |
| accountState | Mixed | No | function newAccountState() { return this.isNew ? "active" : undefined; } | — | No field-level unique declaration | — | {"validate":"value => [\"active\", \"suspended\"].includes(value)"} |
| authorityVersion | Mixed | No | None declared | — | No field-level unique declaration | — | {"validate":{"validator":"function isTokenVersion(value) {\n  return Number.isSafeInteger(value) && value >= 0;\n}","message":"Invalid account authority version"}} |
| tokenVersion | Mixed | No | None declared | — | No field-level unique declaration | — | {"validate":{"validator":"function isTokenVersion(value) {\n  return Number.isSafeInteger(value) && value >= 0;\n}","message":"Invalid account security version"}} |
| _id | ObjectId | No | Generated ObjectId (Mongoose) | — | No field-level unique declaration | — | — |
| createdAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | {"immutable":true} |
| updatedAt | Date | No | No declared default; timestamp middleware | — | No field-level unique declaration | — | — |
| __v | Number | No | 0 (Mongoose version key) | — | No field-level unique declaration | — | — |


| Index keys (order retained) | Options |
|---|---|
| {"identifier":1} | {"unique":true} |
| {"phone":1} | {"unique":true,"sparse":true} |


## 5. Database Relationships

Cardinalities describe stored identifiers and verified writer behavior, not referential enforcement. MongoDB does not automatically ensure target existence, ownership equality, or cascade deletion. `required` ensures a value only when applicable Mongoose validation runs. Declared unique indexes limit duplicate identifier values only if deployed. All target fields below are `_id` unless explicitly stated.

| Source collection | Source field | Referenced collection | Referenced field | Relationship/cardinality | Representation | Evidence |
|---|---|---|---|---|---|---|
| accountauditevents | subjectAccountId | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/AccountControl.js:66](../../backend/models/AccountControl.js#L66) |
| accountoperationreceipts | actorId | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/AccountControl.js:69](../../backend/models/AccountControl.js#L69) |
| accountoperationreceipts | targetId | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/AccountControl.js:69](../../backend/models/AccountControl.js#L69) |
| accountrolereviews | targetAccountId | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/AccountControl.js:68](../../backend/models/AccountControl.js#L68) |
| accountrolereviews | reviewerId | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/AccountControl.js:68](../../backend/models/AccountControl.js#L68) |
| conditionalaccountgrants | recipientAccountId | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/AccountControl.js:67](../../backend/models/AccountControl.js#L67) |
| conditionalaccountgrants | grantedBy | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/AccountControl.js:67](../../backend/models/AccountControl.js#L67) |
| customers | owner | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/Person.js:51](../../backend/models/Person.js#L51) |
| debtpayments | owner | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/DebtPayment.js:56](../../backend/models/DebtPayment.js#L56) |
| debtpayments | customer | customers | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/DebtPayment.js:56](../../backend/models/DebtPayment.js#L56) |
| debtpayments | transaction | transactions | _id | Many source documents → zero/one target | ObjectId with Mongoose ref | [backend/models/DebtPayment.js:56](../../backend/models/DebtPayment.js#L56) |
| expenses | userId | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/Expense.js:19](../../backend/models/Expense.js#L19) |
| expenses | createdBy | users | _id | Many source documents → zero/one target | ObjectId with Mongoose ref | [backend/models/Expense.js:19](../../backend/models/Expense.js#L19) |
| financials | userId | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/Financial.js:19](../../backend/models/Financial.js#L19) |
| invoices | owner | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/Invoice.js:58](../../backend/models/Invoice.js#L58) |
| invoices | customer | customers | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/Invoice.js:58](../../backend/models/Invoice.js#L58) |
| invoices | transaction | transactions | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/Invoice.js:58](../../backend/models/Invoice.js#L58) |
| invoicecounters | owner | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/InvoiceCounter.js:23](../../backend/models/InvoiceCounter.js#L23) |
| products | owner | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/Product.js:67](../../backend/models/Product.js#L67) |
| stores | createdBy | users | _id | Many source documents → zero/one target | ObjectId with Mongoose ref | [backend/models/Store.js:11](../../backend/models/Store.js#L11) |
| stores | orderCustomer | customers | _id | Many source documents → zero/one target | ObjectId with Mongoose ref | [backend/models/Store.js:11](../../backend/models/Store.js#L11) |
| transactions | owner | users | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/Order.js:169](../../backend/models/Order.js#L169) |
| transactions | customer | customers | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId with Mongoose ref | [backend/models/Order.js:169](../../backend/models/Order.js#L169) |
| transactions | items[].product | products | _id | Many source documents → one target (required identifier; target existence not schema-enforced) | ObjectId ref inside embedded array | [backend/models/Order.js:169](../../backend/models/Order.js#L169) |
| transactions | processedBy | users | _id | Many source documents → zero/one target | ObjectId with Mongoose ref | [backend/models/Order.js:169](../../backend/models/Order.js#L169) |
| transactions | studentUser | users | _id | Many source documents → zero/one target | ObjectId with Mongoose ref | [backend/models/Order.js:169](../../backend/models/Order.js#L169) |
| transactions | assignedTo | users | _id | Many source documents → zero/one target | ObjectId with Mongoose ref | [backend/models/Order.js:169](../../backend/models/Order.js#L169) |
| users | storeIds[] | stores | _id | Many-to-many; no join collection | Mixed array validated as BSON ObjectIds; no ref | [backend/services/accountManagement.js:233](../../backend/services/accountManagement.js#L233) |
| products | storeId | stores | _id | Many sources → zero/one Store; historical absence permitted | Mixed BSON ObjectId; no ref | [backend/services/bookstoreMapping.js:26](../../backend/services/bookstoreMapping.js#L26) |
| customers | storeId | stores | _id | Many sources → zero/one Store; historical absence permitted | Mixed BSON ObjectId; no ref | [backend/services/bookstoreMapping.js:26](../../backend/services/bookstoreMapping.js#L26) |
| transactions | storeId | stores | _id | Many sources → zero/one Store; historical absence permitted | Mixed BSON ObjectId; no ref | [backend/services/bookstoreMapping.js:26](../../backend/services/bookstoreMapping.js#L26) |
| invoices | storeId | stores | _id | Many sources → zero/one Store; historical absence permitted | Mixed BSON ObjectId; no ref | [backend/services/bookstoreMapping.js:26](../../backend/services/bookstoreMapping.js#L26) |
| debtpayments | storeId | stores | _id | Many sources → zero/one Store; historical absence permitted | Mixed BSON ObjectId; no ref | [backend/services/bookstoreMapping.js:26](../../backend/services/bookstoreMapping.js#L26) |
| bookstoreauditevents | storeId | stores | _id | Many sources → one Store by application convention | ObjectId without ref | [backend/services/bookstoreCommand.js:19](../../backend/services/bookstoreCommand.js#L19) |
| bookstoreoperationreceipts | storeId | stores | _id | Many sources → one Store by application convention | ObjectId without ref | [backend/services/bookstoreCommand.js:19](../../backend/services/bookstoreCommand.js#L19) |
| stockmovements | storeId | stores | _id | Many sources → one Store by application convention | ObjectId without ref | [backend/services/sizeInventory.js:38](../../backend/services/sizeInventory.js#L38) |
| bookstorepayments | storeId | stores | _id | Many sources → one Store by application convention | ObjectId without ref | [backend/services/bookstoreOrders.js:19](../../backend/services/bookstoreOrders.js#L19) |
| bookstorereversalrequests | storeId | stores | _id | Many sources → one Store by application convention | ObjectId without ref | [backend/services/bookstoreOrders.js:19](../../backend/services/bookstoreOrders.js#L19) |
| bookstoresalereversals | storeId | stores | _id | Many sources → one Store by application convention | ObjectId without ref | [backend/services/bookstoreOrders.js:19](../../backend/services/bookstoreOrders.js#L19) |
| guestorderintents | storeId | stores | _id | Many sources → one Store by application convention | ObjectId without ref | [backend/services/guestOrders.js:35](../../backend/services/guestOrders.js#L35) |
| bookstoresequences | storeId | stores | _id | Many sources → one Store by application convention | ObjectId without ref | [backend/services/bookstoreOrders.js:19](../../backend/services/bookstoreOrders.js#L19) |
| bookstoreauditevents | actorId | users | _id | Many → one account; optional for guest actor / not-yet-approved request / uncancelled order | ObjectId without ref | [backend/services/bookstoreCommand.js:23](../../backend/services/bookstoreCommand.js#L23) |
| stockmovements | actorId | users | _id | Many → one account; optional for guest actor / not-yet-approved request / uncancelled order | ObjectId without ref | [backend/services/sizeInventory.js:32](../../backend/services/sizeInventory.js#L32) |
| bookstorepayments | actorId | users | _id | Many → one account; optional for guest actor / not-yet-approved request / uncancelled order | ObjectId without ref | [backend/services/bookstoreOrders.js:74](../../backend/services/bookstoreOrders.js#L74) |
| bookstorereversalrequests | requestedBy | users | _id | Many → one account; optional for guest actor / not-yet-approved request / uncancelled order | ObjectId without ref | [backend/services/bookstoreOrders.js:184](../../backend/services/bookstoreOrders.js#L184) |
| bookstorereversalrequests | approvedBy | users | _id | Many → one account; optional for guest actor / not-yet-approved request / uncancelled order | ObjectId without ref | [backend/services/bookstoreOrders.js:244](../../backend/services/bookstoreOrders.js#L244) |
| bookstoresalereversals | approvedBy | users | _id | Many → one account; optional for guest actor / not-yet-approved request / uncancelled order | ObjectId without ref | [backend/services/bookstoreOrders.js:244](../../backend/services/bookstoreOrders.js#L244) |
| transactions | cancelledBy | users | _id | Many → one account; optional for guest actor / not-yet-approved request / uncancelled order | ObjectId without ref | [backend/services/bookstoreOrders.js:170](../../backend/services/bookstoreOrders.js#L170) |
| stockmovements | transactionId | transactions | _id | Many movements → zero/one transaction | ObjectId without ref | [backend/services/sizeInventory.js:32](../../backend/services/sizeInventory.js#L32) |
| bookstorepayments | transactionId | transactions | _id | One transaction → zero/one payment; unique transactionId index declared | ObjectId without ref | [backend/services/bookstoreOrders.js:146](../../backend/services/bookstoreOrders.js#L146) |
| bookstorereversalrequests | transactionId | transactions | _id | One transaction → many requests; no unique transactionId | ObjectId without ref | [backend/services/bookstoreOrders.js:146](../../backend/services/bookstoreOrders.js#L146) |
| bookstoresalereversals | transactionId | transactions | _id | One transaction → zero/one reversal; unique transactionId index declared | ObjectId without ref | [backend/services/bookstoreOrders.js:146](../../backend/services/bookstoreOrders.js#L146) |
| bookstoresalereversals | requestId | bookstorereversalrequests | _id | Many → one by schema; service applies a request once; requestId is not unique | ObjectId without ref | [backend/services/bookstoreOrders.js:244](../../backend/services/bookstoreOrders.js#L244) |
| transactions | reversalId | bookstoresalereversals | _id | Many → zero/one by schema; one sale/invoice linkage in normal completion/reversal flow | ObjectId without ref | [backend/services/bookstoreOrders.js:245](../../backend/services/bookstoreOrders.js#L245) |
| invoices | reversalId | bookstoresalereversals | _id | Many → zero/one by schema; one sale/invoice linkage in normal completion/reversal flow | ObjectId without ref | [backend/services/bookstoreOrders.js:246](../../backend/services/bookstoreOrders.js#L246) |
| stockmovements | productId | products | _id | Many movements → one product | ObjectId without ref | [backend/services/sizeInventory.js:38](../../backend/services/sizeInventory.js#L38) |
| bookstoresalereversals | returned[].productId | products | _id | Many-to-many over embedded returned selections; no join collection | String identifier inside embedded Mixed row | [backend/services/bookstoreOrders.js:206](../../backend/services/bookstoreOrders.js#L206) |
| invoices | snapshot.items[].productId | products | _id | Many snapshots → many products; historical copy, not live price data | String identifier inside embedded Mixed receipt DTO | [backend/services/bookstoreOrders.js:53](../../backend/services/bookstoreOrders.js#L53) |
| guestorderintents | _id | transactions | _id | One intent → zero/one submitted guest transaction; non-guest transactions have no intent | Shared ObjectId identity; no ref | [backend/services/guestOrders.js:55](../../backend/services/guestOrders.js#L55) |
| accountauditevents | actor.id | users | _id | Many events → zero/one account actor; system-expiry has no account | ObjectId without ref | [backend/services/accountManagement.js:102](../../backend/services/accountManagement.js#L102) |
| accountauditevents | reviewId | accountrolereviews | _id | Many sources → zero/one target; historical links may outlive target account | ObjectId without ref | [backend/services/accountManagement.js:301](../../backend/services/accountManagement.js#L301) |
| accountauditevents | grantId | conditionalaccountgrants | _id | Many sources → zero/one target; historical links may outlive target account | ObjectId without ref | [backend/services/accountManagement.js:150](../../backend/services/accountManagement.js#L150) |
| conditionalaccountgrants | revokedBy | users | _id | Many sources → zero/one target; historical links may outlive target account | ObjectId without ref | [backend/services/accountManagement.js:147](../../backend/services/accountManagement.js#L147) |
| accountrolereviews | supersedes | accountrolereviews | _id | Many sources → zero/one target; historical links may outlive target account | ObjectId without ref | [backend/services/accountManagement.js:289](../../backend/services/accountManagement.js#L289) |
| accountauditevents | scope.accountId | users | _id | Many audit events → account context; capability events instead use grant scope | Application-generated identifier inside Mixed scope | [backend/services/accountManagement.js:104](../../backend/services/accountManagement.js#L104) |
| conditionalaccountgrants | scope.resourceIds[] (capability-dependent) | products | _id | Many-to-many bounded application scope; target type depends on capability | String IDs inside Mixed scope | [backend/services/accountManagement.js:336](../../backend/services/accountManagement.js#L336) |
| conditionalaccountgrants | scope.resourceIds[] (capability-dependent) | transactions | _id | Many-to-many bounded application scope; target type depends on capability | String IDs inside Mixed scope | [backend/services/accountManagement.js:336](../../backend/services/accountManagement.js#L336) |
| conditionalaccountgrants | scope.resourceIds[] (capability-dependent) | users | _id | Many-to-many bounded application scope; target type depends on capability | String IDs inside Mixed scope | [backend/services/accountManagement.js:332](../../backend/services/accountManagement.js#L332) |
| bookstoreauditevents | actorKey | users | _id | Many records → one actor identity by prefix; no ref | Discriminated string account:<id> or guest:<id> | [backend/services/bookstoreCommand.js:40](../../backend/services/bookstoreCommand.js#L40) |
| bookstoreoperationreceipts | actorKey | users | _id | Many records → one actor identity by prefix; no ref | Discriminated string account:<id> or guest:<id> | [backend/services/bookstoreCommand.js:40](../../backend/services/bookstoreCommand.js#L40) |
| bookstoreauditevents | actorKey | guestorderintents | _id | Many records → one actor identity by prefix; no ref | Discriminated string account:<id> or guest:<id> | [backend/services/guestOrders.js:49](../../backend/services/guestOrders.js#L49) |
| bookstoreoperationreceipts | actorKey | guestorderintents | _id | Many records → one actor identity by prefix; no ref | Discriminated string account:<id> or guest:<id> | [backend/services/guestOrders.js:49](../../backend/services/guestOrders.js#L49) |


Additional polymorphic event targets: `bookstoreauditevents.targetId` is resolved by `targetKind` and action: Store→stores; Product→products; Transaction→transactions; Invoice→invoices; GuestIntent→guestorderintents; Customer→customers; DebtPayment→debtpayments. **Reversal is ambiguous without action:** `reversal.requested` uses bookstorereversalrequests, while `reversal.applied` uses bookstoresalereversals. These discriminator strings are not model registrations or foreign keys. [backend/models/BookstoreControl.js:20](../../backend/models/BookstoreControl.js#L20); [backend/services/bookstoreOrders.js:185](../../backend/services/bookstoreOrders.js#L185); [backend/services/bookstoreOrders.js:248](../../backend/services/bookstoreOrders.js#L248)

Transactions↔Products is a verified many-to-many association through `transactions.items[].product`, embedded within each transaction. It is not a separate line-item collection. Invoice→Transaction is many-to-one at schema level (multiple invoices allowed per transaction); service lookup/issuance intends one invoice per sale, without a unique index. Store→orderCustomer is a single reference, but no unique constraint prevents different stores from selecting the same Customer. There is no verified automatic User↔Customer identity mapping: bookstore orders use `Store.orderCustomer`; authenticated students are recorded separately in `Transaction.studentUser`.

`operationId` correlates audit rows, operation receipts, stock movements, grants, reviews, payments, and reversals by command context. It is a string, not an ObjectId ref. Bookstore audit↔receipt correlation uses `(actorKey, operationId)`, and account audit↔receipt uses `operationId`; not every audit event has a corresponding receipt (e.g. intent issuance/expiry materialization). DTO result/snapshot IDs are copies and are not additional collections.

## 6. Embedded Documents

| Parent collection | Embedded path | Internal structure | Purpose/validation | References | Evidence |
|---|---|---|---|---|---|
| transactions | items[] | product, quantity, unitPrice, name, sku, category, size, subtotal | Sold/order product and price snapshots; _id:false | items[].product → Product ref | [backend/models/Order.js:8](../../backend/models/Order.js#L8) |
| financials | expenses[] | _id, type, amount, date | Independent legacy expense subdocuments; automatic child _id | None; not references to expenses | [backend/models/Financial.js:4](../../backend/models/Financial.js#L4) |
| stockmovements | sizeChanges[] | size, before, after, delta | Size-level delta ledger; _id:false; optional undefined | None; labels link to product sizeStocks by convention | [backend/models/BookstoreControl.js:49](../../backend/models/BookstoreControl.js#L49) |
| accountauditevents | actor | id, role, kind | Plain nested object, no child _id | actor.id → User in account service, no ref | [backend/models/AccountControl.js:13](../../backend/models/AccountControl.js#L13) |
| stores | categoryNames[] | String elements | Category labels, not independent entities | Product.category matches label in application | [backend/services/categoryService.js:13](../../backend/services/categoryService.js#L13) |
| accountrolereviews | evidenceRefs[] | String elements | Sanitized independent review evidence references | Not database ref values | [backend/models/AccountControl.js:53](../../backend/models/AccountControl.js#L53) |
| users | storeIds | Mixed expected as ObjectId[] | Validated membership list | Store IDs; no Mongoose ref | [backend/models/resourceAttribution.js:8](../../backend/models/resourceAttribution.js#L8) |
| products | sizeStocks | Supported size keys XS,S,M,L,XL,2XL,3XL,4XL → nonnegative safe integers | Mixed nonempty size map; sum equals stock when present | No collection reference | [backend/utils/clothingSizes.js:7](../../backend/utils/clothingSizes.js#L7) |
| invoices | snapshot | orderId, reference, orderStatus, total, moneyUnit, items[], assignedTo, invoiceNumber, issuedAt, paymentMethod, paymentReference, cashierId | Mixed receipt DTO; item fields productId, optional size, name, sku, quantity, unitPrice, subtotal | String order/product/cashier IDs inside copy | [backend/services/bookstoreOrders.js:153](../../backend/services/bookstoreOrders.js#L153) |
| bookstoresalereversals | returned[] | productId (String), quantity (Number), optional size (String) | Array<Mixed>; service restricts selections to sold quantities/product/size; empty list allowed | Product ID strings, no ref | [backend/services/bookstoreOrders.js:206](../../backend/services/bookstoreOrders.js#L206) |
| guestorderintents | verification | digest (String), issuedAt (Date), expiresAt (Date) | Mixed verifier, select:false; no stored raw credential; seven-day lifetime checked by code | Identity tied to parent intent ID by digest construction | [backend/auth/guestOrderAccess.js:21](../../backend/auth/guestOrderAccess.js#L21) |
| conditionalaccountgrants | scope | kind, resourceIds[] | Mixed; grant service requires exact shape and 1–100 unique bounded IDs | User/Product/Transaction depending on capability | [backend/services/accountManagement.js:327](../../backend/services/accountManagement.js#L327) |
| accountauditevents | before, after, scope | Open Mixed projections; ordinary scope kind=account-realm/accountId; grant events use grant scope | Account state snapshots and authority context; no fixed nested schema | May include account/grant/review identifiers | [backend/services/accountManagement.js:98](../../backend/services/accountManagement.js#L98) |
| bookstoreauditevents | before, after | Open Mixed; command-specific state snapshots, e.g. stock, lifecycle, returned[], deleted, visibleInQueue | Operational projection rejects protected keys/nonplain objects and sanitizes text | Target-dependent copied IDs only | [backend/auth/operationalProjection.js:5](../../backend/auth/operationalProjection.js#L5) |
| accountoperationreceipts, bookstoreoperationreceipts | result | Open Mixed; command-specific response DTO | Idempotent replay response, not a stable universally defined sub-schema | May contain account/order/invoice/product/grant/review/reversal IDs | [backend/services/bookstoreCommand.js:56](../../backend/services/bookstoreCommand.js#L56) |


Mixed values remain open in the schema. The shapes above document current writer behavior, not exhaustive schema restrictions on arbitrary historical data. Scalar Mixed fields (confirmed, accountState, versions, moneyUnit, storeId, revokedAt) are not independent embedded entities.

## 7. Database Constraints and Validation

### 7.1 Schema-declared rules

Section 4 preserves every declared required/default/enum/unique/index/min/max/length/selection/setter/custom-validator option. No max numeric validator is declared in these schemas. Important custom and middleware rules follow.

| Scope | Actual rule/limit | Evidence |
|---|---|---|
| User | isTokenVersion validates nonnegative safe integers; confirmed must be Boolean; accountState active/suspended; storeIds dense unique ObjectId array. Optional validators do not make missing fields required. New roles/confirmation/state defaults depend on isNew; new tokenVersion/authorityVersion are initialized to 0 by pre-validate, not field defaults. | [backend/models/User.js:48](../../backend/models/User.js#L48) |
| User | Pre-save rejects uncontrolled security/authority epoch changes, increments security epoch for password/role/confirmation/state/membership changes and authority epoch for authority changes, uses an expected epoch update condition, and hashes changed passwords. Post-save clears local tracking. Password validation is length >=6 characters and <=72 UTF-8 bytes; bcrypt cost 10. Query/raw writes do not automatically execute document save hooks. | [backend/models/User.js:55](../../backend/models/User.js#L55) |
| Product | When sizeStocks exists, validSizeStocks requires nonempty plain object of supported size keys and nonnegative safe integer values, safe sum, and sum == stock. Product schema alone only min-checks price/stock/costPrice, not safe-integer checks for each scalar. | [backend/models/Product.js:27](../../backend/models/Product.js#L27) |
| Transaction | Pre-validate normalizes item numbers, supplies missing subtotal (does not overwrite an existing one), sums subtotals, clamps paid amount, calculates balance, and derives paid/partial/debt for completed orders. It does not generally enforce subtotal == quantity*unitPrice for explicitly supplied subtotals. | [backend/models/Order.js:116](../../backend/models/Order.js#L116) |
| Transaction → Invoice | Post-save updates one invoice matching owner+transaction with mapped payment status or void. Does not create invoice, ensure invoice uniqueness, or synchronize all duplicate invoices. The hook is not triggered by arbitrary query updates. | [backend/models/Order.js:142](../../backend/models/Order.js#L142) |
| Resource attribution | storeId is optional Mixed validated as a canonical BSON ObjectId. moneyUnit is optional Mixed validated as PHP-centavos. Applied to Product, Customer, Transaction, Invoice, DebtPayment; moneyUnit excluded on Customer. Both are absent by default. | [backend/models/resourceAttribution.js:20](../../backend/models/resourceAttribution.js#L20) |
| Account audit | strict:throw, versionKey:false, unique eventId and (operationId,sequence), reason max length 1024, actor fields conditionally required, audit state/scope Mixed required. Append-only middleware rejects subsequent save and declared query update/delete/replace/bulkWrite operations. | [backend/models/AccountControl.js:27](../../backend/models/AccountControl.js#L27) |
| Conditional grant | Mixed epoch validators; revokedAt accepts null or finite Date with new-document-only null default; strict:throw; timestamps. No schema date-order validator, capability enum, scope shape validator, approvalRef required flag, or TTL declaration. | [backend/models/AccountControl.js:33](../../backend/models/AccountControl.js#L33) |
| Operational ledgers | BookstoreAudit, StockMovement, BookstoreReceipt, BookstorePayment and SaleReversal use appendOnly middleware. It covers listed Mongoose APIs, not raw driver writes or a server-side immutable collection policy. Requests, intents and sequences are mutable and do not use appendOnly. | [backend/models/BookstoreControl.js:64](../../backend/models/BookstoreControl.js#L64) |
| Bookstore audit | Pre-validate operationalProjection sanitizes before/after. minimize:false preserves empty objects. targetKind is an enum discriminator but has no target existence validator. | [backend/models/BookstoreControl.js:27](../../backend/models/BookstoreControl.js#L27) |
| Stock movement | Safe integer delta/before/after; before/after >=0. Pre-validate requires before+delta=after, delta!=0, size row equations/nonzero deltas, and sum(size deltas)=aggregate delta when sizeChanges is present. | [backend/models/BookstoreControl.js:58](../../backend/models/BookstoreControl.js#L58) |
| Operational payment/reversal/sequence | Payment and reversal amount >=0 and safe integer; cash/gcash enum. Each transactionId unique. Sequence seq >=1 and safe integer; (storeId,year) unique. year is required Number with no integer/range validator. | [backend/models/BookstoreControl.js:76](../../backend/models/BookstoreControl.js#L76) |
| Default strict mode | Most legacy schemas use Mongoose strict:true; control schemas and Store use strict:throw. Mixed payloads retain arbitrary internal keys unless their custom validator/writer constrains them. select:false is a query projection default, not encryption/access control. | [backend/models/Store.js:8](../../backend/models/Store.js#L8) |


### 7.2 Backend service and controller constraints

| Scope | Implemented rule | Evidence |
|---|---|---|
| Store membership and identity | Membership command validates canonical IDs, no duplicates, expected epoch, existing Store records, and changed membership; mutations revoke affected grants. Store creation makes a placeholder Customer and sets orderCustomer in the transaction; it does not silently assign memberships. | [backend/services/accountManagement.js:233](../../backend/services/accountManagement.js#L233) |
| Scope and referential checks | bookstoreCommand checks active/confirmed/current actor, explicit store membership, Store existence and capability/resource scope. Reads use bookstoreReadScope and mappedStoreFilter. These are request/service checks, not schema foreign keys. | [backend/services/bookstoreCommand.js:19](../../backend/services/bookstoreCommand.js#L19) |
| Pricing/cart | Requires nonempty dense cart, canonical product IDs, positive safe-integer quantities, existing active products in the same store, PHP-centavos marker, safe price/subtotal/total, selected clothing size/stock. Uses current stored prices, not client unit prices. | [backend/services/bookstoreOrders.js:21](../../backend/services/bookstoreOrders.js#L21) |
| Stock concurrency | Compare-and-update includes prior stock/sizeStocks with store identity; rejects invalid/noninteger/negative results and stale writes; records one movement per product/actor/operation. Same-total size redistribution is retained in audit but no aggregate StockMovement is created when delta=0. | [backend/services/sizeInventory.js:31](../../backend/services/sizeInventory.js#L31) |
| Sale completion | Requires pending/unrecorded assigned order, unarchived queue entry, confirmed full cash/GCash payment, GCash reference, matching quote digest/confirmed total; checks all in transaction; writes stock, order, invoice, payment, audit, operation receipt. No external payment verification service is called. | [backend/services/bookstoreOrders.js:129](../../backend/services/bookstoreOrders.js#L129) |
| Reversal | Requires fully paid completed unreversed sale, request in requested state, invoice linkage and authority; returned lines must match sold product/size and have positive safe-integer quantities <=sold quantities with no duplicates. Full repayment must use original method; GCash reference required. Only selected returned quantities restore stock. | [backend/services/bookstoreOrders.js:190](../../backend/services/bookstoreOrders.js#L190) |
| Idempotency | Account command: globally unique operationId receipt plus actor/target/fingerprint match. Bookstore command: unique (actorKey,operationId), matching private fingerprint required on replay; unique audit event positions and movement keys constrain duplicate effects. Conflict returns 409; commit uncertainty must not be treated as definite failure/replayed blindly. | [backend/services/accountManagement.js:76](../../backend/services/accountManagement.js#L76) |
| Transactions | accountTransaction uses snapshot read concern, majority write concern, primary preference, observed commit handling, and shared realm write-fence; deployed transaction/topology support not verified. | [backend/utils/accountTransaction.js:12](../../backend/utils/accountTransaction.js#L12) |
| Guest order identity | Public Store and creator checked, intent verifier loaded with select override and validated, receipt replay checked, existing Order with intent ID prevents second submission; transaction._id = intent._id. Credential expires after seven days in code, not TTL. | [backend/services/guestOrders.js:42](../../backend/services/guestOrders.js#L42) |
| Order reference collision | Sparse unique bookstoreReference index plus preflight lookup and bounded whole-command retry only for known duplicate-reference errors, excluding uncertain commits. | [backend/utils/orderReference.js:23](../../backend/utils/orderReference.js#L23) |
| Invoice numbering | Bookstore store/year sequence pair is unique; service skips already-used invoice numbers for that store. Legacy owner/type/year counter is not unique. Invoice invoiceNumber and transaction pairs have ordinary indexes only. | [backend/services/bookstoreOrders.js:116](../../backend/services/bookstoreOrders.js#L116) |
| Independent role/grant controls | Prevents self-review/self-grant, stale approvals, loss of last active Administrator; review evidence 1–20 bounded strings; grants 1–13 distinct capabilities, exact bounded scope of 1–100 unique IDs, explicit dates/approvalRef, effectiveAt<expiresAt, future expiry and version bindings. These exceed schema validation. | [backend/services/accountManagement.js:346](../../backend/services/accountManagement.js#L346) |
| Historical mapping | Internal preparation/apply functions require explicit bounded mapping manifest, digest snapshot, valid owner, existing related records in target/mapping scope, duplicate SKU/invoice checks, reviewed reference/count, and atomic store attribution; no automatic money conversion. Not invoked during audit. | [backend/services/bookstoreMapping.js:26](../../backend/services/bookstoreMapping.js#L26) |
| Product deletion/categories | Deletion blocked by order/invoice/movement/return/receipt history or remaining stock and unverified monetary units. Category service enforces names, case-insensitive create/rename duplicates, assigned-product replacement and size transition checks. These are application rules, not unique/category indexes. | [backend/services/productManagement.js:42](../../backend/services/productManagement.js#L42) |
| Customer/debt/legacy payment | Customer deletion blocked by outstanding debt then soft-deletes. Debt payment controller checks same owner/customer, balance, nondeleted customer, positive rounded amount and reference for GCash/bank. Customer-wide settlements update multiple transactions but store no per-transaction allocation array. Current route perimeter blocks legacy operational writes. | [backend/controllers/DebtPaymentController.js:15](../../backend/controllers/DebtPaymentController.js#L15) |
| Expense amount | Create controller requires positive amount, but update controller/schema do not repeat the positivity check. Current legacy perimeter restricts effectful access. No expense amount min schema rule. | [backend/controllers/ExpenseController.js:54](../../backend/controllers/ExpenseController.js#L54) |
| Legacy route boundary | Legacy user is read-only; admin writes outside /api/products rejected in requireLegacyOperationalAccess. Old order/debt/expense writer implementations still exist, but existence in a controller is not proof the routed write is currently reachable. | [backend/middleware/roleAdmission.js:5](../../backend/middleware/roleAdmission.js#L5) |


### 7.3 Constraints not present or not verified

No MongoDB server JSON-schema validator, automatic foreign-key checking, cascading delete, schema-level cross-store equality, unique product SKU/name, unique invoice number/transaction, unique legacy invoice-counter partition, unique reversal request per transaction, or TTL index is declared. No schema nonempty-array validator is declared for transaction items, returned rows, evidenceRefs, categoryNames, or sizeChanges. Optional `storeId`/`moneyUnit` allow historical absence. No unique Store.orderCustomer or SaleReversal.requestId index is declared. No application-wide uniqueness of payment/refund reference is enforced by inspected code. Append-only middleware and service constraints do not protect against bypass through raw database writes. The database was not queried to verify server validators/indexes.

## 8. Complete Data Dictionary

Every persisted schema path appears below; section 4 supplies enums, references, indexes and detailed validation. Defaults distinguish explicit defaults, Mongoose automatic behavior, and middleware-generated timestamps. Conditional required functions are included verbatim. Nested array children apply per existing row.

### accountadministrationrealms

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| accountadministrationrealms | _id | String | No | None declared | String document identifier; accountManagement uses account-management as its shared write-fence record. |
| accountadministrationrealms | revision | Number | Yes | None declared | Realm write-fence revision or role-review revision counter, depending on collection. |
| accountadministrationrealms | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### accountauditevents

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| accountauditevents | schemaVersion | Number | Yes | None declared | Account audit format version; enum restricts to 1. |
| accountauditevents | eventId | String | Yes | None declared | Unique account audit event identity. |
| accountauditevents | operationId | String | Yes | None declared | Command identity used for audit ordering, idempotency, or operation traceability; uniqueness varies by index. |
| accountauditevents | sequence | Number | Yes | None declared | Event sequence within an operation. |
| accountauditevents | actor.id | ObjectId | Conditional: function humanActorId() { return this.actor?.kind === "account"; } | None declared | Account actor ID; conditionally required for kind account; no ref metadata. |
| accountauditevents | actor.role | String | Conditional: function humanActorRole() { return this.actor?.kind === "account"; } | None declared | Role at time of account event; conditionally required for account actors. |
| accountauditevents | actor.kind | String | Yes | None declared | Account or system-expiry audit actor classification. |
| accountauditevents | subjectAccountId | ObjectId | Yes | None declared | Account whose state/permissions were audited; reference may survive account deletion. |
| accountauditevents | action | String | Yes | None declared | Recorded account or bookstore action from the declared enum. |
| accountauditevents | occurredAt | Date | Yes | None declared | Ledger event occurrence timestamp. |
| accountauditevents | reason | String | Yes | None declared | Required audit/operation justification; setters redact sensitive text. |
| accountauditevents | before | Mixed | Yes | None declared | Mixed previous-state projection, or numeric stock before movement. |
| accountauditevents | after | Mixed | Yes | None declared | Mixed next-state projection, or numeric stock after movement. |
| accountauditevents | scope | Mixed | Yes | None declared | Mixed bounded authority/audit context; its shape is validated or constructed in account services. |
| accountauditevents | approvalRef | String | No | None declared | Approval evidence reference; grant service requires it although grant schema does not. |
| accountauditevents | reviewId | ObjectId | No | None declared | Associated AccountRoleReview ID; application reference without ref metadata. |
| accountauditevents | grantId | ObjectId | No | None declared | Associated ConditionalAccountGrant ID; application reference without ref metadata. |
| accountauditevents | securityVersionBefore | Number | No | None declared | Account security epoch before administrative mutation. |
| accountauditevents | securityVersionAfter | Number | No | None declared | Account security epoch after administrative mutation. |
| accountauditevents | outcome | String | Yes | None declared | Applied account mutation or observed grant expiry. |
| accountauditevents | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |


### accountoperationreceipts

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| accountoperationreceipts | operationId | String | Yes | None declared | Command identity used for audit ordering, idempotency, or operation traceability; uniqueness varies by index. |
| accountoperationreceipts | actorId | ObjectId | Yes | None declared | Account command/payment/movement actor identifier; account audit counterpart is actor.id. |
| accountoperationreceipts | targetId | ObjectId | Yes | None declared | Account operation target, or polymorphic bookstore event target; meaning depends on collection/targetKind. |
| accountoperationreceipts | fingerprint | String | Yes | None declared | Private keyed command digest for operation replay/conflict checks; select:false. |
| accountoperationreceipts | result | Mixed | Yes | None declared | Mixed persisted command response DTO for replay/reconciliation; shape varies by command. |
| accountoperationreceipts | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| accountoperationreceipts | createdAt | Date | No | No declared default; timestamp middleware | Creation timestamp managed by Mongoose timestamps unless separately declared. |
| accountoperationreceipts | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| accountoperationreceipts | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### accountrolereviews

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| accountrolereviews | targetAccountId | ObjectId | Yes | None declared | Account under independent role review. |
| accountrolereviews | reviewerId | ObjectId | Yes | None declared | Account performing the role review. |
| accountrolereviews | status | String | Yes | None declared | Lifecycle/review state; allowed values appear in the structure table. |
| accountrolereviews | proposedRole | String | Yes | None declared | Proposed approved business role; excludes legacy user. |
| accountrolereviews | expectedVersion | Number | Yes | None declared | Expected target security epoch to detect stale review/application. |
| accountrolereviews | expectedRole | String | Yes | None declared | Target role snapshot checked when applying review. |
| accountrolereviews | reason | String | Yes | None declared | Required audit/operation justification; setters redact sensitive text. |
| accountrolereviews | evidenceRefs | Array<Mixed> | Yes | [] (Mongoose array default) | Embedded review-evidence reference strings, sanitized by setter. |
| accountrolereviews | revision | Number | Yes | None declared | Realm write-fence revision or role-review revision counter, depending on collection. |
| accountrolereviews | supersedes | ObjectId | No | None declared | Prior AccountRoleReview ID; application reference without ref metadata. |
| accountrolereviews | verifiedAuthorityVersion | Number | No | None declared | Authority epoch recorded on an applied independently verified administrator review. |
| accountrolereviews | operationId | String | Yes | None declared | Command identity used for audit ordering, idempotency, or operation traceability; uniqueness varies by index. |
| accountrolereviews | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| accountrolereviews | createdAt | Date | No | No declared default; timestamp middleware | Creation timestamp managed by Mongoose timestamps unless separately declared. |
| accountrolereviews | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| accountrolereviews | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### bookstoreauditevents

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| bookstoreauditevents | actorKey | String | Yes | None declared | Discriminated actor string account:<id> or guest:<intentId>; part of scoped operation identities. |
| bookstoreauditevents | operationId | String | Yes | None declared | Command identity used for audit ordering, idempotency, or operation traceability; uniqueness varies by index. |
| bookstoreauditevents | sequence | Number | Yes | None declared | Event sequence within an operation. |
| bookstoreauditevents | storeId | ObjectId | Yes | None declared | Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas. |
| bookstoreauditevents | actorId | ObjectId | Conditional: function accountActorRequired() { return this.actorKind === "account"; } | None declared | Account command/payment/movement actor identifier; account audit counterpart is actor.id. |
| bookstoreauditevents | actorKind | String | Yes | None declared | Bookstore audit actor classification account/guest. |
| bookstoreauditevents | action | String | Yes | None declared | Recorded account or bookstore action from the declared enum. |
| bookstoreauditevents | targetKind | String | Yes | None declared | Polymorphic target discriminator; Reversal names either request or applied reversal by action. |
| bookstoreauditevents | targetId | ObjectId | Yes | None declared | Account operation target, or polymorphic bookstore event target; meaning depends on collection/targetKind. |
| bookstoreauditevents | occurredAt | Date | Yes | None declared | Ledger event occurrence timestamp. |
| bookstoreauditevents | reason | String | Yes | None declared | Required audit/operation justification; setters redact sensitive text. |
| bookstoreauditevents | before | Mixed | Yes | None declared | Mixed previous-state projection, or numeric stock before movement. |
| bookstoreauditevents | after | Mixed | Yes | None declared | Mixed next-state projection, or numeric stock after movement. |
| bookstoreauditevents | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |


### bookstoreoperationreceipts

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| bookstoreoperationreceipts | actorKey | String | Yes | None declared | Discriminated actor string account:<id> or guest:<intentId>; part of scoped operation identities. |
| bookstoreoperationreceipts | operationId | String | Yes | None declared | Command identity used for audit ordering, idempotency, or operation traceability; uniqueness varies by index. |
| bookstoreoperationreceipts | capability | String | Yes | None declared | Capability name; validated against capability policy in grant service, not a schema enum. |
| bookstoreoperationreceipts | storeId | ObjectId | Yes | None declared | Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas. |
| bookstoreoperationreceipts | fingerprint | String | Yes | None declared | Private keyed command digest for operation replay/conflict checks; select:false. |
| bookstoreoperationreceipts | result | Mixed | Yes | None declared | Mixed persisted command response DTO for replay/reconciliation; shape varies by command. |
| bookstoreoperationreceipts | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| bookstoreoperationreceipts | createdAt | Date | No | No declared default; timestamp middleware | Creation timestamp managed by Mongoose timestamps unless separately declared. |
| bookstoreoperationreceipts | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| bookstoreoperationreceipts | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### bookstorepayments

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| bookstorepayments | storeId | ObjectId | Yes | None declared | Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas. |
| bookstorepayments | transactionId | ObjectId | Yes | None declared | Transaction identifier on an operational ledger/counterpart record; application reference without ref metadata. |
| bookstorepayments | actorId | ObjectId | Yes | None declared | Account command/payment/movement actor identifier; account audit counterpart is actor.id. |
| bookstorepayments | operationId | String | Yes | None declared | Command identity used for audit ordering, idempotency, or operation traceability; uniqueness varies by index. |
| bookstorepayments | amount | Number | Yes | None declared | Expense/payment/refund amount; integer PHP centavos enforced for operational ledgers. |
| bookstorepayments | method | String | Yes | None declared | Cash/GCash payment or repayment method. |
| bookstorepayments | reference | String | No | "" | Legacy order reference or operational payment/refund reference, depending on collection; no uniqueness declaration. |
| bookstorepayments | occurredAt | Date | Yes | None declared | Ledger event occurrence timestamp. |
| bookstorepayments | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |


### bookstorereversalrequests

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| bookstorereversalrequests | storeId | ObjectId | Yes | None declared | Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas. |
| bookstorereversalrequests | transactionId | ObjectId | Yes | None declared | Transaction identifier on an operational ledger/counterpart record; application reference without ref metadata. |
| bookstorereversalrequests | requestedBy | ObjectId | Yes | None declared | Account requesting reversal. |
| bookstorereversalrequests | reason | String | Yes | None declared | Required audit/operation justification; setters redact sensitive text. |
| bookstorereversalrequests | status | String | Yes | None declared | Lifecycle/review state; allowed values appear in the structure table. |
| bookstorereversalrequests | approvedBy | ObjectId | No | None declared | Account approving/applying reversal. |
| bookstorereversalrequests | appliedAt | Date | No | None declared | Reversal request application timestamp. |
| bookstorereversalrequests | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| bookstorereversalrequests | createdAt | Date | No | No declared default; timestamp middleware | Creation timestamp managed by Mongoose timestamps unless separately declared. |
| bookstorereversalrequests | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| bookstorereversalrequests | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### bookstoresalereversals

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| bookstoresalereversals | storeId | ObjectId | Yes | None declared | Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas. |
| bookstoresalereversals | transactionId | ObjectId | Yes | None declared | Transaction identifier on an operational ledger/counterpart record; application reference without ref metadata. |
| bookstoresalereversals | requestId | ObjectId | Yes | None declared | BookstoreReversalRequest identifier used for an applied sale reversal. |
| bookstoresalereversals | approvedBy | ObjectId | Yes | None declared | Account approving/applying reversal. |
| bookstoresalereversals | operationId | String | Yes | None declared | Command identity used for audit ordering, idempotency, or operation traceability; uniqueness varies by index. |
| bookstoresalereversals | amount | Number | Yes | None declared | Expense/payment/refund amount; integer PHP centavos enforced for operational ledgers. |
| bookstoresalereversals | method | String | Yes | None declared | Cash/GCash payment or repayment method. |
| bookstoresalereversals | reference | String | No | "" | Legacy order reference or operational payment/refund reference, depending on collection; no uniqueness declaration. |
| bookstoresalereversals | reason | String | Yes | None declared | Required audit/operation justification; setters redact sensitive text. |
| bookstoresalereversals | returned | Array<Mixed> | Yes | [] (Mongoose array default) | Embedded Mixed array of product/quantity/optional size selections actually returned to stock; empty array permitted by service. |
| bookstoresalereversals | occurredAt | Date | Yes | None declared | Ledger event occurrence timestamp. |
| bookstoresalereversals | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |


### bookstoresequences

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| bookstoresequences | storeId | ObjectId | Yes | None declared | Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas. |
| bookstoresequences | year | Number | Yes | None declared | Calendar year counter partition; bookstore receipt year uses Asia/Manila. |
| bookstoresequences | seq | Number | Yes | None declared | Current sequential counter value. |
| bookstoresequences | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| bookstoresequences | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### conditionalaccountgrants

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| conditionalaccountgrants | recipientAccountId | ObjectId | Yes | None declared | Account receiving a conditional permission. |
| conditionalaccountgrants | capability | String | Yes | None declared | Capability name; validated against capability policy in grant service, not a schema enum. |
| conditionalaccountgrants | scope | Mixed | Yes | None declared | Mixed bounded authority/audit context; its shape is validated or constructed in account services. |
| conditionalaccountgrants | grantedBy | ObjectId | Yes | None declared | Grantor account. |
| conditionalaccountgrants | reason | String | Yes | None declared | Required audit/operation justification; setters redact sensitive text. |
| conditionalaccountgrants | approvalRef | String | No | None declared | Approval evidence reference; grant service requires it although grant schema does not. |
| conditionalaccountgrants | effectiveAt | Date | Yes | None declared | Start of grant validity. |
| conditionalaccountgrants | expiresAt | Date | Yes | None declared | End of grant validity; no TTL index declared. |
| conditionalaccountgrants | recipientVersion | Mixed | Yes | None declared | Recipient security epoch to which the grant is bound. |
| conditionalaccountgrants | grantorAuthorityVersion | Mixed | Yes | None declared | Grantor authority epoch to which the grant is bound. |
| conditionalaccountgrants | revokedAt | Mixed | No | function newGrantRevocationState() { return this.isNew ? null : undefined; } | Mixed null-or-Date revocation state; default null only for new documents. |
| conditionalaccountgrants | revokedBy | ObjectId | No | None declared | Revoking account identifier; application reference without ref metadata. |
| conditionalaccountgrants | revocationReason | String | No | None declared | Why grant was revoked. |
| conditionalaccountgrants | expiredRecordedAt | Date | No | None declared | Timestamp when expiry was materialized into the audit ledger. |
| conditionalaccountgrants | operationId | String | Yes | None declared | Command identity used for audit ordering, idempotency, or operation traceability; uniqueness varies by index. |
| conditionalaccountgrants | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| conditionalaccountgrants | createdAt | Date | No | No declared default; timestamp middleware | Creation timestamp managed by Mongoose timestamps unless separately declared. |
| conditionalaccountgrants | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| conditionalaccountgrants | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### customers

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| customers | owner | ObjectId | Yes | None declared | Historical owner account; owner-scoped compatibility access. Not equivalent to store membership. |
| customers | name | String | Yes | None declared | Display name of the account, store, customer, product, or sold product snapshot. |
| customers | phone | String | No | "" | Contact phone; User has a sparse unique index, Customer does not. |
| customers | email | String | No | "" | Customer email text; not declared on User. |
| customers | address | String | No | "" | Contact postal/address text. |
| customers | isDeleted | Boolean | No | false | Customer soft-deletion flag. |
| customers | deletedAt | Date | No | None declared | Customer soft-deletion timestamp. |
| customers | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| customers | createdAt | Date | No | No declared default; timestamp middleware | Creation timestamp managed by Mongoose timestamps unless separately declared. |
| customers | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| customers | storeId | Mixed | No | None declared | Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas. |
| customers | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### debtpayments

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| debtpayments | owner | ObjectId | Yes | None declared | Historical owner account; owner-scoped compatibility access. Not equivalent to store membership. |
| debtpayments | customer | ObjectId | Yes | None declared | Customer/contact linked to the transaction, invoice, or payment. |
| debtpayments | transaction | ObjectId | No | None declared | Transaction ObjectId reference; optional on customer-wide DebtPayment records. |
| debtpayments | amountPaid | Number | Yes | None declared | Paid amount; transaction middleware clamps to [0,totalAmount]; DebtPayment records a settlement amount. |
| debtpayments | paymentMethod | String | No | cash | Payment method; broader legacy enum than bookstore payment ledger. |
| debtpayments | paymentReference | String | No | "" | External payment reference text; no uniqueness declaration. |
| debtpayments | paidAt | Date | No | function now() { [native code] } | Debt payment timestamp. |
| debtpayments | notes | String | No | "" | Free-text notes. |
| debtpayments | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| debtpayments | createdAt | Date | No | No declared default; timestamp middleware | Creation timestamp managed by Mongoose timestamps unless separately declared. |
| debtpayments | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| debtpayments | storeId | Mixed | No | None declared | Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas. |
| debtpayments | moneyUnit | Mixed | No | None declared | Explicit PHP-centavos monetary marker; absent historical values are not automatically converted. |
| debtpayments | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### expenses

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| expenses | userId | ObjectId | Yes | None declared | Owning account reference. |
| expenses | itemName | String | Yes | None declared | Expense item description. |
| expenses | amount | Number | Yes | None declared | Expense/payment/refund amount; integer PHP centavos enforced for operational ledgers. |
| expenses | category | String | No | misc | Product/category label or Expense category enum, as shown in the structure table. |
| expenses | note | String | No | None declared | Expense free-text note. |
| expenses | date | Date | No | function now() { [native code] } | Expense occurrence date. |
| expenses | createdBy | ObjectId | No | None declared | Creator account reference. |
| expenses | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| expenses | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### financials

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| financials | userId | ObjectId | Yes | None declared | Owning account reference. |
| financials | capitalInvested | Number | No | 0 | Declared capital amount in apparently unused Financial model; operational purpose requires verification. |
| financials | grossIncome | Number | No | 0 | Declared gross income in apparently unused Financial model; calculation/writer requires verification. |
| financials | netIncome | Number | No | 0 | Declared net income in apparently unused Financial model; calculation/writer requires verification. |
| financials | expenses | Array<EmbeddedDocument> | No | [] (Mongoose array default) | Embedded expense array in Financial; independent of expenses collection. |
| financials | expenses[].type | String | Yes | None declared | Embedded financial expense classification text. |
| financials | expenses[].amount | Number | Yes | None declared | Embedded financial expense amount. |
| financials | expenses[].date | Date | No | function now() { [native code] } | Embedded financial expense occurrence date. |
| financials | expenses[]._id | ObjectId | No | Generated ObjectId (Mongoose) | Mongoose-generated identifier of the embedded financial expense, not an independent collection identifier. |
| financials | notes | String | No | None declared | Free-text notes. |
| financials | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| financials | createdAt | Date | No | No declared default; timestamp middleware | Creation timestamp managed by Mongoose timestamps unless separately declared. |
| financials | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| financials | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### guestorderintents

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| guestorderintents | storeId | ObjectId | Yes | None declared | Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas. |
| guestorderintents | verification | Mixed | Yes | None declared | Private Mixed guest verifier object; digest/issuedAt/expiresAt constructed and checked in guestOrderAccess. |
| guestorderintents | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| guestorderintents | createdAt | Date | No | No declared default; timestamp middleware | Creation timestamp managed by Mongoose timestamps unless separately declared. |
| guestorderintents | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| guestorderintents | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### invoices

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| invoices | owner | ObjectId | Yes | None declared | Historical owner account; owner-scoped compatibility access. Not equivalent to store membership. |
| invoices | customer | ObjectId | Yes | None declared | Customer/contact linked to the transaction, invoice, or payment. |
| invoices | transaction | ObjectId | Yes | None declared | Transaction ObjectId reference; optional on customer-wide DebtPayment records. |
| invoices | invoiceNumber | String | Yes | None declared | Human-readable invoice/receipt number; no unique schema index. |
| invoices | issuedAt | Date | No | function now() { [native code] } | Invoice issuance timestamp. |
| invoices | dueDate | Date | No | None declared | Optional invoice due date; legacy creation sets seven days ahead for debt or null for paid sales. |
| invoices | status | String | No | unpaid | Lifecycle/review state; allowed values appear in the structure table. |
| invoices | notes | String | No | "" | Free-text notes. |
| invoices | snapshot | Mixed | No | None declared | Mixed embedded receipt DTO produced at bookstore completion; no nested schema enforcement. |
| invoices | reversalId | ObjectId | No | None declared | Applied BookstoreSaleReversal identifier; application reference without ref metadata. |
| invoices | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| invoices | createdAt | Date | No | No declared default; timestamp middleware | Creation timestamp managed by Mongoose timestamps unless separately declared. |
| invoices | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| invoices | storeId | Mixed | No | None declared | Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas. |
| invoices | moneyUnit | Mixed | No | None declared | Explicit PHP-centavos monetary marker; absent historical values are not automatically converted. |
| invoices | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### invoicecounters

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| invoicecounters | owner | ObjectId | Yes | None declared | Historical owner account; owner-scoped compatibility access. Not equivalent to store membership. |
| invoicecounters | type | String | Yes | invoice | Invoice counter namespace, or embedded legacy financial expense type. |
| invoicecounters | year | Number | Yes | None declared | Calendar year counter partition; bookstore receipt year uses Asia/Manila. |
| invoicecounters | seq | Number | No | 0 | Current sequential counter value. |
| invoicecounters | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| invoicecounters | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### products

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| products | owner | ObjectId | Yes | None declared | Historical owner account; owner-scoped compatibility access. Not equivalent to store membership. |
| products | name | String | Yes | None declared | Display name of the account, store, customer, product, or sold product snapshot. |
| products | sku | String | No | "" | Product stock-keeping code; neither schema nor normal catalog command declares uniqueness. |
| products | price | Number | Yes | None declared | Product sale price; bookstore services require integer PHP centavos. |
| products | stock | Number | No | 0 | Aggregate available quantity; bookstore service enforces safe integers and stock consistency. |
| products | sizeStocks | Mixed | No | undefined (explicit) | Mixed embedded size-to-quantity object, validated against supported clothing sizes and aggregate stock. |
| products | category | String | No | General | Product/category label or Expense category enum, as shown in the structure table. |
| products | isActive | Boolean | No | true | Catalog availability/archive flag. |
| products | imageUrl | String | No | undefined (explicit) | Optional product photo; creation service validates data URL/image contents. |
| products | costPrice | Number | No | 0 | Declared product cost with min 0; no dedicated operational writer found; excluded from staff sale projection. |
| products | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| products | createdAt | Date | No | No declared default; timestamp middleware | Creation timestamp managed by Mongoose timestamps unless separately declared. |
| products | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| products | storeId | Mixed | No | None declared | Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas. |
| products | moneyUnit | Mixed | No | None declared | Explicit PHP-centavos monetary marker; absent historical values are not automatically converted. |
| products | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### stockmovements

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| stockmovements | storeId | ObjectId | Yes | None declared | Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas. |
| stockmovements | productId | ObjectId | Yes | None declared | Product identifier on stock movement; application reference without ref metadata. |
| stockmovements | actorId | ObjectId | Yes | None declared | Account command/payment/movement actor identifier; account audit counterpart is actor.id. |
| stockmovements | operationId | String | Yes | None declared | Command identity used for audit ordering, idempotency, or operation traceability; uniqueness varies by index. |
| stockmovements | delta | Number | Yes | None declared | Signed, nonzero stock quantity change. |
| stockmovements | before | Number | Yes | None declared | Mixed previous-state projection, or numeric stock before movement. |
| stockmovements | after | Number | Yes | None declared | Mixed next-state projection, or numeric stock after movement. |
| stockmovements | reason | String | Yes | None declared | Required audit/operation justification; setters redact sensitive text. |
| stockmovements | source | String | Yes | None declared | Movement origin adjustment/sale/return. |
| stockmovements | occurredAt | Date | Yes | None declared | Ledger event occurrence timestamp. |
| stockmovements | transactionId | ObjectId | No | None declared | Transaction identifier on an operational ledger/counterpart record; application reference without ref metadata. |
| stockmovements | sizeChanges | Array<EmbeddedDocument> | No | undefined (explicit) | Embedded size-level before/after/delta rows, with no embedded _id. |
| stockmovements | sizeChanges[].size | String | Yes | None declared | Affected clothing size. |
| stockmovements | sizeChanges[].before | Number | Yes | None declared | Quantity for this size before movement. |
| stockmovements | sizeChanges[].after | Number | Yes | None declared | Quantity for this size after movement. |
| stockmovements | sizeChanges[].delta | Number | Yes | None declared | Signed nonzero change for this size. |
| stockmovements | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |


### stores

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| stores | name | String | Yes | None declared | Display name of the account, store, customer, product, or sold product snapshot. |
| stores | categoryNames | Array<Mixed> | No | undefined (explicit) | Embedded list of category labels; not a Category collection. |
| stores | createdBy | ObjectId | No | None declared | Creator account reference. |
| stores | orderCustomer | ObjectId | No | None declared | Placeholder Customer used for guest/student/POS bookstore order compatibility. |
| stores | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| stores | createdAt | Date | No | No declared default; timestamp middleware | Creation timestamp managed by Mongoose timestamps unless separately declared. |
| stores | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| stores | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### transactions

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| transactions | owner | ObjectId | Yes | None declared | Historical owner account; owner-scoped compatibility access. Not equivalent to store membership. |
| transactions | customer | ObjectId | Yes | None declared | Customer/contact linked to the transaction, invoice, or payment. |
| transactions | items | Array<EmbeddedDocument> | No | [] (Mongoose array default) | Embedded sale/order lines; not a separate collection. Item snapshots retain names/prices at sale. |
| transactions | items[].product | ObjectId | Yes | None declared | Product ObjectId reference inside an embedded item. |
| transactions | items[].quantity | Number | Yes | None declared | Number of units ordered/sold; schema min 1, bookstore commands require positive safe integer. |
| transactions | items[].unitPrice | Number | Yes | None declared | Per-unit selling price snapshot. |
| transactions | items[].name | String | No | None declared | Product name snapshot. |
| transactions | items[].sku | String | No | None declared | Product SKU snapshot. |
| transactions | items[].category | String | No | None declared | Product category snapshot. |
| transactions | items[].size | String | No | undefined (explicit) | Selected clothing size, when applicable. |
| transactions | items[].subtotal | Number | Yes | None declared | Line subtotal; services calculate quantity × unitPrice. Schema hook preserves an already supplied subtotal. |
| transactions | totalAmount | Number | Yes | None declared | Sum of embedded item subtotals, recomputed in transaction pre-validation. |
| transactions | amountPaid | Number | No | 0 | Paid amount; transaction middleware clamps to [0,totalAmount]; DebtPayment records a settlement amount. |
| transactions | balance | Number | No | 0 | Remaining transaction balance recomputed from totalAmount minus amountPaid. |
| transactions | paymentStatus | String | No | debt | Transaction paid/partial/debt/unpaid classification; derived for completed transactions. |
| transactions | paymentMethod | String | No | cash | Payment method; broader legacy enum than bookstore payment ledger. |
| transactions | paymentReference | String | No | "" | External payment reference text; no uniqueness declaration. |
| transactions | customerType | String | No | customer | Legacy customer/channel classification; bookstore origin is stored separately. |
| transactions | reference | String | No | "" | Legacy order reference or operational payment/refund reference, depending on collection; no uniqueness declaration. |
| transactions | orderStatus | String | No | completed | Pending/completed/void/cancelled lifecycle; reversal does not introduce a reversed enum value. |
| transactions | ledgerRecorded | Boolean | No | false | Flag indicating completion effects were applied; used with lifecycle eligibility checks. |
| transactions | completedAt | Date | No | None declared | Sale completion timestamp. |
| transactions | processedBy | ObjectId | No | None declared | Account that completed the sale. |
| transactions | origin | String | No | None declared | Order channel guest/student/pos; missing indicates legacy order. |
| transactions | directPayment | Boolean | No | undefined (explicit) | Cashier direct-checkout marker; absent on other/historical orders. |
| transactions | studentUser | ObjectId | No | None declared | Authenticated customer/student account linkage; excluded from ordinary query selection. |
| transactions | assignedTo | ObjectId | No | None declared | Account assigned to fulfill/process a pending order. |
| transactions | bookstoreReference | String | No | None declared | Generated public UPH-XXXX-XXXX order reference; sparse unique index declared. |
| transactions | cancelledAt | Date | No | None declared | Pending-order cancellation timestamp. |
| transactions | cancelledBy | ObjectId | No | None declared | Account that cancelled the pending order; application reference without ref metadata. |
| transactions | cancellationReason | String | No | None declared | Pending-order cancellation reason. |
| transactions | reversalId | ObjectId | No | None declared | Applied BookstoreSaleReversal identifier; application reference without ref metadata. |
| transactions | reversedAt | Date | No | None declared | Timestamp when the sale reversal was applied. |
| transactions | notes | String | No | "" | Free-text notes. |
| transactions | voidedAt | Date | No | None declared | Legacy void timestamp read by filters and invoice synchronization; no current writer found. |
| transactions | voidReason | String | No | None declared | Legacy void reason; no current writer found. |
| transactions | createdAt | Date | No | function now() { [native code] } | Explicit indexed creation date with Date.now default; timestamp option only manages updatedAt. |
| transactions | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| transactions | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| transactions | storeId | Mixed | No | None declared | Bookstore attribution. Mixed on legacy-compatible resource schemas; ObjectId on operational schemas. |
| transactions | moneyUnit | Mixed | No | None declared | Explicit PHP-centavos monetary marker; absent historical values are not automatically converted. |
| transactions | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### users

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| users | identifier | String | Yes | None declared | Account login identifier; lowercased by account commands/login, unique index declared. |
| users | password | String | Yes | None declared | Password hash persisted by save middleware after password validation and bcrypt hashing; no values included in this audit. |
| users | role | String | Yes | function defaultNewAccountRole() { return this.isNew ? "user" : undefined; } | Stored account role; user denotes a legacy unassigned account. |
| users | name | String | No | None declared | Display name of the account, store, customer, product, or sold product snapshot. |
| users | phone | String | No | None declared | Contact phone; User has a sparse unique index, Customer does not. |
| users | address | String | No | None declared | Contact postal/address text. |
| users | storeIds | Mixed | No | None declared | Mixed value validated as a dense, duplicate-free BSON ObjectId array of explicit store memberships. |
| users | confirmed | Mixed | No | function newConfirmationState() { return this.isNew ? false : undefined; } | Account confirmation flag, validated as Boolean without casting. |
| users | accountState | Mixed | No | function newAccountState() { return this.isNew ? "active" : undefined; } | Account active/suspended state retained as Mixed to reject malformed persisted values. |
| users | authorityVersion | Mixed | No | None declared | Nonnegative safe-integer authority epoch advanced on authority changes. |
| users | tokenVersion | Mixed | No | None declared | Nonnegative safe-integer authentication/security epoch advanced on security changes. |
| users | _id | ObjectId | No | Generated ObjectId (Mongoose) | Primary document identifier; generated ObjectId unless an explicit type/value is supplied. |
| users | createdAt | Date | No | No declared default; timestamp middleware | Creation timestamp managed by Mongoose timestamps unless separately declared. |
| users | updatedAt | Date | No | No declared default; timestamp middleware | Last update timestamp managed by Mongoose timestamps. |
| users | __v | Number | No | 0 (Mongoose version key) | Mongoose version key; application also increments User.__v as an account write fence. Not a general optimistic-lock guarantee. |


### Embedded containers and usage-defined Mixed subpaths

These rows are **not additional declared schema paths**. They document current constructors/validators described in section 6. `*` denotes open content, not a Mongoose wildcard field. This distinction avoids inventing a closed schema for Mixed payloads.

| Collection | Field Name | Data Type | Required | Default | Description |
|---|---|---|---|---|---|
| accountauditevents | actor | Object (plain nested container) | Container has no own required rule | None | Contains schema-defined actor.id, actor.role, actor.kind. Child fields listed above. |
| users | storeIds[] | ObjectId inside Mixed | Not a separate schema path | None | Each membership value; validated as unique BSON ObjectId; Store existence checked in membership command. |
| products | sizeStocks.<size> | Number inside Mixed | Not a separate schema path | None | Supported keys XS,S,M,L,XL,2XL,3XL,4XL; each provided value is a nonnegative safe integer. Not all keys required. |
| invoices | snapshot.orderId / snapshot.cashierId | String inside Mixed | Not schema-declared | None | Identifiers copied by sale completion. |
| invoices | snapshot.reference / snapshot.orderStatus / snapshot.moneyUnit / snapshot.invoiceNumber | String inside Mixed | Not schema-declared | None | Public order reference, lifecycle, monetary marker and issued receipt number captured by writer. |
| invoices | snapshot.total | Number inside Mixed | Not schema-declared | None | Sale total in PHP centavos at issuance. |
| invoices | snapshot.items[] | Array<Object> inside Mixed | Not schema-declared | None | Receipt item snapshots, no registered line-item model. |
| invoices | snapshot.items[].productId / name / sku | String inside Mixed | Not schema-declared | None | Product ID and text snapshots; an unknown/missing name/SKU is represented by empty string by itemDto. |
| invoices | snapshot.items[].size | String inside Mixed | Not schema-declared | None | Present only for sized sale lines. |
| invoices | snapshot.items[].quantity / unitPrice / subtotal | Number inside Mixed | Not schema-declared | None | Quantity and monetary values copied from sale lines. |
| invoices | snapshot.assignedTo | String or null inside Mixed | Not schema-declared | None | Assigned cashier identifier copied by orderDto. |
| invoices | snapshot.issuedAt | String (ISO date) inside Mixed | Not schema-declared | None | Completion timestamp converted with toISOString. |
| invoices | snapshot.paymentMethod / snapshot.paymentReference | String inside Mixed | Not schema-declared | None | Original payment method/reference snapshot. |
| bookstoresalereversals | returned[].productId | String inside Mixed row | Service requires, not child schema | None | Sold Product ID validated by reversal assessment. |
| bookstoresalereversals | returned[].quantity | Number inside Mixed row | Service requires, not child schema | None | Positive safe-integer units restored, <= sold units for product/size. |
| bookstoresalereversals | returned[].size | String inside Mixed row | Optional | None | Copied size when supplied; must match exact sold line. |
| guestorderintents | verification.digest | String inside Mixed | Verifier function expects, not child schema | None | SHA-256 verifier format; no actual digest/credential values included. |
| guestorderintents | verification.issuedAt / verification.expiresAt | Date inside Mixed | Verifier function expects, not child schema | None | Issue and expiry dates with exact seven-day span checked by verifier. |
| conditionalaccountgrants | scope.kind | String inside Mixed | Grant service requires, not child schema | None | Capability scope kind matching policy. |
| conditionalaccountgrants | scope.resourceIds[] | String inside Mixed array | Grant service requires 1–100, not child schema | None | Canonical target ID strings; no duplicate resource IDs; bounded to recipient authority. |
| accountauditevents | scope.kind / scope.accountId | String or ObjectId-compatible identifier in Mixed | Constructed by ordinary account command | None | Ordinary account-realm scope; grant-related audit entries can instead use capability scope. |
| accountauditevents, bookstoreauditevents | before.*, after.* | Mixed open object paths | No fixed child schema | None | Command-dependent state copies. Examples include role/confirmed/accountState/version, stock/lifecycle, returned and queue visibility. No universally exhaustive child-field inventory exists. |
| accountoperationreceipts, bookstoreoperationreceipts | result.* | Mixed open response DTO paths | No fixed child schema | None | Command-dependent result including operationId and optional IDs/account/order/receipt/payment fields. Defined response shapes vary; schema permits arbitrary content. |


## 9. Entity Relationship Diagram

Mermaid source: [database-erd.mmd](database-erd.mmd). All 23 code-defined collection mappings are included, with financials labeled as not loaded. Mermaid ER entity attributes do not support full nested boxes; embedded paths are explicitly labeled within their parent collection and never drawn as independent entities. The diagram is an overview of important links; section 5 is the fuller relationship ledger.

Solid cardinality ends describe application-intended logical associations; dotted relationship lines indicate non-identifying references with no foreign-key enforcement. Identifier-field presence is not proof that a referenced document exists. `0..1` payment/reversal per transaction depends on declared unique transactionId indexes being deployed. Invoice count remains 0..many at schema level despite the intended one-invoice workflow.

No `mmdc` executable or Mermaid renderer package was found in the existing project environment. No new dependencies were installed and no remote renderer received this schema. No standalone rendered image was generated; the Mermaid source can be rendered by an existing compatible documentation viewer.

## 10. Schema and Application Usage Findings

| ID | Finding | Source-supported detail | Evidence |
|---|---|---|---|
| F01 | Financial model is definition-only in the application import graph | Offline app import registers 22 models; explicit import of all model modules adds only Financial. FinancialController aggregates Transaction/Customer and never imports Financial. Therefore financials must not be asserted as a verified active/live collection. | [backend/controllers/FinancialController.js:2](../../backend/controllers/FinancialController.js#L2) |
| F02 | No unique invoice or legacy counter partition index | Invoice indexes owner+invoiceNumber and owner+transaction, and InvoiceCounter owner+type+year, are nonunique. Service checks/intended sequence generation are not equivalent to uniqueness enforced on these fields. | [backend/models/Invoice.js:54](../../backend/models/Invoice.js#L54) |
| F03 | No unique catalog SKU/name declaration | Product owner+sku/name indexes are nonunique. Historical mapping detects collisions, while ordinary catalog creation does not check SKU uniqueness; duplicate SKU/name is not generally prohibited. | [backend/services/catalogService.js:78](../../backend/services/catalogService.js#L78) |
| F04 | User.email requested but absent from schema | OrderController populates processedBy selecting name email identifier. User defines no email. Customer.email exists, but it is a different collection/identity. | [backend/controllers/OrderController.js:339](../../backend/controllers/OrderController.js#L339) |
| F05 | Legacy raw query targets a virtual/nonpersisted product path | productDeletionStatus checks products.product in addition to items.product. Transaction.products is a getter virtual and not a declared persisted path; the query looks like a historical compatibility probe, not a second embedded array declaration. | [backend/services/productManagement.js:46](../../backend/services/productManagement.js#L46) |
| F06 | Aggregation fields are not missing persisted Customer fields | PersonController computes summary, totalDebt, totalPaid, totalOrders, totalSpent, lastTransaction and balance in an aggregation. Customer defines summary-reading virtuals but no stored summary/debt collections. Do not add these output-only fields to the persisted schema. | [backend/controllers/PersonController.js:56](../../backend/controllers/PersonController.js#L56) |
| F07 | Declared fields with no dedicated operational writer | Financial.capitalInvested/grossIncome/netIncome and embedded expenses have no runtime model consumer; Product.costPrice appears only as a schema field/projection exclusion; Transaction.voidReason has no non-model application usage, and voidedAt is read but no current writer was found. Keep these declared paths in documentation while labeling activity unverified. | [backend/models/Order.js:86](../../backend/models/Order.js#L86) |
| F08 | Relationships rely heavily on application references | User.storeIds and legacy-resource storeId are Mixed. Most operational ObjectId IDs have no Mongoose ref. Scope.resourceIds, receipt snapshot IDs and returned product IDs are strings inside Mixed. Validation/existence checks live in services, not database foreign keys. | [backend/models/resourceAttribution.js:21](../../backend/models/resourceAttribution.js#L21) |
| F09 | Reversal target discriminator is overloaded | BookstoreAuditEvent.targetKind Reversal names either a request or an applied reversal, resolved by action. It is not a registered model named Reversal. | [backend/services/bookstoreOrders.js:185](../../backend/services/bookstoreOrders.js#L185) |
| F10 | Multiple reversal requests permitted | Request creation checks sale eligibility but has no duplicate outstanding-request lookup or unique transactionId. SaleReversal.transactionId is unique and request status/application checks prevent ordinary repeated application; pending requests may remain after another request is applied. | [backend/services/bookstoreOrders.js:177](../../backend/services/bookstoreOrders.js#L177) |
| F11 | Legacy and bookstore monetary contracts coexist | Legacy-compatible schemas allow missing storeId/moneyUnit and broader bank/credit payment methods. Bookstore services require PHP-centavos and safe integer money with cash/gcash only. Never infer a historical unit from numeric values. | [backend/models/resourceAttribution.js:24](../../backend/models/resourceAttribution.js#L24) |
| F12 | Debt settlements may lack allocation history | DebtPayment.transaction is optional; customer-wide settlement updates multiple transaction balances but creates one payment without per-transaction allocations. A direct payment-to-each-transaction relationship cannot be reconstructed solely from that payment document. | [backend/controllers/DebtPaymentController.js:84](../../backend/controllers/DebtPaymentController.js#L84) |
| F13 | Schema hooks do not universally ensure totals/immutability | Transaction supplied subtotal is trusted by its hook; services price current items. Append-only middleware is client-side protection, and raw driver access can bypass it. The schema is not a server validator. | [backend/models/Order.js:122](../../backend/models/Order.js#L122) |
| F14 | Account deletion can leave historical identifiers | deleteAccount deletes User after revoking grants and writing audit, without cascading removal or a universal reference-blocking scan. Audit/ownership/creator IDs can therefore intentionally outlive the account. | [backend/services/accountManagement.js:446](../../backend/services/accountManagement.js#L446) |
| F15 | Queue removal is an audit event, not a Transaction field | order.queue_removed controls queue visibility; there is no stored queueRemoved/archived field on Transaction. Service returns queueRemoved as a response flag and leaves order state/record unchanged. | [backend/services/cashierQueue.js:25](../../backend/services/cashierQueue.js#L25) |
| F16 | Stale comments conflict with live route bindings | Comments in guestOrderAccess, accountManagement membership foundation and resourceScope describe unbound functionality, but BookstoreRoute binds guest ordering and membership endpoints and uses scoped services. Route imports/bindings take precedence over comments for this audit. | [backend/routes/BookstoreRoute.js:32](../../backend/routes/BookstoreRoute.js#L32) |
| F17 | Reversed is a read DTO state, not persisted orderStatus enum | trackGuestOrder returns reversed when reversalId exists; applyReversal sets reversalId/reversedAt without changing orderStatus to a nonexistent reversed enum. Existing orderStatus remains completed. | [backend/services/guestOrders.js:68](../../backend/services/guestOrders.js#L68) |


### Model consumer inventory

The following references exclude model definitions, test fixtures and dependencies. A file listed here imports the model module; it does not prove live database rows exist or that every exported function is reachable.

| Model | Application consumers |
|---|---|
| AccountAdministrationRealm | [backend/services/accountManagement.js:8](../../backend/services/accountManagement.js#L8) |
| AccountAuditEvent | [backend/controllers/AccountLifecycleController.js:2](../../backend/controllers/AccountLifecycleController.js#L2); [backend/services/accountManagement.js:8](../../backend/services/accountManagement.js#L8) |
| AccountOperationReceipt | [backend/controllers/AccountLifecycleController.js:2](../../backend/controllers/AccountLifecycleController.js#L2); [backend/services/accountManagement.js:8](../../backend/services/accountManagement.js#L8) |
| AccountRoleReview | [backend/controllers/AccountLifecycleController.js:2](../../backend/controllers/AccountLifecycleController.js#L2); [backend/services/accountManagement.js:8](../../backend/services/accountManagement.js#L8) |
| BookstoreAuditEvent | [backend/services/bookstoreAdministration.js:3](../../backend/services/bookstoreAdministration.js#L3); [backend/services/bookstoreCommand.js:6](../../backend/services/bookstoreCommand.js#L6); [backend/services/bookstoreOrders.js:7](../../backend/services/bookstoreOrders.js#L7); [backend/services/bookstoreReads.js:7](../../backend/services/bookstoreReads.js#L7); [backend/services/cashierQueue.js:2](../../backend/services/cashierQueue.js#L2); [backend/services/guestOrders.js:7](../../backend/services/guestOrders.js#L7) |
| BookstoreOperationReceipt | [backend/services/bookstoreCommand.js:6](../../backend/services/bookstoreCommand.js#L6); [backend/services/bookstoreReads.js:7](../../backend/services/bookstoreReads.js#L7); [backend/services/guestOrders.js:7](../../backend/services/guestOrders.js#L7); [backend/services/productManagement.js:4](../../backend/services/productManagement.js#L4) |
| BookstorePayment | [backend/services/bookstoreOrders.js:7](../../backend/services/bookstoreOrders.js#L7); [backend/services/cashierQueue.js:2](../../backend/services/cashierQueue.js#L2) |
| BookstoreReversalRequest | [backend/services/bookstoreAliases.js:3](../../backend/services/bookstoreAliases.js#L3); [backend/services/bookstoreCommand.js:6](../../backend/services/bookstoreCommand.js#L6); [backend/services/bookstoreOrders.js:7](../../backend/services/bookstoreOrders.js#L7); [backend/services/bookstoreReads.js:7](../../backend/services/bookstoreReads.js#L7) |
| BookstoreSaleReversal | [backend/services/bookstoreOrders.js:7](../../backend/services/bookstoreOrders.js#L7); [backend/services/bookstoreReads.js:7](../../backend/services/bookstoreReads.js#L7); [backend/services/productManagement.js:4](../../backend/services/productManagement.js#L4) |
| BookstoreSequence | [backend/services/bookstoreOrders.js:7](../../backend/services/bookstoreOrders.js#L7) |
| ConditionalAccountGrant | [backend/controllers/AccountLifecycleController.js:2](../../backend/controllers/AccountLifecycleController.js#L2); [backend/services/accountManagement.js:8](../../backend/services/accountManagement.js#L8); [backend/services/bookstoreGrants.js:1](../../backend/services/bookstoreGrants.js#L1) |
| Customer | [backend/controllers/DebtPaymentController.js:4](../../backend/controllers/DebtPaymentController.js#L4); [backend/controllers/FinancialController.js:3](../../backend/controllers/FinancialController.js#L3); [backend/controllers/OrderController.js:4](../../backend/controllers/OrderController.js#L4); [backend/controllers/PersonController.js:2](../../backend/controllers/PersonController.js#L2); [backend/services/bookstoreAdministration.js:2](../../backend/services/bookstoreAdministration.js#L2); [backend/services/bookstoreMapping.js:5](../../backend/services/bookstoreMapping.js#L5); [backend/services/bookstoreOrders.js:6](../../backend/services/bookstoreOrders.js#L6); [backend/utils/personService.js:2](../../backend/utils/personService.js#L2) |
| DebtPayment | [backend/controllers/DebtPaymentController.js:2](../../backend/controllers/DebtPaymentController.js#L2); [backend/controllers/OrderController.js:7](../../backend/controllers/OrderController.js#L7); [backend/controllers/PersonController.js:4](../../backend/controllers/PersonController.js#L4); [backend/services/bookstoreMapping.js:8](../../backend/services/bookstoreMapping.js#L8) |
| Expense | [backend/controllers/ExpenseController.js:1](../../backend/controllers/ExpenseController.js#L1) |
| Financial | None found outside definition/tests |
| GuestOrderIntent | [backend/services/guestOrders.js:7](../../backend/services/guestOrders.js#L7) |
| Invoice | [backend/controllers/InvoiceController.js:2](../../backend/controllers/InvoiceController.js#L2); [backend/controllers/OrderController.js:6](../../backend/controllers/OrderController.js#L6); [backend/controllers/PersonController.js:5](../../backend/controllers/PersonController.js#L5); [backend/services/bookstoreAliases.js:2](../../backend/services/bookstoreAliases.js#L2); [backend/services/bookstoreMapping.js:7](../../backend/services/bookstoreMapping.js#L7); [backend/services/bookstoreOrders.js:5](../../backend/services/bookstoreOrders.js#L5); [backend/services/bookstoreReads.js:6](../../backend/services/bookstoreReads.js#L6); [backend/services/productManagement.js:3](../../backend/services/productManagement.js#L3) |
| InvoiceCounter | [backend/controllers/InvoiceController.js:4](../../backend/controllers/InvoiceController.js#L4) |
| Product | [backend/controllers/OrderController.js:5](../../backend/controllers/OrderController.js#L5); [backend/controllers/ProductController.js:1](../../backend/controllers/ProductController.js#L1); [backend/services/accountManagement.js:4](../../backend/services/accountManagement.js#L4); [backend/services/bookstoreMapping.js:4](../../backend/services/bookstoreMapping.js#L4); [backend/services/bookstoreOrders.js:2](../../backend/services/bookstoreOrders.js#L2); [backend/services/bookstoreReads.js:5](../../backend/services/bookstoreReads.js#L5); [backend/services/catalogService.js:2](../../backend/services/catalogService.js#L2); [backend/services/categoryService.js:1](../../backend/services/categoryService.js#L1); [backend/services/guestOrders.js:5](../../backend/services/guestOrders.js#L5); [backend/services/inventoryService.js:1](../../backend/services/inventoryService.js#L1); [backend/services/productManagement.js:1](../../backend/services/productManagement.js#L1); [backend/services/sizeInventory.js:1](../../backend/services/sizeInventory.js#L1) |
| StockMovement | [backend/services/bookstoreReads.js:7](../../backend/services/bookstoreReads.js#L7); [backend/services/catalogService.js:6](../../backend/services/catalogService.js#L6); [backend/services/productManagement.js:4](../../backend/services/productManagement.js#L4); [backend/services/sizeInventory.js:2](../../backend/services/sizeInventory.js#L2) |
| Store | [backend/middleware/bookstoreAdmission.js:6](../../backend/middleware/bookstoreAdmission.js#L6); [backend/services/accountManagement.js:6](../../backend/services/accountManagement.js#L6); [backend/services/bookstoreAccess.js:2](../../backend/services/bookstoreAccess.js#L2); [backend/services/bookstoreAdministration.js:1](../../backend/services/bookstoreAdministration.js#L1); [backend/services/bookstoreCommand.js:3](../../backend/services/bookstoreCommand.js#L3); [backend/services/bookstoreOrders.js:4](../../backend/services/bookstoreOrders.js#L4); [backend/services/bookstoreReads.js:3](../../backend/services/bookstoreReads.js#L3); [backend/services/categoryService.js:2](../../backend/services/categoryService.js#L2); [backend/services/guestOrders.js:3](../../backend/services/guestOrders.js#L3) |
| Transaction | [backend/controllers/DebtPaymentController.js:3](../../backend/controllers/DebtPaymentController.js#L3); [backend/controllers/FinancialController.js:2](../../backend/controllers/FinancialController.js#L2); [backend/controllers/InvoiceController.js:3](../../backend/controllers/InvoiceController.js#L3); [backend/controllers/OrderController.js:3](../../backend/controllers/OrderController.js#L3); [backend/controllers/PersonController.js:3](../../backend/controllers/PersonController.js#L3); [backend/services/accountManagement.js:5](../../backend/services/accountManagement.js#L5); [backend/services/bookstoreAliases.js:1](../../backend/services/bookstoreAliases.js#L1); [backend/services/bookstoreMapping.js:6](../../backend/services/bookstoreMapping.js#L6); [backend/services/bookstoreOrders.js:3](../../backend/services/bookstoreOrders.js#L3); [backend/services/bookstoreReads.js:4](../../backend/services/bookstoreReads.js#L4); [backend/services/cashierQueue.js:1](../../backend/services/cashierQueue.js#L1); [backend/services/catalogService.js:3](../../backend/services/catalogService.js#L3); [backend/services/guestOrders.js:6](../../backend/services/guestOrders.js#L6); [backend/services/productManagement.js:2](../../backend/services/productManagement.js#L2); [backend/utils/orderReference.js:3](../../backend/utils/orderReference.js#L3) |
| User | [backend/controllers/UserController.js:3](../../backend/controllers/UserController.js#L3); [backend/middleware/authMiddleware.js:3](../../backend/middleware/authMiddleware.js#L3); [backend/services/accountManagement.js:3](../../backend/services/accountManagement.js#L3); [backend/services/bookstoreAccess.js:1](../../backend/services/bookstoreAccess.js#L1); [backend/services/bookstoreCommand.js:2](../../backend/services/bookstoreCommand.js#L2); [backend/services/bookstoreMapping.js:3](../../backend/services/bookstoreMapping.js#L3); [backend/services/bookstoreReads.js:2](../../backend/services/bookstoreReads.js#L2); [backend/services/guestOrders.js:4](../../backend/services/guestOrders.js#L4); [backend/utils/accountTransaction.js:1](../../backend/utils/accountTransaction.js#L1); [backend/utils/adminAccountMutation.js:2](../../backend/utils/adminAccountMutation.js#L2); [backend/utils/seedAdmin.js:3](../../backend/utils/seedAdmin.js#L3) |


### Declared field names absent from non-model application source

A conservative identifier scan of all non-test backend JavaScript outside models found the following field names with no occurrence. This does not prove historical data is unused; shared/common names and generic serializers prevent a complete semantic dead-field proof. Dedicated writers absent for additional fields are identified in F07.

| Model | Field | Definition evidence |
|---|---|---|
| Financial | capitalInvested | [backend/models/Financial.js:19](../../backend/models/Financial.js#L19) |
| Financial | grossIncome | [backend/models/Financial.js:19](../../backend/models/Financial.js#L19) |
| Financial | netIncome | [backend/models/Financial.js:19](../../backend/models/Financial.js#L19) |
| Transaction | voidReason | [backend/models/Order.js:169](../../backend/models/Order.js#L169) |


## 11. Limitations and Items Requiring Verification

1. Physical MongoDB collection existence, extra legacy collections, document counts/actual shapes, deployed indexes (including unique/sparse), server JSON validators, server version, sharding/topology and database name were not inspected. A code model mapping is not proof of a populated/active collection.

2. Current on-disk source contains pre-existing uncommitted application changes. This audit describes that source snapshot, not necessarily production or a particular released commit. The metadata sourceManifest records SHA-256 hashes of non-test backend JS/package JSON files for reproducibility, without environment values.

3. Mixed fields intentionally admit open schemas or preserve malformed historical values. Their current service-created shapes are documented separately from declared paths. Existing documents may differ, and optional newly introduced fields may be missing in historical records.

4. No migration directory or runnable general migration framework was found. `backend/utils/seedAdmin.js` exists but disables offline administrator bootstrap and requires a separately authorized recovery procedure; it was not executed. `bookstoreMapping.js` provides internal reviewed historical-attribution preparation/application functions, not a startup migration. Test fixtures/seeded test data are not production schema or evidence of collection existence. [backend/utils/seedAdmin.js:10](../../backend/utils/seedAdmin.js#L10)

5. Runtime behavior/concurrency was reasoned from source, not exercised against any database. Application tests were not run because this is a schema-only documentation task and some suites create/drop test databases. No live/model index synchronization was performed.

6. No application source, project configuration, package lock, model or database record was changed. Deliverables are this audit, Mermaid source, Chapter 26.2 summary, offline extractor, documentation builder and metadata. No standalone diagram image is claimed.

7. Reproduction: from the project root, run `node docs/database-schema/extract-schema.mjs`, then execute `docs/database-schema/build-audit.py` with an available Python interpreter. This inspection used the already installed Blender-bundled interpreter at `C:/Program Files/Blender Foundation/Blender 5.0/5.0/python/bin/python.exe`; the ordinary python/py launchers have no usable installation. The extractor imports app.js/models only, blocks connection entry points and disables autoCreate/autoIndex; do not replace it with index.js or invoke service/seed functions. Metadata contains code/default/validator descriptions only, never records or environment values.
