# B02-B1 — Audit and account lifecycle contract

Date: 2026-11-04, Asia/Manila. UPHSD Bookstore POS.

**Scope: technical design and contract resolution only. Implementation authorization: NOT GRANTED.** No runtime, schema, account, test or configuration changes are made. B02-C, B03 and A08B do not start.

## 1. Authority, contract status and inspected evidence

Authority: [B02-A owner decisions](UPHSD_BOOKSTORE_B02_A_OWNER_DECISIONS.md), [B02-A role/account contract](UPHSD_BOOKSTORE_B02_A_ROLE_ACCOUNT_CONTRACT.md), Phase 15C permissions and all 17 canonical Phase 15B acceptance criteria. [B02-B results](UPHSD_BOOKSTORE_B02_B_IMPLEMENTATION_RESULTS.md) remains the historical account of partial implementation, not full acceptance.

This document fixes the technical audit payload, primary persistence strategy, workflow states, time validation, mutation invariants and proposed API boundaries. These are requirements for a separately authorized implementation. Remaining business choices are explicitly isolated in section 10; finalizing technical structure does not fabricate owner approval for them.

### Source-backed current state

- backend/models/User.js: one role, confirmed, tokenVersion, compatible hashes; no independent suspension state, review ledger or conditional grants.
- backend/auth/accountRoles.js: exact keys admin, store_manager, cashier, customer; user is legacy-unassigned. Missing hydrated role receives no authority.
- backend/middleware/authMiddleware.js: current-account role/confirmation/epoch validation; no suspension/grant lookup.
- backend/middleware/roleAdmission.js and ten business route modules: new business roles remain blocked from 52 operational registrations and 21 derived HEAD forms. Existing admin/user envelope is retained pending reviewed cutover.
- backend/controllers/UserController.js: guarded legacy account administration; new-role assignment/provisioning deliberately returns 409. Ordinary profile/account responses exclude password but are not future-field-safe DTOs.
- backend/utils/adminAccountMutation.js: canonical self CAS; cross-account actor revision fence and target effect in one supported transaction. Actor predicate currently checks admin/confirmed/epoch, not a future suspension field.
- backend/utils/accountCommitBoundary.js and accountMutationOutcome.js: callback/commit distinction, compound-label protection, indeterminate account outcomes and cleanup preservation.
- backend/controllers/OrderController.js: sale/order/payment/void aliases, explicit sessions/commits, post-commit work; no uniform current-actor write fence for suspension.
- backend/controllers/DebtPaymentController.js: transactional collections; no complete lifecycle authorization boundary.
- backend/controllers/ProductController.js: read-add-save stock adjustment and two-stage bulk availability updates; no suspension fence or durable movement/audit guarantee.
- backend/controllers/InvoiceController.js: receipt/void effects; independent aliases must not bypass future operation guards.
- backend/auth/capabilities.js: 13 conditional capability names / 19 eligible role-capability pairs, unchanged.

The account R2 helper is not a generic proven fix for the other controllers. Native MongoDB transaction support, commit durability, actual account data and deployment state remain unverified. No database, health endpoint or provider was contacted.

## 2. Fixed roles and security invariants

| Business role | Sole authoritative stored User.role |
| --- | --- |
| Administrator | admin |
| Store Manager | store_manager |
| Cashier | cashier |
| Customer / Student | customer |

Preserve strict explicit compatibility mapping, manual legacy review, unknown-role denial, password hashing, seven-day JWT expiration, required version claims/current epoch, Administrator actor guards, canonical case-insensitive self-delete rejection, redacted diagnostics and R2 no-replay behavior.

Authentication does not authorize an operation. A role assignment, active status or conditional grant does not remove the B02-B admission guard or activate B03/later workflows. Shared store ownership, kiosk identity, operational capability binding and role-specific frontends remain later dependencies.

Preserve the five Phase 15C decisions: both guest/authenticated student ordering; Administrator-only pricing; direct Store Manager stock adjustments; Store Manager refund/void approval; Manager all-cashier history with Cashier own-only default. No automatic cancellation, repayment, restocking, reservation or refund rule is introduced.

## 3. Finalized technical audit event specification

### 3.1 Logical event schema

