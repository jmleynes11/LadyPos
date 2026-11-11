# B02 — Role and account compatibility assessment

Date: 2026-11-04, Asia/Manila. UPHSD Bookstore POS.
**Assessment only. No B02 implementation, account/schema change or role activation is authorized.**

## 1. Recommendation and authority

Recommend retaining one authoritative persisted User.role, expanding its permitted values additively only after approval, and introducing an explicit server-side adapter to B01's four business labels. Retain admin as the Administrator compatibility key. Treat user as an unresolved legacy value requiring exact-ID owner-reviewed assignment; never map all user accounts to Cashier, Manager or Customer.

A separate persisted businessRole field is **not technically necessary or recommended for the initial design**. It would create two authority sources while existing admin checks still read role. A derived businessRole response/internal value is useful and does not require a second stored field.

This is a technical recommendation, not approval of keys, enum changes, account mappings, new permissions or a migration. Proposed store_manager/cashier/customer keys remain unapproved. Phase15C's four roles and six listed operational rules remain fixed; no separate Inventory Staff role is introduced.

**Readiness: ready for owner review of a bounded local B02 contract, not ready for full activation/migration or blanket implementation authorization.** Resolve the decision register before the affected slice. B01-R2 PASS WITH LIMITATIONS removes the local foundation defect blocker; it does not resolve account, lifecycle, API-exposure or native database gates.

Authority/evidence: Phase15C approved specification, Phase15D impact assessment, Phase15E B02 blueprint/dependencies, Phase15F contract, B01-R2 independent review and implementation plan. Earlier reports retain their historical statements.

## 2. Files inspected and evidence boundary

Read actual code in:
- backend/models/User.js; controllers/UserController.js; routes/UserRoute.js; middleware/authMiddleware.js.
- utils/generateToken.js, tokenPolicy.js, tokenVersion.js, passwords.js, adminAccountMutation.js, accountMutationOutcome.js; account identity/commit and seed-admin paths as compatibility dependencies.
- ProductRoute/ExpenseRoute and ExpenseController role checks; B01 roles/capabilities/policy interfaces.
- client/src/shared/hooks/AuthContext.jsx and DashboardGuard.jsx; authApi.js; UserModal.jsx, ProfilePage.jsx, LoginPage.jsx; useAdminUsers.js.
- Relevant Phase15C/D/E/F and B01-R2 review/results, plus existing test/report evidence.

No live account/collection inventory, provider/database connection, environment-secret retrieval, test/build execution, migration, dependency installation or deployment occurred. Database findings describe model code, not real records. All proposed files/fields below are unimplemented recommendations.

## 3. Current architecture findings

| Component | Actual implementation | Compatibility consequence |
| --- | --- | --- |
| User.role | Required by schema behavior through default: String enum user/admin, default user | Four business labels are not valid stored values today; hydrated legacy data is not proof of valid/live roles |
| Identity/profile | Unique identifier, password, optional name/phone/address; phone sparse unique; timestamps | Preserve IDs, hashes and identifiers; contact details cannot establish a student role |
| confirmed | Boolean default false | Existing account confirmation, not independent activation/deactivation |
| tokenVersion | Mixed with safe nonnegative integer validation; new account zero; no hydrated legacy default | Missing stored field alone is zero; invalid values fail; do not default legacy records on read |
| Security save | Modified password/role/confirmed + epoch advanced in same expected-version conditional save | Single-role changes already participate in revocation; future security fields must be added explicitly |
| Passwords | One hashing path; minimum6 characters and maximum72 UTF-8 bytes; bcrypt cost10; comparison recognizes2a/2b/2y | No hash conversion/reset needed merely for role integration |
| Login | Public POST /api/users/login; lowercase identifier lookup, bcrypt check, confirmed gate, returns role/profile + JWT | No new role/status validation exists at login; new DTO/default policy must be deliberate |
| Register | POST /api/users/register is protect + admin; validates role admin/user; defaults user/unconfirmed | Staff creation is administrator-only despite public-looking naming/comments |
| Account administration | Admin list/update/delete; allowed role/confirmed/password/profile fields; self profile/password separate | New role assignment must retain server whitelist and guarded administrator authority |
| getProfile/getUsers | Excludes password; otherwise returns broad model data | New security/grant/membership fields must not automatically leak through these responses |
| JWT | ID, role claim, tokenVersion; seven-day issuer contract | Role claim is informational; verifier uses current persisted account, not claim role |
| protect | HS256, required valid iat/exp, max604,800 seconds, ID check, current account/confirmed/epoch | Fails closed on missing/failed lookup; does not globally reject unknown persisted role values |
| authorizeRoles | Strict current req.user.role allowlist | Existing callers expect raw admin/user, not B01 labels |
| Admin writer | Self guarded CAS; cross-account real actor revision fence and target change in one transaction | Keep adminAccountFilter admin-only and preserve R2 observer/no-replay handling |
| Client auth | Caches raw user.role/JWT in browser storage; logout clears storage | Cached role is display state, not server authority; logout does not revoke copied token |
| Client routing | DashboardGuard checks cached authentication; login goes to /pos; admin table uses role===admin | New student role cannot safely inherit current staff shell/default landing |
| Role selector | UserModal and admin hooks support user/admin and confirmed | Updating only this selector would expose unsupported role behavior |

