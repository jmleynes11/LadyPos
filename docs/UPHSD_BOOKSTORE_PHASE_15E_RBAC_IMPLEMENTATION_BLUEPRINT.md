# Phase15E — RBAC implementation blueprint

Date: 2026-11-03, Asia/Manila. **UPHSD Bookstore POS**.
Formal project title: **UPHSD BookstorePOS: Point-of-Sale and Inventory Management System for the University Bookstore**.

**READ-ONLY DESIGN. NO IMPLEMENTATION AUTHORIZATION.** This document proposes implementation contracts and independent batches. It creates no roles, account permissions, schema, APIs or workflows. A08B and production changes remain unauthorized.

## 1. Authority, outcome and evidence boundary

Read the [Phase15C finalized specification](UPHSD_BOOKSTORE_PHASE_15C_FINALIZED_ROLE_PERMISSION_SPECIFICATION.md), [Phase15B design](UPHSD_BOOKSTORE_PHASE_15B_ROLE_PERMISSION_DESIGN.md), [Phase15D assessment](UPHSD_BOOKSTORE_PHASE_15D_RBAC_TECHNICAL_IMPACT_ASSESSMENT.md) and [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md). Phase15C controls business permissions; Phase15B's exact RB01-RB17 wording is retained in section7. Earlier proposals do not reopen settled decisions.

The four roles remain **Administrator, Store Manager, Cashier, Customer / Student**. Store Manager includes inventory duties. No separate Inventory Staff role, generic superuser role or guest staff account is proposed. Guest is an ordering access mode, not a fifth persisted business role.

The existing architecture can support the design through narrow middleware/policy, scoped-query, field-validation and service additions. Twelve batches below separate local foundations from data-impacting features and real-account cutover. They are reviewable implementation units with explicit gates, not instructions to execute now.

**Phase15D baseline unchanged:** RB03/RB05/RB13/RB14 Already Implemented as local security foundations; RB02/RB04/RB06/RB10/RB15 Partially Implemented; RB01/RB07/RB08/RB09/RB11/RB12/RB17 Not Implemented; RB16 Cannot Verify. No criterion has been promoted by documentation.

### Classification used throughout

- **Already approved in Phase 15C:** binding business permission or restriction. No reapproval of the five owner decisions is requested.
- **Technical recommendation:** proposed implementation mechanism or file/contract name; not an existing feature or permission grant.
- **Requires owner approval:** unresolved business/compatibility/schema/API/failure-policy choice or execution scope. Absence of a decision never grants authority.
- **Requires additional evidence:** facts unavailable locally, including actual accounts, target identity, effective provider permissions or native database guarantees.

All proposed identifiers, function names, schemas and new paths are Technical recommendations unless explicitly marked otherwise. Schema/API adoption and batch execution still require authorization. No new action label below expands a Phase15C permission.

### Files inspected and actual checks

Reinspected User model/hooks, UserController/UserRoute, authMiddleware, ProductController/ProductRoute, Order model, all mounted business route declarations, app.js mounts, Financial/Expense controller scope, Customer model identity, token policy/version/issuer, adminAccountMutation, accountCommitBoundary, accountMutationOutcome, safeErrors/response helpers; client App/DashboardGuard/useAdminUsers and the existing architecture/test evidence. Inspected declarations of backend security/token/account/commit tests and client diagnostics/logout/invoice/retry tests; package scripts were read, not executed.

Relevant paths are expanded in sections3-7. Existing local source establishes behavior; reports supply dated context. The inspected source still uses admin/user and owner=requester. No database/account inventory, environment secret, provider or external service was queried.

Only source/document reads and documentation coverage/preservation checks occurred. **No tests, builds or lint runs in Phase15E.** Historical evidence remains129 backend passes,16 client passes and successful build; full client lint16 errors/13 warnings, with2 pre-existing Layout errors in Phase15A targeted checks. These are not new results. Native MongoDB concurrency/durability and browser behavior remain unverified.

## 2. Existing implementation and fixed security invariants

| Current implementation | Evidence | Blueprint consequence |
| --- | --- | --- |
| One role string, enum user/admin, default user; confirmed; tokenVersion; no independent activation/membership/grant representation | `backend/models/User.js`; controller allowlists | Update schema/validators only under B02 approval; no automatic legacy role reinterpretation |
| protect verifies HS256 and strict iat/exp/version, then loads current account role/confirmation/epoch | `middleware/authMiddleware.js`, `utils/{generateToken,tokenPolicy,tokenVersion}.js` | Keep604,800-second maximum; absent stored epoch alone zero; missing/malformed version claim denied; no JWT role authority |
| Password hashing once and compatible bcrypt comparison | `models/User.js`, `utils/passwords.js` | Preserve existing hashes and login compatibility; no password migration or plaintext conversion |
| Atomic User security save conditions; guarded self account mutation and cross-account actor fence | `User.js`, `UserController.js`, `adminAccountMutation.js` | Extend approved security fields without bypassing epochs; never broaden adminAccountFilter to Manager |
| Canonical ObjectId self-delete guard before mutation/session/fence | `accountIdentity.js`, `UserController.deleteUser` | Retain uppercase/mixed-case rejection and zero-effect assertions |
| R2 commit observation distinguishes unsafe replay from permitted driver retry; cleanup preserves primary outcome | `accountCommitBoundary.js`, `accountMutationOutcome.js`, `adminAccountMutation.js` | Do not replace with callback-only labels or infer safe resubmission from a500 response |
| Business routes mainly authenticate; products permit both old roles; owner filters isolate requester data | All11 routers; Product/Order/Person/Invoice/DebtPayment/Financial controllers | Add action, object scope and field checks separately; do not remove owner filters globally |
| Shared authenticated shell; cached role; only admin account-table visibility | `client/src/app/App.jsx`, `shared/hooks/{AuthContext,DashboardGuard}.jsx`, Layout/Profile/UserModal | Backend first; capability-aware shell follows, never substitutes for server enforcement |
| No durable action audit, stock ledger, approval module or public kiosk boundary | Inspected models/routes; logger only request metadata | Missing features require new approved contracts; no acceptance based on buttons or logs |

These are preserved requirements, not authority to rewrite authentication, change session duration, rotate credentials, add roles or perform data repair. Account fences currently protect account mutations; they do not automatically protect new product/payment operations from admitted-actor races.

## 3. Proposed technical contracts

### 3.1 Policy, scope and field pipeline

**Technical recommendation:** retain Express routes/controllers and Mongoose models. Add small `backend/auth/` policy/scope helpers and `backend/services/` only where domain mutation/audit boundaries justify them. Existing folders need no generic restructure or new dependency.

The future protected request path is:

1. Existing protect validates signature, lifetime, epoch and current account; approved lifecycle/membership/grant fields are loaded from persistence, never trusted from a body/JWT/cache.
2. `requireCapability(action)` performs action admission using `evaluateAccess(currentActor, action, context)`. Unknown role/action, missing scope or malformed security state denies.
3. `scopeFor(currentActor, action, requestFilters)` supplies mandatory resource predicates. Client filters can only narrow them, not replace them. Build compound queries so search $or conditions cannot override scope.
4. Validate canonical IDs, per-action allowed fields and numeric/state inputs before domain effects. Apply the resource predicate at the mutation itself; loading then checking alone is insufficient for sensitive concurrent changes.
5. A focused service executes state/effect and required audit under the approved atomic strategy, with a current-actor guard at sensitive mutation time. Account paths retain their specific guard/R2 contract.
6. Return an allowlisted DTO and truthful result; no credentials, hashes, security epochs, raw operational grants or unauthorized PII in ordinary catalog/report payloads. Login still returns its legitimate access token; redaction does not remove the authentication response contract.
7. Error handling preserves current401 authentication/403 capability conventions and existing object-scope404 behavior. Validate malformed IDs safely. Any changed response contract requires OP09 review; do not silently replace all envelopes.

Proposed evaluator result: allowed/denied plus an internal reason code, scope selector and field-profile identifier. It must not return an unrestricted query or trust caller-supplied capabilities. Keep `req.user` compatible; attach any new internal authorization context separately rather than overwriting server identity with request data.

**Already approved in Phase 15C:** unassigned permissions default deny; current backend role is authoritative. **Technical recommendation:** explicit immutable role ceilings plus only the owner's approved conditional operational grants. An Administrator permission editor cannot grant Manager price changes or Cashier independent refund approval contrary to Phase15C.

### 3.2 Capability vocabulary — labels for existing approved rights

| Proposed action labels | Phase15C authority / scope | Classification |
| --- | --- | --- |
| account.list/create/assignRole/confirm/reset/deactivate; permission.manage | Administrator only; guarded target mutation | Already approved in Phase 15C; exact labels Technical recommendation |
| settings.manage | Administrator; only approved nonsecret settings; module/setting keys not defined | Approved authority; actual setting contract Requires owner approval |
| systemAudit.read | Administrator; Manager no by default; no normal audit-edit/delete action | Already approved in Phase 15C |
| catalog.manage / product.price.write | Administrator only; Manager metadata management denied by default | Already approved in Phase 15C |
| catalog.saleRead | Cashier/customer safe catalog; Manager price/availability monitoring | Already approved in Phase 15C; field projection Technical recommendation |
| inventory.receive / inventory.adjust | Store Manager directly; Administrator only if authorized | Already approved in Phase 15C; conditional Admin grant Requires owner approval |
| inventory.history.read / inventory.report.read | Administrator and Manager; Cashier no full movement/cost reports | Already approved in Phase 15C |
| sale.process / payment.record / receipt.issue | Cashier; Administrator/Manager only if explicitly authorized | Already approved in Phase 15C; exact conditional grants Requires owner approval |
| salesHistory.own / salesSummary.own | Cashier personal completed activity only | Already approved in Phase 15C |
| salesHistory.all / salesReport.all | Administrator/Manager authorized system/bookstore scope | Already approved in Phase 15C; attribution/scope Requires owner approval/evidence |
| reversal.request | Manager/Cashier; Admin if applicable; Customer no | Already approved in Phase 15C |
| reversal.approve / reversal.apply | Manager; Administrator only separately authorized; Cashier no | Already approved in Phase 15C; financial/stock effects Requires owner approval |
| order.submit / order.status.own | Customer/student and guest mode under distinct subject/access rules | Both modes Already approved; privacy/access mechanics Require owner approval |
| order.fulfill / order.oversee | Cashier approved assigned subset; Manager oversight; Admin operational necessity where authorized | Approved responsibilities; queue/state/PII boundaries Require owner approval |
| expenses / costs / exports and undefined operational settings | No automatic grant from a neighboring capability | Requires owner approval; default deny for new-role policy |

Normal self-profile/password behavior is retained for authenticated accounts where applicable, without granting staff authority. Guest requests do not receive a normal account session.

### 3.3 Authorization-at-mutation and retry contract

**Technical recommendation:** use current actor ID/role/confirmation/activation/epoch/membership/capability conditions at sensitive commit boundaries. A read-only role recheck immediately before a write is not itself atomic. For cross-record effects, propose a real actor write fence and effect/event within one supported transaction; review this separately from the unchanged adminAccountFilter. With changed membership/grants included in the account epoch, a stale admitted actor cannot pass the guarded write.

