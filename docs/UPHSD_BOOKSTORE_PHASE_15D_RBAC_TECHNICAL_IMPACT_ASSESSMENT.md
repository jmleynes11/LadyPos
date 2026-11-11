# Phase15D — RBAC technical impact assessment

Date: 2026-11-03, Asia/Manila. Project: **UPHSD Bookstore POS**. Formal title: **UPHSD BookstorePOS: Point-of-Sale and Inventory Management System for the University Bookstore**.

**Assessment only. Implementation NOT STARTED. No implementation, account migration, production session invalidation or A08B execution is authorized by this report.**

## 1. Executive summary and authority

The existing React/Express/Mongoose application can be extended without replacement. Its current authorization model is a single `admin`/`user` account role, administrator-only account administration, authenticated business routes and mostly requester-owned data. Four bookstore roles, shared operational access, guest/student identity separation, field-level pricing restrictions and durable sensitive-action audits are not implemented by changing that enum alone.

The [Phase15C finalized specification](UPHSD_BOOKSTORE_PHASE_15C_FINALIZED_ROLE_PERMISSION_SPECIFICATION.md) is authoritative. The [Phase15B design](UPHSD_BOOKSTORE_PHASE_15B_ROLE_PERMISSION_DESIGN.md) supplies the exact 17 mandatory criteria. Phase15C expressly settles earlier proposals; its approved specializations are applied without deleting or weakening the original wording. All required documents exist. No blocking contradiction was found: superseded proposals and historical failing reports remain historical, not current business policy.

**Criteria result:** 4 Already Implemented security foundations; 5 Partially Implemented; 7 Not Implemented; 1 Cannot Verify. “Already Implemented” denotes supported local source/test foundations, not four-role end-to-end acceptance, a fresh test run or native database verification.

**Readiness:** sufficient evidence exists to scope a separately authorized local RBAC foundation. The full RBAC/workflow/migration implementation is **not ready for blanket authorization** until the remaining technical/data-policy decisions are resolved. The five owner decisions are already approved and must not be reopened. Live accounts, deployed versions, provider/database identity and transaction capability remain unknown.

### Inspection boundary and files

Read the authoritative documents, [Phase14 audit](UPHSD_BOOKSTORE_PHASE_14_UI_BRANDING_AUDIT.md), [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md), Phase15A results and relevant account/security evidence: token-version implementation; A02/A03; A04, A05, A06, A07; A08A fault handling, R1, R2 fix and independent review. A01/A08B gates remain as documented; no access was attempted.

Source inspection covered:

- Frontend: `client/src/main.jsx`, `app/App.jsx`, `shared/hooks/{AuthContext,DashboardGuard}.jsx`, `shared/components/Layout.jsx`, `shared/utils/{apiClient,safeDiagnostics,useAdminUsers,useProfile}.js`; authentication pages/components/API; product page/form/services; POS/orders page, payment sheet and order services; people/debt, invoice and financial/expense pages/services; `services/ThemeToggle.jsx`.
- Backend: `backend/app.js`; `middleware/{authMiddleware,logger,errorMiddleware}.js`; every mounted router (`UserRoute`, `ProductRoute`, `PersonRoute`, `CustomerRoute`, `OrderRoute`, `TransactionRoute`, `InvoiceRoute`, `DebtPaymentRoute`, `FinancialRoute`, `DashboardRoute`, `ExpenseRoute`); corresponding controllers and the User/Product/Person/Order/Invoice/DebtPayment/Financial/Expense/InvoiceCounter models.
- Security helpers: `generateToken.js`, `tokenPolicy.js`, `tokenVersion.js`, `passwords.js`, `accountIdentity.js`, `adminAccountMutation.js`, `accountCommitBoundary.js`, `accountMutationOutcome.js`, `safeErrors.js`, response/invoice helpers and account seed helper as local evidence only.
- Existing regression evidence: backend security/tokenSecurity/tokenVersion/a03TokenReview/a04Security/accountIdentity/accountFaults/commitReplay/payments/invoices tests; client logout/safeDiagnostics/invoice/accountMutationRetry tests. Reviewed relevant assertions and declarations; no tests were edited or executed. Package scripts were inspected; dependency ranges do not establish deployed versions.

No database/provider/browser session, application startup, seed/reset script, migration, build or integration test was run. No actual user record or secret value was retrieved. Database discussion is source-model analysis, not an inventory of live collections or accounts. Prior dirty source/lockfiles are outside this task.

## 2. Existing architecture and RBAC implementation

### Frontend access paths

React/Vite mounts AuthProvider and the browser router. `App.jsx` places profile, products, POS, orders/transactions, customers, invoices, dashboard/finances and expenses beneath DashboardGuard/Layout. DashboardGuard checks cached authentication, not per-page capabilities. Layout exposes its operational navigation without a four-role policy. ProfilePage shows AdminUserTable for cached `user.role === "admin"`; UserModal exposes only User/Admin. Login redirects to POS, which will be inappropriate for a future student account without role-aware landing behavior. Public RegisterPage has no working registration submission; its presence does not authorize public staff provisioning.

AuthContext restores browser storage and client logout clears it. This logout does not revoke a copied JWT on the server. Backend epochs remain the security authority; no new logout/recovery policy is selected here.

### Backend enforcement and entry-point map

| Surface | Existing enforcement/evidence | Required RBAC impact |
| --- | --- | --- |
| `/api/users/login`, profile/password | Login checks bcrypt and confirmation; self profile has a field whitelist; protect loads current account | Retain safeguards; define approved student enrollment separately from staff creation |
| `POST /api/users/register`, account list/update/delete | protect + authorizeRoles(admin); mutation helper for provisioning/update/delete | Administrator only; add approved role validation/lifecycle without weakening guards |
| `/api/products` CRUD and stock | Most methods permit both admin/user, then filter by requester owner | Separate catalog/pricing, stock and sale-safe read capabilities; changing a menu is insufficient |
| `POST /api/products/set-active` | Authentication only; two owner-scoped updateMany writes | Cover this alias explicitly; activation can affect availability and has deferred partial-write risk |
| `/api/orders`, `/api/transactions` | Authenticated; shared OrderController functions; owner filters; pay/complete/void and DELETE alias | Independent sale, payment, fulfillment, history and refund/void gates; preserve server validation |
| `/api/invoices` | Authenticated owner scope; create, ensure, detail/list and independent markVoid | Include receipt access, ensure side effects and invoice void in policy; GET ensure can create a record |
| `/api/people`, `/api/customers`, debt/payment aliases | Authenticated owner-scoped customer/debt operations | Do not expose to students by making customer routes public; review every payment/debt alias |
| `/api/debt-payments` | Authenticated payment operations, separate controller transaction | Capability and record scope must match linked transaction/customer; no refund policy inferred |
| `/api/financials`, `/api/dashboard` | protect, requester aggregation | Manager approved cashier scope versus Cashier personal summaries; do not call all aggregates management-authorized |
| `/api/expenses` | protect; creator scope with creator/admin mutation checks | Expense policy is unassigned; no automatic Manager grant |
| Audit/settings | Sanitized request logger; client theme; no durable action-audit or server settings management module | New approved persistence/API/access design required; existing diagnostics do not satisfy RB17 |

