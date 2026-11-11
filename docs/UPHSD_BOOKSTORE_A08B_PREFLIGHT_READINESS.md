# UPHSD Bookstore POS — A08B preflight readiness

Date: 2026-11-03, Asia/Manila. **Final recommendation: BLOCKED PENDING EVIDENCE.**

This is local inspection and planning only. No target identity, isolation or effective test privileges can be established from the available repository evidence. No native integration runner with an approved target guard/lifecycle was found. A08B has not started and is not approved. Readiness, if later established, will still require separate execution authorization.

## 1. Evidence and scope

Reviewed the [A08A results](UPHSD_BOOKSTORE_A08A_FAULT_HANDLING_RESULTS.md), [R1 review](UPHSD_BOOKSTORE_A08A_R1_REVIEW.md), [R2 results](UPHSD_BOOKSTORE_A08A_R2_COMMIT_REPLAY_FIX_RESULTS.md), [independent R2 review](UPHSD_BOOKSTORE_A08A_R2_INDEPENDENT_REVIEW.md), [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md), relevant A04–A07 reports and [A01 local verification history](UPHSD_BOOKSTORE_PHASE_10A01_VERIFICATION_RESULTS.md). Prior conclusions remain historical evidence, not newly obtained live facts.

Local source inspected: backend/package.json; config/config.js; accountCommitBoundary.js; adminAccountMutation.js and accountMutationOutcome.js as established by R2 review; commitReplay.test.js, other test connection stubs and fixture references; repository file inventory for native integration configuration/manifests. The normal seed/startup paths are identified from source/history, not executed.

No environment-file contents, credentials, production accounts, provider state or database records were inspected. No dependencies, configurations, source or tests changed. No unit suite was rerun: the latest independent review already records129 backend and16 client passes, build/syntax/targeted-lint passes and client lint16 errors/13 warnings. Those are **historical verified local results**, not fresh preflight executions or native evidence. Only this report and an additive plan entry are delivered.

## 2. Disposable target and selection

| Question | Local evidence | Status |
| --- | --- | --- |
| Dedicated A08B database/instance name | No confirmed name/namespace or environment ownership supplied. Documentation requests identifiers but does not confirm them | **UNVERIFIED — target gate BLOCKED** |
| Application connection selection | config/config.js passes process.env.MONGO_URI directly to mongoose.connect; no dbName option | **PASS: source selection identified**, not target safety |
| Default database risk | A01 previously established that the then-inspected local URI omitted an application database and the driver defaulted to test. It also established that test is not a confirmed bookstore database. No current URI was read/reparsed here | **UNVERIFIED current target; fallback unsafe to assume disposable** |
| Existing test selection | npm test invokes Node tests; commitReplay uses synthetic sessions/wire operations, and connection stubs forbid real connections | **PASS: mocked suite distinguished from integration** |
| Native integration target selector/guard | No dedicated native runner, independent explicit target settings, allowlist/ownership check or approved startup manifest found | **FAIL: readiness control missing**, not a defect in the mock tests |
| Startup/cleanup script | No approved native fixture/reset/cleanup implementation found. Current start/dev launch the ordinary application; the separate seed utility is not a test initializer | **UNVERIFIED lifecycle; do not run these commands for A08B** |
| Development/shared/staging/production routing | MONGO_URI is not tied by local code to a disposable environment; provider/process settings may differ from workstation settings | **UNVERIFIED; potentially any environment** |

A database name containing test, a localhost address, authSource, client application label or successful login would not establish disposability or ownership. Do not repoint the mock suite by setting the normal application URI and assume it becomes an integration harness. Do not run normal app startup, seeds or resets as preflight checks.

**Required future harness design, not implemented:** require explicit approved target/namespace and connection input separate from normal app fallback; reject missing/implicit database selection; match operator-approved nonsecret environment/endpoint/database metadata before any connection; do not load production configuration as a default. An initial future authorized connection must be metadata-only, with no auto-create/index/sync/seed/setup before identity/topology/permission checks pass. Offline evidence is needed first; if identity differs, disconnect and stop before writes.

Connection strings must remain in an approved secret channel. Target selection can be checked without printing them: privately compare parsed selection to the approved nonsecret manifest and return only match/reject plus permitted redacted identity metadata. Do not publish URI fingerprints or options containing credentials. No such parser/harness was added or executed here.

