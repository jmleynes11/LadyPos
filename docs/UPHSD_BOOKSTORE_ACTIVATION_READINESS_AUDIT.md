# UPHSD Bookstore POS — B01–B03 activation-readiness audit

Date: 2026-11-04, Asia/Manila. Audit only; no production inspection or new implementation phase.

## 1. Executive summary

**Overall verdict: NOT READY for production activation.** Accepted B01/B02 local history and B03's prior local PASS WITH LIMITATIONS remain preserved. Fresh tests do not establish native database or production readiness. This audit also reproduces a specific B03 policy defect: an Administrator with a valid bounded order.oversee grant can cancel an unpaid order without a Manager actor, contrary to the explicit Manager-only owner decision.

Other blockers: tracked backend secrets; implicit database selection; unverified native transactions/indexes/privileges; actual account/resource attribution; backup/restoration evidence; deployment/guest security configuration; and controlled release/cutover provenance. No READY WITH LIMITATIONS production verdict is justified.

**Disposition:** freeze the audited B01–B03 baseline. Do not restart B01/B02. B03 requires a specifically approved cancellation-boundary correction and regression/review. Credential containment/configuration need separate approval. Only this audit and the implementation roadmap change; runtime, tests, environment, dependency and actual account/data files remain untouched.

## 2. Current B01–B03 status

| Phase | Preserved local acceptance | Activation disposition |
| --- | --- | --- |
| B01 | Original FAIL followed by R1/R2 remediation; R2 PASS WITH LIMITATIONS | Preserve foundation; metadata/eligibility alone is not a runtime permit |
| B02 | Local account lifecycle COMPLETE; independent PASS WITH LIMITATIONS | Preserve active/unconfirmed creation, role IDs, manual review, grants, epochs and last-admin protections; actual roster/native ordering unverified |
| B03 | Local implementation COMPLETE WITH LIMITATIONS; final local independent PASS WITH LIMITATIONS | Historical completion retained; new cancellation defect requires a specific correction before activation; native/data/recovery gates remain open |

Earlier reports are not overwritten. Their scoped local17-criterion disposition cannot be read as17 production passes. This audit records contrary RB09 evidence explicitly.

## 3. Methodology and evidence

Inspected current source, approval records, schema/index declarations, configuration consumers, test adapters, frontend permission paths and repository state. Re-ran installed local tests/build/syntax/lint. Ran two temporary in-memory adversarial probes from stdin: direct service and actual localhost HTTP. Compared remaining lint findings against corresponding Git HEAD source using in-memory ESLint. Privately parsed local environment metadata and the committed backend environment blob without returning secrets. Used the installed MongoDB driver/connection-string parser without calling connect, DNS, health or database commands.

Captured backend/client first-party file hashes before work for final preservation comparison, including source/config/environment/manifests/lockfiles and excluding dependency/build caches. Build output is a new temporary directory. No ordinary backend startup, configured remote API/browser request, production account/session action, migration, seed, restore, real payment or deployment occurred. A08B and new major phases were not started.

Documentation reviewed:

- [B01 implementation](UPHSD_BOOKSTORE_B01_IMPLEMENTATION_RESULTS.md), [original review](UPHSD_BOOKSTORE_B01_INDEPENDENT_REVIEW.md), R1/R2 results and [R2 independent review](UPHSD_BOOKSTORE_B01_R2_INDEPENDENT_REVIEW.md).
- [B02 completion](UPHSD_BOOKSTORE_B02_COMPLETION_REPORT.md), [security review](UPHSD_BOOKSTORE_B02_INDEPENDENT_SECURITY_REVIEW.md), compatibility assessment, [owner decisions](UPHSD_BOOKSTORE_B02_A_OWNER_DECISIONS.md), role/account and lifecycle contracts.
- [B03 results](UPHSD_BOOKSTORE_B03_IMPLEMENTATION_RESULTS.md), [review](UPHSD_BOOKSTORE_B03_INDEPENDENT_REVIEW.md), [owner approvals](UPHSD_BOOKSTORE_B03_OWNER_APPROVAL_DECISIONS.md), [roadmap](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md).
- Phase15B canonical17 criteria and Phase15C/D/E/F permissions/architecture/contracts; [database review](UPHSD_BOOKSTORE_DATABASE_REVIEW.md), [test plan](UPHSD_BOOKSTORE_TEST_PLAN.md), [A08B preflight](UPHSD_BOOKSTORE_A08B_PREFLIGHT_READINESS.md), A08A commit-boundary evidence and [deployment plan](implementation/deployment-plan.md).