`authorizeRoles` checks `req.user.role`, which protect constructs from the current database account, not from a trusted JWT role claim. Product-route allowlists are explicit; most other business routes stop at authentication. Owner filters are genuine current isolation, but cannot fulfill approved shared Manager reporting or student order privacy by themselves.

### Security foundations that must survive

- HS256 verification; required valid iat/exp with maximum 604,800 seconds; expired/future-issued/malformed tokens denied.
- Strict tokenVersion claim; missing stored field alone reads as zero, but missing/invalid claims and invalid stored values reject. Role/password/confirmation changes increment the epoch within the same conditional User save; stale saves cannot reset epochs.
- Bcrypt-compatible authentication and single hashing path. New role code must not rewrite password hashes or introduce plaintext compatibility.
- Canonical validated ObjectId self-delete rejection occurs before a deletion call/session/fence. Different-case spellings do not represent different accounts.
- `adminAccountFilter` pins actor ID, admin role, confirmed state and security epoch. Self mutations attach guard conditions to the save; different-target operations write an actor `__v` fence in the same transaction as target work.
- R2 observes commit attempts on the owned session, distinguishes unknown/compound labels from transient-only failures before callback target work, preserves primary errors and cleanup outcomes. It does not supply durable financial request deduplication.
- Safe diagnostics/error envelopes remain sanitized. Request logs are not account legitimacy or action-approval evidence.

Cross-account account administration depends on transaction support; no nontransaction fallback is approved. These account guards do not automatically fence ordinary product/payment privileges. Future sensitive business operations need an explicit authorization-at-mutation design rather than widening the admin helper.

## 3. Four-role architecture mapping

| Approved role | Existing representation | Required target behavior and boundaries |
| --- | --- | --- |
| Administrator | Existing admin is a useful compatibility anchor, not proof a live admin is legitimate | Staff accounts/roles, approved system settings, product information/prices, all reports and system audit. Inventory/sales/payments/receipts/refund duties remain conditional as Phase15C specifies |
| Store Manager | No dedicated enum or policy | Combined operations/inventory role: direct audited receiving/adjustment; all cashier transactions/reports; orders; refund/void approval and processing. No role/security administration, price edits, product-information management or system-wide audit access by default |
| Cashier | Existing user has excessive product/stock/void/report rights and is not an approved mapping | POS/payments/receipts, own completed transaction history and own summaries; approved assigned-order access. Refund/void request only; no prices, stock adjustment, roles or other cashier history by default |
| Customer / Student | Neither user nor Person/Customer represents this authenticated role safely | Public-safe catalog and own orders; both guest mode and authenticated student identity; no internal dashboards/staff APIs |

Keep a centralized, testable backend capability policy separate from resource scope and field whitelists, using the existing middleware/controller architecture. A frontend projection can drive menus/actions but cannot grant authority. Do not infer hierarchy or unlimited admin bypasses from role names.

Persisted identifiers, legacy compatibility and conditional operational grants require an approved representation. Retaining the existing admin key is a compatibility option; new stored keys are not selected here. Legacy user must not automatically become Cashier, Manager or Customer. Unknown/unmapped roles must fail closed. Guest is an access mode, not automatically a fifth persisted role.

## 4. Five approved owner decisions mapped to technical work

| Settled decision | Existing mismatch | Required implementation/test boundary |
| --- | --- | --- |
| Administrator-only product pricing | admin and user CRUD share productPayload, including price/cost/stock | Server field/capability checks on create/update and aliases; Manager/Cashier denied price injection; historical unitPrice retained; cost rights remain separately specified |
| Manager directly receives/adjusts stock | Generic owner stock changes; no mandatory reason/movement history | Direct Manager operation with actor/time/product/delta/reason, safe concurrency and durable movement; no invented second approver |
| Manager approves/processes refunds and voids | Owner-authenticated transaction and invoice void paths; no refund request/approval module | Cashier request only, Manager approval/processing across aliases, reason/audit; define money/stock effects before building |
| Manager all cashier history; Cashier own history | Owner equals requester, not a store-wide processor access model | Authorized store/cashier query scope for list/detail/receipt/report; test other cashier denial and narrow fulfillment exception |
| Both guest and authenticated student ordering | No kiosk route or public catalog/order API; customer is an owner-linked contact | Separate safe guest/student subjects, reference privacy, student own-order access and staff API denial; order submission is not payment/completion |

Phase15B's conditional approval tests in RB08 apply only where the final workflow actually has approval; Manager inventory adjustment does not require another actor. RB11 must test both modes, not choose one. RB17 is now a required audit capability, not optional because its earlier wording was conditional.

## 5. All 17 mandatory acceptance criteria

Each quotation below reproduces the Phase15B requirement. File paths in per-criterion frontend/backend bullets use the indicated roots; shorthand controller names refer to files in `backend/controllers/`. Required tests are future acceptance work unless expressly identified as existing security regressions.

| Criterion | Source-based assessment |
| --- | --- |
| RB01 | Not Implemented |
| RB02 | Partially Implemented |
| RB03 | Already Implemented |
| RB04 | Partially Implemented |
| RB05 | Already Implemented |
| RB06 | Partially Implemented |
| RB07 | Not Implemented |
| RB08 | Not Implemented |
| RB09 | Not Implemented |
| RB10 | Partially Implemented |
| RB11 | Not Implemented |
| RB12 | Not Implemented |
| RB13 | Already Implemented |
| RB14 | Already Implemented |
| RB15 | Partially Implemented |
| RB16 | Cannot Verify |
| RB17 | Not Implemented |

### RB01 — Not Implemented

**Exact Phase15B requirement:**

> Approved role values persist/round-trip correctly; malformed/unknown values cannot grant authority. Legacy accounts follow the approved mapping/compatibility rule; User/Person identities are not conflated

- **Existing evidence/status:** Not Implemented. Current source provides only the subset described below; there is no four-role acceptance signoff.
- **Frontend files** (relative to `client/src/`): features/auth/components/UserModal.jsx; shared/hooks/AuthContext.jsx.
- **Backend files/functions** (relative to `backend/`): models/User.js; controllers/UserController.js; middleware/authMiddleware.js.
- **Database impact:** User.role enum/default and approved compatibility representation; no live account values verified.
- **Required changes:** Add four approved roles and explicit legacy handling; update provisioning validation and client labels together.
- **Security implications:** Never map user/unknown to privileged roles by default; Customer is not Customer/Person data automatically.
- **Required tests:** Persist/validate each approved value, reject malformed/unknown, verify legacy and User/Person separation.
- **Dependencies/blockers:** Approved identifiers, compatibility/cutover and account mappings.

### RB02 — Partially Implemented

**Exact Phase15B requirement:**

> Every protected endpoint/method has positive and negative tests for all four roles, anonymous/unconfirmed/deleted accounts, expired/wrong-signature/malformed/stale tokens. Test direct API calls independently of hidden menus