Use a dedicated append-only AccountAuditEvent ledger, with the exact physical collection/index names fixed in the implementation schema review. This is a proposed new model, not a collection created here. It records only an allowlisted payload; never serialize a User/request/driver exception wholesale.

| Field | Type / required rule |
| --- | --- |
| schemaVersion | Integer 1 for this event contract; unsupported versions rejected |
| eventId | Server-generated UUID; unique; stable through permitted same-operation retries |
| operationId | Validated stable logical command identifier, unique at command scope; shared by associated events; not an authorization credential |
| sequence | Nonnegative integer to distinguish multiple events in one command; unique with operationId |
| actor | For human commands: canonical current account ID and persisted role at execution; not JWT/body claims |
| subjectAccountId | Canonical target User ID, including a reserved target ID for account creation |
| action | Closed event-action enum below; unknown values rejected |
| occurredAt | Server UTC BSON Date, serialized as explicit UTC ISO timestamp; time of event construction, not a fabricated database commit timestamp |
| reason | Required nonempty validated text for sensitive Administrator role/grant/lifecycle actions; reject missing/whitespace; explicit maximum length chosen in implementation validation review |
| before / after | Action-specific allowlisted previous/new nonsecret values; explicit absent markers for creation; no arbitrary model snapshots |
| scope | Approved account-realm or capability-specific resource scope; absent/not-applicable represented explicitly, never wildcard authority |
| approvalRef / reviewId | Required where an approved review/approval is a prerequisite; reference is evidence, not a grant itself |
| grantId | Required for grant/revoke/expire events; canonical record identifier |
| securityVersionBefore / securityVersionAfter | Actual expected and resulting epochs when security changes; no client-assigned values; undefined stored legacy epoch represented explicitly with effective zero |
| outcome | applied for effects committed atomically with the event; observed-expired for expiry observations; optional denial/failure events must not masquerade as applied |
| correlationId | Sanitized server/request correlation reference; not an access token or raw URL |

Audit reason validation must not introduce arbitrary acceptance limits without documenting and testing the chosen technical bounds. No reason may justify bypassing the permission matrix.

For an expiry observation, use actor = system-expiry with no fictional human actor; retain the original granting Administrator and target as attribution fields. This is a machine event provenance type, not an application role or permission to grant/revoke. There is no public endpoint accepting a client-selected system actor.

### 3.2 Closed action vocabulary and before/after rules

| Action | Required previous/new information and linked evidence |
| --- | --- |
| account.created | Before absent; after canonical role, confirmation and resolved explicit lifecycle state; actor, reason and provisioning approval |
| account.role_assigned | Legacy-unassigned/current role -> approved role; review/approval reference, expected state, epoch transition |
| account.role_changed | Exact old/new canonical role and epoch; no implicit grants or owner reassignments |
| account.confirmation_changed | Boolean old/new confirmation and epoch; separate from suspension |
| account.suspended | Old/new lifecycle state and epoch; reason; no delete or financial-record rewrite |
| account.reactivated | Old/new lifecycle state and epoch; reason; no restoration of old tokens/grants |
| account.password_reset | Record that credentials changed and epoch advanced; NEVER password, hash or reset token |
| account.password_changed | Self actor/target and credential-change marker/epoch, no secret values |
| account.profile_changed | Changed allowlisted field names; do not copy identifiers/contact values by default; additional PII retention requires approval |
| account.deleted | Existing authorized non-self delete only; nonsecret identity reference and reason; no cascade history removal; lifecycle activation must not broaden deletion policy |
| permission.granted | Capability, recipient, granting admin, scope, effectiveAt, expiresAt, approval/reason; previous absence and new grant reference |
| permission.revoked | Grant reference and old/new revoked state, revoking admin, revocation time/reason; preserve original terms |
| permission.expired | Original grant reference/capability/scope/expiry; observation timestamp, machine provenance; expiration is not redefined as the later observation time |
| account.review_recorded | Review state/revision, proposed role as nonauthoritative recommendation, reviewer/reason/evidence references |

Sensitive action types cannot be hidden in a generic profile event. A compound role/confirmation/reset command may produce multiple linked events, all sharing operationId with distinct sequence values and one atomic outcome. No repeated event may imply a repeated effect.