Older database/deployment documents contain historical role/hash/test-script/logging descriptions superseded by current code. Actual models/auth/services and fresh checks determine this audit. A proposed runbook is not an executed backup/native test or deployment approval.

Primary source: backend/auth/*; middleware/authMiddleware.js, roleAdmission.js, bookstoreAdmission.js, guestBookstore.js; services/accountManagement.js, bookstoreCommand.js, bookstoreGrants.js, bookstoreAccess.js, bookstoreReads.js, bookstoreOrders.js, bookstoreAliases.js, inventoryService.js, catalogService.js, guestOrders.js, bookstoreMapping.js; operational/account models; utils/accountTransaction.js/accountCommitBoundary.js/accountMutationOutcome.js; app.js/index.js/config/config.js; client bookstore/kiosk/auth/navigation/API modules; actual schema/fault/HTTP/mapping tests and accountManagementAdapter.js.

## 4. Fresh passed, failed and unperformed checks

| Executed check | Exact result | Evidence class |
| --- | --- | --- |
| Backend npm test | **812 passed,0 failed/cancelled/skipped/TODO** | Actual code/schemas/hooks with staged/mocked persistence and temporary localhost HTTP |
| Client npm test | **26 passed,0 failed/cancelled/skipped/TODO** | Modules/SSR/interceptors/controlled timers and pending identity |
| Production build | **PASS,680 modules**, Vite8.0.3 | New temporary output; main JS about771.79kB, gzip233.85kB; compilation, not deployment |
| Backend node --check | **114/114 PASS** | Source/tests excluding dependencies |
| Targeted backend lint | **28 files,0 errors,0 warnings** | B03 backend subset; Node globals/no-undef/no-unused-vars |
| Targeted frontend lint | **12 files,0 errors,0 warnings** | bookstore/kiosk/useApi |
| Full client lint | **FAIL:15 errors,12 warnings** | Itemized/provenance below |
| git diff --check | **PASS** | Existing LF/CRLF notices only |
| Direct cancellation audit probe | **1/1 defect reproduced** | Valid conditional Admin oversight cancels unpaid order; not a business-rule PASS |
| HTTP cancellation audit probe | **1/1 defect reproduced:HTTP200** | Actual token/protect/route/service, no Manager actor/payment/native DB |
| Offline dependency inventory | Both npm ls --depth=0 --offline exit0 | Installed top-level versions; six extraneous client packages |
| Native MongoDB/installed indexes/concurrent native clients | **NOT RUN / UNVERIFIED** | No authorized verified target |
| Actual accounts/backups/restore/production/payments | **NOT ACCESSED / UNVERIFIED** | No real-data or recoverability claim |

The812 include1,024 bad-auth requests:90 explicit protected methods+38 inherited HEAD, eight account/token states. They include512 canonical-role cases:128 methods times four roles. These are assertions within the suite, not additive unique test totals. Historical aggregation/population transports are staged, not native engine execution. Synthetic rows are not actual bookstore inventory. No test was skipped. Two new passing adversarial probes confirm a defect that existing812 passing tests miss; probe files were not added.

## 5. Native MongoDB readiness

| Guarantee | Current implementation | Activation evidence |
| --- | --- | --- |
| Multi-document atomicity | Primary/snapshot/majority accountTransaction; no nontransactional fallback | **BLOCKER / UNVERIFIED:** actual server/topology/transaction compatibility and rollback |
| Actor/suspension ordering | Same-transaction actor write fence, serialized realm, epoch/retry checks | Staged PASS; native conflicts/failover/ordering/load **UNVERIFIED** |
| Duplicate operations | Persistent receipts/fingerprints/replay checks; one payment/reversal per Transaction declarations | Staged PASS; installed constraints and cross-process/native races **UNVERIFIED** |
| Inventory/payment consistency | Stock exact-before CAS, movements and server-priced sale/payment/receipt/audit in same boundary | Staged competing-cashier/audit-failure PASS; native crash/concurrency guarantees **UNVERIFIED** |
| Audit persistence | Required atomic events; append-only application hooks | Native durability/privileges **UNVERIFIED**; model hooks do not restrain privileged raw DB clients |
| Commit uncertainty | Observed commit boundary, unknown-result precedence, no blind callback replay, acknowledgment reconciliation | Native error labels/network/failover/recovery **UNVERIFIED**; injected labels are not native proof |
| Installed indexes | Unique declarations below | **BLOCKER / UNVERIFIED:** no listIndexes/build/collision check |
| Startup DDL safety | Local global Mongoose autoIndex=true and autoCreate=true; ordinary connect has no explicit verified target | **BLOCKER:** ordinary startup may attempt collection/index initialization; never treat it as metadata-only preflight |

Declared unique keys include User.identifier; sparse User.phone; sparse Transaction.bookstoreReference; AccountOperationReceipt.operationId; BookstoreOperationReceipt(actorKey,operationId); BookstoreAuditEvent(actorKey,operationId,sequence); StockMovement(actorId,operationId,productId); BookstorePayment.transactionId; BookstoreSaleReversal.transactionId; BookstoreSequence(storeId,year). Historical owner/SKU and invoice/counter declarations are not automatically unique. These are schema metadata, not installed-index inventory. Nothing was created, dropped or synchronized.

Later native evidence needs an exact separately approved isolated target, actual server/topology/version/effective privileges, controlled collection/index preparation/collision inventory, competing cashiers/adjustments, duplicate completion/reversal, audit-failure abort, commit-ACK ambiguity and fresh-client recovery. Define fixture IDs/faults/stop/cleanup rules first. A test-like name or URI replicaSet option proves neither ownership nor isolation. A08B preflight remains planning, not execution authorization.

## 6. Existing accounts and historical mappings

**No actual roster or database records were accessed. Counts are unknown, not zero.** No current authoritative exported inventory was supplied for certification.

| Actual inventory required | Finding |
| --- | --- |
| Accounts by admin/store_manager/cashier/customer/user; malformed/missing roles | **UNVERIFIED**; role validators exist |
| Confirmed/active/suspended/missing-state accounts and security epochs | **UNVERIFIED** distribution; active/unconfirmed creation and approved legacy compatibility retained |
| Usable verified Administrators/current independent issuer reviews | **UNVERIFIED** identity/count; staged last-admin guards pass; emergency bootstrap is disabled |
| Legacy user exact IDs and individual review/assignment evidence | **UNVERIFIED**; no auto-conversion; D2 owner reads/self-service/write denial implemented |
| Store identities, memberships and Store creator/customer links | **UNVERIFIED** actual setup/foreign/malformed/missing mappings |
| Unmapped Product/Customer/Transaction/Invoice/DebtPayment and owners | **UNVERIFIED** counts; internal prepare/apply was not run against actual data |
| Duplicate SKU/receipt/reference/index keys | **UNVERIFIED** groups; staged planner rejects, never merges or renumbers |
| Missing/invalid cashier/processor/assignment/student references | **UNVERIFIED**; no identity guessing authorized |
| Legacy money units, stock/price anomalies and financial links | **UNVERIFIED**; centavo markers do not reinterpret old values |
| Preserved real history counts/checksums | **UNVERIFIED** without before/after inventory/backup; staged preservation tests are not real data evidence |

Manual assignment readiness is partial: audited review/apply, expected versions, membership replacement, grant invalidation and forward suspension recovery exist. Human-approved roster/mapping/unit decisions and operator evidence are absent from verified activation evidence. Adding store attribution does not resolve unknown cashier identity, money units or backup recovery. No account or actual record was changed.

## 7. Backup/recovery and loss/downtime exposure

**BLOCKER: recoverable backup/restoration evidence UNVERIFIED.** Repository documents propose backup/cutover requirements; they do not demonstrate a current operating procedure. No recoverable archive/snapshot manifest, scheduled-job result or successful restore was established from reviewed project files. This does not assert no backup exists elsewhere: providers/storage/operators were not accessed.

Unknowns: responsible owner, consistent scope across account/store/financial/audit collections, schedule/last successful backup, protected storage/access/encryption/key recovery, approved retention, integrity manifest, isolated restore compatibility, restoration duration and permissible loss/downtime. No RPO/RTO or retention duration is invented.

An isolated recovery test must verify collection counts/IDs/relations/units/indexes/roles/epochs, preserved audit/operation receipts and one financial/stock effect after interruption. Stale epoch/key restoration can revive revoked access; stale stock restoration can erase later sales. A failed HTTP response may follow a committed effect and must not trigger blind resubmission.

Staged recovery demonstrates known-abort retry and forward audited suspension with increasing epochs, **not database backup restoration**. After shared writes, removing attribution or blindly restoring an older app/database is not demonstrated rollback. Loss/downtime bounds cannot be quantified. No destructive recovery was run.

## 8. Security, approved operations and all17 criteria

### AR01: confirmed Manager-only cancellation defect

Authority: [B03 owner approvals](UPHSD_BOOKSTORE_B03_OWNER_APPROVAL_DECISIONS.md), line183 explicitly restricts unpaid cancellation to Store Manager. The preceding fulfillment approval distinguishes oversight from cancellation.

Actual path: backend/services/bookstoreOrders.js:140–152 uses order.oversee for cancelOrder. backend/auth/capabilities.js:21 permits conditional Administrator order.oversee. bookstoreCommand/bookstoreGrants accept a current bounded B02 grant; there is no cancellation-specific Store Manager floor. routes/BookstoreRoute.js dispatches POST /api/bookstore/orders/:id/cancel to that service. client/src/features/bookstore/BookstorePage.jsx:130 renders cancellation using the same oversight capability.

Reproduction: synthetic confirmed active Administrator with current epoch/membership, a different current Administrator as issuer, unexpired/unrevoked oversight grant bound to the exact pending unpaid Transaction. No Manager actor/approval exists. Direct service and authenticated localhost HTTP each cancelled the order and wrote an Administrator-attributed audit; no payment was recorded. HTTP returned200. Real protect/token/route/service code executed over staged storage; no native guarantee was inferred.

**FAIL / BLOCKER.** Oversight eligibility must not expand into the later Manager-only cancellation decision. A targeted approved correction should preserve conditional oversight, enforce Manager-only cancellation in the domain service, align the button, and regress direct/API/relevant legacy aliases with a grant-present Admin denial and zero effects while retaining Manager success. Do not remove conditional capabilities globally or alter approved paid-reversal duties as an assumed fix. No correction was performed.

### Approved financial rules versus code

| Approved rule | Current evidence/result |
| --- | --- |
| New cash/GCash only; full payment | completeOrder allowlists methods, requires paymentConfirmed and exact current total; tests reject bank/credit/partial/injected fields. **LOCAL PASS** |
| Submit unpaid without reservation/deduction | Pending submissions set unpaid/pending/amountPaid0; completion creates stock/payment/receipt effects. **LOCAL PASS** |
| Cashier rechecks current server prices/availability | pricedItems loads active unit-verified scoped Products; validates stock/quantities; quote HMAC/confirmedTotal bind current items. **LOCAL PASS** |
| Changed total confirmed before payment | Stale quote/total returns409; UI displays revised quote and requires received-payment/current-total checkbox. Human customer interaction is procedural, not independently observable by server. **LOCAL PASS; operator SOP UNVERIFIED** |
| Deduct exactly once on sale completion | Same transactional CAS/movement/order/payment/receipt/audit, replay/state guards. **STAGED PASS; native UNVERIFIED** |
| Manager refund/void approval; whole-sale reversal | Base Manager approve/apply, original whole amount, Cashier request-only. Phase15C also permits separately authorized conditional Admin approval/application, implemented and tested. **LOCAL PASS under existing conditional specification; release wording needs owner interpretation** |
| Original-method repayment; GCash refund reference | applyReversal requires repaymentConfirmed, original method, GCash reference and returned-condition confirmation. **LOCAL PASS** |
| Record confirmed refund, no transfer initiation | Internal ledger has no payment-provider transfer implementation; confirmation/reference are human assertions. **LOCAL PASS; external reconciliation SOP UNVERIFIED** |
| Restock only confirmed saleable returns | Product/quantity/duplicate/sold-limit validation; only assessed returns create movements. **STAGED PASS** |
| Manager alone cancels unpaid orders | **FAIL AR01:** conditionally authorized Admin can cancel; UI shares this incorrect boundary |
| Cancellation reason/audit, zero payment/refund/stock effect | State/reason/payment-link checks and audit present; audit probes observed no payment. **Local effects PASS; authorization FAIL** |
| Historical amounts/identity/history preserved | Snapshots and no automatic monetary/identity conversion; staged preservation PASS. **Actual records UNVERIFIED** |

No blanket Admin refund override is inferred. Phase15C explicitly allows separately authorized Admin reversal duties; the unpaid-cancellation decision explicitly says only Manager. Before enabling conditional financial grants, record the owner's release interpretation of this checklist's Manager wording versus that existing reversal exception. This audit changes neither policy and does not invent an unpaid-cancellation exception.

Cash/GCash verification is manual cashier confirmation, not gateway settlement verification. This matches approved no-transfer scope; operating/reconciliation evidence remains necessary. Transaction idempotency does not independently settle cross-sale reuse of an external reference; no reference-uniqueness business rule is invented.

### All17 canonical RBAC criteria: current audit disposition

| ID | Current local evidence | Activation disposition |
| --- | --- | --- |
| RB01 | Role/schema/legacy/manual-review regressions PASS |Actual roster/mapping **UNVERIFIED** |
| RB02 |128-method/four-role and1,024 bad-auth cases PASS; grant-present cancellation denial missing and audit probes contradict policy |**PARTIAL / BLOCKER AR01** |
| RB03 | Persisted role, strict JWT lifetime/epochs regressions PASS |Local logic READY; signing-secret exposure/deployed key state **BLOCKER** |
| RB04 | Admin-only account/grant/field-injection regressions PASS |Actual Admin/issuer legitimacy **UNVERIFIED** |
| RB05 | Canonical self-delete/last-active-admin regressions PASS |Actual last-admin inventory/recovery **UNVERIFIED** |
| RB06 | Store/subject/cashier/receipt scopes PASS locally |Actual mappings/orphans/native queries **UNVERIFIED** |
| RB07 | Admin pricing, protected fields/response filtering PASS locally |Actual data/deployed revision **UNVERIFIED** |
| RB08 | Approved adjustment, reason/movement/CAS/replay/audit rollback staged PASS |Native stock concurrency/index/durability **UNVERIFIED / BLOCKER** |
| RB09 | Approved Manager-only cancellation fails for conditional Admin |**FAIL / BLOCKER AR01** |
| RB10 | Server price/state/full-payment/duplicate-effect staged PASS |Native exact effects/crash/reconciliation **UNVERIFIED** |
| RB11 | Guest/student proof/privacy/reset/expiry tests PASS locally |Public-store/limiter/proxy/kiosk activation **UNVERIFIED** |
| RB12 | Base and bounded conditional price/history/stock/reversal tests PASS |Owner release interpretation/actual grants **WARNING / UNVERIFIED** |
| RB13 | Actor fence/suspension/retry staged PASS |Native ordering/load **UNVERIFIED** |
| RB14 | Synthetic commit/retry/cleanup regressions PASS |Native protocol/fault/recovery **UNVERIFIED** |
| RB15 | Context/resource-bound navigation/session/identity tests PASS; cancellation button inherits oversight mismatch |**PARTIAL / BLOCKER AR01**; production browser/error/print coverage incomplete |
| RB16 | Five exact-ID/preservation/digest/forward-recovery rehearsals PASS |Actual mapping/backup restoration **UNVERIFIED / BLOCKER** |
| RB17 | Atomic/redacted/append-only application audit tests PASS |Native durable audit/index/privileges **UNVERIFIED / BLOCKER** |

Previous local acceptance tables remain historical. New RB09 evidence prevents an all17 activation PASS irrespective of the passing suite count.

## 9. Lint, dependencies and environment

### All remaining client lint findings

Paths under client/src; E=errors, W=warnings. Results are fresh.

| File | Lines | E/W | Finding |
| --- | --- | --- | --- |
| features/auth/components/PasswordChangeModal.jsx |18 |1/0 |Synchronous effect state |
| features/auth/components/ProfileCard.jsx |15 |1/0 |Synchronous effect state |
| features/auth/components/SecurityCard.jsx |32 |1/0 |Synchronous effect state |
| features/auth/components/UserModal.jsx |29 |1/0 |Synchronous effect state |
| features/financials/pages/ExpensePage.jsx |19 |0/1 |Missing loadExpenses dependency |
| features/financials/pages/FinancialPage.jsx |19,23 |0/2 |Missing summary/revenue dependencies |
| features/invoices/pages/InvoicePage.jsx |31 |0/1 |Missing loadInvoices dependency |
| features/orders/components/AddOrderModal.jsx |24,27 |1/1 |Missing data dependencies; effect state |
| features/orders/components/UpdateOrderModal.jsx |34,51 |1/1 |Effect state; missing data dependencies |
| features/orders/pages/OrdersPage.jsx |56 |0/1 |Missing loadOrders dependency |
| features/orders/pages/PosPage.jsx |53 |0/1 |Missing load dependency |
| features/people/components/PersonCard.jsx |10 |1/0 |Unused loading |
| features/people/pages/PersonPage.jsx |40,41,136,137 |2/2 |Effect state; missing load dependencies |
| features/products/components/ActiveProductsModal.jsx |14,15 |1/1 |Hook immutability/declaration-order; missing loadProducts dependency |
| features/products/pages/ProductPage.jsx |31,32 |1/1 |Effect state; missing load dependency |
| shared/components/Layout.jsx |128,137 |2/0 |Effect state |
| shared/hooks/AuthContext.jsx |111 |1/0 |Mixed exports/fast-refresh |
| shared/utils/useServerReady.js |17 |1/0 |Unused err |
| **Total** | |**15/12** |Full lint FAIL |

Provenance: each currently failing/warning file's Git HEAD source was linted in memory with the same installed configuration. Every current rule/count signature already occurs there; no increased rule/count signature was found in these files. New B03 subset is clean. This supports inherited debt, not exact attribution of every uncommitted line to a phase. Prior16/13 totals remain historical. No rule was disabled or code fixed. A lint finding alone proves neither a privilege exploit nor a runtime crash; appropriate owner release-quality disposition remains necessary and does not excuse AR01.

Tooling: Node24.14.0/npm11.9.0. Backend installed top-level versions include Mongoose9.3.3, MongoDB7.1.1, Express5.2.1, jsonwebtoken9.0.3, bcryptjs3.0.3. Client includes React19.2.4, Vite8.0.3, Axios1.13.6, React Router7.13.2. Both offline npm ls calls exit0; six extraneous client packages are listed. Many first-party additions and manifests/lockfiles are already dirty/untracked. Git HEAD2e9942e, dated2026-08-26, is not the audited B01–B03 working-tree snapshot.

**WARNING:** clean npm ci, lifecycle-script review, fresh authoritative advisory scan, approved dependency provenance/SBOM and clean deployment-runner reproduction were not performed. Installed versions/build success do not establish vulnerability absence. No network package installation/audit fix/update ran. A versioned reviewed release artifact is required; deploying old HEAD would not deploy the tested snapshot.

### Configuration and secrets

- **AR02 — BLOCKER:** local git ls-files and privately parsed HEAD:backend/.env confirm committed nonempty MONGO_URI, MONGO_PASS and JWT_SECRET. The local signing secret equals the committed secret. No value, URI, password, token or secret fingerprint is published here. Deployed use/exposure extent is unknown; this is not a claim of a proven production breach or completed rotation. If used in deployment, owner-controlled containment/rotation/session/cutover handling and history disposition are required. Adding an ignore rule does not remove Git history. No secret was changed.
- client/.env is also tracked despite the current ignore rule. The inspected file contains VITE_API_URL only; a public API base is not itself a server credential. Its configured destination is remote HTTPS. No request was made. Correct deployed base/path/CORS ownership remains unverified.
- **AR03 — BLOCKER:** MongoDB's installed parser accepts the local URI but confirms no explicit database pathname. MongoClient construction without connect selects the driver's default database. Generic web URL parsing was not used as a MongoDB validity verdict. connectDB has no explicit database override/verified-target guard. No URI was connected.
- index.js fixes port5000 and starts listening before connectDB completes; PORT is not consumed. Health returns503 until connected and pings only when invoked. Hosting routing/port/drain/readiness/failure behavior remains unverified. No health request was made.
- CORS hardcodes localhost development and existing ServeFlow frontend origins. Exact bookstore deployment origin, TLS, security headers, proxy trust, network restrictions, private secret storage and effective DB permissions were not verified.
- Local backend environment lacks BOOKSTORE_PUBLIC_STORE_ID, BOOKSTORE_GUEST_RATE_LIMIT and BOOKSTORE_GUEST_WINDOW_MS. Missing/invalid settings safely produce503: fail-closed, not configured production readiness. Provider environment may differ and was not accessed.
- Guest buckets are per-process/per-IP, with no verified distributed/proxy deployment. Proxy IP grouping or per-worker budgets require ingress testing. Login throttling/edge abuse controls are not established by guest limiting.
- Local Mongoose autoCreate/autoIndex=true means normal startup is not metadata-only preflight; control actual DDL/privileges/collisions separately.
- Browser-accessible JWT storage is preserved approved design, not redesigned here. Production XSS/header/TLS/shared-kiosk/incident controls need verification; no hypothetical exploit is claimed.

JWT_SECRET also participates in operation fingerprints and deterministic account-command identities. Rotation planning must preserve uncertain-operation evidence/reconciliation; do not bypass idempotency or repeat payments under new identities to avoid changed fingerprints.

## 10. Blocker register and risk assessment

READY means sufficient evidence only for the stated local check. WARNING requires owner review/disposition, not unattended activation. BLOCKER means production must not proceed.

| ID | Classification/severity | Finding/evidence | Required closure |
| --- | --- | --- | --- |
| AR01 |**BLOCKER / high** |Manager-only cancellation bypass via conditional Admin oversight; service+HTTP reproduced; UI shares capability |Approved narrow domain/UI correction, grant-present direct/API/alias denial with zero effects, Manager positive regression/review |
| AR02 |**BLOCKER / critical if deployed** |Backend secrets tracked; local signing material matches HEAD |Owner-controlled incident/rotation/session/operation-identity plan, private storage and approved history/deployment disposition; no exposed secrets in evidence |
| AR03 |**BLOCKER / high** |Implicit DB selection/no verified-target guard |Explicit approved database/environment/target and guarded settings; no implicit default or accidental production test routing |
| AR04 |**BLOCKER / high** |Native transactions/commit/concurrency/audit/index/privileges unverified; autoDDL defaults true |Separately approved isolated target/harness/results; installed constraints/collisions/effective permissions; controlled DDL |
| AR05 |**BLOCKER / high** |Actual admin/legacy/membership/history/unit/cashier inventory unknown |Owner-reviewed exact IDs/counts, mapping and anomaly disposition; preserved hashes/confirmation/history; controlled actual mapping evidence |
| AR06 |**BLOCKER / critical operational** |Recoverable backup/restoration/loss/downtime evidence absent from verified record |Named procedure/owner, protected backup, successful isolated restore manifest and approved RPO/RTO/recovery handling |
| AR07 |**BLOCKER / high** |Production TLS/network/CORS/port/readiness/guest-store/limiter/proxy/abuse controls unverified |Actual intended configuration and staged smoke/load/security/guest evidence, monitoring/operator responsibility |
| AR08 |**BLOCKER / high** |No approved immutable tested artifact/cutover/reconciliation/recovery signoff; extensive dirty/untracked code differs from HEAD |Reviewed versioned artifact, controlled install/config/index/data sequencing, writer quiescence, unknown-operation reconciliation, manifests, stop/recovery runbook and explicit activation approval |
| AW01 |**WARNING / medium** |Inherited full lint15errors/12warnings; B03 subset clean |Approved specific fixes or documented release-quality disposition; no audit remediation |
| AW02 |**WARNING / medium** |Six extraneous client packages; clean install/advisory/provenance unverified |Clean isolated reproducible dependency/build/runtime/advisory evidence before release-artifact signoff |
| AW03 |**WARNING / high policy/operations** |Manager reversal checklist wording versus Phase15C conditional Admin exception; manual external payment verification |Owner release interpretation without expanding cancellation; approved cash/GCash confirmation/reconciliation procedure |
| AW04 |**WARNING / medium** |Production-like browser/print/forged-cache/session-error/kiosk/accessibility/load coverage incomplete |Targeted staged tests, without UI redesign or real charges |
| R01 |**READY — local only** |812backend/26client/114syntax/build680/targeted lint PASS |Retain evidence; does not close blockers |
| R02 |**READY — local only** |Current-account/token/field/scope/redaction/grant/replay supporting tests PASS |Preserve B01/B02 protections during approved correction |
| R03 |**READY — audit boundary** |No native/production/account/payment/migration/deployment/runtime modification |Maintain restrictions until separately authorized |

Primary risks: demonstrated unauthorized cancellation; token forgery/DB exposure if committed material is deployed (applicability unknown); wrong-database activation from implicit selection; duplicate/partial/lost financial or stock effects under unverified native behavior; disclosure from incorrect actual shared mappings; and unbounded loss/downtime without proven restoration. No numerical probability/loss estimate is invented. Mocked passes do not reduce these to production READY WITH LIMITATIONS.

## 11. Recommended order — proposals, not execution authorization

1. **Contain/freeze:** retain baseline/evidence; do not start against the configured URI or activate public ordering. Obtain approval for AR01's narrow local correction/regression/review. Preserve conditional oversight and paid-reversal rules; do not rebuild B01–B03.
2. **Secrets/target controls:** under separate authorization, prepare credential-containment/history/rotation/session/operation-identity plan; verify private settings and explicit database selection. No production key change or history rewrite is authorized now.
3. **Inventory/recovery prerequisites:** obtain authorized account/store/resource/index metadata and exact mapping/unit/cashier decisions. Establish a protected consistent backup and demonstrate isolated restoration before actual data/index cutover.
4. **Native verification:** approve exact disposable target/credentials/privileges/harness/fault/cleanup scope with no production/default fallback. Verify concurrency, stock/payment/refund/audit atomicity, unique constraints, native commit ambiguity and recovery. Do not infer A08B execution permission from this audit.
5. **Release qualification:** prepare immutable reviewed artifact and clean reproducible dependency/runtime checks; resolve/disposition lint; verify intended HTTPS/CORS/port/readiness/secrets/guest/limiter/proxy/monitoring and payment SOPs. Run staged browser/print/kiosk/error checks, not real transactions.
6. **Controlled cutover review:** quiesce affected writers; reconcile unknown receipts; preserve pre/post manifests and backup; execute only separately authorized mappings/indexes; apply approved monotonic-epoch reauthentication; verify scopes/stock/financial/audit relations; rehearse stop/recovery. Obtain explicit owner activation approval after all blockers close.

These recommendations create no implementation phase and authorize no remediation, native write, credential/account change or deployment. Production remains NOT READY even if one local fix passes.

## 12. Preservation and stop

Authorized deliverables: this report and an additive/current audit-status entry in docs/UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md. Previous B01–B03 reports/contracts/decisions remain unchanged. Final content-hash preservation verification is recorded below; no runtime/config/environment/test/lockfile edit is part of this audit.

**Final verdict: NOT READY. Freeze B01/B02 as accepted local foundations and B03 pending the specific approved cancellation correction. Native/data/backup/security/environment/cutover evidence remains required. Stop after audit. Obtain explicit approval before remediation or production activation.**

Preservation verification completed: **202 baseline backend/client first-party files and202 final files;0 changed/removed;0 added.** Source, tests, environment, manifests and lockfiles match their pre-audit content hashes. Dependency/build caches were excluded. Only the audit document and roadmap were authored. Documentation links/fences and final git diff --check pass; existing line-ending notices remain.
