# UPHSD Bookstore POS — A08A-R1 independent local review

Date: 2026-11-02, Asia/Manila. **Assessment: FAIL. A08B is not cleared to begin as the next accepted phase.**

The account cleanup correction and ordinary indeterminate-response paths pass local verification, as do the existing JWT, token-version, administrator and ObjectId protections. The unchanged suites pass111 backend and16 client tests. However, two supplemental negative acceptance probes reproduce the same **commit-phase compound-label callback replay** outside the31 new regressions. The application can report success after invoking the target callback twice in that injected sequence. That defeats the strongest conservative no-replay acceptance criterion under the tested fault input. Real-server reachability and actual duplicate durable effects remain unverified.

Financial/inventory review also confirms important existing resubmission, lost-update, partial-completion and outcome-handling risks. They were not introduced by A08A and were not corrected in this read-only phase. Green existing suites do not establish production readiness or negate the new negative probe.

Only this new report and an additive implementation-plan entry are delivered. No application/test edit, external service/database connection, migration, account/session/credential/permission action, deployment, environment/lockfile change or dependency installation occurred. All probes used process-local synthetic state. A01 remains blocked.

## 1. Method and evidence boundaries

Reviewed the [A08A results](UPHSD_BOOKSTORE_A08A_FAULT_HANDLING_RESULTS.md), [A07 verification](UPHSD_BOOKSTORE_A07_SECURITY_VERIFICATION.md), [A06 ObjectId results](UPHSD_BOOKSTORE_A06_OBJECTID_SECURITY_FIX_RESULTS.md) and [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md). Traced actual account save/controller/error/cleanup paths and their regression fixtures, installed MongoDB7.1.1 transaction/commit control flow, financial routes/controllers/models, inventory updates and client account APIs/hooks.

Reran existing suites, build, syntax and lint checks without editing them. Additional probes ran from stdin only; no permanent test file was added or changed. They exercised actual controller/Mongoose code and, for the compound-label case, installed driver control flow with session/wire/database operations substituted. **None is a real MongoDB concurrency, protocol-conformance, rollback or durability test.**

## 2. Verification matrix

| Requested control | Result and evidence |
| --- | --- |
| Cleanup preserves successful results and primary errors | **PASS locally.** Account helper awaits/catches endSession separately; acknowledged update remains200, rejection identity/404 survives, diagnostics are constant. Existing accountFaults tests verify these behaviors |
| Indeterminate account writes are not presented as safe retries | **PASS for the normal surfaced-error paths; incomplete at commit replay boundary.** Trusted errors produce500 plus operationOutcome indeterminate and retryable false; standalone saves do not retry. F01 can be consumed/replayed internally before that error reaches the handler |
| Unknown callback errors cannot inherit a replay-triggering label | **PASS inside the application callback; FAIL for the stronger whole-transaction invariant under F01.** Unknown callback errors are wrapped without MongoError labels, but commit errors arise outside that catch |
| Existing JWT/version/current-role/identity protection | **PASS locally.** Source review and unchanged suites retain expiry, role/version guards, stale rejection and all self-delete case assertions; native concurrency remains unverified |
|31 new tests are meaningful | **PASS with coverage limits.**23 backend cases exercise observable failures/state/authorization plus selected driver control flow;8 client cases execute published API exports and verify single transport invocation/error preservation. They do not cover F01 or real server behavior |
| Financial/inventory mutations examined | **Completed, with unresolved findings F02–F05.** Five supplemental characterizations confirm behaviors in synthetic persistence; native outcomes are unknown |
| Lost responses/manual resubmission limitations | **Accurately documented in A08A.** No persistent operation ledger, deduplication or client reconciliation exists; metadata cannot reach a disconnected client |

## 3. R1-F01 — commit-phase compound-label replay

**Priority: high, conditional fault-safety gap. Status: reproduced locally; production/server reachability unknown.**

Evidence:

- [adminAccountMutation.js](../backend/utils/adminAccountMutation.js), lines47–65, catches/wraps UnknownTransactionCommitResult errors **from the callback**. Its outer catch at lines67–78 can classify errors only after withTransaction rejects. Each new callback resets callbackCompleted/callbackFailure at lines48–49.
- Installed `backend/node_modules/mongodb/lib/sessions.js`, lines344–354 and652–665, can add UnknownTransactionCommitResult to a code50/MaxTimeMSExpired commit error.
- In that file's withTransaction commit handler, lines604–614, code50 skips the ordinary unknown-commit acknowledgement-retry branch. A simultaneous TransientTransactionError label then selects a **new transaction/callback attempt**. An outer application catch cannot intercept a failure that the driver consumes internally and later resolves successfully.