Audit is readable only under approved systemAudit.read Administrator scope; Manager operational movement history is distinct. No normal role receives audit edit/delete access. Retention duration, administrative export, attempt-event policy and legal/privacy requirements remain owner decisions; no TTL, purge job or invented statutory retention is authorized.

### 3.3 Selected persistence and truthful outcome contract

**Primary technical strategy: account/review/grant mutation plus required applied events in the SAME supported MongoDB transaction/session.** Maintain current expected-version predicates and real actor write fence. A second post-save insert or console log is not sufficient.

Self-account security updates currently use single-document CAS; adding a separate ledger therefore requires a reviewed same-session transaction retaining the original CAS and R2 semantics. Do not merely append a ledger insert after the existing save. If this strategy cannot be implemented safely, keep the writer blocked and bring back a concrete embedded-outbox alternative for review; no silent fallback.

An unsupported transaction topology or unavailable required audit persistence blocks a new sensitive command before it is reported successful. A rejected malformed/self-delete request must still return before session/fence/delete; optional rejection logging must not break that existing invariant.

| Observable operation state | Required treatment |
| --- | --- |
| Validation/authorization rejection before write | No target effect and no applied event; preserve existing safe errors |
| Transaction abort definitely established | No account/grant/review effect or applied event; no fabricated success |
| Commit acknowledged | Effect and event are committed together; only then return definitive success with nonsecret operation/event reference |
| Commit result unknown or HTTP acknowledgement lost | Indeterminate to the caller, not definitely failed; do not automatically replay effect; reconcile operationId under current authorization |
| Cleanup/delivery failure after acknowledged commit | Preserve acknowledged result; do not claim failure or repeat mutation to “finish audit” |
| Primary error plus abort/cleanup error | Preserve primary cause without secrets; classify uncertainty conservatively; no inherited-label callback replay |

Persistence verification requires acknowledged transaction completion and, in authorized integration tests, reading event + effect together from committed state. Creating an event object, a fulfilled mocked save, eventId allocation or a log line is not proof of durable persistence.

A required operation receipt/unique operation identity must be persisted atomically to support reconciliation and reject conflicting key reuse. The service must validate same actor/target/action/normalized nonsecret command fingerprint; a duplicate operation key cannot bypass current authorization or expose another account's result. Secrets must not enter the fingerprint/audit. Concrete storage/index/receipt API must be reviewed before implementation; never retry an uncertain operation under a fresh key to evade reconciliation.

Expiry is enforced by current server time on every permission use, not by whether the expiry event has been written. A separately authorized internal worker/observation process records one durable expiration event per grant/expiration version with a uniqueness constraint. Missing/delayed expiry audit cannot extend permission. No worker is started by this phase.

## 4. Account state and Administrator role-assignment workflow

### 4.1 Technical lifecycle representation

Select an additive User.accountState field with explicit active / suspended values as the **target technical representation**, separate from confirmed. This choice is a documented schema proposal only, not permission to add/default/backfill fields.

New accounts under the future writer must have explicit state; use unconfirmed plus explicitly active as a proposed provisioning representation only after adoption of the creation/default contract. “Active” never bypasses unconfirmed, restrictive operational admission or grant checks. If an owner instead requires initially suspended accounts, adopt that explicit policy before implementation; no field-default decision is inferred here.

For existing records with no accountState: retain current B02-B behavior during this documentation phase. Future reader compatibility must be supplied by an approved exact-ID legacy plan/envelope; missing state must not globally mean active, suspended or new-role-authorized. New-role lifecycle writers remain blocked until legacy missing-state and provisioning-default policy are adopted.

Unknown/malformed lifecycle values fail closed in the future reader. Self profile/body updates cannot set accountState, role, confirmed, epoch, grants or review approvals.

### 4.2 Creation, assignment, change and access revocation