No independent active state, store membership, business-role mapping, conditional-grant persistence or durable account-action audit is implemented.

## 4. Architecture alternatives

| Option | Benefits | Risks / recommendation |
| --- | --- | --- |
| Expand existing role + explicit adapter | One authority; keeps admin compatibility; existing role save already increments epoch; limited schema surface | Requires all readers/validators updated before new values; recommended after owner adoption |
| Add persisted businessRole beside role | Old reader sees familiar admin/user; new role metadata can be prepared separately | Contradictory admin/Cashier or user/Administrator combinations; stale old-role privileges; two-field atomicity/rollback/audit rules. Do not choose merely to avoid updating authorization |
| External assignment collection | Independent migration review records/complex membership possible | Every request requires consistent joins/revocation; multi-record transactions and audit; unnecessary complexity for current single-role design |
| Replace role values directly with display labels | Simple-looking UI mapping | Breaks admin guards/client checks/enum/old readers and may bypass security assumptions; not recommended |

If the owner chooses dual fields, approval must define exact valid pairs, which field can grant each operation, how conflicts deny, and how both change with one epoch. An old admin field must never remain a privilege escape after businessRole demotion. That alternative requires additional schema/security review; this assessment does not silently select it.

## 5. Recommended mapping and compatibility contract

### Proposed adapter table — not applied

| Persisted input | Proposed resolved business role | Required treatment |
| --- | --- | --- |
| admin | Administrator | Preserve existing key; mapping is technical only, not proof of live legitimacy or new operational grants |
| store_manager (proposed key) | Store Manager | Only after identifier/schema/account assignment approval |
| cashier (proposed key) | Cashier | Same approval; own-history restriction retained |
| customer (proposed key) | Customer / Student | Secure authenticated User binding required; never inferred from Customer contact |
| user | No assigned business role; internal legacy-unmapped result | Preserve record pending reviewed exact-ID decision; no automatic elevated or customer mapping |
| Missing/null/unknown/malformed/case-altered values | Invalid/unresolved authority, deny | Never default to user, Administrator, Cashier or Customer |

Legacy-unmapped is an internal resolution state, **not a fifth user role**. The adapter accepts current persisted account data after authentication; no client/JWT role claim is a mapping input. Retain req.user.role as its canonical persisted key so adminAccountFilter and existing explicit guards remain compatible. A separate internal authorization context can hold resolved businessRole; do not overwrite role with a display label.

**Legacy access policy requires approval.** Recommended transition: preserve current login during inventory/planning; freeze new legacy user provisioning at an approved cutover; assign only reviewed accounts; define a finite compatibility envelope and cutoff with the owner. No duration is selected. A later unmapped account may have only an approved self-service envelope, but that restriction is not authorized here.

Known admin accounts are candidates for Administrator preservation; their identity/provisioning must be verified through A01. Uncertain administrators must be escalated for owner review without automatic demotion/reset. Existing user accounts map by verified duties: inventory/operations -> candidate Manager; checkout -> candidate Cashier; genuine student -> candidate Customer after identity review. Conflicting/multiple duties require owner-approved conditional operational grants, not automatic multi-role inheritance.

### Reader/authority behavior

