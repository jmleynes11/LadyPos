# B02 — Role & Account Management completion report

Date: 2026-11-04, Asia/Manila. UPHSD Bookstore POS.

**Status: COMPLETE for the owner-approved LOCAL account-management scope, with release limitations. Independent review: PASS WITH LIMITATIONS. Production activation: NOT AUTHORIZED and evidence gates remain open.**

B02 is one major roadmap phase. Earlier B02-A/B/B1 and review labels remain historical/internal references, not additional major phases. This report does not start B03 or A08B.

## 1. Authority and decisions finalized during execution

Read B02 assessment, role/account contract, owner decisions, lifecycle contract, earlier implementation results, B01-R2 independent review, Phase 15C/D/E/F and implementation plan. Earlier reports remain unchanged except the requested additive implementation-results update.

The owner explicitly approved these decisions in this task, resolving their previously pending status:
- Fence-first work may finish atomically; suspension is acknowledged only after it completes. Suspension-first work is denied. Unknown commit outcomes reconcile without replay.
- B02 acceptance verifies account-related portions of RB01–RB17. All later operational portions remain mandatory dependencies; no B03 implementation is authorized.
- New accounts are active but unconfirmed.
- Missing accountState on existing admin/user retains confirmation-based compatibility without a hydration write. New business roles with missing state fail closed.
- Unreviewed user retains existing owner-scoped access without new privileges until approved individual review. A finite cutover plan is required before production activation.
- Deny self-grants. Another independently verified Administrator executes authorized grants.
- Invalidate prior conditional grants on recipient security changes and issuer demotion/suspension; require fresh approval.
- Do not remove/suspend/demote the last usable confirmed active Administrator. No self-recovery endpoint; emergency recovery requires separate owner authorization.
- Retain audit until a separately approved retention/purge policy; Administrator read only, no export endpoint. Applied events persist atomically; failed/rejected attempts use redacted best-effort logging without replacing primary outcomes.

No default grant duration was approved or invented. No prior Phase 15C permission was changed.

## 2. Account behavior and workflows

### Roles and compatibility

Exact keys remain admin, store_manager, cashier and customer in one User.role. Existing user remains legacy-unassigned; there is no automatic Customer/employee assignment. Unknown/malformed roles fail closed.

New role support is authentication/account compatibility, not automatic POS authority. The existing restrictive admission guard stays on all 52 business registrations and 21 inherited HEAD forms. Future Manager/Cashier/Customer operational rights remain deferred. Legacy admin/user owner scope is temporarily retained, including known legacy permissions broader than the eventual Phase 15C policy; finite review/cutover and later enforcement remain production prerequisites.

Confirmed and accountState preserve invalid stored types rather than casting malformed state into an active/confirmed account. Only exact confirmed true and active state authorize; missing-state compatibility is limited to existing admin/user. Existing bcrypt hashes, identifiers, IDs and historical owners are not migrated.

### Secure account administration

Staff creation remains Administrator-only and now requires an explicit approved role, reason and stable operationId. Accounts start active/unconfirmed, no impersonation JWT is returned, and passwords follow the existing hashing path. Invalid role, malformed password or attempt to create a confirmed/suspended new account rejects.

Role/confirmation/reset updates require expectedVersion on the existing administrative PUT, and sensitive new command routes require explicit expectedVersion plus stable operationId. Actor authority is checked from current account data inside the serialized transaction and pinned by a real write. Target epoch predicates remain in the actual save, including canonical self updates.

Administrator mutation responses return the current nonsecret securityVersion so a subsequent form edit has a valid expectedVersion. Self-profile responses omit this administrative field. Sequential administrative edits and profile exclusion are covered by the positive HTTP regression.

Canonical malformed/self-delete requests still reject before session, fence or deletion. Existing peer hard-delete behavior remains a distinct guarded Administrator action with audit and last-admin protection; no historical transaction cascade was added. Suspension never invokes deletion.

### Manual legacy review

Administrator records review evidence and a decision; approved review is not role authority. Application requires the exact target, current expected role/epoch, approved role and current Administrator authority. Role + epoch + applied review + audit commit together. Corrections create a superseding review with linked audit; rejection preserves the account and compatibility envelope.

Administrator independent verification uses a separately reviewed peer account record; self-review cannot establish it. Distinct account IDs and synthetic fixtures do not prove real human independence. Actual administrator legitimacy and verification evidence must be established through authorized A01/owner review before production grants.