- **Existing evidence/status:** Partially Implemented. Current source provides only the subset described below; there is no four-role acceptance signoff.
- **Frontend files** (relative to `client/src/`): app/App.jsx; shared/hooks/DashboardGuard.jsx; shared/components/Layout.jsx.
- **Backend files/functions** (relative to `backend/`): all business route files; middleware/authMiddleware.js; tests/a03TokenReview.test.js.
- **Database impact:** Policy/scope representation may be needed; permissions do not imply data reassignment.
- **Required changes:** Inventory all methods/aliases; add server capability and object/field checks; keep existing early protect.
- **Security implications:** Protected today does not mean four-role authorization; anonymous/stale route denials already tested locally.
- **Required tests:** Four-role allowed/denied matrix, anonymous/unconfirmed/deleted/invalid-token direct API tests, zero effects on rejection.
- **Dependencies/blockers:** Capability map and shared record scope; new-role fixtures.

### RB03 — Already Implemented

**Exact Phase15B requirement:**

> Current persisted role overrides a forged/cached admin claim. Password/reset/role/confirmation changes advance epochs atomically; old tokens remain rejected after demotion/restoration. Preserve the established seven-day lifetime and strict legacy-token policy

- **Existing evidence/status:** Already Implemented. Existing current-account/epoch/lifetime mechanisms satisfy this security foundation locally; new-role and future lifecycle integration still needs testing.
- **Frontend files** (relative to `client/src/`): shared/hooks/AuthContext.jsx; shared/utils/apiClient.js (client is not authority).
- **Backend files/functions** (relative to `backend/`): middleware/authMiddleware.js; models/User.js; utils/tokenPolicy.js, tokenVersion.js, generateToken.js; tests/tokenVersion.test.js, tokenSecurity.test.js.
- **Database impact:** Existing tokenVersion remains monotonic; future lifecycle/security fields must join epoch logic.
- **Required changes:** Preserve established security baseline while extending roles; review policy-change session impacts.
- **Security implications:** Current role/confirmation/version override signed or cached claims; absent stored version only is zero, claim-less tokens reject.
- **Required tests:** Retain bcrypt/expiry/forged-role/reset/demotion/restoration tests; extend to new roles and lifecycle transitions.
- **Dependencies/blockers:** No four-role implementation implied; native concurrency remains unverified.

### RB04 — Partially Implemented

**Exact Phase15B requirement:**

> Only Administrator can provision/list/edit staff privileges, confirm/reset/delete accounts. Body field injection cannot escalate rights through signup/profile/product/order endpoints. Managers cannot assign themselves or another user Administrator

- **Existing evidence/status:** Partially Implemented. Current source provides only the subset described below; there is no four-role acceptance signoff.
- **Frontend files** (relative to `client/src/`): features/auth/components/AdminUserTable.jsx, UserModal.jsx; shared/utils/useAdminUsers.js.
- **Backend files/functions** (relative to `backend/`): routes/UserRoute.js; controllers/UserController.js; utils/adminAccountMutation.js; tests/security.test.js.
- **Database impact:** Role values and activation/deactivation design; verified mappings absent.
- **Required changes:** Keep staff administration admin-only; extend validated approved assignments, safe lifecycle and injected-field denials.
- **Security implications:** Do not give Manager access to staff provisioning or broaden admin guard; guest/student provisioning cannot accept privileged role fields.
- **Required tests:** Admin positive cases; every other role denied; body injection, profile escalation and alias bypass tests.
- **Dependencies/blockers:** Lifecycle representation, customer enrollment and last-admin policy.

### RB05 — Already Implemented

**Exact Phase15B requirement:**

> Canonical/uppercase/mixed-case self-delete rejects before either deletion function/session/fence; malformed IDs safely reject. Authorized peer administration still works

- **Existing evidence/status:** Already Implemented. Canonical identity protection and zero-delete rejection assertions exist in the local implementation.
- **Frontend files** (relative to `client/src/`): shared/utils/useAdminUsers.js and auth confirmation UI (UI checks remain secondary).
- **Backend files/functions** (relative to `backend/`): utils/accountIdentity.js; controllers/UserController.js deleteUser; tests/accountIdentity.test.js.
- **Database impact:** None for identity fix; preserve account IDs.
- **Required changes:** Reuse canonical comparison before mutation; no weakening for role expansion.
- **Security implications:** Case variants must not bypass self-delete; malformed IDs reject before deletion.
- **Required tests:** Retain lowercase/uppercase/mixed-case, invalid-ID, peer deletion and zero document/collection deletion assertions.
- **Dependencies/blockers:** Existing local adapter coverage; native deletion behavior unverified.

### RB06 — Partially Implemented

**Exact Phase15B requirement:**

> Every allowed operation enforces approved store/record scope: list/detail/search/aggregation/export/receipt paths cannot leak another store or unauthorized cashier's/customer's data by changing an ID/filter

- **Existing evidence/status:** Partially Implemented. Current source provides only the subset described below; there is no four-role acceptance signoff.
- **Frontend files** (relative to `client/src/`): features/orders/pages/OrdersPage.jsx; invoices/pages/InvoicePage.jsx; financials/pages/FinancialPage.jsx.
- **Backend files/functions** (relative to `backend/`): owner filters in Product/Order/Person/Invoice/DebtPayment/Financial controllers; ExpenseController creator/admin checks.
- **Database impact:** Store/resource membership and distinct order customer identity may need additive fields/indexes; preserve existing owners.
- **Required changes:** Separate store scope, actor/processor and customer subject; implement scoped list/detail/aggregate/receipt queries.
- **Security implications:** Never remove owner filters globally, trust requested owner IDs, or make Administrator a universal bypass.
- **Required tests:** Cross-store, cashier-to-cashier and student-to-student ID/filter/pagination/aggregate/receipt leakage tests.
- **Dependencies/blockers:** Approved scope/legacy-resource plan and private customer binding.

### RB07 — Not Implemented

**Exact Phase15B requirement:**

> Cashier cannot edit price/cost/stock or access full management reports. Approved Manager/catalog rights do not expose account administration. Response filtering excludes costs, secrets, hashes, tokens and unauthorized personal data

- **Existing evidence/status:** Not Implemented. Current source provides only the subset described below; there is no four-role acceptance signoff.
- **Frontend files** (relative to `client/src/`): features/products/pages/ProductPage.jsx; orders/pages/PosPage.jsx; dashboard/financial pages.
- **Backend files/functions** (relative to `backend/`): routes/ProductRoute.js; controllers/ProductController.js productPayload; routes/DashboardRoute.js, FinancialRoute.js.
- **Database impact:** Field-level rights, price-change audit; preserve cost and historical unitPrice.
- **Required changes:** Administrator-only product info/prices; Manager stock-only paths; Cashier sale-safe DTO; restrict management reports.
- **Security implications:** Current user can change stock/price; omitted costPrice defaults zero; combined payloads must not bypass price authority.
- **Required tests:** Price/cost/stock injection via every route, metadata-only edits preserving cost, recorded sale price and field redaction tests.
- **Dependencies/blockers:** Cost visibility details, scoped reports and separately authorized cost reset fix.

### RB08 — Not Implemented

**Exact Phase15B requirement:**