## 3. Isolation and lifecycle requirements

All environment requirements below remain **UNVERIFIED** until an authorized operator supplies evidence. The preferred planning shape is an operator-owned disposable nonproduction instance/replica-set environment, or a dedicated test database with proven boundaries. No particular host, provider, cluster or database name is proposed as an existing resource.

| Requirement | Evidence required before execution |
| --- | --- |
| Data separation | Operator-approved target manifest; ownership; confirmation no real/shared bookstore or other users' records; whether instance or database is dedicated |
| Transaction topology | Actual server version/topology, session/transaction capability and intended driver versions. Existing sessions in financial code do not prove support |
| Network boundary | Restricted reachable endpoints and routes; any proxy confined to this test connection; no production route/secret inheritance. Localhost/container placement alone is insufficient |
| Credential boundary | Dedicated test identity, target/resource restrictions and direct/inherited/custom effective grants; no reuse of application/production/A01 identity |
| Controlled creation | Explicit fixture collections/indexes and setup authority; account for Mongoose autoCreate/autoIndex behavior before importing/initializing native models. Provisioning or disabling auto setup is a future reviewed harness choice, not a current configuration change |
| Controlled run | Fixed approved matrix, bounded duration/retry expectations, fixture/run manifest and stop conditions; no public account registration/production account dependency |
| Reset/cleanup | Exact IDs/namespaces created by this run, dependency order, expected counts and recovery procedure; no unfiltered deleteMany/drop/reset against an inferred database |
| Recovery/teardown | Stop faults first, close sessions/clients, restore observers/proxies, inspect uncertain outcomes before cleanup, preserve sanitized evidence. Operator disposes instance only under explicit authorization |

**Cleanup rule C (used throughout the matrix):** keep a local run manifest of exact test-created IDs, collection resources and dependencies; do not add schema fields merely for tagging. Use approved existing fixture identifiers where applicable. Revalidate target identity and manifest before deleting only those resources. Unknown commit outcomes require an authorized inspection from a fresh client before deciding which fixture IDs exist. Missing manifest, unexpected records, target mismatch, unexplained counts or inability to restore a fault stops automated cleanup and transfers recovery to the operator. No database/collection drop, index change, user deletion or blanket reset is implied by C.

A dedicated database alone does not make cluster-wide failpoints, restarts or network disruption safe. Those require a separately disposable server boundary and specific permission. No cleanup/data-changing command is supplied for execution in this report.

## 4. Minimum permissions and effective-grant evidence

**Current effective permissions: UNVERIFIED.** No identity or permission export for an A08B target is present. A role name alone, including readWrite, is not an effective privilege review. A01's proposed read-only identity cannot authorize this phase.

Proposed least-privilege capabilities, subject to operator mapping to the actual server version:

| Purpose | Candidate capabilities / boundary |
| --- | --- |
| Account test operations/assertions | find/insert/update/remove on only approved synthetic fixture collections in the exact disposable database; no access to production or unrelated namespaces |
| Target/topology checks | Only metadata necessary to verify database/collections, server/topology and identity. listCollections/listIndexes only if the approved checks require them; do not grant broad data/admin access merely to ease discovery |
| Collections/index setup | Prefer operator-prepared resources. createCollection/createIndex permissions only if explicitly needed/approved for the manifest. Model initialization must not silently build indexes beyond this scope |
| Cleanup | remove on manifested fixture resources; collection/database/index dropping excluded unless separately justified and authorized |
| Transactions/sessions | Operator verifies the installed version's required actions for sessions and commit/abort with these collection privileges; do not invent a universal standalone transaction role or assume cluster administration is required |
| Fault mechanisms | Application-local synthetic failures need no server-admin grant. Any supported failpoint/server control must use a separate operator identity on the disposable instance only; never silently elevate the test application's identity |

This is a capability proposal, **not a finalized MongoDB role definition**. Before connecting, the database/security administrator must provide a recent redacted grant record: identity alias, exact environment/database/resource scope, all direct/inherited/custom roles, resolved actions and restrictions, review timestamp and approver. Supply equivalent operator-verifiable evidence for managed/provider restrictions. No passwords, access tokens, hashes or URIs are needed in the report.