### Supplemental negative probes

Probe1 used the actual installed withTransaction loop with a synthetic commit method that records a simulated commit, then throws code50 carrying both labels on its first attempt. Probe2 also executed the installed **commitTransaction implementation**, replacing only its executeOperation wire operation with a process-local function. In Probe2 the supplied synthetic response had code50 and TransientTransactionError; the installed commit method added UnknownTransactionCommitResult itself. No MongoClient connection or configured URI was used.

Both observed:

```text
transaction starts:          2
target callback invocations: 2
commit attempts:            2
simulated committed effects:2
helper result:               reported-success
database connection state:   0 (disconnected)
acceptance assertion:        expected callback count1, actual2 — FAIL
```

Both processes exited1 on the no-replay assertion. They are two versions of one finding, not two independent vulnerabilities. The second probe confirms that the application/installed driver can construct the compound labels rather than requiring both to be manually attached at the callback boundary.

**Qualification:** the probes deliberately supply a synthetic server error and model the first commit as applied. They do not prove that a conforming MongoDB server can return this label combination after a committed write, or that production has done so. A TransientTransactionError normally directs safe transaction retry; that protocol assumption may make some compound inputs unreachable or definitively aborted in reality. What is confirmed is that A08A does not enforce an application-level conservative no-replay boundary across this commit-phase input. No real account/password/epoch was changed and no actual duplicate durable effect is claimed.

### Disposition

Do not describe all indeterminate transaction outcomes as independently protected against callback replay. Preserve the passing callback-level protection. A separately authorized local correction/design must address or formally constrain this commit-phase case and add a permanent negative regression, while retaining safe known-aborted retries and same-transaction acknowledgement retries. Do not patch installed dependencies, weaken temporal/actor guards, or assert server impossibility from a mock. Native label reachability belongs in an explicitly approved isolated diagnostic matrix.

This unresolved counterexample is the reason for the overall FAIL assessment. The assessment is not a claim that A08A removed the earlier security fixes, or that its explicitly out-of-scope financial modules were newly regressed.

## 4. R1-F02–F05 — financial and inventory findings

### F02 — financial finalization/cleanup can obscure outcomes

**Priority: high for release readiness. Existing risk, not an A08A regression.**

[OrderController.js](../backend/controllers/OrderController.js) create/update/void paths commit manually, then use catch paths that call abortTransaction unconditionally. Create/update also populate related data **after commit**. A post-commit population failure cannot undo the sale; abort after commit may throw and replace the original failure. [DebtPaymentController.js](../backend/controllers/DebtPaymentController.js), lines80/127–133, has the same commit/abort masking risk and no account-style uncertainty envelope. Both controllers call endSession without awaiting its promise. Session creation/startTransaction occur before their try/finally boundaries, so a start failure can skip cleanup.

A supplemental actual debt-controller probe injected a commit error with UnknownTransactionCommitResult, followed by a different abort error. The handler rejected with the **abort error**, not the original commit error, and produced no response body in that direct invocation. A payment insertion and one simulated commit attempt had occurred. Persistence was mocked; this proves error replacement in the controller, not a real commit or rollback.

An unawaited cleanup rejection can escape the intended handler; exact process behavior and actual driver cleanup failures were not tested. An ordinary400/500 from these paths must not be treated as proof that no financial effect committed. Financial log/error behavior was not redesigned here.

### F03 — stock adjustments can be repeated or overwritten

**Priority: high data-integrity risk. Reproduced at the controller/generated-write boundary.**

[ProductController.js](../backend/controllers/ProductController.js), lines104–119, loads stock, adds a delta and saves the resulting absolute quantity. It has no adjustment identity, atomic delta update or expected-stock/version condition.

- Sequential repeat of delta+3 from stock10: two200 responses, two saves, stock16. An identical resubmission applies again; the system cannot identify whether it is a new adjustment or a retry.
- Two overlapping calls read stock10 and each add3. Actual Mongoose-generated writes both set stock13 with an `_id`-only filter. The synthetic collection applied both and ended at13 while both calls returned200. This loses one requested adjustment in the modeled interleaving. Real database scheduling/durability was not tested.

Absolute catalog stock edits can likewise overwrite a more recent sale/adjustment without an expected-state guard. No stock-in/adjustment ledger or responsibility/history design was added. Existing nonnegative-stock clamping does not resolve lost updates or retry duplication.

### F04 — multi-step product activation permits partial completion

**Priority: medium atomicity/availability risk. Reproduced locally.**