The safe ordering contract is serialization: either the authorized mutation commits before revocation, or committed revocation prevents that mutation. It is not a claim that every in-flight response disappears immediately when a button is clicked. Only native independent-client tests can verify actual server ordering.

Driver-permitted retries remain inside the reviewed transaction API contract. No external payment request, print, notification or other irreversible side effect belongs in a replayable callback. Compound unknown-commit labels win over transient labels; a commit acknowledgement retry is different from replaying target work. R2 does not deduplicate a second HTTP request.

| Outcome | Required caller behavior |
| --- | --- |
| Validation/authorization rejected before domain write | Return existing safe error; do not invoke target effect. A separately designed denial-audit attempt is not a financial/stock effect |
| Acknowledged committed mutation + durable event | Return success; secondary observer/session cleanup cannot convert it to failure |
| Confirmed abort/rejection under actual reviewed contract | Preserve primary rejection; only explicitly safe retry strategy may run |
| Lost acknowledgement/unknown commit/finalization outcome | Mark indeterminate with safe nonretryable metadata; never claim definite rollback or replay target automatically |
| Lost HTTP success response / manual resubmission | Requires persistent operation identity and reconciliation; client disable button or retryable false alone cannot prevent duplicates |

Sensitive operation identity, allowed retention and reconciliation access remain an approved schema/API design, not an invented business settlement policy.

RB05 ordering also constrains audit integration: a blocked self-delete or malformed account-target request must not start a session/fence or invoke a target deletion. Optional attempt logging must not introduce the transaction/session effects that these regression tests forbid.

## 4. Dependency recommendations A-F

### A. Legacy account mapping

- **Already approved in Phase 15C:** preserve verified Administrator privileges, review each user account, no automatic staff promotion, preserve compatible hashes/security/history, approved role mappings and recovery.
- **Technical recommendation:** retain `admin`; propose `store_manager`, `cashier`, `customer` as technical keys. Keep `user` only as a legacy compatibility value, not a fifth assigned business role or automatic Customer identity.
- **Requires owner approval — OP01:** approve keys, explicit provisioning/default rules, legacy access envelope and cutoff. Recommend no new user assignments after cutover; unknown values deny. An unmapped legacy account remains unchanged until the approved transition; any restriction or deactivation needs explicit approval, not an automatic quarantine job.
- **Technical recommendation:** plan each account by immutable ID, expected old role/epoch/confirmation, proposed role/store/grants, approver and expected impact. Validate counts and stale plans; preserve login access during planning without promising unsafe broad legacy privileges indefinitely.
- **Requires additional evidence — EV01:** actual account roster, legitimate administrator provisioning, confirmation/hash-format compatibility and resource ownership. Neither a current admin string nor a familiar identifier proves legitimacy.

| Existing evidence, once verified | Recommended classification for owner review | Unapproved action prohibited |
| --- | --- | --- |
| Existing admin with verified provisioning/legitimacy | Preserve Administrator and verified duties; do not presume conditional cashier/refund grants | No automatic demotion, reset or extra operational authority |
| Existing user with verified receiving/inventory/operations responsibility | Candidate Store Manager; Administrator-only pricing still denied | No mapping based solely on current broad product access |
| Existing user with verified checkout duties | Candidate Cashier with personal history only | No promotion of every user to Cashier |
| Existing user verified as a student/customer account | Candidate Customer only after secure User/subject binding and owner approval | No email/name/Customer-contact match as identity proof |
| Uncertain account or conflicting/multiple duties | Pending explicit owner decision; preserve records and document access impact | No silent deactivation, fifth role or broad compatibility grant |

### B. Conditional permissions

- **Already approved in Phase 15C:** Administrator-only pricing; Manager direct inventory; Manager reversal approval; Cashier request-only and own history; Manager all-cashier history. No second inventory approver.
- **Technical recommendation:** one primary role with a fixed policy plus a narrow explicit grant list only for Phase15C's conditional Admin/Manager operational actions, scoped by approved store. Role ceilings always prevail. No arbitrary wildcard/role inheritance.
- **Requires owner approval — OP02:** choose grant representation and the exact accounts/duties to receive Admin inventory/POS/payment/receipt/reversal or Manager POS/payment/receipt permissions. No grant is enabled by this blueprint.
- **Requires owner approval — OP05/OP08:** cost visibility/editing, expenses/exports, allowed payment/credit methods and reversal effects remain separate. Current enums are historical implementation, not approval of every listed method.

### C. Shared record scope

- **Technical recommendation:** a single approved bookstore resource identity with `storeId` as a scope boundary; this does not add a multi-store business feature/UI. Keep original owner as provenance, distinct from store, processedBy cashier and customer subject.
- **Technical recommendation:** add optional scoped fields to compatible records; server-generated new records inherit validated store/actor context. Cashier own history filters by authenticated processor under approved attribution; Manager all-cashier history filters by authorized bookstore scope. Administrator system-wide report scope is explicit, not an unrestricted mutation bypass.
- **Requires owner approval — OP03:** exact store membership and legacy catalog/order attribution, duplicate SKU/receipt resolution, definition of historical cashier identity and unmapped-resource behavior. Never overwrite owner fields, merge catalogs or infer missing processedBy automatically.
- **Requires additional evidence — EV01:** actual ownership/attribution/duplicate references. Until mapped, legacy resources retain an explicitly approved owner-compatibility path; absent storeId never means “shared with everyone.”

### D. Guest and student identity

- **Already approved in Phase 15C:** support both modes; distinguish them; students see only their own private orders; guest gets a reference; submission does not imply payment.
- **Technical recommendation:** server-set order origin and subject: student User ID from validated authentication, or a distinct guest session/access binding. Keep Customer contact linkage separate. Never bind a student by email/name/phone match alone.
- **Technical recommendation:** separate public display order number from an unguessable private access capability; store only a verifier where feasible, do not log it, and restrict status DTOs. This is not an official receipt number or staff JWT.
- **Requires owner approval — OP04/OP10:** student enrollment/confirmation method, guest access transport/lifetime/reset/recovery/rate/retention, status fields and fulfillment privacy. No duration, pickup, reservation, cancellation or student-directory integration is invented.
- **Technical recommendation:** reject an invalid presented authenticated credential on an authenticated/student request rather than silently downgrading it to guest. Guest submission is an explicit separate contract.
- **Requires additional evidence:** identity assurance cannot be established from current Customer records or local test fixtures.

### E. Account lifecycle

- **Already approved in Phase 15C:** Administrator staff creation/roles/activation/deactivation; Manager no role changes; all existing security safeguards preserved.
- **Technical recommendation:** separate activation from confirmation with an additive `User.isActive` field after approval. Provision explicit values; protect validates Boolean state without coercing null/string. Staff signup stays administrator-only; student enrollment, if added, is a separate restricted path.
- **Requires owner approval — OP06:** initial/legacy activation semantics, last-admin protection if desired, account deletion/deactivation handling and session cutover. Missing activation must not become an unreviewed automatic activation or mass lockout.
- **Technical recommendation requiring OP06 adoption:** provision new unconfirmed staff explicitly inactive until Administrator activation/confirmation. For approved existing accounts only, use a time-bounded, exact-ID legacy reader rule that preserves current confirmation-based login while their explicit activation state is reviewed; the owner must approve the roster and cutoff, with no invented duration. Missing/invalid state on a new-role account outside that approved compatibility path fails closed. Do not write defaults while hydrating a legacy document.
- **Technical recommendation:** approved role, confirmation, password, activation, membership and conditional-grant changes share one expected-epoch guarded security update and increment tokenVersion. Raw bulk role updates bypassing hooks are prohibited. Existing bcrypt hashes and confirmed states remain unchanged by role mapping.
- **Requires additional evidence — EV01/EV04:** actual account status, recovery ownership, compatible deployed readers and approved reauthentication impact. No production token/session state is presumed.

### F. Audit consistency

- **Already approved in Phase 15C:** durable sensitive account, pricing, stock, refund/void attribution; reasons for sensitive movements/reversals; no silent financial history rewrite.
- **Technical recommendation:** append-oriented event ID, operation identity, server actor/target/store/action/time, reason, sanitized changed-field summary and truthful outcome. Audit grants do not expose password/hash/token/connection data.
- **Technical recommendation:** preferred multi-record strategy is mutation + success event in the same supported transaction. For existing single-document self-account CAS, review either a same-session transaction retaining the exact CAS predicate/R2 semantics or an embedded atomic audit outbox drained idempotently. A post-save independent insert is insufficient.
- **Requires owner approval — OP07:** choose schema/retention/access, attempt logging and unavailable-audit policy. Recommend preventing a required sensitive mutation when its mandatory event cannot commit atomically, while preserving acknowledged success and indeterminate outcomes; this failure policy is a proposal, not silent implementation.
- **Technical recommendation:** do not record a success event for an unconfirmed commit, erase a primary error because attempt logging failed, or automatically replay a mutation to “finish” audit. Acknowledged success with an atomically stored outbox entry is not lost merely because later delivery fails.
- **Requires additional evidence — EV03:** native transaction support/isolation/durability, outbox behavior and cleanup/commit outcomes. Request logger output is not durable approval history.

### 4.1 Proposed additive schema contract — NOT APPROVED OR APPLIED

| Affected record/field | Recommended shape and validation | Gate / compatibility impact |
| --- | --- | --- |
| User.role | Approved four technical keys, legacy user accepted only under explicit compatibility rule; no implicit staff default for new provisioning | OP01; schema/controller/UI and binary readers must agree |
| User.isActive | Optional Boolean during reviewed reader transition; new account explicit state, malformed values fail closed | OP06; missing-value behavior requires approval; add to protect and epoch-change detection |
| User.storeIds | Canonical ObjectId array, server-assigned membership; no client-selected store authority | OP03; membership changes increment epoch; no guessed legacy memberships |
| User.operationalGrants | Allowlisted conditional capability + store binding; cannot exceed immutable role ceilings; no wildcard | OP02/OP03; same-account atomic update with epoch; malformed grants deny |
| Product/Transaction/Customer/Invoice/DebtPayment storeId | Optional during approved additive rollout; new writes get validated server scope; existing owner retained | OP03; no automated catalog/history reassignment; linked records must agree |
| Transaction origin/studentUser/guestAccess binding | Explicit guest versus authenticated subject; store contact references separately; no subject supplied as authority by client | OP04/OP10; exact names/privacy/legacy state require schema approval |
| AuditEvent | Actor/target/action/store/time/reason/outcome/operation identity; append-oriented controlled writes | OP07; scope/retention/deduplication indexes reviewed; no automatic TTL selected |
| StockMovement | Product/store, delta, actor/time/reason/source/operation identity; stock remains only in Product.stock | OP07/OP08; same effect/event consistency; no running stock copy as independent authority |
| ReversalRequest/effect links | Original transaction, request/approval actors/reasons, expected version/state, application operation identity | OP08; no money/stock/refund states selected before effect policy |
| Operation identity/indexes | Unique only for the approved operation type/store/actor-or-subject namespace, with payload conflict detection | OP07/OP08; durable resubmission protection is new schema work, not paymentReference uniqueness |

