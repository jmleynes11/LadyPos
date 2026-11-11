# UPHSD Bookstore POS — requirements confirmation

Date: 2026-11-02. **Approval checkpoint.** The authorized work completed here is repository audit, non-destructive verification and seven planning documents. Application rebranding, security fixes, schema/index changes, data migrations, dependency installation and deployment have not started.

## A. Confirmed requirements

| ID | Confirmed requirement | Authority/limit |
| --- | --- | --- |
| C01 | Official name UPHSD Bookstore POS; brand UPHSD Bookstore; institution University of Perpetual Help System DALTA | User request; does not authorize an invented official logo/colors/contact/tax details |
| C02 | Transform existing LadyPos/ServeFlow into a web POS/inventory system with kiosk ordering | Reuse existing project; no rebuild from scratch |
| C03 | Remain independent of GradeSense AI | No coupling of accounts/data/config/deployment; no integration found |
| C04 | Understand actual frontend/backend/models/access/workflows/tests/deployment before implementation | Source is authoritative, UI presence is not working proof |
| C05 | Catalog, inventory, orders/queue, cashier payment, receipts, sales/inventory reporting and role enforcement form the target scope | Specific roles/states/methods/credit/reservation/pickup/discount/refund rules still require approval |
| C06 | Backend validates price/quantity/stock/amounts and enforces permissions; no public admin registration | Current code violates parts of this requirement; repair awaits phase approval |
| C07 | Prevent duplicate order/financial effects and unsafe concurrent cashier stock sales | Requires real transaction/constraint/concurrency verification |
| C08 | Preserve historical transactions, payments, users, products and other records; no destructive operations without explicit approval | Historical ambiguity must be documented, not guessed or erased |
| C09 | Prepare blueprint, architecture, implementation plan, requirements, database, security and test documents | Seven requested exact filenames; existing equivalent general audit docs preserved and linked |
| C10 | No initial application-code/schema changes, deletion, installs or deployment; obtain approval for specific implementation phase | This delivery does not grant future permission |
| C11 | Report changed files, actual tests and remaining issues after each approved phase | Planned criteria must remain distinct from executed checks |
| C12 | Professional provisional text branding until authorized official assets/guidelines are supplied | Preserve useful layout/components and internal identifiers |

Existing documentation/UI states accounts should be administrator-created (`LoginPage.jsx` tooltip). This is existing intended policy, **not current enforcement**: public /register permits admin creation. Existing payment enum/credit/invoice dueDate/food-delivery labels are source behavior, not approved bookstore business policy.

## B. Existing features to reuse

No complete live business workflow was verified. The following are useful source-supported foundations; reuse requires the indicated repair/tests.

| Feature | Actual locations | Reuse boundary |
| --- | --- | --- |
| React feature folders/layout/mobile navigation | client/src/features, shared/components/Layout.jsx, index.css | Build passes; responsive/accessibility behavior unverified |
| Authentication UI/JWT/bcrypt libraries | auth pages, AuthContext, backend authMiddleware/generateToken | Preserve framework/UI; fix public provisioning, hash path, identity and stale account checks |
| Product catalog/search/deactivation | Product.js, ProductController.js, ProductPage.jsx/productApi.js | Database CRUD unverified; protect metadata updates from stock/default overwrite |
| Product.stock and conditional sale deduction | Product.js, OrderController decrementStock | Keep canonical quantity and sufficient-stock predicate; add audit/atomic adjustment/concurrency evidence |
| Cart and server-priced line building | PosPage.jsx, OrderController buildItems | Useful cart; adapt settlement/pending workflow after confirmation |
| Order list/history and existing Transaction model | OrdersPage.jsx, Order.js, OrderController.js | Preserve model/collection/routes/history; add scope/number/state/idempotency/snapshots as approved |
| Invoice/counter scaffolding and print CSS | Invoice*.js, InvoiceController.js, InvoicePage/Invoice.jsx, index.css | Fix uniqueness/issue state/DTO/printing; not a working receipt implementation |
| Customer and credit history | Person.js/PersonController.js, PersonPage.jsx, DebtPayment.js | Preserve records; collection is broken and customer-required policy undecided |
| Dashboard chart/aggregation foundations | FinancialController.js, FinancialPage.jsx | Replace misleading basis with approved sales/collection calculations; no profit claim |
| Expense CRUD | Expense model/controller/page | Preserve module/data; continued bookstore use/permissions/units/retention need decision |
| Independent client/API build structure | package manifests, Vite config, Express routes/controllers/models | Retain stack and separation; avoid generic restructuring |

## C. Features to modify

