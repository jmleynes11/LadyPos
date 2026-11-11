# UPHSD Bookstore POS — database review

Date: 2026-11-02. **Source/model inspection and isolated checks only. No configured database connection, schema/index operation, seed, migration or record write was performed.** Actual database contents, server version, replica-set topology, indexes, backups and historical corruption remain unverified.

## Existing persistence and collections

`backend/config/config.js` uses mongoose.connect with MONGO_URI. `pg` is declared but no SQL implementation was found. Collection names below are Mongoose model metadata/default naming, not a live database inventory. ObjectId references are application relationships, not enforced foreign keys. All models are under `backend/models/`.

| File / model / collection | Stored fields and validation | Relationships/index declarations |
| --- | --- | --- |
| User.js / User / users | identifier/password required; role user/admin; confirmed false default; name/phone/address; timestamps | identifier unique; phone unique+sparse; no hash middleware or matchPassword method |
| Product.js / Product / products | owner/name/price required; sku empty; category General; stock=0, costPrice=0 with min0; isActive=true; timestamps | owner->User; owner and active indexes; owner+name, owner+sku, owner+category+active nonunique |
| Person.js / Customer / customers | owner/name required; phone/email/address; isDeleted/deletedAt; timestamps | owner->User; owner/isDeleted; owner+name and owner+phone nonunique |
| Order.js / Transaction / transactions | owner/customer required; embedded items(product, quantity min1, unitPrice/subtotal min0); totalAmount/amountPaid/balance min0; paid/partial/debt; cash/gcash/bank/credit; references; customerType walkin/customer/grab/foodpanda; pending/completed/void; ledgerRecorded; completedAt/processedBy; notes; voidedAt/reason; createdAt/updatedAt | owner/processedBy->User, customer->Customer, items.product->Product; owner/customer/paymentStatus/orderStatus/ledgerRecorded/createdAt indexes; owner+customer+createdAt+paymentStatus, owner+createdAt |
| Invoice.js / Invoice / invoices | owner/customer/transaction/invoiceNumber required; issuedAt; dueDate; unpaid/partial/paid/void; notes; timestamps | refs User/Customer/Transaction; single lookup indexes plus owner+number and owner+transaction, neither declared unique |
| InvoiceCounter.js / InvoiceCounter / invoicecounters | owner/type/year required; seq=0 | owner->User; owner+type+year declared nonunique |
| DebtPayment.js / DebtPayment / debtpayments | owner/customer/amountPaid required, amount min1; optional transaction; method/reference; paidAt/notes; timestamps | User/Customer/Transaction refs; owner/customer/transaction/paidAt; owner+customer+paidAt, owner+transaction+paidAt |
| Expense.js / Expense / expenses | userId/itemName/amount required; category inventory/rent/utilities/salary/misc; note/date/createdBy; no timestamps or amount min | User refs; no extra schema indexes |
| Financial.js / Financial / financials | userId required; capitalInvested/grossIncome/netIncome default0; embedded type/amount/date expenses; notes; timestamps | User ref; no extra indexes; no active financial route uses it |

Product virtuals sellingPrice/quantity/active/userId, Customer contactInfo/userId/summary aliases, Transaction products/total/date/personId/userId, item productId/price, Invoice orderId/userId and DebtPayment personId/userId are compatibility views. They are not separate stored stock or total fields. Do not migrate virtuals as if duplicate stored values existed.

## Existing transactions and history

- OrderController creates/edits/completes/voids using MongoDB sessions. Checkout reads current product prices, merges repeated product IDs and conditionally decrements `{stock: {$gte: quantity}}` with `$inc`. Completion records processedBy, completedAt and ledgerRecorded and creates an invoice in the session.
- Pending creation does not reserve/deduct stock; buildItems validates active owned product IDs but not stock quantity. The UI submits pending orders with payment inputs; they are not reliable payment events.
- Transaction pre-validation derives totals from stored subtotals, clamps amountPaid and derives completed payment status. Save hook synchronizes invoice status. Directly accepting stored subtotal without product-derived recalculation would be unsafe; the existing create path builds it server-side.
- Linked debt collection updates the sale in DebtPaymentController and again in DebtPayment pre-save. A05/A06 confirmed the logic defects using mocked DB/session methods and the actual custom hook. Full collection fails; small collection doubles. No claim is made about existing records being corrupt.
- Customer-wide collection allocates oldest-first by updating sales but stores one DebtPayment without per-sale allocation details. Allocation history cannot be reconstructed reliably just from the final current balances.
- Void restores stock when ledgerRecorded and marks sale/invoice void; it does not create a payment reversal/refund. Invoice-only void can diverge from the sale. GET invoice ensure can issue records outside a transaction, including for pending orders.
- Product absolute updates and read/add/save adjustments can overwrite concurrent changes; negative adjustments are silently clamped to zero. No immutable receiving/movement/audit history exists.
- Product/customer deletion is soft; users and expenses can be hard deleted. Existing historical records must be retained; orphan detection and retention policy are needed before changing those commands.

Source: OrderController.js, DebtPaymentController.js, ProductController.js, InvoiceController.js, UserController.js, ExpenseController.js and corresponding models. Full existing route list remains in [prior API inventory](architecture/api-design.md).

