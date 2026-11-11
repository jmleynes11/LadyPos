# B02-A — Role and account implementation contract

Date: 2026-11-04, Asia/Manila. UPHSD Bookstore POS.

**Design and contract only. No source, tests, accounts, schema, authentication, role activation or deployment changes are authorized.**

## 1. Contract status and authority

Phase 15C remains the approved business permission authority. The owner's B02-A Final Owner Decision Record instruction, recorded on 2026-11-04 in [B02-A owner decisions](UPHSD_BOOKSTORE_B02_A_OWNER_DECISIONS.md), additionally approves Administrator-only conditional delegation, manual legacy account review/assignment, immediate suspension enforcement with token-version invalidation, and temporary grants with explicitly supplied expiration dates. These four policies are finalized, not pending choices. This contract retains the technical role identifiers, single-role representation, route inventory and security invariants. Remaining implementation details and narrower unresolved policies are identified in section 10; their dependent operations remain denied or unimplemented. Policy approval does not authorize implementation or account actions.

Sources: [B02 assessment](UPHSD_BOOKSTORE_B02_COMPATIBILITY_ASSESSMENT.md), [Phase 15C](UPHSD_BOOKSTORE_PHASE_15C_FINALIZED_ROLE_PERMISSION_SPECIFICATION.md), [Phase 15F](UPHSD_BOOKSTORE_PHASE_15F_TECHNICAL_CONTRACT_REVIEW.md), Phase 15B's canonical 17 acceptance criteria, Phase 15D/E dependency boundaries, B01-R2 independent review and implementation plan. No earlier report is superseded silently.

Already settled: Administrator-only price changes; direct Store Manager receiving/adjustments; Store Manager refund/void approval; Store Manager all-cashier history and Cashier own-only default; both guest and authenticated student ordering. These are not pending choices. Refund/payment/stock effects, grant storage/audit mechanics and identity mechanics still require their applicable implementation contracts; the four newly approved owner policies above must not be reopened.

## 2. Exact role identifiers and authoritative representation

These are the selected internal identifiers for future B02 implementation, not values written or activated in this phase.

| Business role | Canonical persisted User.role | B01 business label |
| --- | --- | --- |
| Administrator | admin | Administrator |
| Store Manager | store_manager | Store Manager |
| Cashier | cashier | Cashier |
| Customer / Student | customer | Customer / Student |

One account has **one authoritative stored business role in User.role**. No second persisted businessRole field, role array, inferred title or parallel authority source. An optional derived businessRole DTO is display/internal context only. Retain raw req.user.role for existing admin guards; do not replace it with a display label. B01's label-only vocabulary stays unchanged and unattached until separately authorized.

Adapter inputs must come from the current database account after authentication, never JWT role, body, query, browser storage, Person/Customer contact or display name. Match canonical keys exactly. Reject whitespace/case variants, numbers, arrays, objects, null, missing and unknown values; no coercion or default privilege. A database lookup failure never falls back to token claims or cached state.

The historical user value remains readable as **legacy-unassigned**, an internal compatibility result, not a fifth business role and not a valid new role-assignment choice after approved cutover. Never map it automatically to customer, cashier, store_manager or admin. New staff provisioning must require an explicit canonical role rather than silently defaulting to user. Any change to missing-role request behavior must be documented/tested as an API compatibility change.

## 3. Legacy account mapping and compatibility

### Fixed rules

1. Preserve existing IDs, identifiers, bcrypt hashes, confirmation state, linked owners, orders, invoices, payments and historical prices. No migration through schema hydration defaults.
2. Existing admin maps technically to Administrator; that does not verify a real administrator's legitimacy. A01/provider/account evidence is still unavailable.
3. Existing user remains unchanged until an authorized Administrator approves an exact-account mapping supported by actual duties/identity evidence. A contact named “student” or a sales-owning account is not proof of Customer identity or Cashier duty.
4. No automatic promotion, role rename, default assignment, confirmation, password reset, disabling or mass token invalidation.
5. Preserve current runtime behavior during this documentation-only phase. Awaiting review, user remains legacy-unassigned: no automatic business-role mapping, additional capability or expanded endpoint scope. Existing legacy authentication compatibility is not operational authorization. The exact existing-access envelope and cutoff still need a release contract and separate execution authorization; this phase neither silently revokes existing access nor extends it.
6. Unknown values are invalid authority; do not treat them as legacy user or allow authenticated operational access.

### Reviewed assignment procedure — not executed

Obtain an approved minimum-data A01 inventory only after target identity and read-only permissions are established. Create a reviewed plan keyed by canonical account ID: expected old role, expected epoch, confirmation/lifecycle state, proposed canonical role, verified duties, approver, approved scope, access impact and decision status. Keep secrets and password hashes out of the plan/report. A hash-format compatibility category is sufficient.