### Temporary conditional grants

Only current Administrator grants/revokes; issuing grants also requires independent peer verification. Each capability must be an existing approved conditional action eligible for the recipient role, with validated finite resource scope, reason, approval reference and explicit UTC effective/expiration instants. Missing, malformed, expired, out-of-scope, wrong-role or revoked grants deny server-side.

Grant-set replacement accepts a complete explicitly fresh-approved set (up to 13 different capabilities). Recipient epoch advances once, old grants are invalidated, and all fresh grants share the resulting epoch. A singular request is a one-item replacement. This supports compound future sale/payment/receipt duties without silently carrying old grants forward. Each entry supplies its own approval and expiration; no duration/default is inferred.

Current scope support is a bounded subset of the recipient's existing owner-linked records, or own-processor identity. It does not create shared-store membership. Assigned-order grants fail closed because owner is not an approved assignment. B03/later operational binding is still required before any grant can authorize those operations.

Revocation and recipient security changes invalidate grants/tokens atomically; grantor authority epoch/current status prevent revival after demotion/restoration. Expiration is checked independently of audit delivery, including after queueing before creation. Expiration events are materialized by lazy observation or an explicit Administrator/internal maintenance sweep. **No automatic scheduler was installed**; scheduling/monitoring is a release prerequisite. Expiry denial never waits for that sweep.

### Suspension and in-flight work

Suspension and epoch advance are one atomic audited change. Subsequent requests/login reject; reactivation advances epoch again and cannot revive old JWTs or revoked grants.

All effectful legacy API handlers share the account realm write/fence with account administration and borrow the same session. Response bodies are buffered until acknowledged outer commit. Existing explicit financial sessions do not independently commit/abort/clean up when borrowing that session. Effectful invoice GET/HEAD ensure routes are included; retired debt tombstones retain their no-effect 410 behavior.

Fence-first work completes atomically before suspension can finish; suspension-first work rejects before effects. No automatic cancellation/refund/restock policy was added. Commit uncertainty is indeterminate/non-retryable, with primary errors and acknowledged success preserved through cleanup failure.

A global serialized realm is deliberately conservative; it reduces parallel write throughput and requires native load/concurrency verification. No claim of MongoDB lock fairness or latency bounds is made.

## 3. Audit and operation persistence

Logical models: AccountAuditEvent, ConditionalAccountGrant, AccountRoleReview, AccountOperationReceipt and AccountAdministrationRealm. User adds accountState and authorityVersion; strict confirmation/status/version handling preserves missing-only compatibility. These are local schema/code changes; no database schema/index/data operation was executed.

Required applied event and account/grant/review effect share one supported snapshot/majority transaction. Ledger events include actor/target/action/time/reason, safe before/after values, scope and relevant review/grant references. Compound profile/security commands emit linked events; profile audit stores changed field names instead of PII values.

Operation receipts use stable command identity and a private keyed fingerprint; no password, token, fingerprint or credential hash appears in audit/read DTOs. Known secrets, labelled credentials, bcrypt material, JWT-shaped tokens, Bearer values and connection URIs are redacted from free-text audit/evidence metadata before storage and on reads. Arbitrary unlabelled text cannot be universally classified as a secret; operators must not submit credentials as reasons/evidence.

Applied events are not claimed durable until acknowledged commit. Unknown outcomes stay unknown; a matching authorized operation ID can be reconciled. Non-Administrator reconciliation is restricted to operations both performed by and targeting the current self account, preventing a demoted admin from reading former peer-account results. Machine expiry IDs use a reserved namespace.

Ledger model mutation hooks and absence of edit/delete/export APIs enforce application-level append-only behavior. They are not tamper-proof against direct database administration; effective provider privileges/indexes remain unknown. Retention/purge is not automated.

Existing self-profile/password APIs accept server-generated operation IDs for compatibility; clients may supply stable IDs. Lost-response reconciliation/deduplication is guaranteed only when the caller retained its stable command ID. No client automatic retry was introduced.

Offline seedAdmin bootstrap is disabled before CLI database connection. Existing Administrator records are not replaced. Creating a first/recovery Administrator requires a separately authorized procedure; there is no unapproved bootstrap exception.

## 4. Changed files

### New backend modules