> Receiving/adjustment tests cover request versus approval versus application, unauthorized transitions, maker/approver identity if approved, recorded responsible users and reasons. No stock ledger acceptance based solely on a quantity input

- **Existing evidence/status:** Not Implemented. Current source provides only the subset described below; there is no four-role acceptance signoff.
- **Frontend files** (relative to `client/src/`): features/products/pages/ProductPage.jsx; new approved receiving/movement UI needed.
- **Backend files/functions** (relative to `backend/`): controllers/ProductController.js adjustStock/updateProduct; models/Product.js.
- **Database impact:** Receiving/movement/audit records with actor/time/product/delta/reason; authoritative stock design.
- **Required changes:** Implement direct Manager receiving/adjustments with required history; no mandatory second approver from superseded proposal.
- **Security implications:** Cashier/Customer cannot adjust; avoid absolute stale overwrites and duplicate deltas; audit and effect must not split.
- **Required tests:** Direct Manager success; denied roles zero effects; reason requirements, concurrency, retry and movement linkage.
- **Dependencies/blockers:** New data/audit design and native verification; approval of implementation only, not reapproval of direct Manager authority.

### RB09 — Not Implemented

**Exact Phase15B requirement:**

> Approved void/refund/cancellation authority is enforced on every entry point, including DELETE order alias, transaction void and invoice markVoid. Denied actions produce zero financial/stock effects. No refund test invents unapproved settlement/accounting rules

- **Existing evidence/status:** Not Implemented. Current source provides only the subset described below; there is no four-role acceptance signoff.
- **Frontend files** (relative to `client/src/`): features/orders/pages/OrdersPage.jsx PaymentSheet/actions; invoices/pages/InvoicePage.jsx; request/approval UI missing.
- **Backend files/functions** (relative to `backend/`): OrderController voidTransaction/deleteOrder; InvoiceController markVoid; OrderRoute/TransactionRoute/InvoiceRoute.
- **Database impact:** Refund/void requests, approval actor/reason/events and links to original records; no refund model now.
- **Required changes:** Manager approval/processing; Cashier request only; guard every alias; preserve completed history.
- **Security implications:** Existing owner-authenticated void/invoice mutation lacks Manager approval distinction; refund effects unspecified.
- **Required tests:** Every void/refund/cancel alias authorization, denied zero money/stock effects, audit reason and approved transitions.
- **Dependencies/blockers:** Payment/inventory refund/void effects and workflow must be defined before build.

### RB10 — Partially Implemented

**Exact Phase15B requirement:**

> Order and payment transitions are server-validated; no arbitrary status/price/payment-state assignment from the client. Concurrent cashiers and duplicate submissions require explicit integrity tests under approved semantics

- **Existing evidence/status:** Partially Implemented. Current source provides only the subset described below; there is no four-role acceptance signoff.
- **Frontend files** (relative to `client/src/`): orders/pages/PosPage.jsx, OrdersPage.jsx; services/ordersApi.js.
- **Backend files/functions** (relative to `backend/`): OrderController buildItems/decrementStock/completeTransaction; DebtPaymentController; models/Order.js; tests/payments.test.js.
- **Database impact:** Approved request identity/ledger design may be needed; preserve captured prices and history.
- **Required changes:** Keep backend catalog prices and conditional stock deduction; add approved transition/idempotency/concurrency safeguards.
- **Security implications:** Pending order is not paid/completed; current UI status/totals cannot be trusted; existing financial error masking persists.
- **Required tests:** Tampered totals/prices/status, competing cashiers, replay, partial failure, stock/balance/receipt reconciliation tests.
- **Dependencies/blockers:** Reservation/payment/fulfillment details, native tests and five deferred integrity risks.

### RB11 — Not Implemented

**Exact Phase15B requirement:**

> Guest/customer kiosk cannot call staff APIs or enumerate another person's order/receipt. If login is chosen, secure User/order ownership binding is tested; if guest is chosen, approved session/reference/privacy/rate controls are tested. No current user-role shortcut

- **Existing evidence/status:** Not Implemented. Current source provides only the subset described below; there is no four-role acceptance signoff.
- **Frontend files** (relative to `client/src/`): app/App.jsx has no kiosk; future catalog/cart/order-status surface required.
- **Backend files/functions** (relative to `backend/`): Current staff Product/Order/User routes; models/Order.js, Person.js, User.js.
- **Database impact:** Guest versus authenticated subject binding and reference/access metadata, without assuming Person equals User.
- **Required changes:** Build separate approved public-safe submission/read path and authenticated student ownership; support both modes.
- **Security implications:** Never reuse legacy user role as customer or make staff route public; references must not enumerate private orders.
- **Required tests:** Both guest and student positive ordering; other-order enumeration and all staff API denials; session privacy/reset tests.
- **Dependencies/blockers:** Identity/enrollment, guest reference/access lifecycle, store scope and fulfillment rules; no Phase16 implementation now.

### RB12 — Not Implemented

**Exact Phase15B requirement:**

> Cashier cross-history, Manager price edits/adjustment approval and financial visibility match the signed D decisions exactly, including denial cases and aliases

- **Existing evidence/status:** Not Implemented. Current source provides only the subset described below; there is no four-role acceptance signoff.
- **Frontend files** (relative to `client/src/`): Profile/Admin controls; product fields; orders/history/financial pages and navigation.
- **Backend files/functions** (relative to `backend/`): Product/Financial/Order/Invoice controllers and all relevant routes; capability policy needed.
- **Database impact:** Scope/audit representations supporting approved actions, not arbitrary historical rewrite.
- **Required changes:** Apply exact five 15C owner decisions consistently across reads, writes, reports and aliases.
- **Security implications:** Manager cannot edit price; cashier own history only; combined inventory duties do not grant system roles or security audit access.
- **Required tests:** Explicit positive/negative checks for Manager direct stock/refund approval/all-history; Admin-only price; Cashier own-only; field leakage.
- **Dependencies/blockers:** Conditional Administrator/Manager cashier duties, cost/expense/settings scope details.

### RB13 — Already Implemented

**Exact Phase15B requirement:**

> Administrator requests admitted before revocation cannot regain privilege at mutation time. Keep actor-version guard, same-transaction fence and safe retry rechecks; do not broaden adminAccountFilter for convenience

- **Existing evidence/status:** Already Implemented. The existing account helper guards self writes and fences different-target account writes in the transaction.
- **Frontend files** (relative to `client/src/`): Account-management UI caller; no authority from frontend.
- **Backend files/functions** (relative to `backend/`): utils/adminAccountMutation.js, accountCommitBoundary.js; models/User.js; tests/a03TokenReview.test.js, a04Security.test.js.
- **Database impact:** Preserve epoch/__v fence behavior; new audit atomicity must not weaken it.
- **Required changes:** Keep admin-only actor guard and same-transaction target operations; use a separate authorized design for other business capabilities.
- **Security implications:** Do not generalize adminAccountFilter to grant Manager account administration; admitted request cannot restore authority after committed revocation.
- **Required tests:** Keep paused demotion/reset/confirmation races and safe retry rechecks; extend role/lifecycle cases.
- **Dependencies/blockers:** Local tests only; real serialization and any audit transaction redesign need approved native verification.