An authorized Administrator approves mappings; unresolved accounts stay unresolved. Apply only an explicitly authorized plan through guarded writers with expected-state checks and durable audit. Any stale role/epoch/state, duplicate/conflicting mapping or uncertain outcome stops that item for reconciliation. A migration must not convert every user to a staff role or merge their catalogs/history.

**Approved legacy handling:** manual individual review and authorized assignment; preserve legacy user accounts and all account/history data; no automatic customer conversion or extra privileges for unreviewed accounts. The proposed exact-ID review procedure above remains a technical process to finalize, not an executed migration. **Remaining transition detail:** approve the precise legacy endpoint envelope and cutoff before a release changes existing access. After an approved cutover, any unresolved account has only the explicitly approved compatibility access, never an inferred business-role grant. No date, duration or automatic lockout is selected; no indefinite broad fallback satisfies completed four-role rollout.

## 4. Authentication versus endpoint authorization

Current source: User.role enum is admin/user; login checks password and confirmed; protect checks HS256, seven-day lifetime, account confirmation and tokenVersion. It does not globally reject unknown roles. authorizeRoles compares current persisted role. Existing getProfile/getUsers return broad model data excluding password; future fields need explicit safe projection. These are code facts, not statements about deployed accounts.

Future admission sequence: validate JWT/signature/time/version claim; load current account; validate role and approved account state; resolve strict compatibility context; evaluate the route's capability; enforce resource scope, field/state/effect guards and conditional grant; then mutate under the required actor/version/transaction boundary. Authentication alone never grants operational capability.

Any missing capability, scope, required state, grant or policy denies. Unavailable account/grant/audit dependencies cannot become permission. Preserve existing response conventions where possible: invalid authentication 401, valid actor lacking permission 403, invalid input 400; existing retired 410 and canonical self-delete 400 remain. Exact new lifecycle error semantics need review without leaking private state.

### Complete mounted route access matrix

Verified from backend/app.js and all 11 mounted route modules, cross-checked against Phase 15F R01–R59. **59 explicit protected registrations: 49 without a route-level role allowlist and 10 with one.** “Authentication-only gate” describes the middleware boundary, not absence of all controller ownership/financial checks. Expense creator/admin checks, owner filters and retired handlers still exist.

A = Administrator; M = Store Manager; C = Cashier; S = authenticated Customer / Student. * = explicit approved conditional grant required. U = authority/scope unresolved: no new-role permit, including no automatic Administrator override. T = retired authenticated 410 without database effects, not a grant. Guests receive no access to these staff APIs.

Rows specify future eligibility ceilings, **not immediate permission to use today's full handler/DTO**. Every allow depends on safe scope/fields/effects and its batch. A denied or unresolved dependency cannot be bypassed because the same role has a nearby capability. Student self-service is compatible account access, not an operational permission.