1. Require a currently authenticated, confirmed, nonsuspended Administrator; validate canonical target, allowed role, reason and applicable approval/review evidence.
2. Public account creation cannot select privileged roles or confirmation/grants. Existing staff register remains admin-only; authenticated student enrollment remains a separate contract, not a new public staff registration path.
3. New authorized provisioning requires explicit admin/store_manager/cashier/customer; do not introduce new user accounts after approved provisioning cutover. Current legacy default is not changed in this phase.
4. Reserve target ID/operationId before transaction; prevent duplicate identifier provisioning and conflicting key reuse.
5. Inside the transaction, serialize the actor's authority at mutation time using the established real actor fence and expected epoch/state, then read/check the expected target state.
6. Role change + tokenVersion advance + required audit + review application state commit together. Preserve the existing hook's single advance for a combined security change; do not manually reset epochs or double-increment through two independent paths.
7. New role invalidates old tokens and requires fresh login. Validate grant eligibility against the resulting role; handling of otherwise-compatible old grants needs the carryover decision in section 10.
8. Return success only after acknowledged commit. Unknown result remains indeterminate; reconcile rather than resubmit a fresh command.
9. Revoking access uses approved suspension/grant revocation, not an empty/unknown role, deletion of history, downgrade-to-user fallback or silent confirmation toggle.
10. Reactivation is Administrator-only and advances epoch; it neither confirms the account nor restores expired/revoked grants or old tokens. Last-admin/self-change/recovery rules must be supplied before enabling affected actions.

Only Administrator performs role assignment. A suspended/demoted Administrator cannot use a previously admitted request to restore authority. Grant-management permission does not let an Administrator bypass separately required financial approval. Self-role/lifecycle operations cannot bypass the same actor/version checks; unrestricted self-escalation is never permitted.

Suspension preserves User, order, transaction, grant/review evidence and audit history. Suspension and epoch change must be atomic and current-state checks must reject subsequent requests and new login. It does not authorize deletion or automatic refunds.

## 5. Legacy account review contract

**Authorized reviewer and executor: current Administrator only.** Owner/duty/identity evidence may support a decision but does not create another application role or permit a Manager to assign accounts. Independent second-reviewer requirements are not invented.

Use a separate AccountRoleReview record as workflow evidence, not a second authoritative role. A proposedRole in a review cannot authorize access; only committed User.role can do so.

| Review state | Meaning / allowed next step |
| --- | --- |
| awaiting-review | Legacy user remains unchanged; no role/grant implied |
| in-review | Administrator collecting minimum necessary evidence; no extra access |
| approved | Exact target role/expected account state approved; still no role authority until application |
| rejected | Insufficient/incorrect mapping; preserve account/history; no automatic suspension or deletion |
| applied | Guarded role+epoch+audit and review transition committed together |
| superseded | A correction/new review revision replaces the recommendation; old evidence remains immutable |

A separate review record may not exist yet: absence means awaiting-review for planning only, not a schema hydration write or authorization state.

Required evidence: canonical target account ID, expected old role/epoch/confirmation and lifecycle state, verified duties/identity references, proposed canonical role, current Administrator reviewer ID, reason, review revision/time and decision reference. Do not store passwords/hashes, unnecessary student data or identity-document copies in this ledger. Evidence location/access/retention needs review.

Workflow:
- Obtain real inventory only through separately authorized A01 with verified target/read-only scope.
- Select individual account; verify evidence; record review without changing User.
- Approve/reject exact proposed mapping. Conflict, missing evidence or uncertain legitimacy prevents application, not automatic role reassignment.
- Apply approved plan under current Administrator authority and expected target state. If epoch/role/state changed since review, reject as stale and require review.
- Correction creates a new revision/event that supersedes the old decision; do not overwrite prior evidence. A mistakenly applied role is corrected by another authorized role+epoch+audit transition, not by restoring an old dump/tokenVersion.
- Rejection returns the record to no newly assigned role/access; it does not punish an account by deleting/suspending it without a separate authorized action.
- Unreviewed accounts retain the documented existing compatibility envelope until an explicitly authorized cutover. No automatic customer conversion or additional privilege. Exact future endpoint envelope/cutoff/notification is still an owner decision.

No review is “applied” because an Administrator clicked approve. Applied status needs the verified atomic role/epoch/audit outcome. Indeterminate items require reconciliation before another application attempt.

## 6. Suspension during in-progress operations

### 6.1 Mandatory behavior independent of the pending ordering choice

Once authorized suspension is durably established, subsequent authenticated requests and login must reject using current state/epoch; status change and epoch are one atomic security transition. Missing account/database/state lookup must not restore authority from cache/JWT.