### RB14 — Already Implemented

**Exact Phase15B requirement:**

> Both R1 commit replay probes continue to pass: uncertain commit cannot repeat target/fence effects; legitimate confirmed-abort/ack retries remain; cleanup preserves acknowledged success and primary error; unknown outcomes retain retryable false

- **Existing evidence/status:** Already Implemented. Commit-boundary replay/error controls and permanent regression assertions exist; this is not native MongoDB proof.
- **Frontend files** (relative to `client/src/`): shared/utils/apiClient.js and account API callers preserve errors.
- **Backend files/functions** (relative to `backend/`): utils/accountCommitBoundary.js, adminAccountMutation.js, accountMutationOutcome.js; tests/commitReplay.test.js, accountFaults.test.js.
- **Database impact:** No additional field needed by existing observer; persistent deduplication is separate.
- **Required changes:** Preserve public-commit observation, before-target replay guard, primary errors and cleanup isolation.
- **Security implications:** Unknown commit cannot authorize target replay; empty wrapper entry is not second mutation; retryable false is advisory.
- **Required tests:** Both original R1 probes; compound labels; safe abort/ack retries; primary cause, cleanup success/error and method restoration.
- **Dependencies/blockers:** Installed driver contract and synthetic effects verified locally; native topology/protocol remain unverified.

### RB15 — Partially Implemented

**Exact Phase15B requirement:**

> Frontend navigation/pages/actions match approved permissions, stale UI state does not bypass the backend, and account errors remain sanitized. Customer surfaces do not render staff routes through cached storage manipulation

- **Existing evidence/status:** Partially Implemented. Current source provides only the subset described below; there is no four-role acceptance signoff.
- **Frontend files** (relative to `client/src/`): DashboardGuard.jsx, Layout.jsx, AuthContext.jsx, ProfilePage.jsx, authApi.js, apiClient.js.
- **Backend files/functions** (relative to `backend/`): authMiddleware.js; User and business routes/controllers; safeErrors.js.
- **Database impact:** DTO/subject scope may require approved data fields; no need to persist client menu grants.
- **Required changes:** Add role/capability-aware navigation and action states backed by server decisions; retain provisional branding and safe diagnostics.
- **Security implications:** Cached user is not server authority; hidden buttons cannot secure direct requests; denial must not auto-resubmit uncertain writes.
- **Required tests:** Deep links, stale/forged storage, direct requests, unauthorized fields, error/log redaction, all guest/staff screen boundaries.
- **Dependencies/blockers:** Approved capability/resource design; browser verification separate from SSR.

### RB16 — Cannot Verify

**Exact Phase15B requirement:**

> Migration dry-run/commit/recovery verifies exact authorized account IDs/counts, unchanged bcrypt/confirmation/history/ownership, expected epoch increases, protected last-admin rules if approved, and no automatic treatment of uncertain accounts

- **Existing evidence/status:** Cannot Verify. No live inventory, approved mapping, migration execution or recovery evidence is available; migration tooling is also absent.
- **Frontend files** (relative to `client/src/`): Future admin migration review UI/tooling; existing AdminUserTable is not migration evidence.
- **Backend files/functions** (relative to `backend/`): models/User.js; security-aware UserController/admin mutation helpers; migration artifact absent.
- **Database impact:** Actual account inventory/mappings, backups and compatibility cannot be verified locally; migration procedure not implemented.
- **Required changes:** Prepare approved exact-ID plan/dry-run/recovery before changes; never map every user to staff privileges.
- **Security implications:** Preserve verified admin, hashes, confirmation/owners/history and monotonic epochs; no blind raw bulk role updates or old-epoch restore.
- **Required tests:** Synthetic mapping, dry-run zero writes, exact counts/IDs, rollback as new security changes, interrupted/indeterminate reconciliation.
- **Dependencies/blockers:** Approved read-only account inventory, verified legitimacy/mappings, backup/recovery and explicit migration/session authorization.

### RB17 — Not Implemented

**Exact Phase15B requirement:**

> Durable audit entries, if approved/implemented, identify actor/target/action/time/result without credentials; unprivileged roles cannot alter them. Missing audit functionality cannot be called verified based on request logs

- **Existing evidence/status:** Not Implemented. Current source provides only the subset described below; there is no four-role acceptance signoff.
- **Frontend files** (relative to `client/src/`): No audit review page; operational history UI missing.
- **Backend files/functions** (relative to `backend/`): middleware/logger.js request diagnostics; User/Product/Order models and sensitive controllers; no durable Audit model.
- **Database impact:** Durable events/outbox or equivalent design with actor/target/action/time/reason/result and access/retention indexes.
- **Required changes:** Add required sensitive-action audit and controlled admin/operational views; deny audit mutation in normal UI.
- **Security implications:** Request logs/timestamps/__v cannot establish who approved a price/stock/refund action; define mutation/audit failure consistency.
- **Required tests:** Required event attribution, sensitive field exclusion, unauthorized read/write denial, mutation/audit failure and unknown-outcome handling.
- **Dependencies/blockers:** Audit persistence/retention/failure strategy approval; no credentials in logs; transactions/native evidence if cross-record.

## 6. Frontend impact assessment

Retain feature folders, router, layout, reusable forms, formatting, invoice component and redacted API client. No generic application rewrite or wholesale screen redesign is necessary.

| Area | Expected changes after authorization | Acceptance boundary |
| --- | --- | --- |
| AuthContext, DashboardGuard, App | Role/capability-aware landing and route eligibility; refresh/reconcile stale account state; clear customer session state on kiosk handoff | Cached role or forged storage never grants staff data; fresh login after security changes; backend still authoritative |
| Layout/sidebar | Render only permitted destinations using the same approved capability vocabulary | Deep links/direct APIs remain denied; existing provisional text branding retained |
| Profile/AdminUserTable/UserModal/useAdminUsers | Four-role approved labels/validation, administrator-only staff provisioning, safe lifecycle controls after policy approval | Manager/Cashier/Student cannot access account-list/mutation APIs; canonical self-delete tests retained |
| ProductPage and product API | Separate catalog/price management from stock operations and customer-safe product display | Administrator-only metadata/price changes; Manager read/stock interface cannot submit unauthorized price/cost fields |
| PosPage and OrdersPage | Cashier checkout and own history; Manager approved all-cashier operational view; conditional operational duties represented explicitly | Own completed history is not the same permission as assigned-order fulfillment; payments remain server validated |
| InvoicePage/Invoice | Scoped receipt access and refund/void capability states; account for ensure endpoint's write effect | Direct receipt IDs and ensure aliases cannot bypass object scope; snapshot prices retained |
| FinancialPage/ExpensePage | System/Manager reporting versus Cashier personal summaries; expenses remain unassigned until decided | Server-filtered totals/fields; no profit claim based solely on collected revenue |
| New guest/student surface | Separate approved catalog/cart/reference/status experience, not exposure of staff Layout/POS | Both modes and private-order separation tested; this assessment does not authorize building it |
| Audit/settings | New restricted views only after approved data/API design | System audit Administrator-only by default; Manager movement history is operational history, not all system logs |