ProductController setActiveProducts, lines122–145, first deactivates all owner products, then activates the selected IDs in a separate updateMany. A synthetic failure in the second call returned500 with all products still deactivated by the first call. There is no transaction/compensation or indeterminate-operation contract here. A partial effect is possible independently of server transaction support because this path does not request a transaction. No real catalog was modified.

### F05 — resubmission identity and invoice uniqueness remain unestablished

**Priority: high before financial production acceptance; some remedies require approved API/data decisions.**

- A supplemental debt-controller probe submitted the same partial-payment request twice while sufficient balance remained. Both returned201; amount paid advanced0→100→200, balance1000→900→800, and two payment records were inserted in the adapter. The one-request linked-payment double-application fix remains intact. This is a **new-request resubmission risk**, not proof that two distinct legitimate payments should be collapsed. No new payment policy is inferred.
- Order/sale creation and ExpenseController creation generate new records for new calls without a durable request identity. A repeated lost-response submission can represent another financial effect. Existing same-order completion `ledgerRecorded` handling and zero-balance pay handling protect selected sequential replays, not arbitrary create/partial-payment retries.
- [InvoiceController.js](../backend/controllers/InvoiceController.js) find-then-create invoice handling and counter increment can run without a session through ensure routes, including GET routes in [InvoiceRoute.js](../backend/routes/InvoiceRoute.js). Invoice and InvoiceCounter model compound indexes are declared **without unique:true**. Concurrent ensure/counter upsert and repeated failure need investigation. Actual deployed indexes are unknown; no existing index/data was inspected or changed. Do not add uniqueness without checking historical data and obtaining approval.
- PersonController payment/pay-all aliases delegate to the same payment path. Old add/update/delete-debt endpoints return410; no additional legacy mutation was assumed active. FinancialController's reviewed summary functions are reads. The inspected personService helper is not evidence that a mounted route executes it.

### Wider mutation matrix

| Mutation family | Existing safeguard | Unresolved outcome/duplication boundary |
| --- | --- | --- |
| Create sale/order | Backend catalog prices, same-session stock/order/invoice writes | New-request replay creates another ID; commit/population/abort/cleanup ambiguity remains |
| Complete existing order | ledgerRecorded duplicate branch; conditional stock `$inc` with sufficient-stock predicate | Concurrent completion/conflicts and error recovery need independent-client transaction tests; sequential guards are not native concurrency proof |
| Partial/general payment | Backend balance checks, payment effects owned by controller transaction | No durable submission identity; repeated partial request can apply again; commit/abort/cleanup risk |
| Void | Excludes previously voided transaction; stock restoration and invoice status use same session | Concurrent/uncertain voids need verification. Stock-restoration update results are not checked, so zero-match restoration can be missed; no refund policy is inferred |
| Adjust/edit stock | Owner scope, nonnegative values | Repeated delta and stale absolute-save overwrite demonstrated; no adjustment ledger/CAS |
| Bulk activation | Owner scope | Two writes can leave partial state; second-write failure demonstrated |
| Invoice ensure/status | Existing invoice lookup and counter increment | Find/create uniqueness, no-session gaps and post-insert response failure remain |
| Expense create/update/delete | Existing owner/creator/admin checks | Generic error outcomes; repeated creation and stale edits are not reconciled/deduplicated |

Transactions can prevent partial database commits only where all required operations actually participate and native guarantees hold. They do not provide request deduplication, validate unchecked zero-match effects, or guarantee that an HTTP response reaches a client. No financial/inventory implementation was changed in this review.

## 5. Existing security and test quality

### Preserved controls

The source and passing regressions retain required safe-integer iat/exp, the604,800-second maximum, HS256 signature validation, expired/missing/malformed/stale-token rejection, absent-stored-version compatibility without claim-less fallback, bcrypt login and current-account role/confirmation authority. Account lookup failures remain fail-closed. Self conditional saves and cross-account actor-version predicates remain present; stale actor authority is not refreshed by the target.

Canonical account comparison still rejects lowercase/uppercase/mixed-case self deletion with400 before target deletion/session/fence work. The unchanged tests assert zero document and collection delete calls. Malformed IDs, authorized other-account deletion and uppercase self-update dispatch remain covered. No new signature, epoch, role-restoration or ObjectId bypass was identified. These findings do not certify native MongoDB concurrency or cancel every already-admitted business/read request.

### Review of the31 A08A regressions