| ID | Method/path | Current route gate | Future eligible roles | Required boundary / blocker |
| --- | --- | --- | --- | --- |
| R01 | POST `/api/users/register` | Role allowlist | A | Guarded staff creation; explicit role; no guest/student self-signup contract. |
| R02 | GET `/api/users/profile` | Authentication-only gate | A M C S | Self only; safe profile DTO; no authority from response fields. |
| R03 | PUT `/api/users/profile` | Authentication-only gate | A M C S | Self nonprivileged fields only; privilege inputs cannot take effect. |
| R04 | PUT `/api/users/password` | Authentication-only gate | A M C S | Self; verify current password; atomic hash + epoch. |
| R05 | GET `/api/users` | Role allowlist | A | Account realm; safe DTO; no Manager access. |
| R06 | PUT `/api/users/:id` | Role allowlist | A | Canonical target; actor fence/CAS + target epoch + durable audit. |
| R07 | DELETE `/api/users/:id` | Role allowlist | A | Existing canonical self-delete prohibition; guarded peer only; last-admin policy pending. |
| R08 | POST `/api/products` | Role allowlist | A | Catalog/price only; stock, cost and availability effects require separate field approval. |
| R09 | GET `/api/products` | Role allowlist | A M C | Management view for A; sale-safe M/C projection. S needs a separate approved customer-safe contract. |
| R10 | GET `/api/products/:id` | Role allowlist | A M C | Same projections as R09; scoped target; no raw cost/owner leakage. |
| R11 | PUT `/api/products/:id` | Role allowlist | A | Catalog/price only; stock/cost effects separately gated; omitted cost reset remains deferred. |
| R12 | DELETE `/api/products/:id` | Role allowlist | U | Availability authority not finalized; no new-role assignment inferred from monitoring. |
| R13 | PATCH `/api/products/:id/stock` | Role allowlist | M; A* | Direct inventory.adjust, reason + ledger + atomic delta; A requires explicit grant. |
| R14 | POST `/api/products/set-active` | Authentication-only gate | U | Bulk availability authority/atomicity pending; no automatic Manager grant. |
| R15 | POST `/api/people` | Authentication-only gate | U | Standalone contact creation not assigned; checkout-internal resolution is distinct. |
| R16 | GET `/api/people` | Authentication-only gate | U | Raw contact/balance/history aggregate not a blanket grant; approved scoped history subset requires separate DTO. |
| R17 | GET `/api/people/:id` | Authentication-only gate | U | Same contact/linked-record privacy gate as R16. |
| R18 | PUT `/api/people/:id` | Authentication-only gate | U | Standalone contact editing not assigned. |
| R19 | DELETE `/api/people/:id` | Authentication-only gate | U | Standalone contact deactivation not assigned; retain unpaid-balance safeguards. |
| R20 | POST `/api/people/:id/debts` | Authentication-only gate | T | Retired authenticated 410; zero database effects; no role gains debt creation. |
| R21 | POST `/api/people/:id/payments` | Authentication-only gate | C; A*/M* | payment.record + authorized transaction/customer; cannot widen history. |
| R22 | POST `/api/people/:id/pay-all` | Authentication-only gate | C; A*/M* | Same payment gate; approved settlement semantics; no duplicate financial effects. |
| R23 | PUT `/api/people/:id/debts/:debtId` | Authentication-only gate | T | Retired authenticated 410; zero database effects. |
| R24 | DELETE `/api/people/:id/debts/:debtId` | Authentication-only gate | T | Retired authenticated 410; zero database effects. |
| R25 | POST `/api/customers` | Authentication-only gate | U | Contact creation alias of R15; same unresolved gate. |
| R26 | GET `/api/customers` | Authentication-only gate | U | Contact list alias of R16; same scoped DTO prerequisite. |
| R27 | GET `/api/customers/:id` | Authentication-only gate | U | Contact detail alias of R17; same linked-record checks. |
| R28 | PUT `/api/customers/:id` | Authentication-only gate | U | Contact editing alias of R18. |
| R29 | DELETE `/api/customers/:id` | Authentication-only gate | U | Contact deactivation alias of R19; retain history/balance safeguards. |
| R30 | POST `/api/orders` | Authentication-only gate | C; A*/M* | Staff sale.process; completion also requires payment/receipt/effect guards; not kiosk order.submit. |
| R31 | GET `/api/orders` | Authentication-only gate | A M C | A/M approved oversight scope; C own processor history. Assigned fulfillment subset requires separate workflow. |
| R32 | GET `/api/orders/:id` | Authentication-only gate | A M C | Same scope as R31 on target and all linked invoices/payments. |
| R33 | PUT `/api/orders/:id` | Authentication-only gate | C; A*/M* | sale.process or approved assigned fulfillment branch; completion requires full effect gates; no generic status write. |
| R34 | PATCH `/api/orders/:id/pay` | Authentication-only gate | C; A*/M* | payment.record + target/customer/state rules; no peer-history implication. |
| R35 | PATCH `/api/orders/:id/complete` | Authentication-only gate | C; A*/M* | Same completion command/guards as PUT; server price, payment, stock, receipt, audit, operation identity. |
| R36 | PATCH `/api/orders/:id/void` | Authentication-only gate | M; A* | reversal.approve/apply; reason/audit; financial/stock effects approval required before enablement; C request only. |
| R37 | DELETE `/api/orders/:id` | Authentication-only gate | M; A* | DELETE is reversal alias, not hard delete; identical gate to R36. |
| R38 | POST `/api/transactions` | Authentication-only gate | C; A*/M* | Same staff sale/completion gate as R30; not customer submission. |
| R39 | GET `/api/transactions` | Authentication-only gate | A M C | Same own/oversight history scope as R31. |
| R40 | GET `/api/transactions/:id` | Authentication-only gate | A M C | Same target/linked-record scope as R32. |
| R41 | PATCH `/api/transactions/:id/pay` | Authentication-only gate | C; A*/M* | Same payment gate as R34. |
| R42 | PATCH `/api/transactions/:id/void` | Authentication-only gate | M; A* | Same reversal gate as R36; no Cashier direct void. |
| R43 | GET `/api/financials/summary` | Authentication-only gate | A M | Management aggregate only after approved store scope/projection; C needs a separate personal-summary contract. |
| R44 | GET `/api/financials/dashboard-summary` | Authentication-only gate | A M | Same management scope; counts/recent contacts/details must all be filtered. |
| R45 | GET `/api/financials/revenue` | Authentication-only gate | A M | Management revenue range; C personal summary requires scoped projection; no invented profit calculation. |
| R46 | GET `/api/dashboard/summary` | Authentication-only gate | A M | Dashboard alias of management summary; no student/internal access. |
| R47 | GET `/api/dashboard/revenue` | Authentication-only gate | A M | Dashboard revenue alias; same report scope. |
| R48 | POST `/api/invoices/create/:orderId` | Authentication-only gate | C; A*/M* | receipt.issue for authorized transaction; issuance not implied by oversight read. |
| R49 | GET `/api/invoices` | Authentication-only gate | A M C | Existing receipt/history read: A/M oversight, C own; filter all populated fields. |
| R50 | GET `/api/invoices/order/:orderId/ensure` | Authentication-only gate | C; A*/M* | Effectful GET: receipt.issue required even with no response body; read permission alone insufficient. |
| R51 | GET `/api/invoices/transaction/:transactionId/ensure` | Authentication-only gate | C; A*/M* | Same effectful ensure gate as R50. |
| R52 | GET `/api/invoices/:id` | Authentication-only gate | A M C | Scoped existing receipt read; no S access to staff invoice API. |
| R53 | PATCH `/api/invoices/:id/void` | Authentication-only gate | M; A* | Reversal gate; independent invoice status update must not bypass unified effects/approval. |
| R54 | POST `/api/debt-payments` | Authentication-only gate | C; A*/M* | payment.record + customer/transaction scope + financial safeguards; no automatic resubmission. |
| R55 | GET `/api/debt-payments` | Authentication-only gate | A M C | Payment/history view: A/M approved oversight; C own processor; fields follow linked record authority. |
| R56 | POST `/api/expenses` | Authentication-only gate | U | Expense creation permission unassigned to all new-role mappings. |
| R57 | GET `/api/expenses` | Authentication-only gate | U | Expense read permission unassigned; sales reports do not imply expense authority. |
| R58 | PUT `/api/expenses/:id` | Authentication-only gate | U | Expense update unresolved; existing creator/admin check is historical, not a future grant. |
| R59 | DELETE `/api/expenses/:id` | Authentication-only gate | U | Expense delete unresolved; completed financial traceability must remain. |