Customer kiosk, approval screens, inventory ledger and system audit UI are missing features, not changes to existing buttons. A future screen test suite needs route/deep-link and field-presence assertions; existing SSR/transport tests alone do not prove browser accessibility, responsive behavior, focus, printing or kiosk-session privacy.

## 7. Backend impact assessment

Use the existing route/middleware/controller separation. Introduce a narrowly scoped capability evaluator and resource-scope helpers only under implementation authorization; review them centrally rather than scattering role-string comparisons across controllers. Middleware admission, conditional mutation authorization and output filtering solve different problems.

1. Enumerate every mounted method and alias in section 2, including customer/debt compatibility paths, invoice ensure and independent invoice void. Deny unknown/unassigned operations. Preserve health/login as explicitly public diagnostic/authentication surfaces.
2. Update User enum, controller validators and frontend selectors coherently after persisted identifiers/legacy handling are approved. Do not turn administrator-only register into a public role-assignment endpoint. Student enrollment, if provided, needs a separate constrained path.
3. Keep administrator account guards restricted to account administration. Future activation/capability/security changes must increment the account epoch atomically and be included in protect's selected fields/validation as applicable. Raw updateOne/bulk writes must not bypass User save-hook guarantees.
4. Split product input permissions: metadata/prices, stock receiving/adjustment and sale-safe display are distinct. Validate forbidden fields even when submitted through alternate aliases or combined payloads. Correcting the omitted cost-price reset requires a separately authorized targeted implementation, not merely hiding a field.
5. Design store/actor/customer query scope consistently for list/detail/search/aggregate/invoice/debt/payment paths. Existing owner cannot simultaneously mean store, cashier and student. Never implement Manager visibility by dropping all owner conditions.
6. Add refund/void request, approval and application checks only after their payment/stock effects are specified. Existing void/deletion aliases and markVoid must not remain a bypass. Preserve original financial references; do not reinterpret or rewrite historical completed transactions.
7. Add durable audit/movement consistency guarantees. A successful write followed by a failed audit insert is a partial outcome unless a reviewed atomic/outbox strategy prevents it. Do not introduce automatic replay of indeterminate writes to repair missing logs.
8. Test authorization again at security-sensitive mutation boundaries where role changes can interleave, using the approved data-layer approach. Existing account actor fences are reusable evidence, not a blanket guarantee for future business capabilities.

There is no implemented server settings resource, refund-request model, receiving/movement ledger or durable system audit collection in the inspected model/route set. Future modules must fit existing architecture and receive explicit scope/data approval.

## 8. Database and account migration impact

### Existing relationships and limitations

| Existing record | Source relationship | Impact |
| --- | --- | --- |
| User | Single role enum; confirmed; password; tokenVersion; no independent active flag/store membership/capability assignments | Additive role/lifecycle representation must preserve authentication and epoch logic |
| Product | Required owner -> User; price/costPrice/stock/isActive; owner-based indexes | A shared catalog needs an approved resource model and historical ownership strategy; cannot merge catalogs by relabeling roles |
| Person.js exports Customer | Required owner -> User, contact fields and soft deletion | Contact record is not proof of an authenticated student identity; no secure User/customer ownership binding exists |
| Order.js exports Transaction | owner -> User; customer -> Customer; processedBy -> User; captured unitPrice/subtotal; statuses and ledgerRecorded | Separate store, cashier and student/guest subjects; processedBy is useful but does not prove completeness/legitimacy of historical cashier attribution |
| Invoice / InvoiceCounter | Owner/transaction/customer references and numbering | Preserve receipt references and historic ownership; compound invoice indexes are not proof of uniqueness/idempotency |
| DebtPayment | Owner/customer/optional transaction; payment amount/reference/time | Scope linked records consistently; paymentReference is not a guaranteed request idempotency key |
| Expense / Financial | Existing expense ownership and financial structures/derived reports | Do not assume owner data can be pooled safely or that accounting policy is approved |
| Audit / movement / approval / store membership | No corresponding durable model identified | New records/fields/indexes require approved schemas, retention, atomicity and migration alternatives |

This is not a statement of actual collection names or persisted account counts. The driver/model conventions do not establish the intended live database or inventory; no database was connected. Legacy owner-linked catalogs/orders are preserved, not silently merged.

### Proposed change families — alternatives, not approved schemas

| Reason / affected data | Proposed design work | Compatibility alternatives and risks |
| --- | --- | --- |
| Four roles; User.role and assignments | Approve exact keys and deny-by-default compatibility state; extend validators centrally | Retain admin identifier; legacy user remains explicitly unmapped/restricted until ID-reviewed assignment. Dual readers may be needed before writers; an old binary must not silently misinterpret new roles |
| Account activation and conditional grants | Specify whether lifecycle has a separate field and how approved operational capabilities attach to an account | confirmed is not documented as independent deactivation. Any new security field must participate in current-account validation and atomic epoch changes; no automatic Administrator/Manager POS/refund grant |
| Shared resources / owner fields | Approve store membership/resource attribution and processor/customer subject distinctions; design additive indexes and backfill only for approved IDs | Single-store deployment does not remove the need to scope records. A per-owner compatibility phase may precede shared data; no shared-catalog migration is authorized |
| Guest/student orders | Add unambiguous origin/subject/access metadata under an approved privacy model | Guest reference versus authenticated User binding must be designed separately; preserve legacy Customer and transaction references |
| Audit, receiving, refund/void approval | Durable append-oriented event/approval design and mutation consistency; restrict ordinary writes to history | Same-transaction event versus atomic embedded event/outbox are alternatives. Multi-document designs depend on transaction support; audit failure behavior must be approved |
| Idempotency / concurrency | Scope request identities, uniqueness and effect reconciliation to approved operations | Requires separate integrity design. Neither ledgerRecorded nor R2 commit observation guarantees repeated HTTP submissions cannot duplicate a sale/adjustment |

Before schema/migration implementation, require the exact fields/types/validation/index proposal, affected legacy fields and records, dry-run plan, backup coverage, risks/alternatives and rollback/recovery review. This assessment approves none of those changes.

### Migration and session compatibility sequence — not executable authorization

1. Establish production identity/read-only access through A01; verify intended database, effective permissions, account collection and administrator legitimacy. Do not infer identity from the fallback database name or an admin role.
2. Obtain an owner-approved exact-ID mapping for existing accounts. Preserve verified Administrator access; do not promote every user to Cashier/Manager or assign uncertain accounts automatically.
3. Approve a consistent backup of accounts, linked historical records and security state, with isolated recovery rehearsal. Preserve IDs, bcrypt hashes, confirmed states, contacts, record owners and prices; no record deletion/reset.
4. Prepare a synthetic dry-run/validation artifact with counts, approved IDs, unknown values, cross-record references and rejected mappings. No such migration tool currently exists.
5. Deploy compatible deny-by-default readers before permitting new role writes, with explicit session-cutover approval. Role or grant changes must advance epochs within the same guarded account update; preserve canonical self-operation protections.
6. Reconcile each acknowledged/failed/indeterminate change before resubmission. Recovery is a reviewed new security change with monotonic epochs, not restoring old tokenVersion values or a verifier that accepts stale tokens.
7. Verify expected counts, login compatibility, unchanged history/ownership and new-role authorization in the authorized environment. Do not backfill missing cashier/customer identity from unverified assumptions.