For each approved schema change, implementation must provide exact fields/types/indexes, affected records, backup, migration/dry-run/recovery and compatibility risks before persistence. Suggested indexes include scoped product search, store+processedBy+completion history, student subject/order reference and audit target/time. Do not create indexes/unique constraints until existing duplicate evidence and index design are approved. Account role migration does not authorize resource migration.

### 4.2 Decision and evidence register

| ID | Input still required | Responsible authority | Blocks |
| --- | --- | --- | --- |
| OP01 | Technical keys, provisioning/defaults, legacy access envelope/cutoff and no-auto-map policy adoption | Owner + security maintainer | B01 contract adoption; B02/B12 cutover |
| OP02 | Exact conditional duties/grants and representation; no new permission ceilings | Owner + authorized Administrator | B02 and conditional operational actions |
| OP03 | Store/resource model, membership, approved account/resource mapping and historical cashier attribution | Owner + data maintainer | B03/B06 and shared writes |
| OP04 | Student enrollment/User binding; guest private access contract and data visibility | Owner + security/privacy authority | B08 |
| OP05 | Cost fields, expenses, export/report scope and private customer fields; no inferred grants | Owner | Relevant B05/B06/B10 APIs |
| OP06 | Activation/legacy state, optional last-admin rule, recovery and session/policy cutover | Owner + security maintainer | B02/B12 |
| OP07 | Audit schema, retention/access, atomic strategy, attempt logging and failure handling | Owner + database/security maintainer | B04 and sensitive enablement |
| OP08 | Payment methods/legacy credit treatment, refund/void/cancel financial/stock effects, operation identity/reconciliation | Owner + operations/financial authority | B07/B09 and payment integrity |
| OP09 | Field/API compatibility, capability projection, receipt issue/read split, availability and initial-stock authority; targeted cost-reset/activation remediation scope | Owner + API maintainer | B05/B06/B10 |
| OP10 | Guest/session/rate/reset parameters, assignment/status/payment location/reservation/pickup rules actually needed by workflow | Owner + operations/privacy authority | B08 and related queue/fulfillment |
| EV01 | Confirmed environment/database/account collection, minimum authorized inventory, admin legitimacy, account/resource mappings | Authorized A01 operator + owner | Real mapping; not pure local policy tests |
| EV02 | Consistent backups, recoverability and nonproduction restore evidence without epoch rewind | Database/security administrator | Any persistent migration/recovery |
| EV03 | Disposable target, isolation, effective permissions, server/topology/driver, fail-closed runner and native fault/cleanup scope | A08B environment owner + QA/security | Native tests; A08B execution separately authorized |
| EV04 | Actual deployed revision/readers, release order, operator access, session cutover and release approval | Deployment/security administrator + owner | Production rollout |

A blank field means unresolved, not permission. This document supplies no actual account identifiers, provider values, database name, credential validity or secret.

## 5. API/middleware enforcement manifest proposal

Paths below are current mounted routes unless marked proposed. Preserve routes/envelopes where possible; split services behind aliases rather than leaving a less-restricted path. Future new routes are contract proposals requiring OP09 and batch authorization.

| Existing method/path | Required capability/scope/field decision | Batch |
| --- | --- | --- |
| POST /api/users/login | Public credential check; current account/security policy; sanitized auth DTO | B02 |
| POST /api/users/register | Administrator staff provisioning only; no public role selection | B02/B04 |
| GET /api/users; PUT/DELETE /api/users/:id | Administrator account actions; guarded actor/version, canonical target; delete self denied before target work | B02/B04 |
| GET/PUT /api/users/profile; PUT /api/users/password | Authenticated self only; privilege field whitelist/epoch logic; approved capability projection separate from authority | B02/B10 |
| GET /api/products and /:id | Staff sale-safe view or approved catalog management view; mandatory record/field scope; do not make this router guest-public | B03/B05 |
| POST /api/products; PUT /:id | Administrator catalog/price; stock/cost/initial-state fields separately authorized, no mixed-payload bypass | B05 |
| DELETE /api/products/:id; POST /api/products/set-active | Availability/catalog mutation with explicit approved authority; existing bulk write atomicity separately unresolved | B05 |
| PATCH /api/products/:id/stock | Direct Manager stock command; Administrator only if authorized; no Cashier/Customer direct adjustment | B07 |
| POST /api/orders and /api/transactions | Staff sale/order command under approved operational scope, backend prices and state; no guest pass-through | B05/B07 |
| GET /api/orders,/transactions and /:id | Cashier own history or separately assigned fulfillment; Manager/Admin approved oversight; no global owner removal | B03/B06 |
| PUT /api/orders/:id; PATCH /api/orders/:id/complete | Approved transition/capability and target scope; not arbitrary state/price/paid assignment | B07, workflow-dependent |
| PATCH /api/orders/:id/pay; /api/transactions/:id/pay | Payment record authority plus same scoped transaction/customer; approved methods/effects | B07, payment-dependent |
| PATCH /api/orders/:id/void; /api/transactions/:id/void; DELETE /api/orders/:id | Same approved reversal authority, reason/audit/effect boundary on all aliases | B09 |
| GET /api/invoices and /:id | Scoped existing receipt access; no other cashier/student data or unrestricted contacts | B06 |
| POST /api/invoices/create/:orderId | Receipt issue authority plus eligible scoped transaction; history read alone insufficient | B06 |
| GET /api/invoices/order/:orderId/ensure and /transaction/:transactionId/ensure | Existing GET may create; enforce issuance for side effect. Recommend new explicit POST issue/ensure and pure read GET under approved compatibility plan, not a silent contract change | B06/OP09 |
| PATCH /api/invoices/:id/void | Same approved reversal service; no independent markVoid bypass | B09 |
| GET/POST /api/debt-payments | Scoped payment summary/record; do not equate read, collection and approved credit policy | B06/B07; OP08 |
| /api/people and /api/customers list/detail/create/update/delete | Protected staff contact operations with minimum fields and approved scope; contact record is not student authority; missing delegated CRUD rights remain OP05/default deny | B03/B06 |
| POST /api/people/:id/payments and /pay-all | Same approved payment authority/effects as other collection aliases | B07; OP08 |
| POST /api/people/:id/debts; PUT/DELETE /:id/debts/:debtId | Legacy debt management is not automatically Cashier/Manager authority; OP08 defines retained policy; no silent historical deletion grant | OP08/B09 as applicable |
| GET /api/financials/summary,/dashboard-summary,/revenue; /api/dashboard/summary,/revenue | Manager/Admin approved reports or separately bounded Cashier own summary; same scope in every aggregation and recent list | B06 |
| /api/expenses CRUD | Preserve legacy module; new-role rights unassigned until OP05. No automatic Manager finance grant | OP05/B06 |
| Proposed audit/inventory/reversal/kiosk APIs | Separate resource/subject/capability contracts in B04/B07/B09/B08; no existing API exists merely because this blueprint names it | Gated new modules |
| Root diagnostic /api/health | Keep sanitized public diagnostics, no logs/config/secrets; no new access to accounts | Preservation |

No legacy module is deleted. Blocking an unassigned new-role action is different from disabling existing users during planning; the actual transition needs OP01-approved impact and explicit execution authority.

## 6. Independent implementation batches

Each batch is a separate reviewable change set with its own authorization. Frontend/test paths listed are expected future changes, not files changed now. Batches that merely preserve helpers should not edit them without a demonstrated need. Completion of one batch is not acceptance of an entire criterion or permission to start the next.
### B01 — Backend policy foundation and alias inventory