### HEAD, public and alias coverage

There are 23 inherited protected HEAD forms. They must carry exactly the GET guards, scope and effects; 20 derive from authentication-only GET registrations, three from role-allowlisted GET registrations. The exact R references are R02, R05, R09, R10, R16, R17, R26, R27, R31, R32, R39, R40, R43, R44, R45, R46, R47, R49, R50, R51, R52, R55, R57. R50/R51 can create invoices/counters even through GET/HEAD. Oversight receipt reading does not authorize issuance.

Public POST /api/users/login remains authentication entry, never role assignment. Public GET / and GET /api/health (and their HEAD behavior) remain redacted diagnostics, not operational grants. CORS/OPTIONS are transport handling, not authorization; method/alias drift and newly mounted registrations must fail manifest coverage review. Do not invoke health during this phase: it can ping a database if connected.

No current route safely constitutes a guest/student kiosk submission API. POST /orders and /transactions can complete sales and are **not** to be reclassified as order.submit. Guest/customer-safe catalog, submission, own status/reference and privacy/rate/identity contracts require later authorization. No guest User record is created by implication.

### Activation firewall

Do not enable new-role sessions, confirm/provision usable new-role accounts, or use a new role to admit operational requests until the entire backend perimeter above is implemented and negatively tested. An enum/adapter update by itself is insufficient. Legacy rules must be explicit rather than allowing any “known role” through protect-only handlers.

Readiness may be satisfied by complete later capability binding or a separately approved restrictive admission perimeter; neither is implemented here. Do not invent an environment switch or change route behavior during B02-A. Preserve legacy behavior until an authorized cutover, while refusing to describe it as four-role compliance.

## 5. Conditional permission contract

The complete current B01 conditional inventory below is from backend/auth/capabilities.js. It is an eligibility vocabulary, not persisted grants or runtime authorization. This contract does not add new conditional capabilities.

| Conditional capability | Eligible recipient role(s) | Maximum scope |
| --- | --- | --- |
| catalog.saleRead | A | Sale-safe catalog projection; not protected costs/PII or catalog mutation |
| inventory.receive | A | Approved store/products; receiving effect only |
| inventory.adjust | A | Approved store/products; reason, atomic delta and movement required |
| sale.process | A, M | Authorized transactions; no price edit |
| payment.record | A, M | Authorized transaction/payment scope, approved payment method/effects |
| receipt.issue | A, M | Authorized transaction; issuance, not blanket history access |
| salesHistory.own | A, M | Own processor history only, not someone else's history |
| salesSummary.own | A, M | Own processor summary only |
| reversal.request | A | Authorized target/request only; not approval/application |
| reversal.approve | A | Authorized reversal only; separate approval required |
| reversal.apply | A | Authorized reversal effect only; approved approval/effect linkage |
| order.fulfill | A, M | Assigned order and minimum approved fulfillment fields |
| order.oversee | A | Approved bookstore order oversight scope |