## Bookstore data design — proposed, not applied

### Canonical data responsibilities

| Information | Authoritative record/proposed invariant |
| --- | --- |
| On-hand stock | Existing Product.stock; one current quantity only |
| Inventory history | Proposed append-only StockMovement; same-session quantity mutation and movement; reconcile opening + deltas to current stock |
| Order and completed sale | Retain Transaction in transactions; immutable completed line/totals snapshots and stable numbering |
| Payment facts | Immutable approved settlement/collection events, linked to sale; existing DebtPayment may be extended for later collections or generalized through a compatibility service after decision |
| Current paid/balance | Transaction projection maintained exactly once from valid payment events; reconcile with allocations, never independent manual editable truth |
| Receipt | Existing Invoice as stable receipt reference plus immutable issue/sale snapshot DTO; never price/name lookup from current catalog at reprint |
| Product category/availability | Existing Product.category and isActive; availability derived from stock/reservation policy; no independent editable available flag |
| Store access | Approved store/membership representation, separate from processing cashier. Current owner scope is not shared store membership |

If reservations are approved, Product.stock remains on-hand. Define reserved and sellable quantities explicitly; either transactional reservation records with derived availability or a clearly maintained reserved projection plus reconcilable reservation ledger. Do not independently edit duplicate available/onHand totals. Reservation expiry, cancellation and payment consumption must have exactly-once effects and tests. No reservation design is approved now.

### Proposed additions and constraints

| Record | Proposed fields/rules | Why required or conditional |
| --- | --- | --- |
| Product additions | isbn? for books, bounded description?, image reference? if storage approved, lowStockThreshold nonnegative integer; restrict costPrice | Identification/customer display and configurable alerts; images optional. Keep existing name/SKU/category/prices/stock/active/timestamps |
| Transaction additions | orderNumber, source, immutable item name/SKU and category snapshots, request identity; processing claim/version/times if approved; cancellation actor/time/reason; tender/change only for approved methods | Queue reference, accurate historical receipts/reports, retries and concurrent cashiers |
| Stable transaction/receipt identity | Decide whether transaction number reuses completed order number or separate sequence; preserve `_id` and existing invoice numbers | Avoid redundant counters without business need; no silent renumbering |
| StockMovement new | scope, product, signed integer delta, movement type, actor, reason, recordedAt, effective receivedAt?, source/reference, idempotency/effect key | Required receiving, adjustment responsibility, sales deduction and reconciliation trace |
| Payment event/allocation changes | scope, transaction, actor, integer applied amount, method/reference, paidAt, state/reversal link, request key; allocation amounts sum to collection | Required accurate settlement/collection history; split allocation needed only if credit/general collections remain |
| Invoice additions | immutable issue/store/item/payment snapshot or reference to immutable sale data; stable receipt DTO; no account-profile branding | Reprints preserve facts; exactly one issue per eligible sale |
| Idempotency record or equivalent unique domain keys | scope+operation+key unique; request hash, result references/state/timestamps; commit with effect | Required duplicate order/payment/stock prevention; generic new collection is a design choice, not mandatory |
| AuditEvent new or equivalent durable audit | scope, authenticated actor, action, target, redacted change, reason, time/request reference | Sensitive permissions, catalog/stock/payment corrections; never store credentials/tokens |
| Store/membership proposal | explicit store scope and validated user membership/capabilities, original owner retained for provenance | Shared catalog/queue requires approved mapping; no automated merging of existing owners |

Currency proposal: safe integer PHP centavos for monetary fields, positive safe integer quantities and nonnegative stock; reject invalid/fractional/overflow values rather than round/truncate arbitrary input. Existing active POS/products convert PHP to centavos, but ExpensePage uses raw amounts; legacy components use other display assumptions. Actual database units must be profiled per source/time period. Do not multiply every existing record by 100.

CostPrice default zero must not become historical acquisition cost. Optional margin reporting would require known cost and valuation decisions plus cost-at-sale snapshots. Historical product/category names must not be guessed: label legacy missing snapshots explicitly or retain a provenance-marked current-name display without claiming historical certainty.

### Index review

Existing schema inspection proves declarations, not which indexes a live administrator installed. User identifier/phone are the only explicitly declared unique indexes among inspected models. A04 confirms invoice and counter uniqueness is absent from schemas. Every proposed unique-index build requires duplicate profiling and approval.

| Candidate constraint/index | Purpose and precondition |
| --- | --- |
| Unique approved scope+orderNumber | Customer queue reference; define global/store/day reset first |
| Unique scope+invoiceNumber; unique scope+transaction | One receipt number/issue per eligible sale, respecting existing issued history |
| Unique scope+counter type+period | Serialize counter identity; atomic increment alone does not ensure unique upsert identity |
| Unique scope+operation+idempotency key | Persist replay identity; exact scope/key lifetime must not allow duplicate effects after expiry |
| Product SKU unique nonempty per scope, only if approved | Catalog identity; sparse/partial semantics must account for empty values and duplicates |
| Orders scope+orderStatus+createdAt; processedBy+completedAt in scope | Queue/cashier history; choose actual query plans before adding |
| Movements scope+product+recordedAt; unique source effect | History and exactly-once deduction/reversal |
| Payment events scope+paidAt and transaction; allocations payment+transaction unique if retained | Collections reconciliation, report date basis |
| Expenses userId+date or eventual approved scope+date | Current expense queries; do not rename fields purely for consistency |