- backend/auth/accountState.js — strict lifecycle reader/compatibility predicates.
- backend/auth/auditText.js — audit-specific credential redaction.
- backend/auth/accountRouteManifest.js — 12 additive account route identities/policies.
- backend/models/AccountControl.js — audit/grant/review/receipt/realm schemas.
- backend/utils/accountTransaction.js — owned transaction/commit-observer wrapper.
- backend/services/accountManagement.js — guarded, audited account/review/grant workflows.
- backend/controllers/AccountLifecycleController.js — narrow versioned commands, safe DTOs and reconciliation.
- backend/middleware/accountOperation.js — effectful API fence/session sharing/response buffering.
- backend/tests/accountManagementAdapter.js — isolated staged-state/concurrency adapter.
- backend/tests/accountManagement.test.js — 32 new regressions, including positive/negative localhost HTTP.

### Existing backend modules

- backend/models/User.js; middleware/authMiddleware.js; controllers/UserController.js — strict state/account validation, safe projections and audited writers.
- backend/utils/adminAccountMutation.js — preserve prior helper with compatible active-state predicate; utils/seedAdmin.js — gate unapproved offline bootstrap.
- backend/controllers/OrderController.js, DebtPaymentController.js, ProductController.js, PersonController.js, InvoiceController.js and ExpenseController.js — propagate borrowed session; no new price/payment/refund/stock business rules.
- All eleven backend/routes/*Route.js modules — ten business routers use effect wrappers after existing admission; UserRoute adds account commands.
- backend/tests/helpers.js, a03TokenReview.test.js, a04Security.test.js, accountFaults.test.js, accountIdentity.test.js, b02Compatibility.test.js, tokenSecurity.test.js, tokenVersion.test.js, security.test.js and routeInventoryAdapter.js — adapt explicit audit/review/default/transaction requirements while retaining security assertions.

Earlier component tests use explicit synthetic spare Administrator/review and ancillary ledger fixtures. Their actor/driver fault adapters remain; they are not proof of audit persistence. The new staged adapter tests real model validation/hooks, atomic result staging, audit failure and realm ordering. Self-write lost-acknowledgement probes now inject at the actual commit boundary, with rollback coverage retained separately. No test was removed. An incidental payment-fixture metadata edit was restored exactly to baseline.

### Client and generated output

- client/src/features/auth/components/UserModal.jsx — explicit four-role choices, reason/review reference and stable form operation ID; new accounts cannot be confirmed by the creation form.
- client/src/shared/utils/useAdminUsers.js — reason, expected version, operation ID and legacy review reference; no null profile values; reason for deletion.
- client/src/features/auth/api/authApi.js — deletion command body and account-command/reconciliation API helpers.
- Requested production build regenerated client/dist/index.html and the hashed JavaScript bundle; prior generated bundle replaced. No dependencies/configuration changed.

Current admin forms are compatible; richer audit/review/grant consoles are not claimed. Narrow account APIs provide the manual workflows. No unrelated navigation/branding/POS redesign occurred.

## 5. Route coverage

Historical Phase 15F/B01 baseline: 59 protected registrations + 23 inherited HEAD forms, preserved. Twelve explicit account routes add four inherited HEAD forms: **71 protected registrations + 27 HEAD forms total** across the same eleven mounted routers.

| Method | Added path | Current policy |
| --- | --- | --- |
| GET | /api/users/operations/:operationId | Current self actor+target, or current Administrator |
| GET | /api/users/audit-events | Administrator, safe read DTO, no export |
| POST | /api/users/grant-expirations | Administrator, explicit maintenance |
| POST | /api/users/:id/role-assignments | Administrator, canonical role + version + stable operation ID |
| POST | /api/users/:id/suspensions | Administrator, versioned audited command |
| POST | /api/users/:id/reactivations | Administrator, versioned audited command |
| POST / GET | /api/users/:id/role-reviews | Administrator review command / read |
| POST | /api/users/:id/role-reviews/apply | Administrator, approved current review |
| POST / GET | /api/users/:id/conditional-grants | Administrator grant-set command / safe read |
| POST | /api/users/:id/conditional-grants/:grantId/revocations | Administrator, versioned audited revocation |

B01's original manifest/criteria/description oracle is unchanged. The collector excludes only exact additive identities when validating the historical baseline, and separately exposes the complete graph for new-route completeness/authorization tests. Changed/missing new registrations and unexpected baseline drift remain test failures. Capability vocabulary is consumed for grant ceilings; B01 operational eligibility/field policy is not activated as an HTTP permit.

## 6. Actual verification

| Verification | Result |
| --- | --- |
| Full backend npm test | **228 passed, 0 failed**, no skips/cancellations |
| Independent final focused account/compatibility/RBAC/route suites | **99 passed, 0 failed** |
| Focused breakdown | 32 account management + 18 compatibility + 49 B01/RBAC tests |
| Client npm test | **16 passed, 0 failed**, no skips/cancellations |
| Client npm run build | Passed; existing >500 kB bundle warning |
| Backend node --check sweep | **42 changed/new JS files passed** |
| Backend targeted no-undef/no-unused-vars, correct Node globals | **40 files passed**; full 42-file set has 2 pre-existing unused-variable errors, 0 warnings |
| Full client npm run lint | **16 errors, 13 warnings**, unchanged |
| git diff --check | Passed; existing LF/CRLF notices are informational |

Backend lint exceptions: unused money in PersonController.js and unused authorizeRoles in OrderRoute.js. The former already appears once in the pre-edit source; the latter was recorded in prior results. Initial custom lint omitted Node globals, producing configuration-only no-undef findings; corrected invocation declares process/console/Buffer/setTimeout/fetch/structuredClone/URL. No lint suppression/config edit hides the two baseline errors.

Database verification classification:
- Real Mongoose 9.3.3 schema/hook/query-generation code; installed MongoDB driver and Mongoose driver both 7.1.1, identified from local packages.
- In-memory staged persistence, controlled concurrency/fault adapters and installed-driver-loop synthetic tests.
- Local integration uses temporary localhost HTTP only; requests and authorization execute actual app routes.
- **No native MongoDB, external provider or production verification.** No persistence/durability claim is derived from mocks.

Early intermediate test failures exposed required fixture adaptations, validation/casting and installed Mongoose batch-create constraints; these were corrected. Only final passing counts above are acceptance evidence. The initial reviewer produced defects; remediation and a fresh separate final review are documented independently.

## 7. All 17 criteria — preserved scope mapping

Canonical Phase 15B text and Phase 15C interpretations remain unchanged. The owner's explicit scope approval permits B02 account slices to pass while keeping later workflow slices mandatory; it does not waive them.

| Criterion | Verified B02 portion | Mandatory remaining system dependency |
| --- | --- | --- |
| RB01 | Four keys, strict adapter, malformed/missing rejection, manual review/application and preserved hashes | Actual inventory/mapping/cutover evidence |
| RB02 | Account API positive/negative roles, token/status denials, historical/additive inventory and HEAD handling | Full future operational allow policies |
| RB03 | Current account, exact confirmation/state, epochs and password/reset/role/lifecycle/grant invalidation; seven-day JWT | Native ordering evidence |
| RB04 | Admin-only provisioning/assignment/confirmation/reset/delete; no public or self escalation | Live Administrator legitimacy |
| RB05 | Canonical/upper/mixed-case self-delete before session/fence/delete; peer administration | Native execution evidence |
| RB06 | Account realm/target scope, self profile and reconciliation isolation, bounded owner grant scopes | Shared bookstore/processor/student resource scope |
| RB07 | Safe account/audit/grant/review DTOs and no operational inheritance | Final catalog/cost/price/report field enforcement |
| RB08 | Preserve direct Manager adjustment approval and reasons/audit requirements; no access accidentally activated | Inventory receiving/movement/effect service |
| RB09 | Conditional ceilings, no Cashier approval or Admin self-grant shortcut | Refund/void financial/stock effects and aliases |
| RB10 | Account operation identity, atomic effects/audit, truthful unknown outcome/no replay | Financial idempotency and cashier/native integrity |
| RB11 | Customer account cannot gain staff operations; no contact/User conflation | Guest/student kiosk identity/privacy workflows |
| RB12 | Role restrictions preserved; Manager pricing/Cashier peer history not granted | Positive Manager operational/history enforcement |
| RB13 | Current-actor transaction fence, self CAS, strict usable-admin count and simultaneous self-demotion protection | Native concurrency/load proof |
| RB14 | Original no-replay/cleanup regressions pass; new wrapper observes real commit boundary | Native fault/commit/durability verification |
| RB15 | Compatible account forms, safe errors and backend authority | Full role landing/navigation/action UI |
| RB16 | Reviewed exact-ID workflow and recovery/cutover runbook; no auto-conversion | Authorized actual migration/backup/recovery evidence |
| RB17 | Account/grant/review/lifecycle ledger and failure/append-only/redaction tests | Native persistence, operational audit and deployment privileges |

## 8. Independent review and remediation

See [independent security review](UPHSD_BOOKSTORE_B02_INDEPENDENT_SECURITY_REVIEW.md). A separate read-only reviewer inspected final code, reproduced important failures independently, re-probed corrections and ran final focused 99/99. Verdict **PASS WITH LIMITATIONS**, with no demonstrated local account-scope acceptance blocker.

Internal remediation corrected malformed hydration fallbacks, last-admin overcount, metadata credential leakage, incomplete command/precondition validation, scope/assignment conflation, incomplete audit mutation guards, namespace collision, expired queued grants, peer reconciliation leakage, review alias verification and installed-driver batch creation. None is portrayed as a deployed exploit or fixed production record.

## 9. Migration, rollback and activation runbook — execution prohibited

1. Verify actual deployment/database/provider identity, intended database and approved access under A01. Never infer identity from test or a connection fallback. Obtain minimum necessary account/role/status/hash-format inventory and independent administrator provisioning evidence; publish no secrets.
2. Review exact account IDs, expected role/epoch/state, duties and evidence; define finite legacy compatibility/cutover and actual reviewers/approvers. No automatic user conversion.
3. Obtain protected backup evidence covering User, historical ownership/transactions and all control ledgers/receipts/realm state. Record nonsecret snapshot/time/scope, restoration rehearsal and recovery approver. No backup was taken here.
4. Preflight supported transaction topology, driver/server compatibility, primary/snapshot/majority behavior, indexes and effective application/maintenance privileges. Create required unique event/operation indexes only under separate execution approval. No schema/index operation was run.
5. Rehearse no-write dry-run, expected counts, stale/conflicting review rejection, malformed legacy data handling and partial/unknown outcome reconciliation in an authorized disposable environment. Native A08B needs its own authorization.
6. Deploy compatible readers before writers; never hydrate defaults into legacy records. Approve API/client default changes and expected reauthentication. A01 actual deployed revision/config remains unknown.
7. Only after explicit approval, apply reviewed assignments through guarded commands, verify audit/effect consistency and retain epoch monotonicity. Record acknowledged/failed/indeterminate items accurately.
8. Configure approved expiry maintenance invocation/monitoring and account transaction performance alerts; prove append-only/least-privilege access and safe audit retention. No schedule/credentials are created here.
9. Approve rollback: keep a secure compatible reader; corrections are new audited epoch-increasing changes. Do not restore old epochs/passwords/roles indiscriminately, replay unknown operations, purge audit or merge catalogs.
10. Obtain separate activation/deployment/account-change authorization after reviewing evidence. Production operational roles remain restricted until later scope/permission/workflow batches meet their criteria.

Current readiness checklist: local code/tests/review PASS WITH LIMITATIONS; actual target/roster/backup/index/permissions/native recovery evidence **UNVERIFIED**; production activation **BLOCKED pending evidence and separate authorization**.

The five deferred financial/inventory risks remain open. Shared sessions/fences reduce some partial-completion opportunities on guarded APIs but do not establish financial resubmission idempotency, complete stock ledger/atomic delta design or native durability. Omitted cost-price reset remains deferred.

## 10. Preservation and final gate

Only authorized source/test/account-form changes, requested reports and appended plan/results entries are delivered. Final snapshot comparison found 38 existing files changed and 13 files added; the only removed file is the replaced generated client JavaScript bundle. The delta comprises 42 backend JavaScript files, three account-client source files, four requested documentation paths and regenerated build artifacts. No unrelated source deletion occurred.

All 74,705 original implementation-plan bytes and 16,928 historical implementation-results bytes remain exact prefixes. Only those two existing documentation files changed; all other prior reports/contracts and canonical criteria match the baseline. Environment files, manifests, all lockfiles (including the existing dependency-directory lockfile), deployment/configuration files and unrelated working-tree changes remain intact. git diff --check passed. No production account/session/data, migration or external connection occurred. GradeSense AI remains independent.

**B02's approved local account scope is ready for separate activation-readiness review; this is not production activation authorization. No B03 or A08B begins.**