Already committed financial/inventory records remain intact. Suspension is not an order cancellation, sale void, refund, debt forgiveness or restock command. Do not invent automatic business reversal. Unknown commits remain unknown until reconciled; repeated request/cleanup must not duplicate effects.

Any future enabled effectful workflow must serialize current actor status/epoch at its **actual mutation boundary**, with a real write conflict/fence inside the same supported transaction as effects and required audit. A pre-controller read alone is insufficient. Existing raw stock/read-save and multi-write availability paths do not satisfy this condition merely because they use protect.

### 6.2 Required race model — owner ordering choice pending

Proposed safe technical ordering for owner adoption:
- Suspension commits before the mutation's authorization fence: stale actor is rejected before domain effects.
- Mutation acquires its fence first: order the two transactions consistently; either the mutation commits atomically before suspension completes or the transaction definitely aborts. Never report that suspension has fully completed while unfenced work may later apply.
- Commit/acknowledgement uncertainty: retain indeterminate classification, no unsafe callback replay; reconcile both security state and operation effects.

**The second case is not yet an approved permission for in-flight work to finish.** Owner must choose whether already-fenced work may finish, whether suspension must wait for it, and how to bound waits/escalation. No timeout, grace period, forced abort or manual cancellation policy is selected. This cannot be solved safely by adding only a status check to middleware.

### 6.3 Workflow matrix

| Workflow | Safe requirement | Existing gap / separate dependency |
| --- | --- | --- |
| Authenticated order submission | Current subject/actor binding and status at write boundary; one order reference/effect identity; no submission if suspension wins | Current staff order create can complete a sale; not a student/guest API. Guest has no account to suspend; do not link guests by contact/name |
| Cashier checkout | Actor fence + authorized server prices, stock/payment/receipt effects and audit in one approved boundary; preserve completed sale if committed | Current legacy operational paths lack a universal suspension fence; final Cashier access remains blocked |
| Payment processing | Same actor/state and idempotency identity across all pay/settlement aliases; no retry of unknown commit | No new money, credit or settlement policy. A status check does not resolve payment resubmission or lost acknowledgement |
| Inventory updates | Actor fence plus atomic delta/movement/reason/effect identity; no half-applied stock updates | Existing read-add-save and bulk availability sequence remain deferred risks; no remediation authorized here |
| Refund/void | Current Manager or separately granted Admin approval, reason, effect identity and coordinated audit; no Cashier approval; preserve original history | Financial/restock effects remain owner-defined. All order/transaction/DELETE/invoice aliases need the same future boundary |

Until required ordering and effect boundaries are approved/implemented/tested, retain B02-B operational denials. No operational grant is activated to test this design. Do not claim existing admin/user operations are already suspend-safe.

## 7. Conditional grant lifecycle

### 7.1 Logical grant record

| Field | Technical rule |
| --- | --- |
| grantId | Stable server-generated canonical record ID |
| recipientAccountId | Exact canonical User ID; current role must be eligible for the capability |
| capability | One of the existing approved conditional capability names only; no arbitrary permission strings/wildcards |
| scope | Explicit validated capability-specific scope, intersected with current resource/membership and field restrictions |
| grantedBy | Current Administrator ID, recorded server-side |
| reason / approvalRef | Required validated reason and applicable independent approval/review evidence |
| effectiveAt | Explicit UTC instant; no implicit perpetual/active-by-default grant |
| expiresAt | Explicit UTC instant supplied per grant; strictly after effectiveAt and not already expired at creation |
| revokedAt / revokedBy / revocationReason | Explicit revocation state/evidence; server-issued; original grant terms preserved |
| operationId / auditEventIds | Atomic creation/revocation provenance; never proof of persistence by themselves |

Use BSON Date for storage and explicit UTC ISO strings on APIs. Validate a documented round-trippable UTC format; reject missing/null/invalid dates, ambiguous local date-only values, timezone-less values and reversed/equal bounds. No default duration or invented maximum grant lifetime. Per-grant actual dates are supplied when the authorized command is issued. Clock accuracy/precision and deployment skew verification are release evidence, not an invented grace period.