B01 currently represents **13 conditional capability names / 19 role-capability pairs**. Base Manager inventory/reversal authority and base Cashier operational authority require no new conditional grant. Manager all-cashier history is base authority, not permission to edit prices. Base Cashier fulfillment still requires an approved assignment/workflow.

### Non-negotiable grant validation

- A conditional grant cannot change the recipient's stored role or bypass its eligibility ceiling. No grants to S, no Manager price/account-admin grant, no Cashier adjustment/reversal-approval/cross-history grant.
- Client conditionalActions, JWT claims and profile fields are never trusted grant sources. The B01 evaluator's conditions parameter must eventually be assembled from authoritative validated state.
- Scope is the intersection of approved grant scope, current account/resource membership, route ownership and field/state/effect rules; never global just because scope is missing.
- Unknown actions, malformed records, wrong target role, missing scope/duration/revocation/audit evidence, expired/revoked grants or failed lookup deny.
- Revocation/expiry must prevent future use; current epoch/actor constraints must protect sensitive in-flight mutations at the operation boundary. Mere middleware recheck before a later unfenced write is insufficient.
- Permission loss cannot be repaired by restoring old epochs. Receipt, payment and stock operations retain their own concurrency/idempotency requirements.

### Grantor, duration and revocation — owner-approved policies

**Approved Decision 1:** only current Administrator (admin) may grant or revoke conditional capabilities. Store Manager, Cashier and Customer cannot delegate or grant permissions. Every grant must fit the approved conditional definitions, recipient role ceiling and Administrator's authorized boundaries; permission.manage is not authority to invent a capability or self-authorize an otherwise unapproved financial power. Record the grant/revocation, scope, reason and expiration in the audit requirements. No grant is created by this documentation update.

Self-grant approval procedure and who separately authorizes Administrator reversal powers remain unresolved. No unrestricted self-grant is approved. A separately authorized independent approval process cannot introduce a new application role or grant execution right to a non-Administrator. The owner remains a business approver, not a fifth application role.

**Approved Decision 4:** conditional grants are temporary and require an explicit expiration date supplied at creation. No default duration or indefinite grant is permitted. Missing, invalid or expired expiration fails closed; server-side checks deny expired grants regardless of scheduled cleanup. Administrator may revoke before expiration, enforced server-side. Record grant, expiration and revocation events in the audit requirements. Exact duration values are inputs for each authorized grant, not a global duration invented by this contract.

Technical event/storage proposal: issuer/recipient IDs, approved capability and scope, reason/approval reference, start/expiration, revoked state/time/actor and audit reference. Exact event structure, clock/precision validation, expiry-event recording and atomic storage remain to be designed. An expiry event recording delay or failure must never extend authorization beyond expiration.

Recommend grant/revoke changes atomically advance the recipient's tokenVersion and require fresh login; current grant lookup also enforces expiry. Expiry cannot depend on a background job completing. Role changes must invalidate grants that no longer fit the role ceiling. Approve the grantor-revocation policy: conservative recommendation denies grants issued by a no-longer-authorized grantor until reviewed, with current validation or an auditable revocation mechanism, not an assumed cascade. Whether to retain a grant after grantor turnover is an unresolved business decision.

## 6. Account lifecycle contract

### Creation and role assignment

Staff provisioning remains guarded Administrator-only, including creation of another Administrator. Retain canonical target validation, self CAS and cross-account actor-version fence in the same supported transaction. Manager cannot create/confirm/reset staff, assign roles or grant itself Administrator.

Future staff creation: require an explicit canonical role, no token issued by registration, no privilege from request-supplied epoch/grants/status beyond the approved whitelist. Preserve unconfirmed-by-default creation unless the separately approved provisioning request intentionally confirms the account. A confirmed account still fails operational admission unless all activation gates are satisfied.

Customer accounts need a separate enrollment/identity contract; permission to support authenticated students does not authorize public selection of staff roles. Guest ordering needs no account. Public signup cannot create privileged accounts through supplied role/confirmed/status/grant fields.

Role assignment/change uses expected old role/epoch/state and current Administrator authorization at mutation time. Change role and epoch atomically; require fresh login. Never use a bulk update bypassing security hooks. Concurrent stale writers must fail rather than restore an actor's lost authority.

### Confirmation, suspension and reactivation

Existing confirmed remains confirmation. Do not silently use it as a suspension flag. **Approved Decision 3:** suspension must immediately block new authenticated requests and invalidate existing authenticated sessions/tokens using tokenVersion; subsequent requests from suspended accounts are rejected. Preserve account, transaction, order and audit records; suspension is not deletion. This is the approved future behavior, not a claim that it is implemented now.