| Group | What is meaningful | What it does not establish |
| --- | --- | --- |
| Account HTTP fault cases | Actual routing/controllers/hooks, status/body, observed staged/committed state, no extra saves, stale-token rejection and sanitized diagnostics | Adapter staging/filter/rollback rules assume server behavior; no native isolation or ambiguous network outcome |
| Fence/session/cleanup tests | Target callback/deletion absence, primary exception identity and preserved acknowledged success | Complete resource recovery, production cleanup failures and every driver error combination |
| Six installed-driver-loop tests | Actual withTransaction control flow for selected callback, commit, abort and actor-recheck inputs | Most commit/wire operations are substituted; missing compound code50 commit case reproduced by R1 |
| Eight client API tests | Actual exported functions, one Axios adapter call, original error identity and unchanged metadata | They inject the500 body; they do not validate its backend origin, UI reconciliation, manual clicks, proxies or lost HTTP responses. Similar API aliases are useful contract coverage, not eight independent risk classes |

The tests are meaningful regressions, not merely implementation mirrors. Their breadth cannot be inferred from the numeric count. Existing payment tests verify normal/sequential flows with mocked sessions, not native rollback or the new resubmission/fault cases. A04's modeled locks, immediate pending-promise assertion and simplified BSON matching limitations remain as described in A07. No tests were changed, disabled or weakened in R1.

## 6. Fresh verification results

| Check | Actual A08A-R1 result |
| --- | --- |
| Backend `npm test` |**111 passed;0 failed/cancelled/skipped/TODO**, exit0; includes23 A08A cases and178 route denials |
| Client `npm test` |**16 passed;0 failed/cancelled/skipped/TODO**, exit0; includes8 A08A cases |
| Supplemental compound-commit negative probes |**2 failed acceptance assertions**, each exit1: expected callback1, actual2; same finding, two driver-boundary variants |
| Supplemental financial/inventory characterizations |**5 passed**, exit0, because assertions require the observed risky behaviors; this is not a security acceptance pass |
| Client build to `<tool-temp>/uphsd-bookstore-a08a-r1-build` |PASS exit0;671 modules; existing753.13kB JS/large-chunk and outside-root output notices remain |
| Client-wide installed ESLint |FAIL exit1: **16 errors/13 warnings**, unchanged |
| Targeted installed ESLint recommended JS + Node globals |PASS:6 A08A runtime/test files;0 errors/0 warnings |
| Backend `node --check` |PASS:57 JS files;0 failures |
| `git diff --check` |PASS; existing LF/CRLF notices remain |
| Real MongoDB concurrency/protocol/durability; provider/live inventory |**NOT RUN / UNKNOWN**; outside this review |

The supplemental probes are not added to111/16 permanent-suite counts. No database-backed test, live deployment or provider action is labelled passing.

## 7. Lost-response documentation and A08B gate

A08A accurately states that retryable:false is advisory, the UI retains its normal error flow, and manual/proxy resubmission or a lost response is not persistently deduplicated. Acknowledged success plus cleanup is handled locally, but a process crash/socket loss/post-commit response failure can still leave clients uncertain. Reloading some account metadata may not prove which request committed; it is not a durable reconciliation protocol. No automatic account reset, epoch rollback, payment reversal or refund follows from a failure response.

**A08B readiness decision: NOT CLEARED as the normal next phase.** First obtain review/authorization for a local commit-boundary correction or a rigorously constrained design addressing F01, with a permanent regression and independent rerun. Scope financial/inventory findings separately; do not silently introduce payment identity, refund, cancellation, stock ledger or schema/index policy.

A separately authorized **diagnostic-only** isolated MongoDB exercise could investigate F01 server-label reachability before choosing a correction. That is not a passing A08A gate or permission to begin now. It requires a confirmed disposable nonproduction target/topology/database, synthetic-only fixtures, least-privilege test identity, explicit write/fault/cleanup permissions, independent-client matrix and recovery/abort controls. Verify isolation without deriving a target from the local driver fallback or reusing A01 read-only production access. No existing data, production credential or production account may be used as test material.

After approved local remediation/review, an explicitly authorized A08B matrix should include ordinary and compound commit labels, commit-response loss, abort/cleanup faults, transaction support failure, actor/target concurrency, stock contention, sequential/manual replay, partial bulk updates and invoice uniqueness. Native tests must record actual outcomes rather than treating every failed request as rollback. A01 production identity/access and deployment/backup/rollback gates remain separate and unresolved.

## 8. Delivered files and stop condition

| File | Change |
| --- | --- |
| `docs/UPHSD_BOOKSTORE_A08A_R1_REVIEW.md` | New independent findings, negative probes, mutation review and A08B gate |
| `docs/UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md` | Dated additive R1 summary only |

All application/test source, previous reports, environment files, dependency lockfiles and unrelated working-tree changes are preserved. **Final assessment: FAIL**, with the confirmed local F01 control-flow counterexample and explicit native/server-reachability limitations. No remediation, integration testing, A01 connection or production rollout follows. Stop for review.