- User-facing branding across login/register, layout/header/sidebar, loading/notification/empty/error text, title/favicon, receipts, reports and relevant hosting display names. Internal identifiers remain unless technically necessary.
- Product catalog with approved ISBN/description/threshold/image/cost policy; category suggestions require actual catalog confirmation. Replace fixed UI `<10` with approved configured threshold semantics.
- Existing owner-per-user scope into explicitly authorized shared bookstore scope while retaining original ownership/provenance; do not merge datasets without a mapping.
- POS submit/checkout distinction, stable order number, allowed state transitions, processing responsibility and whole-dataset server search/pagination.
- Payment recording/validation, single mutation ownership, immutable initial/later events, duplicate handling and accurate receipt data.
- Inventory changes into authenticated atomic commands with movement records; remove metadata-based stock overwrite during approved correction.
- Sales dashboard date/basis, financial projections/role access and dedicated inventory/payment reports.
- Authentication/authorization, profile/password handling, provisioning, current-account checks, safe logs/errors/configuration and seed behavior.
- Deployment readiness/configuration/backup/testing based on confirmed host, not assumptions.

## D. Features to replace or retire only after approval

| Candidate | Conflict | Proposed treatment, not an approved deletion |
| --- | --- | --- |
| Public privilege-bearing registration | Contradicts backend security and administrator-created staff | Replace behavior with guarded provisioning; preserve users and admin creation UI |
| Duplicated linked-payment mutation | Financial amount applied twice | Replace call path with one service; preserve payment/transaction records and reconcile ambiguous history separately |
| Receipt's assumed top-level items/total | API DTO mismatch; user profile treated as store header | Replace serializer/component contract; retain Invoice IDs/issued numbers |
| Mutable collected sum labeled revenue | Not reliable sales or payment-date report | Replace query/labels; retain underlying history; do not add unsupported accounting |
| Read/add/save or absolute metadata stock edits | Lost-update risk and no responsibility trail | Replace commands with atomic ledger-backed adjustments; no stock overwrite during audit |
| Grab/Foodpanda/food-service copy in bookstore workflow | Does not match confirmed bookstore domain | Hide new-order choices/update copy after approval; retain legacy enum values and historical rendering until compatibility plan approved |
| Unused legacy PersonCard/debt helpers/order modals/Financial chart | Drift from active model/API, potential future confusion | Mark/document first; remove only with explicit approval and consumer checks |
| Public log viewer and secret-bearing startup output | Exposes operational/credential data | Remove exposure/protect diagnostics in security phase; credential rotation/history handling separately controlled |

No existing module/file/data has been removed.

## E. Missing required capabilities

1. Restricted kiosk browse/cart/submit/session reset and privacy-safe own-order status.
2. Shared bookstore membership/catalog/queue and approved role capability enforcement.
3. Collision-safe customer-readable order numbering, processing claim/state rules and persistent retry identity.
4. Incoming stock/stock movement ledger, actor/reason/reference history and configurable low-stock thresholds.
5. Reliable settlement event/amount validation, immutable sale/receipt item snapshots and proven one-effect processing.
6. Correct receipt DTO/preview/print/reprint flow, with management-supplied approved header requirements.
7. Sales-by-product/category, accurate completed-period sales, inventory/receiving/movement and payment-date reports.
8. Durable security/operational audit, real automated business/HTTP/DB/concurrency tests and approved migration/restore/deployment procedures.

Some capabilities extend existing modules rather than require new pages/models. Image upload, suppliers, discounts, refunds and full accounting are optional/unconfirmed, not missing committed scope.

## F. Unresolved decisions — grouped confirmation questions

These questions cannot be answered from source. They block only dependent implementation. Proposed defaults are review candidates, never recorded as approval. No response or elapsed time is approval.

### D01 — Kiosk, fulfilment and state transitions

1. Is the kiosk customer-facing or staff-operated?
2. Does all kiosk payment occur at the cashier? If elsewhere, specify the approved payment/verification flow.
3. Is pickup required? If yes, distinguish paid, ready for pickup and collected, and identify who marks each action.
4. Which order states are necessary: pending, processing, completed and cancelled; additional ready/collected only for pickup; retain a distinct historical void/reversal state?
5. Do orders reserve inventory before payment? If yes, confirm reservation expiry, abandoned orders, cancellation/release and who may override. If no, confirm availability is revalidated at settlement and shortages can reject a queued order.
6. On product price/availability changes after submission, does a queued order honor its recorded price or require repricing/customer reconfirmation? Can a subsequently inactive product be completed?

Recommended review candidate: submit unpaid order, process at cashier, atomically settle/deduct once, receipt from committed sale. Pickup/reservation/processing rules are not silently selected.

### D02 — Roles, shared scope and existing users/data