- Login and protect must reject invalid role types/values under the approved compatibility policy. Schema enum validation on writes does not validate every existing hydrated record.
- Missing field or invalid data cannot receive a convenience fallback.
- A role resolution failure denies the protected operation; database failure never reuses a cached/JWT role.
- Preserve distinguishable internal reasons without exposing sensitive account details or legitimizing account enumeration.
- Existing admin allowlists/actor guards remain restricted to raw admin. Managers cannot assign roles, reset staff accounts or create an Administrator.
- B01 returns eligible constraint plans only. Runtime binding still needs authenticated/current actor, approved resource scope, field/state checks and audit/effect consistency.

## 6. Security and activation risk

### New-role activation is not safe through schema expansion alone

Product CRUD/stock allow only admin/user today, while other business routes often use protect only. A confirmed new customer/manager/cashier token can therefore be denied some catalog paths yet admitted to legacy orders, invoices, financials or expenses using owner-scoped queries. Even an empty owner catalog does not prove harmlessness: contact/expense creation and other protected operations can still be attempted.

B02 may prepare compatible representations and tests locally; it must not enable new-role logins or confirmation/provisioning of operational new-role accounts until the backend entry-point perimeter is complete. UI visibility/default landing changes alone cannot satisfy that gate.

Recommended activation prerequisite: approved server-side fail-closed admission for every current method/alias, including unsupported/unassigned capabilities, before any new-role session can use the application. The exact gating mechanism is an implementation decision requiring approval; do not invent a broad new fallback flag/environment variable. B03 and later binding modules are dependencies, not work begun by this assessment.

### Preserve established security

1. Password/reset/role/confirmed changes remain one guarded account write with monotonic tokenVersion advance; stale competing writes fail. Do not use bulk role updates bypassing hooks.
2. Retain existing bcrypt hashes, account IDs and confirmation unless separately authorized. Bcrypt compatibility does not imply plaintext conversion or automatic resets.
3. Keep HS256 and strict seven-day iat/exp contract; missing stored epoch only zero; claim-less/malformed/stale tokens remain rejected.
4. Keep canonical ObjectId target validation and zero-session/fence/deletion self-delete rejection.
5. Keep self actor CAS and peer actor fence + target in the same supported transaction; no Manager widening or nontransaction fallback.
6. R2 commit-boundary observation, primary error, acknowledged result and indeterminate retryable=false semantics survive any new account writer/audit integration.
7. If activation/grants/membership fields are approved, include them in current-account selection/validation and atomic epoch transitions, not merely in a UI or JWT.
8. Code-only policy expansion can change session authority without role-field mutation. Explicitly review session cutover; no mass invalidation is authorized.
9. Require durable account-change audit before new sensitive writer enablement. Independent post-save logging can leave partial outcomes; same transaction or reviewed atomic outbox is required. Self-account CAS auditing needs a deliberate design, not an unnoticed extra insert.

## 7. Database impact and lifecycle

### Minimal recommended role-compatibility scope

Extend User.role enum/validation only after exact keys are approved; retain legacy user read support under the approved transition policy. Require explicit target roles for new staff provisioning after cutover rather than silently defaulting to broad user. Existing admin role values do not need a renaming migration.

No separate persisted businessRole is needed. Proposed schema changes must identify affected fields, validation, old-reader behavior, backup/dry-run/recovery, risks and alternatives before approval. Adding an enum to source is not permission to update records.

### Additional fields are separate decisions

| Candidate | Purpose / risk | Gate |
| --- | --- | --- |
| isActive or accountState | Separate deactivation from confirmed; a hydrated default can activate/lock out legacy accounts | Approve lifecycle model and legacy/new-account semantics; no field selected/applied here |
| Conditional operational grants | Express Phase15C conditional Admin/Manager duties | Narrow allowlist/role ceilings; exact accounts and scope approved; same epoch update |
| Store membership | Scope operational/report access; changing it changes authority | B03 design approval; no synthetic store assigned to old owners |
| Audit event/outbox | Durable assignment/lifecycle trace and reconciliation | B04 consistency/retention/access approval; preserve existing guards |
| Migration plan record | Exact ID/old role/epoch/target role/approver/result | Reviewed tooling/schema if persistent; no executed migration |

Missing activation state cannot silently mean active or inactive for all existing accounts. Changing confirmed to implement deactivation is not automatically acceptable: it conflates distinct lifecycle semantics. Any chosen model must preserve confirmation and prevent old tokens regaining access after deactivate/reactivate.

Historical product/order/customer/payment/invoice owners and processedBy references must be preserved. Account migration does not authorize catalog merging, owner reassignment, cashier attribution backfill or transaction correction.