Phone sparse uniqueness skips absent fields but controller writes null. Review missing/null normalization and duplicates before deciding optional-phone behavior. Do not invoke syncIndexes or drop existing indexes during audit.

## Data preservation, migration approval and recovery

Preserve all users, products, customers, transactions, invoices/counters, debt payments, expense and Financial records, existing IDs/references, original owner IDs, issued numbers and historical statuses. No cleanup deletion is approved. Scope/currency/security fixes require targeted migration designs, not a branding-based rename.

Every work package below must have a reviewed exact script and dry-run output before mutation. **Backup requirement common to all:** encrypted access-controlled consistent backup of all related collections and indexes/configuration, restored into an isolated environment and reconciled before cutover; restrict and separately protect credential-bearing backups. Management must confirm retention, acceptable outage, RPO and RTO. No backup is assumed to exist.

| Change package | Reason / existing fields affected / proposed shape | Migration and validation | Rollback, risks and alternatives |
| --- | --- | --- | --- |
| DB01 Shared bookstore scope | owner/userId currently mean individual operator; add approved store/membership scope while retaining provenance and processedBy | Produce explicit user/record-to-store mapping and access matrix; profile counts/orphans; expand optional scope; dry-run backfill by approved mapping; validate every relationship; switch scoped services only after access tests | Feature flag to old owner reads with matched app version before new shared writes; after live shared writes preserve/reconcile new records rather than blind restore. Risk: exposing one owner's data to others, merging independent stores. Alternative: defer shared operation; cannot call it shared inventory |
| DB02 Bookstore metadata | Existing Product fields retained; add optional ISBN/description/image reference/threshold; add immutable item snapshots and references | No overwrite of historical catalog; backfill only supplied catalog/thresholds; record unknown old names/category as legacy; validate types/units and customer DTO projections | Revert app use while leaving additive fields; do not drop historical snapshots. Risk: invented metadata/cost, image storage obligations. Alternative: retain text-only catalog and explicit unconfigured alerts until supplied |
| DB03 Inventory ledger | Existing Product.stock; add StockMovement and safe integer validation | Reconcile current quantities on restored copy; approved cutover opening movements; route each future stock command through atomic stock+movement service; compare balances/counts/checksums | Revert app under controlled writes and reconcile movements produced since cutover. Do not replay or erase sales effects. Risk: duplicated opening entries/lost stock changes; alternative: defer receiving features rather than duplicate quantities |
| DB04 Currency and payment ownership | price/cost/line totals/amountPaid/balance/Expense.amount and DebtPayment behavior | Profile units and anomalies without logging values/PII; obtain per-record/source conversion rules; repair single ownership of payment effect; reconcile external records; introduce dated events/allocations only for provable payments; flag unresolved legacy sums | Use recorded before-images/versioned conversion map and matched app rollback; never overwrite new valid payments with stale backup. Risk: 100x conversion, double collection, unknowable legacy allocations. Alternative: preserve ambiguous records with legacy flags and exclude unsupported period reports |
| DB05 Unique numbering/idempotency | Invoice number/transaction/counter identity, new order identity/request keys | Report duplicate groups using safe IDs/counts; management decides issued-number conflicts; retain originals/cross-reference corrections; build reviewed unique indexes after data validation and write control; exercise races | Roll back new command paths before index changes; retain issued receipts and committed key results. Risk: failed index build, accidental renumbering, duplicate after key expiry. Alternative: defer issuance until safe constraints exist; do not delete duplicates blindly |
| DB06 Credentials/retention | User.password/confirmation, role/membership and token validity; hard-deleted user/expense behaviors | Classify credential formats privately; approved reset strategy for uncertain/plaintext accounts, no bulk guessed rehash; revoke affected tokens/rotate compromised secrets through controlled operations; additive deactivate/audit fields if approved | Never restore exposed secrets or plaintext authentication as rollback. Restore service with secure reset and compatible application. Risk: lockout, privileged access, orphan history; alternative: controlled forced reset. Retention change preserves existing history and needs management policy |

Live preflight must also inspect fractional/negative/invalid stock/money, duplicate SKU/invoice/counter keys, owner/reference consistency, missing completedAt/processedBy, ledgerRecorded state, orphaned users/products/customers, invoice-vs-sale state and receipts, unallocated/duplicated payments, current indexes and transaction support. Findings may require reconciliation, not automatic repair.

No collection rename is necessary for bookstore branding. Existing [database-design document](architecture/database-design.md) is preserved; this review adds bookstore scope, conditional field decisions and explicit migration gates.

See [requirements decisions](UPHSD_BOOKSTORE_REQUIREMENTS_CONFIRMATION.md) and [test plan](UPHSD_BOOKSTORE_TEST_PLAN.md).