**Remaining technical representation:** recommend an additive accountState enum active/suspended, preserving confirmed as a separate requirement. Field name/enum/defaults and legacy missing-state treatment remain unresolved; this approval is not a schema change. No hydrated default may silently activate or lock out old accounts.

The eventual implementation must persist suspension and a monotonic tokenVersion advance atomically, enforce current status/epoch for subsequent requests and block new login for suspended accounts. It must not acknowledge a definitive suspension success before the security change is established. Reactivation requires current Administrator authority, a new epoch and fresh login; it is not confirmation and cannot restore old grants or token versions. Administrator-only lifecycle administration retains mutation-time authority/audit guards. Last-Administrator/self-suspension policy and emergency recovery authority remain to be defined without weakening immediate enforcement of an authorized suspension.

**In-progress operations:** rejection of new requests does not define cancellation of already-admitted transactions. Exact serialization between suspension and an in-flight mutation, treatment of already-fenced work and response/acknowledgement policy require an explicit design and tests before activation. Do not assume that middleware admission authorizes a later unfenced write; preserve actor/version guards and R2 commit-boundary protections. Never roll back acknowledged financial/stock effects by deleting history, release a suspended actor into a new privileged mutation, or replay an indeterminate operation. Preserve committed records, classify uncertain outcomes truthfully and reconcile before resubmission. No drain, cancellation, automatic reversal or grace-period policy is selected here.

No new suspend/reactivate endpoint, runtime invalidation or confirmed-toggle substitute is authorized by this documentation update. Policy approval must be followed by separately authorized implementation and verification.

### Tokens and password compatibility

Preserve bcrypt-compatible hashes and current hashing path; no plaintext conversion or rehash migration implied. Existing missing stored tokenVersion alone is version zero. JWT must have a valid nonnegative integer version claim; claim-less legacy tokens require fresh login. Reject malformed/stale versions and missing/invalid accounts. Preserve HS256, required iat/exp and maximum 604,800-second lifetime. Role claims remain non-authoritative.

Password changes, administrator resets, role and confirmation changes remain atomic with monotonic epoch advancement. Future suspension, reactivation, grants or scope changes that affect authority must join the security-state/version design. Profile edits cannot assign role, confirmed, epoch or grant/lifecycle fields. Preserve current ignored-unknown-field response behavior unless a separately tested API contract authorizes explicit rejection; in either case zero privilege effects.

Frontend logout currently clears local storage only; it does not revoke copied JWTs. No server logout-all or production invalidation is introduced. Cached roles and navigation cannot grant authority.

## 7. Migration, activation and rollback requirements

### Evidence required before any live action

- A01 verified deployment/database identity, effective access permissions and minimum account inventory; actual administrator legitimacy/provisioning evidence. No database inferred from test or an environment fallback.
- Owner-approved exact-ID mappings, legacy envelope/cutoff, applicable lifecycle/grant decisions and shared store/processor/student scope.
- All runtime readers support canonical keys before new-key writers run; preserve compatible raw role DTOs. Student landing must not default into the staff POS.
- Full backend route/HEAD/alias admission, scope and field tests; safe DTOs; durable account/permission audit and failure handling.
- Separately authorized native MongoDB testing evidence for actual transaction support/concurrency/durability; mocked tests cannot satisfy it. A08B remains blocked and unstarted.
- Approved backup/recovery evidence; reviewed dry-run with zero writes; stale-plan detection, reconciliation and expected counts; secure emergency Administrator recovery.
- Separate approval for migration target/method, account changes, expected reauthentication, deployment and session interruption. This document grants none.

### Migration sequence

1. Freeze the versioned contract and settle applicable blocking annexes.
2. Inventory through approved A01; verify mappings and account legitimacy without publishing PII/secrets.
3. Prepare synthetic fixtures, no-write exact-ID dry-run and backup/recovery plan.
4. Implement and independently verify compatible readers/adapter/security writers locally under separate authorization.
5. Complete later admission/resource/audit/frontend dependencies before new-role activation; do not start B03 automatically.
6. Obtain explicit execution approval, deploy compatible readers before writers, and apply only reviewed guarded mappings.
7. Reconcile every acknowledged, failed or indeterminate item; never automatically replay a possibly committed change.
8. Verify allowed/denied access and unchanged hashes/history/ownership, then close only the gates actually evidenced.

### Rollback

Retain a security-compatible reader after new role values exist; an old admin/user-only binary is not a safe rollback target. Reverse an assignment only as a reviewed new security change with a new epoch and audit; never restore an old epoch, generic user fallback, password or role dump automatically. Preserve IDs, hashes and linked history. Stop and reconcile uncertain outcomes before resubmission.