Existing versioned tokens are not an excuse to accept claim-less legacy tokens. New role names do not change signature/lifetime requirements. Code-only permission expansion for an unchanged role can change an active session's authority without an epoch increment; assess and explicitly authorize that cutover. Production session invalidation is outside this phase.

## 9. Security risks and mitigation recommendations

| Risk | Evidence / impact | Required mitigation and gate |
| --- | --- | --- |
| Legacy-role escalation | user currently has catalog/stock/void/report powers; unknown account legitimacy | Exact reviewed mapping; deny unassigned capabilities; no automatic staff/customer promotion |
| Direct API bypass | Business routes often protect only, product routes allow both existing roles | Per-method capability checks plus scoped query/field validation; negative direct API tests |
| Pricing bypass and cost loss | ProductController productPayload combines price/cost/stock and defaults omitted costPrice to zero | Administrator-only price writes; explicit input/output policy; separately authorized omitted-field fix |
| Record-scope leakage | Owner identifies requester, not store/customer/processor separately | Approved subject/resource model; cross-ID/aggregation/receipt tests; no unrestricted Manager queries |
| Guest/student impersonation | Customer contact and User account are unrelated identities | Explicit server binding and guest access design; public DTOs, privacy/rate/session controls |
| Refund/void bypass | Several aliases and independent invoice status mutation; no approval record | Manager approval and Cashier request-only enforced across aliases; approved financial/stock effects first |
| Audit gaps / partial audit | Request logger does not attribute durable business actions | Durable controlled audit/movement design with approved consistency, retention and access policy |
| Stale admitted actor / session cutover | Account guards exist; ordinary business writes have no equivalent epoch fence | Preserve account guard; design mutation-time checks for new sensitive actions; approved session/recovery plan |
| New schema/hook bypass | Raw role/lifecycle writes could skip epoch save logic | Central security-aware writers, validators, concurrency tests and monotonic recovery |
| Native transaction uncertainty | Cross-account fence and financial transactions rely on server support; only local/mocked evidence | Fail closed if unsupported; separately authorized isolated tests after A08B prerequisites, no downgrade |
| Historical exposure / recovery limitations | Prior security reports cannot establish current provider keys/account legitimacy | A01 and separately approved rotation/account recovery remain independent gates; no secret values in report |

### Deferred integrity risks remain open

| Risk | RBAC interaction | Disposition |
| --- | --- | --- |
| Repeated stock adjustments | Manager permission does not deduplicate a resubmitted delta | Separate request identity/effect/audit design and authorized tests required |
| Lost concurrent inventory adjustments | read-add-save/absolute stock edits can overwrite competing updates | Separate safe atomic/conditional mutation design; no inferred native verification |
| Partial activation | setActiveProducts uses multiple writes | Separate all-or-nothing/failure handling design; RBAC must still guard the alias |
| Payment resubmission | A second HTTP request can repeat effects; account R2 observer is not financial deduplication | Separate payment integrity scope and approved semantics |
| Financial error masking | Post-write/cleanup failures can obscure results outside account helpers | Separate fault-handling review/remediation; avoid claiming definite failure/safe replay |
| Omitted cost-price reset | ProductPage omits costPrice; update defaults it to zero | Deferred targeted fix; no product update submitted or record corrected |
| Native MongoDB behavior | Serialization, transaction durability and commit/network faults not observed here | A08B still blocked pending isolated target, effective permissions, runner, test/cleanup scope and execution approval |

## 10. Test strategy and verification performed

### Required future verification

| Layer | Coverage and evidence required |
| --- | --- |
| Policy/model unit tests | Approved four-role keys; unknown/malformed/legacy values; exact conditional grants; deny-default; no User/Person identity conflation |
| Direct API authorization | Every mounted method/alias with each role, anonymous/unconfirmed/deleted accounts and invalid/expired/stale tokens; denied requests cause zero writes, fence/session calls where applicable, payments or stock effects |
| Field/object scope | Product price/cost/stock injection; all-history versus own-history; other student/guest references; list/search/pagination/aggregate/receipt/ensure responses; no secret/private fields |
| Account/security regressions | Preserve bcrypt, strict lifetime/legacy/version semantics, role/reset/confirmation invalidation, fail-closed lookups, demotion races and case-variant zero-delete protection |
| Financial/inventory acceptance | Manager direct reasoned movements, no second approver; Manager refund/void approval and Cashier request-only; server prices and explicitly approved state/effect rules; no unapproved refund/credit policy |
| Audit consistency | Required actor/target/action/time/reason/result, read/mutation permissions, sensitive-value exclusion, success/failure/unknown outcomes and failed audit persistence |
| Frontend | Menus/actions/deep links/landing pages for four roles and guest mode, forged storage, expired sessions, redacted diagnostics and no unsafe automatic retries |
| Migration | Synthetic exact-ID dry-run and interrupted/recovery tests; unchanged hashes/confirmation/history/owners; monotonic epochs; explicit account inventory required before live claims |
| Native integration | Independent clients and barriers; actor/target serialization; unsupported topology; duplicate/partial effects; commit uncertainty and cleanup. Requires a separate authorized disposable target and A08B scope |

Keep all 17 criteria and the five settled owner checks as release gates. Existing passing account tests are regression assets, not proof the new policy works. Browser-level accessibility, responsive and printing checks need an actual authorized local browser session later; none occurred here.

### Actual Phase15D verification

| Check | Actual result |
| --- | --- |
| Required documents / authority | All present;15C explicitly supersedes pending15B proposals; no blocking contradiction |
| Criterion coverage | All 17 exact requirements transcribed, individually classified and mapped to frontend/backend/data/security/tests/dependencies |
| Route/model tracing | Inspected mounted routers, controls, owner queries, User hooks and security/commit helpers locally |
| Existing test evidence | Inspected relevant assertions/declarations; no tests edited or run |
| Backend suite / client suite / build | **Not run in Phase15D**. Historical latest reviewed reports record 129 backend and 16 client passes and successful build; not new execution results |
| Lint | **Not run in Phase15D**. Historical full-client baseline remains 16 errors/13 warnings; Phase15A targeted Layout checks retained 2 pre-existing errors. No claim of fresh lint verification |
| Database/provider/native behavior | **Cannot Verify**; no connection or database operation |
| Workspace/document preservation | 183 baseline files compared: only the implementation plan changed; this report was added; none were removed. All other baseline files hash-match. The plan's original 54,421 bytes remain an exact prefix |

Documentation checks found 17 criterion sections matching all 17 exact source requirements, 4 resolving relative links, no trailing-whitespace lines and no connection-string/JWT-shaped values in this report. This heuristic is not a comprehensive secret audit. Git diff whitespace check passed; it emitted pre-existing line-ending notices for three untouched tracked files. No test/build/lint execution is implied by these documentation checks.

No synthetic mock result is represented as native MongoDB concurrency or durability. No test count has been invented or inferred from names.