Offline review can check the presented record against the manifest; it cannot independently prove live grants are unchanged. The separately authorized future runner must verify that the actual session matches the approved identity/scope before setup/writes. If metadata needed for this cannot be obtained safely, stop and let the operator perform verification; do not add broad permissions automatically.

## 5. Proposed bounded native matrix — NOT EXECUTED

Common preconditions P: all target/isolation/permission/harness gates passed; synthetic accounts only; approved versions and transaction-capable topology; expected schema/index setup; private fixture credentials; no raw token/hash/account dumps in evidence. Record run IDs, callback/fence/commit-attempt counts separately from durable effects. Check durable role/epoch/stock/payment changes from a fresh client after settlement, not merely from an in-memory document or a failed HTTP response.

Each case uses cleanup C. No counts assume exactly-once network delivery. Deterministic application-injected errors around native operations must be labelled **hybrid**; arbitrary attached error labels do not prove a server can emit them. Unsupported or unapproved fault methods are BLOCKED/NOT RUN, never fabricated as passing.

| ID / preconditions | Proposed injection or stimulus | Expected outcome and assertions/counts | Cleanup | Isolation/safety and extra authorization |
| --- | --- | --- | --- | --- |
| N01 — P; normal administrator and target | No fault; actual create/update/delete transactions on manifested fixtures | Acknowledged200/201; target callback1 and fence1 per operation; one durable intended effect; correct target epoch and bcrypt login where relevant; no unintended actor epoch increment | C; preserve necessary target until all dependent assertions finish | Suitable for isolated target after ordinary write approval |
| N02 — P; controlled abort before commit | Operator-approved, supported transient-abort fault; if unavailable, hybrid callback exception with native abort, explicitly distinguished | Under actual driver contract retry may occur; for one planned abort and recovery expect target callback2/fence2, only one committed target effect. Capture actual labels and abort evidence; no assumed success if server never confirms retry eligibility | C after observing aborted and successful states | Requires approved safe transient-fault method; no forged native guarantee |
| N03 — P; actor/target available through independent clients | Pause an attempt before fence/write; second client commits actor demotion/reset/unconfirmation; resume. Also test valid transaction-first ordering | Revocation-first:401, no later target effect; safe retry repeats original actor predicate. Fence-first: transaction may commit before revocation commits. Record barriers and committed order; do not assert cancellation when demotion merely starts | C for all fixture actors/targets; never reset a live epoch | Safe synthetic concurrent writes only; independent-client matrix needs explicit approval |
| N04 — P; actual commit result cannot initially be established | Approved connection-specific acknowledgement-loss mechanism around commit; establish whether dispatch occurred; fresh-client observation | Indeterminate500/retryable false if no acknowledgement is recovered; target work must not replay due to uncertainty. Durable effect may be0 or1; neither response failure nor a missing ACK proves rollback. Driver may retry same-transaction commit | C only after outcome inspection; retain uncertain run manifest | Network fault permission required; never a shared/production network interruption |
| N05 — P; same transaction acknowledgement retry supported | One approved transient acknowledgement loss followed by recovery; hybrid variant may inject unknown error after a real commit but is not a native error-label test | Driver may make multiple commit attempts, target callback/fence stays1, durable target effect1 after acknowledged recovery. Record transaction identity and actual attempts; do not count commits as effects | C; restore connection/fault before inspection | Same-transaction protocol/deduplication remains a native question; no fixed fabricated native labels |
| N06 — P; R1 compound boundary | Repeat code50 + unknown/transient input at commit boundary using reviewed hybrid hook around native work; native failpoint only if operator confirms support and safe semantics | Both R1 variants must block second target/fence: callback1/fence1; indeterminate with original cause. Driver may enter/abort an empty retry. Measure durable effect independently. Synthetic compound input is not proof of real-server reachability | C after restoring hook/failpoint | Hybrid and native results reported separately. No server failpoint on shared/managed production infrastructure |
| N07 — P; actual unknown→definitive abort/ACK transitions supported | Approved fault sequence returning uncertainty then a legitimate protocol-defined resolution | ACK: no target replay. Confirmed transient-only abort: driver-permitted retry can execute again, one successful durable effect. Compound unknown cannot itself be treated as confirmed abort. Count actual callbacks/attempts; assess the real resolution signal rather than assuming fixture behavior | C only after unambiguous inspection | Version/server-dependent; BLOCKED if a safe truthful sequence cannot be produced |
| N08 — P; commit acknowledged | Application-local endSession/observer-cleanup exception after native success | Success remains success; intended effect1, target callback1; fixed diagnostic only; original method restored where possible; close real session/client separately after injected failure | Restore injected function first, then real cleanup and C | Hybrid cleanup test; proves application outcome handling, not a native resource failure |
| N09 — P; known primary rejection or unknown commit | Inject cleanup failure after the primary event; include abort failure only under reviewed native/hybrid method | Primary error/cause remains; unknown stays indeterminate, no unsafe replay. Confirm whether any effect committed independently; no raw details in response/logs | Restore faults; inspect uncertainty; C | Application hybrid is bounded; native abort failure requires additional operator-approved method |
| N10 — P; timeout/retry policy documented | Approved connection-local repeated transient/unknown faults until configured deadline; separately test unobservable session/unsupported transaction target without setup writes | Finite driver/API termination under actual configured limits; no outer HTTP replay; indeterminate if commit unresolved; no fallback write on unsupported sessions. Count attempts and elapsed time; don't assume the default retry window bounds a hung individual command | Stop fault generator; close clients; inspect any dispatched commit then C | Duration, cancellation and fault budget must be approved; no topology conversion or server restart implied |
| N11 — P; synthetic login fixture | Issue real login tokens, test valid/missing/expired/overlong/signature/version cases; security changes through native saves | Seven-day contract and backend current-account checks unchanged; stale token rejected after password/reset/role/confirmation change. Exactly one durable epoch advance per accepted security change; lookup failure fails closed | C; keep fixture passwords/tokens private; no hashes in evidence | Clock/expiry injection must affect test process only; no host/production clock change |
| N12 — P; synthetic actor and peer accounts | Canonical/uppercase/mixed-case self-delete, malformed IDs, authorized peer deletion | Self/malformed rejection with zero deletion calls/effects and no transaction/fence on blocked path; valid peer delete follows guarded transaction exactly once when acknowledged | C for remaining peers; compare manifest to surviving IDs | No production identities; test observable absence of side effects |