Backups containing old credentials/epochs can revive authority: recovery needs an approved coordinated session/revocation plan. A client rollback must not relax backend authorization. Local implementation rollback reverts only separately authorized batch changes and preserves earlier JWT/admin/ObjectId/commit fixes and unrelated work.

No catalog merging, owner reassignment, historical cashier attribution backfill, financial correction, credential rotation or production token invalidation is included.

## 8. B02 implementation boundary and acceptance evidence

A separately authorized bounded B02 slice may add the strict role adapter, extend approved validators/DTOs and test role/account compatibility in the existing architecture. Expected candidates: backend/models/User.js, controllers/UserController.js, middleware/authMiddleware.js, routes/UserRoute.js only if required, a dedicated account-role adapter and focused regression tests. Existing security helpers are preservation boundaries; change only for an expressly reviewed security-state need. No new grant/lifecycle schema follows automatically from this list.

B02 must not silently bind all B01 policies, implement shared catalog/ownership, grant persistence, kiosk, refunds, financial/inventory fixes, client workflows or audit infrastructure belonging to other batches. If safe activation depends on them, leave activation blocked rather than implementing later batches.

| Acceptance gate | Required positive/negative evidence |
| --- | --- |
| Exact adapter | All four keys; admin preserved; user unresolved; all malformed/unknown/case/whitespace inputs deny with no fallback |
| Provisioning | Guarded Administrator only; explicit role; no privilege by anonymous/student/Manager/Cashier signup/profile/body injection |
| Compatibility | Existing bcrypt and raw-role consumers remain compatible under the approved legacy policy; no hash/ID/confirmation mutation by reads |
| JWT/current account | Correct/expired/invalid signatures and claims; seven-day ceiling; version-zero legacy account only with valid claim; stale/missing account/lookup failure deny |
| Transitions | Password/reset/role/confirmation and approved lifecycle/grant changes advance epoch atomically; demotion/restoration/reactivation cannot revive old tokens |
| Mutation races | Actor revoked between admission and mutation cannot restore privilege; concurrent stale saves fail; unsupported transaction topology fails closed |
| ObjectId | Lower/upper/mixed-case self-delete rejects before session/fence/delete; malformed IDs reject; authorized peer works |
| Admission | Every R01–R59 and 23 HEAD forms, public exclusions and method/alias drift; unknown/unassigned roles never get protect-only operational access |
| Fields/scope | No price edits by M/C; no broad student staff data; C own-only history, M scoped all-cashier access; no owner-ID substitution |
| Conditional grants | Every eligible role/action pair plus forbidden pairs; only current admin grants/revokes within approved boundaries; explicit per-grant expiration with no default; missing/invalid/expired/revoked/out-of-scope deny server-side; grant/expiration/revocation audit; untrusted conditionalActions ignored |
| Suspension | Atomic suspension + epoch, immediate rejection of subsequent authenticated requests and login, old-token rejection including after reactivation, preserved records/history; approved in-flight race/outcome behavior and no unsafe replay |
| Legacy review | No automatic user conversion, privilege expansion or history rewrite; exact-ID authorized assignments only; explicit awaiting-review compatibility and stale/conflicting decision handling |
| Outcomes/audit | Acknowledged success survives cleanup; primary error preserved; uncertain commits remain indeterminate/non-retryable; no replay through compound labels; no secret logs |
| Migration/rollback | Zero-write synthetic dry-run; exact IDs/expected states/counts; stale/conflicting mappings reject; recovery advances epochs without history rewrite |

Tests are future requirements, not executed in B02-A. Native concurrency and real data migration require separately approved environments/evidence.

All **17 Phase 15B criteria RB01–RB17** remain mandatory, interpreted through Phase 15C. None is replaced by this table. RB01–RB05 and RB13–RB14 cover role/auth/admin security; RB06–RB12 cover scope, fields, operational and guest/student boundaries; RB15 covers frontend consistency; RB16 covers approved migration; RB17 requires durable audit. B02 completion cannot be claimed as implementation of the other batches' criteria. Preserve the complete canonical texts in Phase 15B and detailed D/E/F mappings without weakening them.

## 9. Original B02-A inspection and verification history

Inspected local B02 assessment, Phase 15C/F, Phase 15B criteria, implementation plan, all 11 backend route files and backend/app.js; backend/models/User.js; controllers/UserController.js; middleware/authMiddleware.js; auth/roles.js, capabilities.js and policy.js; utils/adminAccountMutation.js, tokenPolicy.js and tokenVersion.js; client/src/shared/hooks/AuthContext.jsx.