Future scheduled grants become usable only when effectiveAt <= serverNow < expiresAt, unrevoked, with current eligible/nonsuspended recipient, required grantor/approval validity and authorized scope. No scheduled task is required to enforce time bounds.

### 7.2 Lifecycle and permission ceilings

Only a current Administrator may create/revoke. Manager/Cashier/Customer cannot delegate. Every command uses mutation-time Administrator authority, recipient expected state, valid reason/scope/time and atomic audit. No scope is inferred from an empty/missing value, user ownership or a client-submitted query.

Do not grant beyond the 13 approved conditional capability names / 19 role-capability pairs. Manager pricing/account administration, Cashier inventory/reversal approval/cross-history and Customer staff access remain denied. Base Manager/Cashier rights do not become conditional grants simply to bypass their workflow gates.

Creation persists grant + required audit + appropriate recipient epoch change in one transaction. Revocation persists immutable terms plus revocation evidence + recipient epoch + audit atomically. Early revocation takes effect server-side; no browser refresh or expiry worker prerequisite. Malformed/expired/revoked/unscoped grants fail closed.

Role changes require immediate eligibility re-evaluation; incompatible grants cannot survive. Reactivation must not silently restore old grants. Whether compatible grants survive other security changes, how reapproval is represented, grantor turnover and self-grant approval remain owner choices; until settled, affected grant paths remain disabled rather than inventing automatic carryover/revocation.

The current B01 conditions argument is not a trusted grant store. Future server resolver must load verified committed grant/account data and reject lookup failure. Passing client conditionalActions directly to B01 is prohibited. B01 eligible remains a constraint plan, never an executable allow.

Issuing a grant does not enable the currently blocked operational route: required capabilities, resource scope, field/state/effect guards and later authorized runtime binding must all be present. A new-role assignment/grant endpoint must not serve as backdoor B03 activation.

## 8. Required database, service and API changes — proposed only

| Surface | Required future change / authorization boundary |
| --- | --- |
| User model | Add explicit accountState under adopted legacy/default semantics; include it in security-version changes and current actor predicates; retain role/confirmed/epoch/password behavior |
| AccountAuditEvent model/ledger | Closed schema above, unique eventId and operationId/sequence, actor/target/time lookup indexes; append-only application API; no assumed production permissions |
| AccountRoleReview model | Versioned evidence states and stale-plan predicates; proposedRole is nonauthoritative; atomic applied transition |
| ConditionalGrant model | Strict capability/recipient/time/scope schema; unique IDs and effect identity; lookup indexes; no TTL deletion masquerading as authorization/revocation |
| Operation receipt | Persist logical command identity/result reference atomically for safe reconciliation; exact schema/index/integration included in implementation review |
| Account mutation service | Shared guarded transaction path for new account/lifecycle/grant/review effects and required audit; preserve R2 commit handling and self-delete ordering |
| Authentication | Select/validate status without unsafe legacy defaults; immediate suspended/epoch denial; do not trust JWT role or grant claims |
| Safe DTOs | Explicit field projections for profile/admin/list/reconciliation; never return whole new grant/review/audit/security structures via select(-password) |
| Future operational services | Current-actor mutation fences and effect consistency only under separate authorized workflow changes, not merely a middleware toggle |
| Frontend | Later role/lifecycle/review UX and safe landing; backend remains authoritative |

### Proposed HTTP contracts for subsequent review

Keep existing /api/users register/login/profile/password/list/update/delete paths and their protection. Introduce narrow commands rather than accepting raw lifecycle/grant/review objects on generic profile/account update:

- POST /api/users/:id/role-assignments — Administrator, reason/reviewRef/explicit role/expected state.
- POST /api/users/:id/suspensions and POST /api/users/:id/reactivations — Administrator, reason/expected state; no business reversal payload.
- POST /api/users/:id/conditional-grants — Administrator, capability/scope/reason/effectiveAt/expiresAt/approvalRef.
- POST /api/users/:id/conditional-grants/:grantId/revocations — Administrator, reason/expected grant state.
- POST /api/users/:id/role-reviews and explicit review decision/application commands — Administrator; immutable revision/evidence.
- GET /api/account-operations/:operationId — strictly scoped current authorized reconciliation, minimal outcome/reference only.