1. Approve or amend Administrator/Store Manager/Cashier/Inventory Staff plus restricted kiosk context; identify combined roles where staff duties overlap.
2. Who may change selling prices/costs, receive stock, correct stock, cancel pending orders, void completed sales, reprint receipts and view store-wide sales/payment reports? Does inventory staff see cost, and cashier see only own sales?
3. May managers provision accounts/change roles, or only administrators? Confirm sensitive-action/second-person approval and last-admin/self-deactivation policy.
4. Confirm one shared bookstore for cashiers; identify which existing users and owner datasets belong to it. Are any datasets independent stores/personal records that must remain isolated?
5. Is anonymous/walk-in ordering allowed, and what minimal customer details, if any, are necessary for pickup/credit? No student ID requirement is assumed.

Backend enforcement and data mapping must be approved together. Enabling shared queries without membership is not an acceptable shortcut.

### D03 — Payment, cancellation, credit and receipts

1. Which existing cash/GCash/bank/credit methods are accepted? How is electronic payment independently verified, and by whom?
2. Are partial payments/customer debt retained for new bookstore sales or historical viewing only? If retained, confirm allocation, due-date and settlement policy; the current seven-day dueDate is not presumed approved.
3. Confirm cash tender/change recording and whether full validated payment is mandatory before completion/stock deduction.
4. Who can cancel unpaid orders and under what conditions? Are paid-sale voids/refunds/returns in scope; if yes, supply approval, money-reversal and stock disposition rules before those commands change.
5. Are discounts/tax computations required? Supply approved rules and rounding only if in scope; no inferred senior/student discount or tax rule is added.
6. Supply approved receipt header/contact/registration wording, transaction/order/receipt numbering scope/reset, reprint/paper/printer requirements and whether the output is an internal receipt or requires a separate compliance process.

### D04 — Catalog, inventory and reports

1. Confirm real categories/catalog and whether optional ISBN/description/images are required; supply authorized image assets/storage constraints if images are included. Confirm SKU uniqueness and any uniform variants.
2. Confirm product-specific low-stock thresholds/default policy and the inclusive boundary proposed as `0 < available <= threshold`; no hardcoded10 will be assumed official.
3. Who records incoming stock and corrections, what source/reference/reason is required, and whether adjustments require manager approval? Confirm no supplier/procurement workflow unless separately requested.
4. Approve reporting timezone/business-day cutoff and week start. Proposed convention is Asia/Manila calendar periods, sales by completedAt, collections by paidAt and separate reversal totals. Confirm exact eligibility/exclusions.
5. Confirm expense module usage/access/retention. Reliable historical cost and valuation are prerequisites for optional margin; full accounting/income statement remains outside confirmed scope.

### D05 — Assets, operations and migration safeguards

1. Provide authorized institutional brand assets/guidelines if official visuals are intended; otherwise approve provisional text identity and neutral styling.
2. Confirm intended frontend/API/database hosting, domain/CORS/TLS, actual DB transaction support, controlled test environment, receipt devices, backup retention and acceptable recovery/outage targets.
3. Approve read-only live-data profiling/backup access separately before migration design is finalized; confirm record-to-store mapping and handling of uncertain currency/payment/legacy records. No destructive repair is authorized by plan approval.

### D06 — Implementation authorization

Confirm the proposed plan and identify the specific next implementation phase/tasks authorized. Recommended first code phase: **10A critical security containment and payment-regression foundation**, followed by **02 provisional branding**; shared-role/schema/payment workflow work remains gated by relevant decisions. Authorizing branding alone permits branding changes only.

This sequencing prioritizes verified critical defects without claiming authorization to fix them during audit. Dependencies and per-task acceptance are in the [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md).

## Deliverable and approval record

| Document | Purpose |
| --- | --- |
| [System blueprint](UPHSD_BOOKSTORE_SYSTEM_BLUEPRINT.md) | Existing status, proposed roles/data/dashboards/workflows/reports |
| [Folder architecture](UPHSD_BOOKSTORE_FOLDER_ARCHITECTURE.md) | Actual tree, routes and incremental target |
| [Implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md) | Twelve phases, tasks, priorities/dependencies/acceptance |
| This requirements confirmation | Confirmed scope, reuse/change/replace/missing, decision groups |
| [Database review](UPHSD_BOOKSTORE_DATABASE_REVIEW.md) | Nine models, relationships/constraints, data preservation/migration gates |
| [Security review](UPHSD_BOOKSTORE_SECURITY_REVIEW.md) | Verified critical issues and future controls |
| [Test plan](UPHSD_BOOKSTORE_TEST_PLAN.md) | Actual checks/results/limits and future acceptance suite |

**Approval state:** pending. No role mapping, payment/reservation/refund policy, schema/migration, install, deployment or next code phase has been approved. Record explicit answers with decision ID, approved rule/scope, approver and date before dependent work. Approval of the design is not automatic approval of destructive operations or every optional feature.