## 8. API and frontend impact

| Existing surface | Proposed compatible change | Boundary |
| --- | --- | --- |
| POST /api/users/login | Current-account role/status validation; optional derived businessRole DTO alongside retained role | No new public role assignment; preserve token contract and login compatibility under approved policy |
| POST /api/users/register | Administrator-only explicit approved staff role; validated confirmation/lifecycle input | Do not turn staff creation into student self-enrollment; no default privileged role |
| GET /api/users and PUT/DELETE /:id | Approved keys/labels in safe DTO and field whitelist; guarded assignment audit/version | Manager/Cashier/Student denied; last-admin/delete/deactivate policy remains unresolved |
| GET/PUT profile, PUT password | Preserve self-only behavior; reject/ignore privilege inputs according to approved contract; explicit projection | Existing profile/admin responses excluding only password must not leak new grants/security fields |
| JWT/protect context | Keep persisted role for old guards; derive business label internally from current account | Do not authorize from token role/businessRole or an untrusted request field |
| Business route aliases | Deny-by-default backend admission and resource/field enforcement before activation | No route behavior change in this assessment; cannot be assumed provided by B02 adapter |
| Frontend auth state | Retain raw role for compatible existing admin controls; display derived businessRole only when server supplies it | Cached storage never grants permissions; do not map legacy user to Customer in JavaScript |
| Role form/admin hooks | Approved selectors/validation after backend support; no hidden conditional grants | Existing role/confirmed assumptions must be reviewed together |
| Landing/routes/Layout | Safe permitted landing and route eligibility; no student default /pos/staff shell | New customer feature/landing missing; frontend work depends on later authorized surfaces |

A derived businessRole response field is an additive API proposal, not a database field or a signed authorization source. Exact response/error compatibility needs approval; do not rename role in existing clients silently. Do not expose raw operationalGrants/tokenVersion in ordinary UI payloads merely because new model fields exist.

Students should not be provisioned through a public staff form with a supplied role. Both guest and authenticated ordering are approved; guest needs no User account. Student enrollment/identity confirmation is a separate unresolved contract; no institution-directory or GradeSense integration is assumed.

## 9. Affected files for future implementation

These are candidates, not authorization:

- backend/models/User.js: approved enum/default/lifecycle and security-version integration.
- controllers/UserController.js, routes/UserRoute.js: explicit role validation, safe staff provisioning/assignment/status DTOs.
- middleware/authMiddleware.js: current known-role/lifecycle validation and trusted mapping context; preserve authentication.
- Proposed backend/auth/accountRoleAdapter.js: strict stored-key -> business-label resolution; legacy/invalid result handling. Do not edit B01 roles.js to pretend persisted keys are business labels.
- Existing adminAccountMutation/accountIdentity/accountCommitBoundary/accountMutationOutcome/token/password helpers: preservation/regression review; changes only for a demonstrated approved lifecycle/audit need.
- utils/seedAdmin.js: review supported admin creation; do not execute or alter existing account state as an implementation shortcut.
- Client AuthContext/DashboardGuard/authApi/ProfilePage/UserModal/useAdminUsers/LoginPage/Layout: later approved DTO/display/landing integration, not backend authority.
- Existing business guards and B01 manifest/tests: reviewed compatibility/coverage updates only when runtime route changes are separately authorized; Phase15F oracle cannot be rewritten silently to make tests pass.
- New local compatibility/API/security/migration-planning tests; no real account fixtures, dependencies or migrations now.

## 10. Regression test plan

All tests below are required future evidence, not tests executed in this assessment.