## 11. Dependencies and blockers

- **Policy representation:** exact stored role keys, legacy compatibility and conditional operational grants; retain exactly four approved roles, no separate Inventory Staff.
- **Resource/identity scope:** shared catalog/store membership versus existing owner data; cashier attribution, private student identity, guest reference/access lifecycle and approved narrow fulfillment access.
- **Lifecycle/audit design:** independent activation/deactivation semantics, audit persistence/retention/access/failure consistency and optional last-admin safeguard policy.
- **Financial/workflow details:** approved payment methods and refund/void stock/payment effects; reservation/pickup/cancellation/assignment rules where the intended implementation needs them. Role approval does not define these effects.
- **Unassigned capabilities:** cost information, expense rights, exports and exact system settings. Deny by default until specified.
- **Account migration:** A01 remains blocked; verified target/account inventory/admin legitimacy, approved mappings, backup/recovery and session cutover are prerequisites for real-account migration, not a reason to connect during local design.
- **Native evidence:** A08B target/isolation/effective permissions/fail-closed runner/test+cleanup scope and explicit execution approval remain missing. No local RBAC task bypasses them.
- **Existing integrity/client issues:** section 9 risks and historical lint debt are not repaired by role design. Handle through separately authorized scopes.

Local capability analysis/tests can be isolated from production inventory, but deployment, shared catalog backfill, activation schema, approvals and kiosk workflows cannot be bundled into a blanket “role rename” change.

## 12. Recommended implementation sequence — future authorization required

1. Resolve section 14 implementation details and approve a bounded capability/resource/schema proposal, preserving all 17 criteria and existing security invariants.
2. Authorize a local permission foundation: centralized default-deny policy, compatibility handling and a full role/method/field/scope test inventory using synthetic fixtures. No real account assignment, kiosk build or data merge.
3. Implement approved User/controller/guard/DTO and frontend capability integration in small reviewed changes; test role changes and conditional grants without broadening account administration.
4. Separately authorize scoped resource/identity and durable audit/lifecycle changes, with schema/backup/migration/rollback review before database-impacting work.
5. Implement catalog/pricing restrictions and separately approved cost-preservation correction; then Manager inventory movements after integrity/audit design, without an invented second approver.
6. Implement Cashier personal history and Manager authorized all-cashier reporting/receipt scopes. Do not bypass ownership by unfiltered queries.
7. Authorize refund/void and guest/student/fulfillment workflows only after their unresolved effect/privacy rules are specified. This is future feature work, not authorized Phase16 implementation.
8. Perform independent local security/behavior verification. A08B isolated native testing requires its own evidence and explicit authorization and does not start automatically.
9. Only after A01, approved exact account mapping, backup/recovery, native verification and release review: request separate migration/session/deployment authorization. Never restore a pre-security verifier or old epochs as rollback.

## 13. Files expected to change during implementation

These are impact candidates, not a change authorization or mandate to edit every file.

| Existing files / likely additions | Reason |
| --- | --- |
| `backend/models/User.js`, `controllers/UserController.js`, `routes/UserRoute.js` | Approved enum/legacy/lifecycle validation and staff provisioning |
| `backend/middleware/authMiddleware.js`; proposed capability/scope helpers | Preserve authentication, apply approved current-account capability/scope checks |
| `backend/utils/adminAccountMutation.js`, `accountMutationOutcome.js`, `accountCommitBoundary.js`, `accountIdentity.js`, token helpers | Primarily preservation/regression review; no automatic rewrite or widening of admin guard |
| `backend/routes/{Product,Order,Transaction,Invoice,DebtPayment,Person,Customer,Financial,Dashboard,Expense}Route.js` and corresponding controllers | Method/alias capabilities, object scope, forbidden fields and output policy |
| `backend/models/{Product,Order,Person,Invoice,DebtPayment,Expense,Financial,InvoiceCounter}.js` | Review scope/identity/index/history compatibility; changes only if approved design requires them |
| Proposed audit/movement/approval resources and services | Missing required persistence and controlled APIs; names/schema not finalized |
| `client/src/app/App.jsx`, `shared/hooks/{AuthContext,DashboardGuard}.jsx`, `shared/components/Layout.jsx` | Role-aware landing/routes/navigation with server authority retained |
| `client/src/features/auth/{pages,components,api}`, `shared/utils/{useAdminUsers,useProfile}.js` | Approved staff lifecycle/role UI and safe account state refresh |
| `client/src/features/{products,orders,invoices,financials,people}` pages/components/services | Scoped actions, fields, histories and customer privacy; preserve working forms/calculations |
| Future separate kiosk/audit/movement/approval feature folders | Missing surfaces; separately authorized feature scope, not a generic restructure |
| `backend/tests/*.test.js`, `client/tests/*.test.js` and new scoped suites | Keep security regressions and add 17-criterion matrix/ownership/effect tests |
| Future migration/dry-run tooling and docs | Exact approved account/resource mapping, compatibility, recovery and evidence; no current tool execution |

No environment, dependency, lockfile, hosting/display configuration or database collection rename is required merely to express roles. A future developer must justify any additional change rather than treating this list as permission.

## 14. Further owner clarification / technical approvals

The approved role responsibilities and five owner decisions are fixed. Remaining decisions are:

1. Persisted identifiers and legacy unmapped behavior; representation of conditional Administrator/Manager POS, payment, receipt, inventory and Administrator refund authority. Do not infer all such grants from role hierarchy.
2. Resource scope/legacy catalog treatment, cashier attribution and allowed assigned-order access; student enrollment/binding and guest reference/status/session/privacy/rate controls.
3. Activation/deactivation representation and last-admin safeguard, if desired; effects of policy-only changes on active sessions.
4. Audit event schema, retention/access, operation-result semantics and persistence failure strategy; cost data, expenses, exports and exact system setting capabilities.
5. Refund/void payment and inventory effects, supported payment methods and required reservation/pickup/cancellation rules before building affected workflows.
6. Approved actual account mapping, backup/recovery and deployment ordering/session cutover, after authorized A01 evidence. No live roster or legitimate administrator is presumed.

These are required inputs for the applicable implementation slice, not permission to invent policies or override the finalized specification. No new business roles or second inventory approver are proposed.

## 15. Final readiness assessment

**NOT READY FOR BLANKET IMPLEMENTATION AUTHORIZATION.** Architecture and technical impacts are sufficiently identified to prepare a bounded local RBAC foundation authorization after its role/capability/compatibility decisions are resolved. Missing workflows, schema/ownership/audit choices, migration evidence, integrity controls and native transaction verification prevent an end-to-end readiness claim.

All 17 mandatory criteria remain intact: 4 existing local security foundations,5 partial,7 missing and1 unverifiable migration acceptance target. No source/test/configuration/environment/lockfile/account/role/database change, dependency installation, connection, migration, deployment or session invalidation occurred. Only this report and an additive plan entry may change.

Existing Phase15A branding, password/JWT/token-version safeguards, administrator actor guards, canonical self-delete protection and A08A-R2 replay/error handling are preserved. The project remains independent of GradeSense AI. **Stop after this assessment; implementation, A08B and production rollout remain unauthorized.**