These are proposed new endpoints, not registered APIs or new role grants. Final route names/request DTOs/error contracts need implementation review and an explicit addition to the route inventory/acceptance tests. Do not silently alter the historical 59-route/23-HEAD baseline or weaken its drift detector to accommodate them.

Invalid authentication 401; valid unauthorized actor 403; invalid request 400; stale/conflicting command 409 are proposed consistent response classes. Indeterminate mutation keeps existing truthful account-outcome behavior, sanitized output and no automatic replay; any new retry/reconciliation response contract requires explicit tests. Do not label a lost response as confirmed abort.

### Schema/migration and rollback prerequisites

Document affected fields/models/indexes, backup/recovery, no-write dry-run, old-reader compatibility and actual target identity before any implementation/data execution approval. No data migration is performed. Preserve all IDs, hashes, confirmation, ownership and financial history. A01/actual inventory and separately authorized native A08B verification remain gates.

Once new states/keys exist, rollback retains a secure compatible reader. Reverse account assignments/status only through reviewed new epoch/audit changes; never restore old tokenVersion or old secret-bearing account dumps. Unknown operations must be reconciled by identity before any retry. No audit deletion, catalog merge or financial backfill is authorized.

## 9. Regression and acceptance requirements

No tests are run for this documentation-only phase. All cases below are future implementation evidence; mocks cannot prove native durability.

| Area | Required tests / observable acceptance |
| --- | --- |
| Audit schema/redaction | Every action's actor/target/time/reason/before/after/scope; rejects unknown fields/actions; no passwords/hashes/tokens/URI/raw request/exception; safe DTOs |
| Atomic persistence | Account/grant/review/audit all commit or none; injected audit insertion failure leaves no applied effect; acknowledged success survives cleanup; unknown commit is not failed/safe-to-retry |
| Reconciliation | Same operation ID never duplicates effect/events; conflicting reuse denied; lost HTTP response reconciles without resubmission; unauthorized IDs cannot reveal another user's result |
| Role administration | Only current admin assigns; explicit four keys; legacy review required; malformed/injected roles reject; self/peer demotion races preserve CAS/fence/security version |
| Legacy review | Pending/in-review/approved not authority; rejection preserves account/access envelope; stale expected state and conflicting revisions deny; applied only with role+epoch+audit; correction retains old evidence |
| Suspension | Status+epoch atomic; all subsequent authenticated routes/login deny; reactivation cannot revive old JWTs; missing legacy/invalid states follow approved contract; no deletes/cascades |
| In-flight races | Each workflow in section 6 tested on both fence orderings under adopted owner policy; no partial effects, duplicate callback/mutation, fake success/abort or hidden retry |
| Grants | All 19 eligible pairs and forbidden pairs; admin-only delegation; explicit scope/reason/effective/expiry; missing/invalid/reversed/expired dates deny; effective/expiry exact boundaries; early revoke; role/status/grantor changes |
| Expiration audit | Expired permission denied even with worker failure; exactly one event per grant/expiration identity after persistence; no permission extension or false persistence claim |
| Security preservation | Seven-day JWT/signature/claims, version-zero legacy accounts with valid claims only, password/reset/demotion/confirmation invalidation, current-account authority, ObjectId self-delete and both R2 no-replay probes |
| Admission | Existing 59 protected/23 HEAD inventory and 52 business/21 HEAD new-role denials stay intact until separately approved replacement; new command routes get explicit role/scope/field checks |
| Recovery/native evidence | Stale plans, backup/read compatibility, reconciliation, native supported transaction/concurrency/durability verification under separately authorized isolated tests |

All RB01–RB17 remain mandatory, with no acceptance promotion here. In particular RB03/RB13 must extend to approved lifecycle transitions, RB14 cannot be weakened by new audit transactions, RB16 requires actual authorized migration evidence, and RB17 needs persisted action audit rather than logs. Preserve the complete Phase 15B text and Phase 15C interpretations.

## 10. Remaining owner decisions and technical adoption gates