| Area | Positive and negative cases |
| --- | --- |
| Role adapter | Each approved key maps exactly; admin retained; user explicitly unresolved; null/missing/unknown/case/whitespace/array/object/wildcard deny; no User/Customer conflation |
| Legacy login | Existing bcrypt2a/2b/2y, confirmed admin/user under approved transition; unchanged hash/ID; no automatic confirmation/assignment; unknown account/role and failed lookup deny |
| Provisioning | Admin only; explicit approved keys; missing/invalid roles; unconfirmed default policy; all other roles/anonymous denied; profile/signup/body injection cannot assign role/status/grants/epoch |
| Security transitions | Password/reset/role/confirmed and approved lifecycle/grant/membership changes atomically advance epoch; old tokens stay rejected after demotion/restoration/reactivation; stale competing write loses |
| JWT | Existing HS256, exact maximum lifetime, expired/future/missing/malformed claims, wrong signatures, stale/missing versions; no claim/cached role authority |
| Administrator race | Admit then revoke before target save/fence; deny stale actor; fence-first serialization; peer transaction failure/unsupported topology fails closed; canonical self-delete variants still cause zero delete/session/fence |
| New-role API exposure | For every59 protected method and23 HEAD forms, customer/manager/cashier allowed only under approved capabilities; retired/public/ensure/payment/void aliases included; no protect-only staff API leak |
| Scope and fields | Cashier personal history versus peer; Manager all approved cashier history; student own orders; price/cost/stock/PII injection and projections; unassigned scopes deny |
| Audit/outcomes | Role assignment event/effect consistency, lost acknowledgement, primary/cleanup failure, unknown outcome no automatic replay; no secret-bearing audit |
| Frontend | Raw/derived role DTO compatibility, old cache, forged storage/deep links, role change while tab open, appropriate landing, no customer staff fetch |
| Migration/recovery | Synthetic exact-ID plan, stale epoch/role, duplicate/unapproved mappings, zero-write dry-run, counts, interrupted/unknown outcome reconciliation; recovery increases epochs and preserves history |
| Existing suites | Retain all B01-R2 and prior security/payment/invoice/client regressions; report actual counts, build/lint limits; no weakened tests |

Native transaction/rollback/concurrent actor ordering still requires separately authorized isolated A08B evidence. Mocked document updates cannot prove live durability. Real account migration acceptance additionally requires A01 and approved inventory, backup/recovery and exact mappings.

## 11. Migration and rollout plan — do not execute

1. Adopt role representation, stored keys, legacy/status policy and assignment authority. Version the policy and keep the five settled Phase15C decisions.
2. Obtain minimum necessary account/ownership inventory through separately authorized A01. Verify administrator legitimacy, database identity, effective permissions and deployed readers. No guessed database, role or account identity.
3. Review exact-ID mappings with the owner: old role/epoch/confirmed/hash-format compatibility, target role/duties, intended store scope, approver and access impact. Unknown cases remain decisions, not automatic account actions.
4. Back up accounts and linked history/security state under approved procedures; rehearse compatible recovery in isolation. Do not export hashes/secrets into reports.
5. Implement/test compatible readers and validators locally before new-value writers. Include schema rollback, public DTOs and mixed-version behavior. All running readers must support the representation before assignment.
6. Prepare a no-write dry-run and stale-plan checks. Preserve passwords, confirmation, identifiers, owner/customer/payment/invoice references and historical prices; role mapping does not rewrite them.
7. Complete the new-role backend admission perimeter, required audit consistency and safe client/landing dependencies. Do not activate new-role sessions just because B02's adapter tests pass.
8. Separately authorize target/schema/account mappings, session interruption and release/migration execution. Apply security-aware exact-ID guarded changes; no raw bulk update. Require fresh login for approved security-state changes.
9. Reconcile acknowledged/failed/indeterminate operations before any resubmission. Audit exact counts/IDs without sensitive data; verify allowed/denied paths and preserved references.
10. Release only after owner review of evidence, native gates, recovery and unresolved quality/integrity risks. No step is executed here.

A new record default may be changed only under an approved provisioning policy; existing records must not acquire role/status defaults when read. A compatibility window has an owner-approved cutoff, never an invented date or indefinite broad fallback.

## 12. Rollback and recovery

- Local unfinished implementation: revert only its approved source changes while preserving earlier security fixes/tests and unrelated work.
- After new keys are stored: keep a secure compatible reader. An old enum/guard binary may reject profiles or mishandle new roles; do not blindly deploy it as rollback.
- Assignment reversal: reviewed new role change with a new epoch and audit, not restoration of an old tokenVersion or generic user fallback. Preserve hashes and IDs.
- Unknown commit/response loss: stop and reconcile the actual applied state; do not rerun a mapping batch automatically.
- Schema reversal: retain additive data until compatibility/audit review proves safe; no field removal, catalog merge or history deletion implied.
- Backup recovery: old roles/passwords/epochs can revive access. Restore only under an approved coordinated security/session recovery plan, with epoch/revocation implications explicitly handled.
- Client rollback: backend restrictions stay authoritative; old menus may show denied actions, but no privilege relaxation is a repair strategy.