### Optional financial/inventory characterization subset — separate inclusion approval

These scenarios provide evidence only; they must not become hidden remediation or a demand to change business policy. P and C apply. Fixture values/counts are defined in the approved test plan, not inferred from production.

| ID / preconditions | Stimulus and fault | Expected characterization/assertions | Cleanup | Safety/approval |
| --- | --- | --- | --- | --- |
| F01 — synthetic stock fixture | Repeat the same adjustment request, including lost response if approved | Record two requests versus durable deltas; current absence of request identity may apply twice. Do not label two legitimate adjustments duplicates without an approved business identity rule | C, using fresh stock reads before removal | Isolated CRUD only; separate financial/inventory test scope |
| F02 — two clients, known initial stock | Barrier both read/modify/save paths; optionally contend with a synthetic sale | Record both acknowledgements and final quantity; detect lost delta/stale overwrite. Real database scheduling is evidence, not presumed from old mocks | C after all writers stop | Explicit concurrent stock/sale write scope |
| F03 — manifested catalog | Fault between bulk disable and selective enable | Inspect partial active state and500 classification; do not automatically compensate or infer atomicity | Restore fault, record all manifested flags, C | Bounded collection scope; no real customer-facing catalog |
| F04 — synthetic sale/customer with balance | Repeat a partial-payment request with sufficient balance | Count request identities, payments and balance movements; current code can apply another request. No invented refund/merge/reversal to make test pass | C in dependency order after reading durable totals | Business identity/deduplication remains a future approved decision |
| F05 — synthetic financial transaction | Approved commit-ACK/abort/endSession fault, plus post-commit population failure | Record original versus surfaced error and durable effects; existing financial paths may mask outcomes. Failed response is not rollback evidence; no auto-resubmit | Resolve uncertainty, restore hooks, C | Native network faults separately approved; hybrid failures labelled accordingly |

No test should count a risky characterization as a security acceptance pass. Preserve the observed failure as evidence and stop at its approved boundary.