- **Objective:** Add a pure, deny-by-default capability evaluator, field policy and explicit route/action manifest without attaching new behavior to live routes. Preserve the existing architecture.
- **Acceptance criteria covered:** RB01/RB02/RB03/RB04/RB07/RB12/RB13/RB14.
- **Frontend files expected to change:** None; document the later capability projection only.
- **Backend files expected to change:** Proposed backend/auth/{roles,capabilities,policy,fieldPolicy}.js; proposed backend/tests/rbacPolicy.test.js and rbacRouteManifest.test.js; backend/app.js and routes/*.js are inspection inputs, not automatically edited.
- **Database/schema impact:** None; no enum expansion, writes or account mapping in this batch.
- **API and middleware impact:** No new public endpoint and no new live grant. Manifest identifies every method, alias, operation and object/field policy; unmapped action returns deny.
- **Security requirements:** JWT role/cached storage cannot supply authority. Enforce immutable Phase15C role ceilings; no admin superuser shortcut or legacy-user fallback. Do not broaden adminAccountFilter.
- **Tests required:** Pure table tests for four business roles, proposed technical keys, unknown values/actions, conditional grants absent/present, explicit forbidden-grant attempts; manifest tests catch omissions including invoice ensure and DELETE void alias. No database needed.
- **Dependencies:** Approve the proposed technical policy contract and vocabulary (OP01); persisted data/migration decisions can remain blocked. This is the smallest candidate for separate local authorization.
- **Risks:** A helper without route attachment is not deployed RBAC. Capability names must not accidentally create new business rights.
- **Rollback considerations:** Remove unused helpers/tests only if authorized; existing guards and prior tests remain. No data rollback or session action.
- **Completion criteria:** Reviewed complete action manifest and deterministic policy tests; zero changes to runtime authorization or data. Do not claim RB02 complete until all API tests exist.

### B02 — Role/account compatibility and lifecycle writers

- **Objective:** Implement approved role validation, constrained staff provisioning and security-state transitions in local fixtures; design compatible readers before any new-role writer is exposed.
- **Acceptance criteria covered:** RB01/RB03/RB04/RB05/RB13/RB14/RB16.
- **Frontend files expected to change:** None initially; features/auth/components/UserModal.jsx, AdminUserTable.jsx and shared/utils/useAdminUsers.js are deferred to B10 after server tests.
- **Backend files expected to change:** backend/models/User.js, controllers/UserController.js, routes/UserRoute.js, middleware/authMiddleware.js; proposed auth/accountPolicy.js and services/accountSecurity.js; existing token/admin/identity/commit helpers preserved with targeted changes only if audit integration needs them; security tests extended.
- **Database/schema impact:** Proposed additive role enum, isActive, storeIds and conditional operationalGrants (section4); no existing account changed. Default/legacy rules and each field/index require schema approval.
- **API and middleware impact:** Staff creation/list/privilege/reset/lifecycle remains Administrator only. Self profile rejects privilege-field injection. Protect loads current approved security state; no public staff signup.
- **Security requirements:** Atomically advance tokenVersion for role/password/confirmation/activation/grant/membership changes; expected-version CAS and actor guard must compose. Missing stored epoch only is zero; no malformed coercion or claim-less acceptance. Preserve bcrypt, IDs and self-delete.
- **Tests required:** All account actions per role; legacy confirmed/unconfirmed accounts; malformed fields; forged privilege fields; all security-change old-token tests; simultaneous changes, admitted actor revocation, case-variant self-delete and fail-closed lookups. Synthetic only initially.
- **Dependencies:** OP01/OP02/OP06, approved User schema/compatibility; B01. B04 is a hard enablement gate for new sensitive writers needing durable audit; production use additionally needs B12.
- **Risks:** A schema default on hydrated legacy accounts, raw bulk updates or a new field outside epoch logic could revive access; an old application binary may reject or misinterpret new roles.
- **Rollback considerations:** Compatible secure reader stays available; cease new-role writes through approved operational control. Revert assignments only as new guarded epoch-increasing changes. Never restore old epochs or bcrypt values automatically.
- **Completion criteria:** Approved local schema/read-write contract, unchanged existing login compatibility, positive/negative account/security tests and no live migration. New lifecycle/grant mutation exposure waits for audit consistency.

### B03 — Shared resource scope and legacy attribution

- **Objective:** Separate store resource ownership, cashier attribution and customer subject without merging existing owner-linked catalogs or rewriting sales.
- **Acceptance criteria covered:** RB01/RB02/RB06/RB10/RB12/RB16.
- **Frontend files expected to change:** None initially; order/report/product service query inputs documented for B10.
- **Backend files expected to change:** Proposed backend/models/Store.js and auth/resourceScope.js; models/User.js, Product.js, Order.js, Person.js, Invoice.js, DebtPayment.js; owner queries in corresponding controllers and FinancialController; Expense/InvoiceCounter compatibility reviewed, not blindly pooled.
- **Database/schema impact:** Proposed optional storeId on approved resources and User.storeIds membership; preserve owner, customer, processedBy and all references. Plan indexes and exact resource mapping separately; no required backfill on document hydration.
- **API and middleware impact:** All list/detail/search/count/aggregate/populate/receipt queries apply server scope. Validate any requested cashier/date/store filters against scope; never accept owner/storeId/processedBy as authoritative body fields.
- **Security requirements:** No global owner-filter removal. A student subject, cashier processor and store are distinct. Unknown/unmapped legacy resources do not become shared by absence of a field.
- **Tests required:** Two stores, two cashiers and private students; mixed legacy/mapped resources; ID/filter/operator injection; pagination/count/aggregate/populate leakage; mappings must not change historical IDs or owner fields.
- **Dependencies:** B01/B02; OP03/OP04; approved schema/resource mapping. Audit scope must be specified before B04 events are exposed.
- **Risks:** Cross-owner catalog merging, incomplete historical processedBy, ambiguous legacy references, duplicate SKU/numbering across owner catalogs and changed aggregate inclusion.
- **Rollback considerations:** Retain owner and previous references; stop shared access with a reviewed secure compatibility version. Reverting code must not expose mapped records to legacy broad user routes; no bulk owner rewrite as rollback.
- **Completion criteria:** Scoped-query contract and synthetic isolation evidence for every resource family; unmapped records explicitly reported. Real attribution remains unverified until authorized inventory/mapping.

### B04 — Durable audit consistency foundation

- **Objective:** Make sensitive mutation attribution durable and consistent before enabling new account, pricing, inventory or approval writers.
- **Acceptance criteria covered:** RB03/RB04/RB08/RB09/RB13/RB14/RB17.
- **Frontend files expected to change:** None; Administrator audit and Manager movement views follow B10.
- **Backend files expected to change:** Proposed backend/models/AuditEvent.js, services/auditService.js and routes/AuditRoute.js; UserController/account security writer and future business services; safeErrors/logger retained as diagnostics only.
- **Database/schema impact:** Append-oriented redacted event schema, scope/actor/action/target/result/reason/correlation and restricted indexes; proposed transactional-outbox or embedded-event alternative where required. No retention duration or deletion permission selected.
- **API and middleware impact:** Administrator system-audit read only; Manager receives separate operational movement data, not the global audit stream. No ordinary event-edit/delete API. Audit reads also require store/privacy scope.
- **Security requirements:** Mutation and success event in the same transaction, or an approved single-document atomic event/outbox strategy. Current self account CAS path cannot gain a post-save audit insert that creates partial success. Denied/failure attempts are separate events; unavailable audit cannot be called proof of denial logging.
- **Tests required:** Success/failure/denial/unknown outcomes, audit write failure before commit, commit uncertainty, acknowledged success plus cleanup failure, actor loss, duplicate event identity, forbidden audit reads/writes and secret-free projections.
- **Dependencies:** B01-B03; OP07; approved schema/consistency/failure policy; B02 security regression contract. Native transaction/serialization proof requires separate A08B authorization.
- **Risks:** Self-account audit may require an explicit path redesign (same-session transaction versus embedded atomic outbox); stop that slice for schema/transaction approval. Do not replay uncertain writes to repair logs.
- **Rollback considerations:** Preserve all events and outbox entries; no audit truncation. Keep a secure writer compatible with stored events. Disable the affected new mutation through approved control if audit consistency cannot be maintained; do not silently run without audit.
- **Completion criteria:** Reviewed outcome/failure contract and synthetic atomicity/fault tests; no unsupported-topology fallback. No sensitive operation enabled without an approved consistency path.

### B05 — Catalog/pricing API enforcement

- **Objective:** Apply Administrator-only metadata/pricing and sale-safe read projections; separate stock authority from catalog edits.
- **Acceptance criteria covered:** RB02/RB06/RB07/RB10/RB12/RB17.
- **Frontend files expected to change:** No permission reliance on ProductPage yet; B10 later separates edit/stock views and services.
- **Backend files expected to change:** backend/routes/ProductRoute.js, controllers/ProductController.js, models/Product.js; proposed services/catalogService.js and auth/productFields.js; OrderController.buildItems reviewed to preserve server prices.
- **Database/schema impact:** Price/cost/stock histories remain intact; price audit uses B04. Initial stock and availability changes need OP05/OP09 clarification, not implicit inventory authority from product creation.
- **API and middleware impact:** POST/PUT/DELETE catalog and POST/set-active explicitly classified; stock fields cannot slip through productPayload. Existing price/sellingPrice, stock/quantity and active/isActive aliases receive identical field checks; no create-time price bypass.
- **Security requirements:** Reject unauthorized sensitive fields before writes, preserve omitted fields, exclude cost/owner/private metadata from sale-safe DTOs; keep historical unitPrice. Omitted-cost reset correction is an explicitly authorized subtask, not a record repair.
- **Tests required:** Administrator price allow; Manager/Cashier/Student price and combined-payload deny; cost/stock injection aliases; omitted cost unchanged; metadata update does not reset price/stock; sale price snapshot; bulk-activation partial failure characterization.
- **Dependencies:** B01-B04; OP05/OP09; approved separate cost-reset subtask and activation integrity work if in scope.
- **Risks:** Existing ProductPage sends stock with metadata; server contract must land before UI adapts. Cost reset and two-write activation remain open unless separately implemented and proven.
- **Rollback considerations:** Retain strict backend write/field restrictions and data. Roll back a UI separately; never restore broad user price updates or default omitted cost to zero.
- **Completion criteria:** All catalog method/field tests pass with safe DTOs and audit linkage. Stock/activation risks explicitly closed only with their own evidence, otherwise recorded as release blockers.

### B06 — Cashier/Manager history, reports and receipt scope

- **Objective:** Implement Cashier own-only completed history and Manager/Administrator authorized system/store oversight without widening payment or receipt-issue authority.
- **Acceptance criteria covered:** RB02/RB06/RB07/RB10/RB12/RB15/RB17.
- **Frontend files expected to change:** None initially; features/orders/pages/OrdersPage.jsx, financials/pages/FinancialPage.jsx, invoices/pages/InvoicePage.jsx and services adapt in B10.
- **Backend files expected to change:** backend/controllers/OrderController.js, FinancialController.js, InvoiceController.js, DebtPaymentController.js, PersonController.js; routes/OrderRoute.js, TransactionRoute.js, FinancialRoute.js, DashboardRoute.js, InvoiceRoute.js, DebtPaymentRoute.js; invoiceDto.js projections.
- **Database/schema impact:** B03 store/processor attribution and approved indexes; no rewriting owner or imputing missing historical cashier identities.
- **API and middleware impact:** Scope list/detail/summary/receipt and ensure aliases consistently. Separate receipt read from generation; all-history permission is not permission to create invoices or collect payments. Assigned-order fulfillment is a different predicate.
- **Security requirements:** Other-cashier/other-student data inaccessible by IDs/filters/aggregates. Manager all-cashier visibility is limited to authorized bookstore scope; Administrator global report scope must be explicitly defined. No cost/profit or credit-policy grants implied.
- **Tests required:** Own versus peer transaction/list/receipt/aggregate; Manager all authorized cashiers; cross-store deny; fulfilled queue does not expose completed history; invoice GET ensure denied when it would issue without authority; totals from full scoped data.
- **Dependencies:** B01-B05; OP03/OP04/OP05/OP09; agreed report date/basis if changing calculations. Keep current calculations labeled until separately approved.
- **Risks:** owner is not always processedBy; missing historical attribution cannot be guessed. Broad reporting DTOs may include private contact data. Current ensure GET can write.
- **Rollback considerations:** Keep backend scope/projection enforcement while reverting display changes; preserve references. Never fix missing reports by unscoped aggregation.
- **Completion criteria:** Direct API evidence for personal versus all-cashier access, including report/receipt aliases and private-field filtering; no unauthorized side effects.

### B07 — Manager receiving/adjustment and sale-effect boundaries

- **Objective:** Provide direct audited Manager inventory operations and protect sale stock effects with approved concurrency/idempotency semantics.
- **Acceptance criteria covered:** RB02/RB06/RB07/RB08/RB10/RB12/RB14/RB17.
- **Frontend files expected to change:** Proposed inventory feature views deferred to B10; product stock form cannot remain an unrestricted alternate writer.
- **Backend files expected to change:** backend/controllers/ProductController.js, OrderController.js; models/Product.js, Order.js; proposed services/inventoryService.js, models/StockMovement.js, routes/InventoryRoute.js; payment/receipt coupling reviewed.
- **Database/schema impact:** Product.stock remains authoritative; movement record stores actor/time/product/delta/reason/source, with approved operation identity uniqueness and scope. Same-session quantity/effect/event consistency; no conflicting stock copy.
- **API and middleware impact:** Receiving and adjustment commands are separated from metadata/price writes. Manager applies directly; no second approver. Cashier changes stock only through authorized sale effects, not direct adjustments.
- **Security requirements:** Validate finite integer deltas and actor scope server-side; use conditional atomic changes rather than read-add-save/clamping. Transaction callback replay must not double external effects; persistent replay protection is separate from R2.
- **Tests required:** Manager direct success/reason enforcement; unauthorized zero effects; two adjustments accumulate; duplicate operation has one effect; last-item competing sales; denied/aborted/uncertain operation reconciles stock+movement; cleanup preserves outcomes.
- **Dependencies:** B01-B05 and B04 audit; OP03/OP07/OP08/OP09; approved inventory/request-identity schema. This batch needs separate inventory-integrity scope; RBAC approval alone does not authorize it.
- **Risks:** Repeated/lost adjustments, sale deduction repeats, multi-item partial effects; native support remains unverified. Existing zero clamp is not an accepted shortage policy.
- **Rollback considerations:** Preserve movements and stock; stop new commands via approved secure control, then reconcile before any corrective movement. Never recompute/rewrite historical stock or replay deltas as rollback.
- **Completion criteria:** Authorized command/denial/fault tests and effect reconciliation evidence; native concurrency remains a separate gate. No maker/approver split invented.

### B08 — Guest/student identity boundary contract

- **Objective:** Implement only a separately authorized customer identity/API slice; future kiosk UI/workflow remains separately scoped.
- **Acceptance criteria covered:** RB01/RB02/RB06/RB10/RB11/RB12/RB15.
- **Frontend files expected to change:** Future features/kiosk and app/App.jsx route declarations are proposed for later authorization; do not expose staff POS/Layout as a guest kiosk.
- **Backend files expected to change:** Proposed backend/routes/KioskRoute.js, services/kioskIdentity.js and kioskOrderService.js; models/Order.js and User.js; Product/Order DTOs reused through safe services, not public staff routers.
- **Database/schema impact:** Origin/subject fields and guest-access verifier metadata; authenticated subject derived from current User, contact/customer association separate. Pending submission and opaque order reference need approved uniqueness/privacy rules.
- **API and middleware impact:** Dedicated public-safe catalog and constrained submission; student own-order path separately authenticates. Guest status needs approved possession/session controls, not just a guessable order number. Public status is not public invoice/PII access.
- **Security requirements:** No guest staff JWT, arbitrary role/owner/student ID or client paid/status authority. Invalid presented staff/student tokens must not silently become a guest write. Guest reset/rate/lifetime/retention parameters require approval.
- **Tests required:** Both modes work under approved semantics; student cannot impersonate another; guests cannot enumerate; staff APIs denied; forged subject/payment/status rejected; replay and stale cart availability; session handoff erases private client state.
- **Dependencies:** B01-B06/B04; OP03/OP04/OP08/OP10; approved schema and separate customer workflow authorization. Both modes are settled, enrollment/access mechanics are not.
- **Risks:** User/Customer conflation, guest credentials in logs/storage, stale identity fallback, absent reservation/pickup semantics and kiosk privacy leaks.
- **Rollback considerations:** Withdraw only the newly introduced guest/student surface using approved controls; preserve orders/references. Do not reclassify guest orders as user-owned or paid.
- **Completion criteria:** Approved identity/API design and isolated tests; no claim of complete kiosk/queue workflow from an identity boundary alone.

### B09 — Refund/void request, approval and application boundaries

- **Objective:** Apply Manager approval/processing and Cashier request-only authority consistently, after financial/inventory effects are approved.
- **Acceptance criteria covered:** RB02/RB06/RB09/RB10/RB12/RB14/RB17.
- **Frontend files expected to change:** New request/approval controls deferred to B10; existing OrdersPage void action and invoice void must share the same approved server workflow.
- **Backend files expected to change:** backend/controllers/OrderController.js voidTransaction/deleteOrder, InvoiceController.js markVoid, DebtPaymentController.js; Order/Transaction/Invoice routes; proposed services/reversalService.js and models/ReversalRequest.js.
- **Database/schema impact:** Append-oriented request/approval/application event and links to original financial/stock records; expected-state/version and operation identity; no deletion/overwrite of completed records.
- **API and middleware impact:** Every void/refund/cancel alias uses the approved gate/service. Manager may approve and process; Cashier submits requests only. Administrator approval requires separate authorized grant. No invoice-only shortcut that obscures completed history.
- **Security requirements:** Approval identity/reason from server; approval cannot be forged via body fields. Sensitive state transitions and audit/effect in approved atomic boundary; no uncertain write replay. Cancellation rules remain explicit rather than equated to refunds.
- **Tests required:** Cashier request succeeds but approval/application denied; Manager allowed; unauthorized roles zero money/stock writes; each alias, approval reuse/replay, competing execution, reason/audit and partial/unknown outcome cases.
- **Dependencies:** B01-B07/B04; OP08/OP07 and explicit reversal workflow/schema approval. No refund amount/method/stock/tax policy selected by this blueprint.
- **Risks:** Independent markVoid, DELETE alias and legacy debt APIs can bypass approval; undefined stock/payment effects block application logic.
- **Rollback considerations:** Preserve original/request/approval/effect records; stop new reversal execution and reconcile. No inverse money/stock command or deletion as automatic rollback.
- **Completion criteria:** Owner-approved effect specification plus direct API/zero-effect denial and audit/effect tests. Until then, this batch is blocked rather than implemented with assumptions.

### B10 — Frontend capability, routes and action visibility

- **Objective:** Reflect already-enforced backend capabilities in navigation, account forms, dashboards and operational actions; preserve branding and components.
- **Acceptance criteria covered:** RB02/RB04/RB06/RB07/RB11/RB12/RB15/RB17.
- **Frontend files expected to change:** client/src/app/App.jsx; shared/hooks/{AuthContext,DashboardGuard}.jsx; shared/components/Layout.jsx; shared/utils/{useAdminUsers,useProfile,apiClient}.js; auth pages/components/API and products/orders/invoices/financials/people pages/services; proposed capability guard and separately approved feature views.
- **Backend files expected to change:** Approved sanitized capability projection through profile/login DTO or dedicated read endpoint (OP09); no relaxed controller checks to accommodate UI.
- **Database/schema impact:** None for menus; no persisted client permissions. New feature views depend on already approved data resources.
- **API and middleware impact:** UI reads server policy projection with scoped-action indicators, revalidates account state and handles 401/403/unknown outcomes without automatic unsafe retries. Keep existing safe error envelopes/diagnostics.
- **Security requirements:** Cached storage cannot authorize routes or data. Deep links and stale tabs denied server-side; no sensitive staff payload fetched then merely hidden. Keep kiosk outside staff shell and retain provisional brand.
- **Tests required:** Four-role landing/deep links/action/menu/field matrix; tampered storage; denied API despite hidden menu; changed role/disabled account; no retry on indeterminate response; SSR/transport tests plus separately authorized browser/accessibility/print verification.
- **Dependencies:** Relevant B01-B09 backend contracts passed; OP09 projection/response compatibility and OP10 kiosk session behavior; do not bundle unimplemented workflows into a UI phase.
- **Risks:** Frontend-first changes create apparent protection without authority; old ProductPage payload resets fields; default /pos landing exposes inappropriate shell.
- **Rollback considerations:** Revert UI independently while keeping backend restrictions. Older UI may show denied actions; it must not regain unauthorized effects. No session or DB rollback implied.
- **Completion criteria:** UI and direct API permissions agree; new browser claims supported by actual checks; existing branding and unrelated behavior preserved.

### B11 — Consolidated local acceptance and native-test readiness

- **Objective:** Collect RB01-RB17 evidence without conflating synthetic tests, browser checks and authorized native integration.
- **Acceptance criteria covered:** RB01-RB17.
- **Frontend files expected to change:** client/tests existing suites plus proposed rbacNavigation.test.js, rbacFields.test.js and kioskPrivacy.test.js if their surfaces are authorized.
- **Backend files expected to change:** backend/tests existing security/payment/invoice suites plus proposed rbacPolicy/routeManifest/api/scope/audit/migration suites; later native runner only under separate harness authorization.
- **Database/schema impact:** No configured/live DB in local suite. Native fixture/index/write/cleanup plan is a separate approval, not authorized by this batch description.
- **API and middleware impact:** Verify every registered method/alias against the contract; identify untested surfaces explicitly; preserve response/no-replay behavior.
- **Security requirements:** No weakened/deleted tests, real secrets or default connection fallbacks. Native runner must fail closed before any write and cannot infer disposal from a database name.
- **Tests required:** Existing backend/client tests, build/syntax/targeted/full lint and all new acceptance cases; exact counts; mock/native/browser evidence labels; native matrix includes transaction support, independent-client races and commit/cleanup faults only when authorized.
- **Dependencies:** Applicable B01-B10 complete; unresolved criteria remain blocked. A08B additionally requires explicit target/isolation/effective permissions/harness/test+cleanup scope and execution authorization.
- **Risks:** Passing mocks hide native isolation/durability failures; blanket lint suppression conceals debt. Known full-client baseline16 errors/13 warnings stays visible until independently changed.
- **Rollback considerations:** Tests are evidence, not state restoration. Do not remove failing regressions; correct the authorized implementation in a later approved change.
- **Completion criteria:** Criterion-by-criterion evidence ledger, exact local results and explicit NOT RUN native/browser cells. Local-only completion does not mark RB16 or production readiness passed.

### B12 — Account/resource mapping and controlled rollout runbook

- **Objective:** Prepare and later execute only separately authorized exact-ID account/resource cutover; no blanket migration or production release implied.
- **Acceptance criteria covered:** RB01/RB03/RB04/RB06/RB13/RB14/RB16/RB17.
- **Frontend files expected to change:** No required code; operator runbook and minimal redacted review artifact; optional UI is not necessary to execute a controlled migration.
- **Backend files expected to change:** Proposed backend/scripts/rbacMappingPlan.js and security-aware mapping service/tests only after tooling authorization; existing User security writers reused; no ad hoc raw bulk role update.
- **Database/schema impact:** Exact approved role/epoch assignments and separately approved resource mapping; preserve all existing data. Account migration and shared-catalog migration are different approved changes.
- **API and middleware impact:** Controlled operational path applies actor/version checks and audit; normal register/profile endpoints cannot become a bulk privilege migration bypass.
- **Security requirements:** Verified admin roster and backup/recovery; no hash/confirmation/history/owner changes unless explicitly approved. Reauthentication/session effects separately authorized; no role legitimacy inferred from name or current admin value.
- **Tests required:** Synthetic dry-run zero writes, exact ID/count/checksum comparison without sensitive output, stale plan rejection, interrupted/indeterminate reconciliation, unchanged hashes/history and monotonic recovery. Native/restore/rollout checks need their own authorization.
- **Dependencies:** B11 evidence; OP01-OP10 applicable decisions; EV01-EV04; approved backups, mappings, deployment ordering, migration/session and explicit release authorization. A01/A08B remain independent gates.
- **Risks:** Lockout, wrong-store mapping, revived epochs after restore, uncertain partial cutover, old/new binary mixed operation and historical attribution guesses.
- **Rollback considerations:** Stop writes through approved control, reconcile exact applied IDs and events, use compatible secure reader; revert approved roles as new guarded epoch increases. Backup restoration requires coordinated security/session recovery, never blind epoch rewind.
- **Completion criteria:** Initially a reviewable runbook and synthetic plan only; actual completion requires separately authorized environment evidence and exact executed results. No such execution is part of Phase15E.

## 7. Complete RB01-RB17 implementation mapping

Quotations are the exact Phase15B requirements. Phase15C specializes RB08 to direct Manager adjustments without another approver, RB11 to both guest and student modes, and RB17 to required durable sensitive-action audit. All other criteria remain intact. RB12 uses the five finalized decisions, not pending Phase15B proposals.

Files in per-criterion FE bullets are relative to `client/src/` unless a complete path is given; BE model/controller/route/helper names refer to the corresponding `backend/` folders. Proposed files are identified in the relevant batch. The tests/evidence below are future acceptance requirements, not tests executed in this phase.
### RB01 — Not Implemented

**Exact Phase15B requirement:**

> Approved role values persist/round-trip correctly; malformed/unknown values cannot grant authority. Legacy accounts follow the approved mapping/compatibility rule; User/Person identities are not conflated

- **Current Phase15D classification:** Not Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B01/B02/B12.
- **Proposed technical solution:** Centralize exactly four approved business roles; retain admin key as a proposal, mark user legacy-unmapped and reject unknown/malformed authority. Explicit validated staff role input; User identity is never inferred from Customer contacts.
- **Files expected to change:** FE: auth/components/UserModal.jsx and AdminUserTable.jsx, AuthContext.jsx (B10). BE: models/User.js, UserController.js, authMiddleware.js; proposed auth/roles.js, policy.js and mapping tooling.
- **Test cases:** Four role round-trips, whitespace/case/object/array/unknown input rejection, legacy confirmed/unconfirmed handling, no auto-promotion, distinct User/Customer references.
- **Dependencies:** OP01/OP02; EV01 for actual mappings; schema/compatibility approval.
- **Completion evidence:** Approved role-key contract, synthetic schema/controller results, then separately authorized exact-ID dry-run/commit/recovery records. Local tests alone cannot close live mapping.

### RB02 — Partially Implemented

**Exact Phase15B requirement:**

> Every protected endpoint/method has positive and negative tests for all four roles, anonymous/unconfirmed/deleted accounts, expired/wrong-signature/malformed/stale tokens. Test direct API calls independently of hidden menus

- **Current Phase15D classification:** Partially Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B01/B05-B11.
- **Proposed technical solution:** Attach capability admission to every protected method/alias only after its scope/field/effect tests pass. Execute the manifest as direct API tests for four roles and invalid authentication states.
- **Files expected to change:** FE: App.jsx/DashboardGuard/Layout later. BE: app.js, all11 route files, authMiddleware.js; proposed capability middleware, route manifest and rbacApi.test.js.
- **Test cases:** Allowed/denied matrix per method including register, stock/set-active, ensure, void/delete, debt aliases, dashboard/expense. Expired, wrong signature, malformed, stale, anonymous, unconfirmed and missing account requests stop before domain effects.
- **Dependencies:** B01 vocabulary; OP03-OP10 for each scoped operation; no unresolved conditional operation silently allowed.
- **Completion evidence:** Manifest-to-router coverage report; no uncovered method; response and zero-domain-effect assertions, with mocks/native limits separated.

### RB03 — Already Implemented

**Exact Phase15B requirement:**

> Current persisted role overrides a forged/cached admin claim. Password/reset/role/confirmation changes advance epochs atomically; old tokens remain rejected after demotion/restoration. Preserve the established seven-day lifetime and strict legacy-token policy

- **Current Phase15D classification:** Already Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B02/B04/B11.
- **Proposed technical solution:** Keep current-account role/time/version validation. Extend the same CAS-protected epoch change to approved new security fields; policy-only cutover gets explicit revocation assessment rather than legacy-token leniency.
- **Files expected to change:** FE: AuthContext/apiClient (B10). BE: authMiddleware.js, models/User.js, generateToken.js, tokenPolicy.js, tokenVersion.js, UserController.js; existing tokenVersion/tokenSecurity/a04 suites.
- **Test cases:** Seven-day boundaries; missing/future/noninteger exp/iat; forged roles and signatures; wrong/stale/missing claim; missing stored epoch only zero; password/reset/role/confirmation/grant/activation/membership transitions and demotion/restoration; bcrypt2a/2b/2y.
- **Dependencies:** OP02/OP06; B04 if security writer audit changes; production cutover not approved.
- **Completion evidence:** Existing regressions retained plus new-field tests proving one guarded state update, old-token denial and unavailable lookup failure. Native race evidence separately labeled.

### RB04 — Partially Implemented

**Exact Phase15B requirement:**

> Only Administrator can provision/list/edit staff privileges, confirm/reset/delete accounts. Body field injection cannot escalate rights through signup/profile/product/order endpoints. Managers cannot assign themselves or another user Administrator

- **Current Phase15D classification:** Partially Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B01/B02/B04/B11.
- **Proposed technical solution:** Keep staff provision/list/privilege/confirmation/reset/delete Administrator-only at middleware and mutation guard; inject neither roles nor security fields via self/business payloads. Student enrollment cannot reuse public staff role assignment.
- **Files expected to change:** FE: UserModal/AdminUserTable/useAdminUsers/authApi. BE: UserRoute/UserController, adminAccountMutation.js and account DTO validators; all business input policies.
- **Test cases:** Manager/Cashier/Customer/guest direct denials for all account routes; role/confirmed/tokenVersion/isActive/store/grant injection through signup/profile/product/order; Admin permitted normal cases; no returned hash or impersonation token.
- **Dependencies:** OP01/OP02/OP04/OP06; B04 audit; staff default and deactivation semantics approved.
- **Completion evidence:** Role-by-account-operation matrix; denied target work zero, audit-attempt effects explicitly classified; no broadening adminAccountFilter.

### RB05 — Already Implemented

**Exact Phase15B requirement:**

> Canonical/uppercase/mixed-case self-delete rejects before either deletion function/session/fence; malformed IDs safely reject. Authorized peer administration still works

- **Current Phase15D classification:** Already Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B02/B11.
- **Proposed technical solution:** Keep canonicalAccountId validation and pre-mutation self-delete comparison; new routes reuse canonical IDs before choosing self versus cross-account operations.
- **Files expected to change:** FE: account delete UI (B10); BE: accountIdentity.js, UserController.deleteUser, adminAccountMutation.js; accountIdentity.test.js retained.
- **Test cases:** Lowercase/uppercase/mixed-case self delete400; document/collection deletion calls0, target lookup0 beyond protect, sessions/fences0. Malformed ID400; real-format absent target404; authorized peer success and unauthorized denial.
- **Dependencies:** No new schema for this control; B02 account extension must preserve ordering.
- **Completion evidence:** Original A05 probe and permanent A06 cases retained and passing locally after implementation; native deletion behavior never inferred from adapters.

### RB06 — Partially Implemented

**Exact Phase15B requirement:**

> Every allowed operation enforces approved store/record scope: list/detail/search/aggregation/export/receipt paths cannot leak another store or unauthorized cashier's/customer's data by changing an ID/filter

- **Current Phase15D classification:** Partially Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B03/B06/B08/B11/B12.
- **Proposed technical solution:** Build mandatory server scope before fetching or aggregating. Distinguish store membership, personal processor and student/guest subject; constrain every list/detail/receipt/populate path and any future export.
- **Files expected to change:** FE: order/invoice/financial/people/product services and pages. BE: proposed resourceScope.js; Product/Order/Person/Invoice/DebtPayment/Financial/Expense controllers and affected models.
- **Test cases:** Cross-store and cross-cashier/student IDs; crafted owner/store/cashier filters; aggregate/count/pagination/populate; GET ensure effects; future export denied until authorized. Unmapped records not silently pooled.
- **Dependencies:** OP03/OP04/OP05; EV01 exact legacy resource attribution; approved store/subject schemas.
- **Completion evidence:** Reviewed query inventory plus forbidden-record/field assertions for each entry point; legacy counts retained in approved mapping evidence.

### RB07 — Not Implemented

**Exact Phase15B requirement:**

> Cashier cannot edit price/cost/stock or access full management reports. Approved Manager/catalog rights do not expose account administration. Response filtering excludes costs, secrets, hashes, tokens and unauthorized personal data

- **Current Phase15D classification:** Not Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B01/B05/B06/B10/B11.
- **Proposed technical solution:** Separate pricing, stock commands, management reports and sale-safe DTOs; enforce forbidden input fields server-side and allowlist response fields. Only Administrator changes product prices; Manager catalog metadata denied by default.
- **Files expected to change:** FE: ProductPage/productApi, PosPage, FinancialPage/Layout. BE: ProductRoute/ProductController, OrderController.buildItems, Financial/Dashboard routes; proposed productFields.js/projections.
- **Test cases:** Cashier price/cost/stock/report denials; Manager price/metadata denied; aliases/nested/operator injection blocked; costs/owner/PII/security internals excluded; omitted cost unchanged under authorized targeted fix; historical price snapshot unchanged.
- **Dependencies:** OP05/OP09; B04 audit; separate cost-reset implementation authorization.
- **Completion evidence:** Every field/method has a declared policy and observable denial/projection result; no hidden-form-only acceptance or historical product record repair.

### RB08 — Not Implemented

**Exact Phase15B requirement:**

> Receiving/adjustment tests cover request versus approval versus application, unauthorized transitions, maker/approver identity if approved, recorded responsible users and reasons. No stock ledger acceptance based solely on a quantity input

- **Current Phase15D classification:** Not Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B04/B07/B10/B11.
- **Proposed technical solution:** Manager directly receives/adjusts through validated delta commands with required movement/audit fields. Keep stock authority in Product.stock. Do not create a second inventory approver; approval tests apply only to actually approved transitions.
- **Files expected to change:** FE: proposed inventory receiving/movement view; ProductPage stock path. BE: ProductController/OrderController, proposed inventoryService/StockMovement/InventoryRoute.
- **Test cases:** Direct Manager success, reason/actor/time/source, Cashier/Student/guest deny, price field injection deny, exactly one movement per operation, concurrent deltas retained and no duplicate sale deduction; no synthetic independent approval policy.
- **Dependencies:** OP07/OP08/OP09; approved stock/movement/idempotency schemas and separate integrity scope; native gateEV03.
- **Completion evidence:** Command-to-stock-to-movement reconciliation, fault and zero-effect denial evidence; independent clients needed before native concurrency claim.

### RB09 — Not Implemented

**Exact Phase15B requirement:**

> Approved void/refund/cancellation authority is enforced on every entry point, including DELETE order alias, transaction void and invoice markVoid. Denied actions produce zero financial/stock effects. No refund test invents unapproved settlement/accounting rules

- **Current Phase15D classification:** Not Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B04/B09/B10/B11.
- **Proposed technical solution:** All void/refund/cancellation entry points delegate approved authorization/state/effect rules; Manager approval/application and Cashier request-only. Record append-oriented reason/approval/effect links; never delete completed history.
- **Files expected to change:** FE: OrdersPage/InvoicePage and proposed reversal request UI. BE: OrderController.deleteOrder/voidTransaction, InvoiceController.markVoid, Order/Transaction/Invoice routes, proposed reversal service/model.
- **Test cases:** Each alias and target scope; forged approval, duplicate application, Cashier request versus approval, Manager success, Admin conditional deny/allow, denied zero financial/stock effects, unknown outcome and traceable original history.
- **Dependencies:** OP08 money/stock/cancel semantics; OP07; explicit schema/operation scope authorization.
- **Completion evidence:** Owner-approved effect specification plus per-alias authorization/audit/reconciliation tests. No invented refund settlement fixtures or silent cancellation equivalence.

### RB10 — Partially Implemented

**Exact Phase15B requirement:**

> Order and payment transitions are server-validated; no arbitrary status/price/payment-state assignment from the client. Concurrent cashiers and duplicate submissions require explicit integrity tests under approved semantics

- **Current Phase15D classification:** Partially Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B05/B07/B08/B09/B11.
- **Proposed technical solution:** Keep catalog-derived prices and backend amount/state checks; define command-specific allowed transitions and durable request identity/effect consistency under separately approved financial/inventory semantics.
- **Files expected to change:** FE: PosPage/OrdersPage/ordersApi and future kiosk submit. BE: OrderController.buildItems/completionPayload/decrementStock/completeTransaction, DebtPaymentController, Order/DebtPayment/Invoice models.
- **Test cases:** Client forged amount/price/paid/status rejected; insufficient/inactive products; concurrent last item, same-order two cashiers, repeated request, lost response/resubmit and partial/indeterminate outcome; denied attempts do not mutate.
- **Dependencies:** OP08/OP10 and five deferred integrity risks; scoped schema approval; native evidenceEV03.
- **Completion evidence:** State/effect table and exact mutation/payment/stock counts with reconciliation; mocks labeled; unresolved native/financial cases explicitly not passed.

### RB11 — Not Implemented

**Exact Phase15B requirement:**

> Guest/customer kiosk cannot call staff APIs or enumerate another person's order/receipt. If login is chosen, secure User/order ownership binding is tested; if guest is chosen, approved session/reference/privacy/rate controls are tested. No current user-role shortcut

- **Current Phase15D classification:** Not Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B03/B08/B10/B11.
- **Proposed technical solution:** Implement dedicated public-safe guest and authenticated-student contracts; server-derived student subject and approved guest possession/session controls. Both modes required; neither gets legacy user/staff powers.
- **Files expected to change:** FE: future kiosk outside staff Layout; App/AuthContext boundary. BE: proposed KioskRoute/kioskIdentity/kioskOrderService, Order/User models and safe catalog DTO.
- **Test cases:** Both-mode positive submit; other student/guest enumeration denied; staff endpoints denied in both modes; invalid credential no guest downgrade, forged subject/paid/status blocked; kiosk handoff privacy and approved rate/session rules.
- **Dependencies:** OP04/OP10; B03/B04; enrollment/privacy/subject schema and separately authorized kiosk workflow.
- **Completion evidence:** Mode-separation and ownership tests plus authorized browser session-reset evidence later; order reference is not proof of payment or blanket receipt access.

### RB12 — Not Implemented

**Exact Phase15B requirement:**

> Cashier cross-history, Manager price edits/adjustment approval and financial visibility match the signed D decisions exactly, including denial cases and aliases

- **Current Phase15D classification:** Not Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B01/B05-B11.
- **Proposed technical solution:** Freeze executable policy expectations from Phase15C: Manager price deny, direct stock allow, refund approval allow and all-cashier history allow; Cashier own-only. Both kiosk modes and Administrator-only pricing included.
- **Files expected to change:** FE: all applicable account/product/order/history/report/menu views. BE: capability policy, all related controller/route aliases and scoped DTOs.
- **Test cases:** Explicit approved five-decision positive/negative cases, conditional Admin/Manager operational grants absent/present, no unauthorized cost/account/audit access, all aliases agree.
- **Dependencies:** OP02/OP03/OP05/OP08/OP10 for implementation details only; no reopening the five settled decisions.
- **Completion evidence:** Signed policy/version matrix matched to test assertions and route coverage; forbidden roles/fields yield zero domain effects.

### RB13 — Already Implemented

**Exact Phase15B requirement:**

> Administrator requests admitted before revocation cannot regain privilege at mutation time. Keep actor-version guard, same-transaction fence and safe retry rechecks; do not broaden adminAccountFilter for convenience

- **Current Phase15D classification:** Already Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B02/B04/B11.
- **Proposed technical solution:** Keep adminAccountFilter admin-only, self-target conditional save, cross-account actor write fence and target change in one transaction; include approved lifecycle/grants in current actor guard. Any audit integration retains serialization and R2 observer.
- **Files expected to change:** FE: account operations caller only. BE: adminAccountMutation.js, User.js, accountCommitBoundary.js, account security/audit integration; a03/a04 regression suites.
- **Test cases:** Admit then demote/reset/unconfirm/deactivate/change grant or membership before fence/save; stale operation fails. Fence-first concurrent revocation ordered after mutation. Retry rechecks actor; unsupported transactions no fallback; target and fence rollback together.
- **Dependencies:** B02/B04 design; OP06/OP07; real transaction schedulingEV03.
- **Completion evidence:** Existing paused race and retry tests preserved, new security-field races added, native independent-client ordering report separately required.

### RB14 — Already Implemented

**Exact Phase15B requirement:**

> Both R1 commit replay probes continue to pass: uncertain commit cannot repeat target/fence effects; legitimate confirmed-abort/ack retries remain; cleanup preserves acknowledged success and primary error; unknown outcomes retain retryable false

- **Current Phase15D classification:** Already Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B02/B04/B07/B09/B11.
- **Proposed technical solution:** Preserve R2 commit observer/no-replay contract and nonretryable indeterminate envelope in every touched account path. Do not substitute callback-only metadata or remove legitimate driver commit retry.
- **Files expected to change:** FE: apiClient/auth API and accountMutationRetry tests. BE: accountCommitBoundary/adminAccountMutation/accountMutationOutcome/errorMiddleware, commitReplay/accountFaults tests.
- **Test cases:** Both original R1 compound-label probes; callback/target/fence counts; unknown commit then transient retry attempt; legitimate transient-only whole-transaction and acknowledgement retries; timeout/abort/cleanup faults; primary cause/result and retryable false.
- **Dependencies:** Installed driver APIs re-reviewed before changes; native protocol evidenceEV03; B04 audit must not add unsafe replay.
- **Completion evidence:** Permanent R1 regressions fail if guard removed and pass when retained; count target effects separately from empty driver callback re-entry; unknown outcomes never labeled definite abort.

### RB15 — Partially Implemented

**Exact Phase15B requirement:**

> Frontend navigation/pages/actions match approved permissions, stale UI state does not bypass the backend, and account errors remain sanitized. Customer surfaces do not render staff routes through cached storage manipulation

- **Current Phase15D classification:** Partially Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B01/B06/B08/B10/B11.
- **Proposed technical solution:** Use sanitized server capability projection to render route/action/field eligibility after backend enforcement. Reconcile stale user state, keep customer surfaces out of staff shell and preserve redacted errors/no-replay handling.
- **Files expected to change:** FE: App/Layout/DashboardGuard/AuthContext, auth forms/services, product/order/invoice/report pages, apiClient/safeDiagnostics. BE: approved profile/projection DTO and all existing enforcement.
- **Test cases:** Every role/deep link; manipulated storage, expired/stale token, changed role/deactivation, stale tabs; no staff fetch-before-hide; no automatic replay; error/log redaction; both kiosk modes; browser focus/responsive claims only if actually checked.
- **Dependencies:** B01-B09 relevant APIs; OP09 projection compatibility/OP10 kiosk behavior.
- **Completion evidence:** Client tests/build and targeted/full lint results recorded; server direct API denials remain independent. SSR/transport/browser evidence separated.

### RB16 — Cannot Verify

**Exact Phase15B requirement:**

> Migration dry-run/commit/recovery verifies exact authorized account IDs/counts, unchanged bcrypt/confirmation/history/ownership, expected epoch increases, protected last-admin rules if approved, and no automatic treatment of uncertain accounts

- **Current Phase15D classification:** Cannot Verify; preserved, not a Phase15E execution result.
- **Implementation batches:** B02/B03/B11/B12.
- **Proposed technical solution:** Exact-ID reviewed mapping plan with expected old state/epoch, dry-run zero writes and reconciled guarded application. Preserve hashes/confirmation/history/owners; recovery advances epochs rather than restoring old security state.
- **Files expected to change:** FE: no migration UI required; any optional Admin review is separately authorized. BE: proposed mapping plan/security-aware apply tooling and synthetic migration tests; User/controller/admin guards preserved.
- **Test cases:** Wrong/unapproved IDs, counts mismatch, stale plan, duplicate mapping, uncertain account, interruption/unknown outcome; unchanged hash/confirmation/ownership privately asserted; last-admin rule only if approved; no auto-classification.
- **Dependencies:** EV01/EV02/EV04; OP01/OP03/OP06; approved mapping, backup, migration/session and rollout authorization.
- **Completion evidence:** Synthetic tooling evidence first; actual dry-run/commit/recovery counts and authorized inventory later. Remains Cannot Verify for live acceptance until those actions are authorized and evidenced.

### RB17 — Not Implemented

**Exact Phase15B requirement:**

> Durable audit entries, if approved/implemented, identify actor/target/action/time/result without credentials; unprivileged roles cannot alter them. Missing audit functionality cannot be called verified based on request logs

- **Current Phase15D classification:** Not Implemented; preserved, not a Phase15E execution result.
- **Implementation batches:** B04/B05/B07/B09/B10/B11/B12.
- **Proposed technical solution:** Durable append-oriented sensitive-action events with verified actor/target/action/time/reason/result; immutable ordinary API, scoped readers and approved atomic mutation/audit strategy. Phase15C makes this mandatory.
- **Files expected to change:** FE: restricted Administrator audit and Manager movement views. BE: proposed AuditEvent/auditService/AuditRoute, sensitive account/catalog/inventory/reversal services; logger not substituted for events.
- **Test cases:** Audit success/denial/failure/unknown, redaction, unauthorized read/edit/delete denied; correlation/deduplication, audit write/commit/cleanup failure, account self-CAS integration; no success event for unconfirmed outcome.
- **Dependencies:** OP07 schema/retention/failure/access rules; transaction topologyEV03 if multi-document; separate event rollout approval.
- **Completion evidence:** Mutation/event atomicity and reader scope assertions; signed retention/failure contract; native durability proof only from authorized environment, no diagnostic-log-only signoff.

## 8. Safest implementation order and enablement gates

Independent means each batch has its own diff, tests, rollback and approval; it does not mean dependent features may be enabled out of order.

| Wave | Proposed work / gate | Why this order |
| --- | --- | --- |
| 0 | Review OP01-OP10 recommendations and authorize only the intended batch/file/test scope | A blueprint is not approval of schema, conditional grants or feature work |
| 1 | B01 pure backend policy + complete method/alias manifest, local fixtures only | Backend authority established before menus; no live runtime behavior or persistence needs to change |
| 2 | B02 role/lifecycle compatibility readers and guarded writer tests; do not enable new sensitive writers | Prevent enum-only deployment, legacy privilege reinterpretation and security-hook bypass |
| 3 | B03 resource/subject scope; B04 audit consistency design and approved implementation | Existing requester owner cannot supply all-cashier or student scope; account self-CAS needs a deliberate atomic audit path |
| 4 | B05 server catalog/field restrictions; B06 scoped histories/reports/receipts | Enforce direct APIs and field/data boundaries before frontend display or shared operational use |
| 5 | B08 guest/student boundary contract and tests; B07 operational stock/effect commands as separately approved parallel branches after dependencies | Kiosk identity separation can be tested without inventing payment/reservation rules; actual submission/completion waits for approved inventory/effect integrity |
| 6 | B09 reversal request/approval/application after OP08 defines effects | Manager authority is already settled; payment/stock effects and traceable records must precede execution |
| 7 | B10 frontend capability shell/actions, only for server-enforced and authorized surfaces | Avoid visibility-first security; do not expose unbuilt kiosk/refund/movement features |
| 8 | B11 consolidated local evidence; then separately authorized native/browser verification | Tests run in every earlier batch; final checks reconcile all17 gates rather than begin testing at the end |
| 9 | B12 controlled migration/resource/deployment runbook; execution only after A01/native/backup/mapping/session approvals | Existing accounts/data and active session effects require explicit environment and operator evidence |

Two priority adjustments are required by the actual code:

- **Audit moves earlier than operational enablement.** User self writes use single-document CAS, while peer administration uses transactions. Adding an independent post-save event would violate consistency; audit strategy must be ready before new sensitive writers are enabled. B02 can prepare/test compatibility without exposing incomplete writers.
- **Shared scope precedes complete API enablement.** Capability admission can be designed first (B01), but Manager history and student privacy cannot be enabled safely while owner=requester is the only scope. B03 supplies that contract; it is not permission to merge data. Inventory effects also depend on OrderController completion, so a kiosk identity boundary cannot establish a complete sale workflow.

Testing is continuous from B01. B11 is the consolidated acceptance gate, not permission to defer security tests. Backend restrictions and account guards remain during any UI rollback.

### Gate states at the end of Phase15E

| Gate | Status | Required next evidence/action |
| --- | --- | --- |
| Approved four-role business policy and five decisions | PASS as design evidence | Preserve Phase15C; do not reopen settled rights |
| Exact RB01-RB17 blueprint coverage | PASS for documentation after coverage checks | Actual acceptance tests remain future work |
| Pure local B01 proposal | READY FOR REVIEW, NOT AUTHORIZED | Approve technical contract and exact local implementation scope |
| OP01-OP10 applicable technical/business contracts | PENDING OWNER APPROVAL | Adopt/revise recommendations; no implicit permission |
| Live account/resource inventory and mapping | UNVERIFIED | A01 scoped verification only after its identifiers/access gate is met |
| Persistent schema/migration/session cutover | NOT AUTHORIZED | Explicit schema/backup/recovery/mapping/session approvals |
| Native transaction guarantees / A08B execution | UNVERIFIED / BLOCKED | EV03 and separate execution approval; do not connect now |
| Production deployment / full operational RBAC | NOT READY / NOT AUTHORIZED | Complete applicable acceptance, integrity, recovery and release gates |

## 9. Test and evidence protocol

### Local tests planned for later authorized batches

Existing scripts are `backend: npm test` and `client: npm test` (Node test runner), `client: npm run build` and `client: npm run lint`. Reinspect scripts/test imports before later execution; do not invoke startup/seed or any configured-database runner as a shortcut. A changed script is not automatically safe because its name is “test.”

Recommended future suites, using installed tooling without an assumed dependency install:

- `backend/tests/rbacPolicy.test.js`: immutable role ceilings, conditional grants and fail-closed malformed/missing state.
- `rbacRouteManifest.test.js` / `rbacApi.test.js`: every mounted method and alias, direct request matrix and zero denied domain effects.
- `rbacScope.test.js`: scoped object/list/aggregate/population/receipt and legacy attribution.
- `rbacAudit.test.js`: atomic event/effect contracts, denied-attempt distinction, cleanup and indeterminate outcomes.
- `rbacMigration.test.js`: synthetic exact-ID mapping, stale plans, no-write dry-run and monotonic recovery; does not access actual accounts.
- Feature tests for receiving, inventory concurrency/replay, reversal approval and both kiosk modes only when those batches/effects are authorized.
- `client/tests/rbacNavigation.test.js`, `rbacFields.test.js`, `kioskPrivacy.test.js`: capability display, stale storage/session boundaries, API denial and private data not fetched/rendered.

Retain existing security.test, tokenSecurity, tokenVersion, a03TokenReview, a04Security, accountIdentity, accountFaults, commitReplay, payments and invoices suites; client safeDiagnostics/logout/invoice/accountMutationRetry tests. Extend behavior coverage, not a file-name-only checklist. Guard-removal mutation testing, when authorized, must use isolated reversible local copies and must not weaken permanent tests.

### Completion evidence required from each batch

1. Exact changed-file diff, approved scope/decision IDs and no unrelated source/lock/environment changes.
2. Tests/commands with exact pass/fail/skip counts and exercised API methods; no assertion of native correctness from mocked methods.
3. Denied-domain-effect counts and after-state assertions, not only status codes or helper invocation checks. Audit attempts are distinguished from forbidden target effects.
4. Outcome ledger: acknowledged success, known rejection and indeterminate response; preserve primary causes privately without leaking tokens/account data.
5. Existing security regressions retained; no lowered expiry/version/role/ID/fence/replay protection.
6. Open criteria/risks and approvals needed for the next slice; completion of one batch never starts another.

For **RB16**, distinguish synthetic tooling acceptance from actual authorized dry-run/commit/recovery. For **RB13/RB14**, distinguish adapter/barrier results, installed-driver synthetic paths and native server protocol/scheduling/durability. For **RB15**, distinguish SSR/transport assertions from browser focus, accessibility, responsive, printer and kiosk handoff checks.

Native fault injection, synthetic database writes and cleanup require the [A08B preflight](UPHSD_BOOKSTORE_A08B_PREFLIGHT_READINESS.md) gate. Missing native results are not fabricated and do not justify contacting an unspecified target. No integration command or connection string is supplied here.

## 10. Open risks and rollback strategy

### Risks carried forward without remediation

| Open risk | Blueprint treatment | Current disposition |
| --- | --- | --- |
| Repeated stock adjustments | B07 proposes scoped operation identity + effect/movement reconciliation | Deferred; no fix or write performed |
| Lost concurrent inventory adjustments | B07 proposes conditional atomic deltas and real concurrent-client evidence | Deferred; no native claim |
| Partial activation | B05 explicitly covers set-active alias but permission alone cannot make two writes atomic | Deferred; separate integrity implementation approval |
| Payment resubmission | B07/B09/B08 must distinguish a new HTTP request from driver retry; durable identity/reconciliation needs schema/semantics | Deferred; R2 does not solve it |
| Financial error masking | B07/B09 must preserve truthful outcomes/primary errors, including post-write failures | Deferred; account helper behavior is not proof for finances |
| Omitted product cost reset | Explicit B05 subtask requires separate authorized fix; no automatic historical record correction | Deferred and unchanged |
| Native MongoDB transaction behavior | EV03/A08B independent testing, no fallback to unsupported nontransaction writes | Unverified; A08B not started |
| Legacy accounts/admin legitimacy/credential lifecycle | EV01/A01 and named approved remediation only | Unknown; no rotation/reset/role change performed |
| Existing client lint debt | Keep16 errors/13 warnings visible until independently rerun/fixed under scope | Historical unresolved baseline; no lint run or repair |

No data integrity risk is closed by a role label, guard, audit design or documentation test.

### Rollback by state boundary

- **Unattached policy/local UI change:** revert only the authorized new code, retaining all existing security fixes/tests. UI rollback never relaxes backend authority.
- **New role/security schema in use:** retain a compatible secure reader that recognizes the new representation. Stop new writes through an approved operational procedure; do not deploy the old broad legacy policy or a binary that ignores activation/grants/version checks.
- **Account assignment changed:** reconcile the exact account's acknowledged state and expected epoch; an approved reversal is a new guarded role/grant/membership change with another epoch increment. No old tokenVersion restoration, mass logout or account reset is implicit.
- **Shared resource attribution changed:** keep owner/IDs/references and approved mapping evidence. Do not unmap by bulk rewriting records, pool unknown records or infer a historical cashier.
- **Financial/inventory/audit effect recorded:** retain history and operation identity. Stop the new command if needed, determine acknowledged/unknown effects, and obtain approval for any compensating action. Do not issue inverse deltas/refunds or delete events as generic rollback.
- **Backup recovery:** old backups can revive passwords, roles, epochs and access. Recovery requires coordinated secure-reader/session strategy, exact target verification and separate authorization; “restore backup” is not automatically a safe security rollback.

A policy-only code change may expand active account authority without changing a stored role/epoch. Release planning must explicitly address that session impact. No deployment/credential/session action is permitted by the rollback design.

## 11. Readiness and authorization boundaries

The approved business design is sufficiently explicit to implement **only the applicable, separately authorized slice** after its gated technical contracts are adopted. B01 is a bounded candidate for local foundation authorization: pure policy/manifest/tests, no runtime route attachment, schema/data migration, account mapping, kiosk, inventory or payment change. It is not authorized by this blueprint.

**Full implementation remains NOT READY FOR BLANKET AUTHORIZATION.** The blueprint is implementation-ready as a set of concrete gated contracts and batches, not a claim that OP01-OP10, actual mappings, audit schema, refund effects or native evidence have already been approved. Blocked slices stop at their stated gate; developers must not fill policy gaps with guesses.

Separate approvals remain necessary for:

- Each implementation batch and its exact file/test/API/schema scope; any departure from the owner's ceilings.
- Account/resource mappings, compatible legacy/lifecycle defaults and deliberate session effects.
- Sensitive audit persistence/failure/retention choices and conditional operational grants.
- Customer identity/privacy and payment/refund/void/stock/fulfillment policies not fixed by Phase15C.
- Any data-impacting schema/index migration, backup/restore, connection, A08B write/fault/cleanup exercise and production deployment.

No prior report is rewritten, no optional role introduced, no approved permission weakened and no new business capability silently granted. The project remains independent of GradeSense AI. **Stop after documentation; no implementation, A08B or Phase16 work follows automatically.**

## 12. Phase15E delivery and preservation verification

| Item | Phase15E result |
| --- | --- |
| Created file | `docs/UPHSD_BOOKSTORE_PHASE_15E_RBAC_IMPLEMENTATION_BLUEPRINT.md` |
| Updated file | `docs/UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md`, dated additive entry only |
| Proposed batches / mandatory criteria | 12 batch contracts; 17 exact criteria with unchanged Phase15D classifications, solutions/files/tests/dependencies/evidence |
| Application/tests/configuration/environment/dependencies/roles/accounts | No changes authorized or made |
| Tests/build/lint/native/browser | Not run; historical counts explicitly labeled |
| Database/provider/external services | No connection, query, write, migration or deployment |
| Preservation/coverage checks | 184 baseline files compared: only the implementation plan changed, this blueprint was added and none were removed. All other baseline files hash-match; the original 56,266 plan bytes remain an exact prefix |

Documentation verification matched all 17 exact requirements and all 17 Phase15D classifications; found 12 batch sections with each required batch field and 17 completion-evidence mappings; all 5 relative links resolve. Whitespace checks passed; git emitted only pre-existing line-ending notices for three untouched tracked files. A heuristic scan found no connection-string/JWT-shaped values in the new blueprint; this is not a comprehensive secret audit. These are documentation checks, not executed application/security tests.

Only the new blueprint and plan append may differ from the pre-phase workspace. Prior reports, pre-existing dirty files/lockfiles and all application security controls remain preserved.