Credential rotation, account resets, disabling users and production session invalidation require separate authorization. Neither schema compatibility nor this rollback proposal authorizes them.

## 13. Dependencies and owner decision register

| Decision/evidence | Recommended direction / consequence | Gate |
| --- | --- | --- |
| One role versus dual fields | Prefer single User.role + derived adapter; dual field requires conflict/atomicity specification | Before B02 schema/adapter implementation contract |
| Stored keys/new-account defaults | Keep admin; review proposed store_manager/cashier/customer; explicit target selection after cutover | Before enum/controller changes |
| Legacy user/admin treatment | Exact reviewed mapping, legitimacy review, approved compatibility envelope/cutoff; no auto-promote/disable | Before existing access restrictions or account migration |
| Conditional operational duties | Explicit Admin inventory/POS/payment/receipt/reversal and Manager cashier grants only as approved | Before those duties are activated |
| Activation/confirmation/last-admin | Choose lifecycle representation and missing-state semantics; optional last-admin rule requires approval | Before new lifecycle/security writers |
| Audit consistency | Approve transaction/outbox, attribution, retention/access and failure handling | Before new sensitive writer enablement |
| Shared record/private identity scope | Preserve owner; approve store/processor/student/guest binding separately | B03/later; no B03 implementation now |
| Student enrollment/client landing | Separate staff provisioning, safe guest/student contracts; no Customer contact inference | Before authenticated customer activation |
| Backend admission perimeter | All methods/aliases deny unassigned role actions; ownership alone insufficient | Before any operational four-role activation |
| A01/actual account inventory | Verified target/read-only method, admin legitimacy and exact mappings unknown | Before live mapping/migration |
| A08B/native/backup/recovery | Approved isolated topology/test scope and recovery evidence; no inferred native guarantees | Before native claims/data cutover |
| Cutover/session/API compatibility | Compatible readers/writers/clients, bounded login interruption and explicit release approval | Before deployment/migration/session action |

Administrator-only pricing, direct Manager stock adjustments, Manager refund/void approval, Cashier own-only history, Manager all-cashier history and both guest/student modes are already approved. They are not reopened as questions. Refund money/stock effects, payment methods, reservations/pickup/cancellation, cost/expense/export scope and actual grants remain separate unresolved details.

## 14. Implementation sequence and readiness

Recommended future slices:
1. Owner adopts the bounded account/role compatibility contract and explicit keys/default/legacy policies.
2. Separately authorize local adapter/schema/controller compatibility and synthetic security tests; no account migration, role activation or broad business policy attachment.
3. Independently review security writers, DTOs, enum/old-reader compatibility, current-account resolution and all existing regressions.
4. Resolve lifecycle/audit and backend admission/scope dependencies through their separately authorized batches. Do not start B03 or A08B by inference.
5. Prepare exact mapping/backup/cutover artifacts only after approved inventory evidence.
6. Obtain separate implementation/activation, account/data/session and deployment authorization for the concrete tested scope.

**Not ready for blanket B02 implementation/activation authorization.** A narrow local compatibility design can be authorized once its representation/legacy/lifecycle boundaries are settled. Production/account migration and four-role sessions remain gated by the dependencies above. No B01-R2 defect is being reopened; its acceptance was explicitly limited to the unattached local foundation.

## 15. Actual verification and preservation

Source/document inspection only. No tests, builds, lint, database/provider access, account query, migration or runtime activation occurred in this assessment. Latest B01-R2 independent results (49 focused/178 backend/16 client, build and eight-file syntax/targeted lint passes) are historical evidence here, not newly executed checks. Full client lint's documented 16 errors/13 warnings likewise remains historical.

All 17 Phase 15B criteria remain mandatory; B02 especially affects RB01-RB06/RB13-RB17 while API/operational/guest criteria remain later gates. No acceptance status is promoted by this assessment.

Only this new assessment and a dated additive implementation-plan entry are delivered. File-hash comparison against the pre-assessment snapshot found exactly one existing file changed (the implementation plan), one file added (this report), and no files removed. The original 67,140 implementation-plan bytes remain an exact prefix of the updated file. Existing application files, tests, configuration, lockfiles and reports match the snapshot. git diff --check passed; existing LF/CRLF notices are informational. No runtime verification is implied by these preservation checks.

The POS remains independent of GradeSense AI. **Stop after assessment; no B02 implementation, B03, A08B or production operation follows automatically.**