Confirmed by source inspection: 59 mounted protected registrations / 23 inherited protected HEAD forms, including 49 registrations / 20 HEAD forms without route-level role allowlists; 13 conditional capability names / 19 role-capability pairs. These are local source inventories, not deployed/provider assertions. No HTTP request, health probe, database connection, test/build/lint suite, migration or runtime activation was executed. Historical B01-R2 test counts remain historical; no new security-test pass is claimed.

Preservation verification: a before/after file-hash comparison found only the implementation plan changed, only this document added and no existing file removed. All 68,618 original plan bytes remain an exact prefix of the updated plan. Existing source, tests, configuration, manifests, lockfiles and reports in the project snapshot remain unchanged. git diff --check passed; existing LF/CRLF notices did not report whitespace errors. The document contains all 59 R01–R59 rows and 11 explicit approval/evidence gates. These are documentation checks, not executed authorization or native transaction tests.

## 10. Decision status after final owner approvals

| ID | Decision still required | Technical recommendation; consequence if unresolved | Blocks |
| --- | --- | --- | --- |
| D01 | Manual legacy review/assignment APPROVED; exact workflow, endpoint envelope, cutoff and per-account decisions remain | Preserve user/data/history; no auto-conversion or additional privileges. Finalize exact-ID review and compatibility access before cutover | Legacy runtime restriction and migration/activation, not pure adapter tests |
| D02 | Administrator-only delegation APPROVED; self-grant/reversal approval procedure remains | Only current admin grants/revokes within authorized boundaries; no non-admin delegate or unrestricted self-grant | Remaining grant procedure and writers/activation |
| D03 | Temporary explicit expiration APPROVED; actual per-grant values, timestamp validation and grantor-turnover policy remain | No default or indefinite duration; missing/invalid/expired deny server-side; grant/expiry/revocation audit required | Grant implementation/input validation and turnover handling |
| D04 | Immediate suspension + token invalidation APPROVED; representation, missing legacy state, in-flight serialization, last-admin/self-suspension and recovery remain | Atomic status/epoch; reject subsequent requests and preserve records; no invented transaction cancellation policy | Lifecycle schema/writers and affected rollout |
| D05 | Durable audit structure, retention/access and atomic effect consistency | Same transaction or reviewed atomic outbox; no successful sensitive write falsely reported as definitive failure from audit cleanup | New sensitive writers/activation |
| D06 | Shared store/processor scope and historical owner compatibility | Preserve owners until B03 approval; real assignments, no inferred all-store membership | Shared operation/history enforcement, not B03 authority |
| D07 | Student enrollment and guest reference/privacy/fulfillment contract | Separate staff provision from enrollment; no contact-to-student inference | Customer/guest activation |
| D08 | Unassigned costs/contact/expense/export/availability rights and receipt eligibility | Deny unresolved operations; no admin/Manager blanket override | Specific U rows and full functional activation |
| D09 | Payment methods/refund/void money/stock effects and unapproved order states | Preserve approved authority; define effects before building workflow | Operational effects, not role identifier choice |
| D10 | Concrete runtime admission perimeter and release/session cutover | Complete capability/alias enforcement before new-role sessions; test rollback compatibility | New-role login/role activation |
| D11 | Live identifiers, inventory/legitimacy, effective permissions, backup/native evidence | Authorized operator/Administrator supplies nonsecret evidence through approved A01/A08B gates | Live review/migration/deployment; neither phase starts here |

The one stored-role architecture, exact identifiers, manual legacy assignment, Administrator-only delegation, temporary explicit expiration, immediate suspension/epoch enforcement, strict unknown-role denial and Phase 15C boundaries are established. The four approved policies must not be reopened as undecided; remaining implementation details are not implied approvals. **B02-B implementation and all runtime/production activation still require separate authorization and resolution of the applicable dependencies.**

## 11. Deferred integrity risks and stop

Repeated stock adjustments, lost concurrent adjustments, partial activation, payment resubmission and financial error masking remain open, as do omitted cost-price reset and unverified native MongoDB behavior. Role/account contract design resolves none of these. No Phase 16 workflow, B03, A08B or remediation is begun.

**Status: four final owner policies recorded and incorporated; remaining technical details explicit; implementation NOT STARTED under this documentation phase. No B02-B, B03 or A08B starts.**

## 12. Final owner decision update — 2026-11-04

Authority: owner's B02-A Final Owner Decision Record instruction; full decisions and remaining details are recorded in [B02-A owner decisions](UPHSD_BOOKSTORE_B02_A_OWNER_DECISIONS.md). Sections 1, 3, 5, 6, 8 and 10 now distinguish approved policies from unresolved mechanics. Original verification in section 9 is retained as historical evidence. Role identifiers, all 59 route rows, 23 inherited HEAD forms, conditional capability inventory, Phase 15C permissions and all 17 Phase 15B acceptance criteria remain unchanged. This update records requirements only; no runtime/account/session change or verification result is claimed.