| Gate | What remains / why it cannot be invented |
| --- | --- |
| O1 In-flight suspension policy | May already-fenced work finish; must suspension wait; timeout/escalation and acknowledgement semantics. Safe ordering recommendation is section 6, not approved cancellation/rollback |
| O2 Legacy/status compatibility | Exact awaiting-review endpoint envelope/cutoff, missing-state mapping/roster and provisioning-state default. Manual review/no conversion is already approved |
| O3 Recovery/self administration | Last-admin/self-suspension/self-demotion rules, emergency recovery authority; no unrestricted self-escalation |
| O4 Conditional approval/carryover | Self-grant/Administrator reversal approval, grantor turnover, reapproval after security changes/return from suspension. Temporary explicit expiry and Administrator-only execution are already approved |
| O5 Audit/privacy operations | Retention, access/export details, attempt logging, evidence PII handling and deployment permissions. Required event payload and selected atomic applied-event strategy are specified here |
| T1 Technical implementation adoption | Review physical schema/indexes, validation bounds, operation-receipt fingerprint, command DTO/route inventory and same-session self-CAS adaptation before implementation |
| T2 Scope/operational dependencies | Capability-specific resource scopes, shared store/history identity, student/guest privacy and approved reversal/payment effects; no B03 workflow invented |
| E1 Live/native/recovery evidence | A01 target/access/roster, transaction support/concurrency/durability and backup/recovery evidence unavailable; no database name or provider state inferred |

Actual grant dates remain per-command inputs, not a missing global duration approval. Operator identity, actual role mappings, external audit evidence and migration execution require separate live authorization. No approved business requirement is reopened by this register.

**Readiness:** technical audit/workflow contract prepared. Remaining owner decisions block dependent writers/operational activation. This document is not blanket authorization to complete B02-B by inventing those choices.

## 11. Implementation sequence and stop

1. Adopt the concrete technical schema/API/persistence design and resolve O1–O5 where each slice depends on them.
2. Separately authorize local implementation of strict audit/grant/review validators and safe DTOs with synthetic tests; no accounts or runtime grants.
3. Implement and test guarded account + audit transactions and reconciliation, retaining existing self-delete and R2 constraints.
4. Add lifecycle reader/writer only after legacy/status and in-flight policy is fixed; no ordinary confirmation toggle substitutes for suspension.
5. Add audited role-review/assignment commands with exact-state checks; retain restrictive B02-B admission.
6. Add grant lifecycle and server expiry/revocation resolver without activating later operational permissions; implement expiry audit delivery separately under reviewed rules.
7. Run full backend/client/build/syntax/lint verification and fault tests; report exact counts and native limitations.
8. Obtain separate B02-C independent-review authorization. Any A01/A08B, migration, new operational perimeter or production deployment needs its own explicit authorization.

No implementation, test execution, dependency installation, account/schema/config change, migration, external connection, deployment, B02-C or B03 occurs in B02-B1. Earlier results remain historical. The POS remains independent of GradeSense AI.

## 12. Documentation verification and preservation

Completed before/after file-hash comparison found exactly the implementation plan changed, this contract added and no files removed. All 73,154 original implementation-plan bytes remain an exact prefix. Prior reports/contracts, canonical acceptance criteria, all B01/B02-B application and test files, unrelated working-tree changes, configuration, environment files and lockfiles including the existing dependency-directory lockfile match the baseline. git diff --check passed; existing LF/CRLF notices are informational. No runtime tests/builds/lint suites were executed in this documentation phase. No claim of audit persistence, suspension enforcement, grant lifecycle implementation or native transaction verification follows from writing this document.



## B03 integration annotation — 2026-11-04

This annotation preserves the preceding approved B02 contract. New accounts remain active/unconfirmed. B03 reuses the authoritative User.role, current lifecycle/epoch fences, realm/commit boundary and ConditionalAccountGrant resolver; no second role/grant mechanism exists. Explicit membership changes advance token/authority epochs and invalidate applicable grants. Conditional Product/Transaction grants retain exact resource bounds; mapped resources additionally require current approved membership. The approved B03 fulfillment decision now resolves assigned-order scope: only exact unassigned/self-assigned orders may be claimed by a currently authorized actor. Expiry/revocation/grantor and recipient epoch checks remain current; transactional resolution does not start nested expiry-audit transactions. Admin grant administration, independent issuer verification, explicit expiration, last-admin and manual legacy review rules remain unchanged. B03's final report/review documents the local implementation and unexecuted native/production gates.