## 6. Five deferred risks remain open

| Risk | Evidence A08B could provide | What it cannot establish/authorize | Disposition |
| --- | --- | --- | --- |
| Repeated stock adjustments | Native count of effects after replay/lost response | Whether two requests represent the same business adjustment; a stock ledger/idempotency policy | Deferred; separate design/implementation approval |
| Lost concurrent adjustments | Independent-client lost-update or sale contention evidence | Correctness for every schedule, nor an approved new stock algorithm | Deferred; separate concurrency correction approval |
| Partial activation | Actual persisted state when second write fails | A compensation policy or automatic reset of catalog state | Deferred; separate atomicity/failure-handling approval |
| Payment resubmission | Durable balance/payment records per request | Whether payments should be merged, refunded or treated as distinct; accounting policy | Deferred; business/API/data-design approval required |
| Financial error masking | Native/hybrid outcome versus surfaced commit/abort/cleanup error | That every failure rolled back, or authority to rewrite settlement/refund flows | Deferred; separate financial lifecycle implementation scope |

R2 is account-scoped and addresses none of these five. Existing invoice/counter uniqueness, unchecked void restoration, expense resubmission and broader recovery risks also remain separately scoped. Characterization does not approve remediation or production readiness.

## 7. Evidence owners and gates

Role titles below specify responsibility, not invented named administrators or newly assigned permissions.

| Missing evidence | Authorized supplier |
| --- | --- |
| Exact disposable target/namespace, ownership and separation from real data | Test-environment owner with bookstore/project owner attestation |
| Server version/topology, network restrictions and supported fault facilities | Authorized database/infrastructure administrator |
| Effective direct/inherited/custom grants and identity binding | Database/security administrator, with provider administrator where applicable |
| Fixture resources/indexes, reviewed fail-closed native runner, stop/cleanup/recovery procedure | Development/QA maintainer; reviewed by environment owner/security administrator |
| Approved cases, permitted disruption/duration and synthetic write/cleanup scope | Project owner and environment owner; business owner for financial scenario interpretation |
| Execution authorization | User/project authority explicitly authorizing A08B after evidence review |

| Gate | PASS / FAIL / UNVERIFIED | Readiness consequence |
| --- | --- | --- |
| R2 local review and both R1 regressions | **PASS — historical independent evidence** | Supports planning, not native verification |
| Local backend129/client16, build/syntax/targeted lint | **PASS — historical results, not rerun** | No fabricated fresh result |
| Client-wide lint | **FAIL — historical16 errors/13 warnings** | Open quality/release issue; no fix attempted; not by itself a reason to touch unrelated UI |
| Explicit disposable target/environment/database | **UNVERIFIED** | **BLOCKED** |
| Nonproduction/data/network isolation | **UNVERIFIED** | **BLOCKED** |
| Effective approved test permissions | **UNVERIFIED** | **BLOCKED** |
| Native runner with pre-write fail-closed target guard | **FAIL — implementation/evidence absent** | **BLOCKED**; future harness work needs authorization before native execution |
| Topology/server/driver compatibility | **UNVERIFIED native server** | **BLOCKED** for selecting native cases |
| Approved fixture/index setup and cleanup lifecycle | **UNVERIFIED** | **BLOCKED** |
| Fault support and bounded native matrix approval | **UNVERIFIED** | **BLOCKED**; unsupported cases must remain NOT RUN |
| Five financial/inventory risks tracked | **PASS for tracking; risks still open** | No implied remediation; optional characterization needs explicit inclusion |
| A08B execution authorization | **UNVERIFIED / not granted in this task** | **BLOCKED** |
| Preflight boundary | **PASS** | Only local reading/documentation; no connection or integration execution |

**Final recommendation: BLOCKED PENDING EVIDENCE.** No safe disposable target or effective permissions can be inferred locally. Obtain the nonsecret evidence, approve the bounded harness/matrix/lifecycle, then request separate execution authorization. Missing native results are A08B's purpose, not a circular prerequisite; missing isolation/permissions/guard/cleanup controls are genuine pre-execution blockers.

No integration command, connection attempt, fixture creation, fault activation or cleanup follows from this plan. A01 production verification and production rollout remain separate gates. **Stop for explicit review and approval; readiness is not authorization.**
