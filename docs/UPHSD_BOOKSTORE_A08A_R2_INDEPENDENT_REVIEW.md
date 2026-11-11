# UPHSD Bookstore POS — A08A-R2 independent local review

Date: 2026-11-03, Asia/Manila.

**Local R2 controls: PASS with stated coverage limits. Final recommendation: BLOCKED PENDING EVIDENCE for A08B execution.**

Both original R1 compound-commit regressions pass in the unchanged existing suite. Independent source tracing confirms that the commit observer records the commit error before the driver handles it, and its replay guard precedes another actor fence or target mutation. No new local replay, token, administrator-role or ObjectId bypass was identified in the reviewed paths. This is not a native MongoDB transaction guarantee.

Fresh verification: **129 backend tests and16 client tests passed;0 failed/cancelled/skipped/TODOs**. Build, syntax and targeted lint passed. Client-wide lint still fails with **16 errors/13 warnings**. All five financial/inventory risks remain deferred. A08B execution cannot be cleared without an identified disposable target, isolation/permission evidence, approved write/fault/cleanup scope and explicit authorization. Native test results themselves are not demanded before A08B; obtaining them is the purpose of that phase.

## 1. Scope, restrictions and method

Read the [A08A results](UPHSD_BOOKSTORE_A08A_FAULT_HANDLING_RESULTS.md), [R1 review](UPHSD_BOOKSTORE_A08A_R1_REVIEW.md), [R2 implementation results](UPHSD_BOOKSTORE_A08A_R2_COMMIT_REPLAY_FIX_RESULTS.md), [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md), and relevant historical [A04](UPHSD_BOOKSTORE_A04_SECURITY_REMEDIATION_RESULTS.md), [A05](UPHSD_BOOKSTORE_A05_SECURITY_VERIFICATION.md), [A06](UPHSD_BOOKSTORE_A06_OBJECTID_SECURITY_FIX_RESULTS.md) and [A07](UPHSD_BOOKSTORE_A07_SECURITY_VERIFICATION.md) evidence. Historical FAIL/PASS conclusions are retained, not silently replaced.

Inspected actual source, assertions, adapters and installed driver code. Before execution, inspected package scripts, test imports/connection stubs, the import-safe app factory, seed main guard, loopback HTTP helper, client Axios adapters and Vite configuration. Backend/client test scripts invoke Node's local test runner. They do not launch the configured application entry point. Mongoose writes/connection attempts are mocked; HTTP test listeners are ephemeral127.0.0.1 servers; client transport is substituted. The seed function is tested with mocked User methods; the seed CLI/main/database connection was not run. Client build uses existing local plugins and writes outside the repository.

Only this new report and the authorized additive plan entry are changed. No application/test/configuration/manifest/lockfile/environment edit, dependency installation, external/provider/database connection, migration, production data/account/credential/session access, deployment or A08B action occurred. No new fault probe or modified/reverted implementation was executed. No finding was fixed in this review.

## 2. Files and functions inspected

| Area | Actual source/functions |
| --- | --- |
| Commit observation | [accountCommitBoundary.js](../backend/utils/accountCommitBoundary.js): observeAccountCommits, beforeCallback, primaryFailure, restore |
| Administrative boundary | [adminAccountMutation.js](../backend/utils/adminAccountMutation.js): adminAccountFilter, runAdminAccountMutation; self and cross-account branches |
| Error classification | [accountMutationOutcome.js](../backend/utils/accountMutationOutcome.js): label predicates, AccountMutationIndeterminateError, saveAccountMutation; [errorMiddleware.js](../backend/middleware/errorMiddleware.js): errorHandler |
| Callers and routes | [UserController.js](../backend/controllers/UserController.js): createUser/updateUser/deleteUser, login/profile/password paths; [UserRoute.js](../backend/routes/UserRoute.js) |
| Existing security | authMiddleware protect/authorizeRoles, generateToken/tokenPolicy/tokenVersion utilities, accountIdentity canonicalAccountId, User model security-version/password hooks |
| R2 regressions | [commitReplay.test.js](../backend/tests/commitReplay.test.js): fixture, fault, resultOf,18 tests including both original R1 cases |
| Previous regressions | accountFaults, a03TokenReview, a04Security, accountIdentity, tokenSecurity, tokenVersion, security and payment/invoice tests; helpers and session adapters |
| Client behavior | authApi exports, useAdminUsers/useProfile handlers, apiClient interceptor, accountMutationRetry tests and safe diagnostics/logout tests |
| Driver | Installed MongoDB7.1.1 `lib/sessions.js`: commitTransaction, withTransaction, unknown-result decoration and timeout/retry branches; synthetic wire substitution target in execute_operation.js |
| Deferred operations | ProductController adjustStock/updateProduct/setActiveProducts; DebtPaymentController createDebtPayment; OrderController completion/manual commit/abort/cleanup/population paths |

Runtime/package files were inspected for their code and declared dependencies; local version queries confirm Node24.14.0, Mongoose9.3.3 and MongoDB driver7.1.1. No production environment or provider settings were inspected. Installed-driver behavior is distinguished from server behavior below.

## 3. Both R1 cases verified against implementation and assertions

The permanent cases are the loop at the end of commitReplay.test.js, not merely matching test names. Their common fixture stages a role/epoch change, counts target callbacks/fences/commits/effects, and explicitly models whether commit applied. Its apply-once rule for a given simulated transaction is a **test assumption**, not proof of MongoDB deduplication.

| Item | Original R1 probe1 | Original R1 probe2 |
| --- | --- | --- |
| Initial failure | Synthetic commit applies a modeled effect, then throws code50 with TransientTransactionError + UnknownTransactionCommitResult | Synthetic wire operation applies a modeled effect, then throws code50 with TransientTransactionError |
| Real driver code executed | Installed withTransaction | Installed withTransaction and commitTransaction; the latter adds UnknownTransactionCommitResult before returning the error |
| Original retry path | Code50 skips the ordinary unknown-acknowledgement retry branch; transient label can request a new transaction/callback | Same path after the driver's label decoration |
| R2 observation point | Public commit override records/rethrows the same compound error | Public override surrounds the native commit call and observes its final decorated error |
| Re-entry | beforeCallback sees unknown uncertainty before another actor fence or target callback; throws trusted application error without retry labels | Same guard and terminal application error |
| Fresh passing assertions | Target callback1, fence1, commit1, modeled effect1, role admin/epoch1; no success value; indeterminate error with original primary cause; cleanup once | Identical assertions, including preservation of the error object decorated by the driver |

The driver may start a second empty transaction and invoke the helper's wrapper before it is rejected. **Driver wrapper entries are not protected target-callback executions.** The guard runs before User.updateOne and work; those do not repeat. The non-Mongo application error follows the driver's abort-and-throw path rather than inheriting transient retry behavior. Cleanup is then attempted. Real server execution of such an empty retry/abort is unverified.

Both cases directly assert that the helper rejects with AccountMutationIndeterminateError rather than returning a successful result. Other R2/A08A cases exercise the global handler's HTTP500 classification and fixed code ACCOUNT_MUTATION_OUTCOME_UNKNOWN, operationOutcome indeterminate, retryable false. Causes and raw driver details are not serialized. Thus modeled application of a commit does not make an unacknowledged operation a success, and a failure response does not assert rollback.

### Regression sensitivity

The cases would not pass simply because a helper was called. With the pre-R2 helper restored (removing observer/guard integration together), or with the beforeCallback replay check bypassed, the inspected driver branch can run work twice; its fixture then produces callback count2, fence count2, modeled effects2 and epoch2. The explicit `callbacks === 1` assertion fails, as do the state/outcome assertions. Conversely, an implementation that rejects all retries would fail the acknowledged-success and confirmed-abort cases.

This is a **counterfactual source/assertion analysis**, not a fresh reverted-code test. R2's historical pre-fix0/2 result corroborates it but is not relabelled as a result of this review. Reverting/removing source or substituting a modified test would violate this review's restrictions; neither was done. The current unchanged129-test run includes both passing cases and all18 R2 regressions.

## 4. Commit, retry, abort and cleanup findings

### Commit observation and label precedence — PASS locally

The observer changes only the owned session instance's commit method temporarily. Original receiver/arguments are forwarded, acknowledged results are returned, and failures are recorded and rethrown unchanged. There is no global pending-commit state, driver patch, label deletion or application copy of the driver's retry loop.

The replay check permits a driver-requested fresh target attempt only when the latest observed commit failure has TransientTransactionError **and lacks** UnknownTransactionCommitResult. Labels are checked through both supported representations; unknown dominates a compound error. A generic/unclassified failed commit cannot authorize replay. An acknowledged commit clears the pending failure. No exception string, request body or frontend claim determines this eligibility.

### Callback retry versus commit retry — PASS under the reviewed API contract; native behavior unverified

| Path | Actual control flow and tests |
| --- | --- |
| Callback transient error with no uncertain commit | Driver abort/retry remains available. Original actor-version predicate is rechecked. Target work may run twice, but only the successful staged attempt is modeled as committed |
| Unknown-only/non-timeout compound commit error | Driver can retry commit acknowledgement on the same transaction. Tests assert one target invocation and modeled effect, even with two commit attempts |
| Code50 compound commit requests a new callback | Observer blocks before another fence/target effect; indeterminate error is terminal for application replay |
| Transient-only commit failure | Driver-directed transaction retry is permitted; the case models the failed attempt as aborted and verifies one final effect |
| Earlier unknown acknowledgement followed by transient-only abort result | The most recent signal may permit retry under the driver's contract. The test intentionally models no earlier applied effect. It does **not** prove that any later generic error, or any arbitrary provider response, establishes abort |
| Actor revoked before a safe retry | New fence returns no match;401, no second target callback and no modeled committed target change |
| Terminal/unlabelled commit exception | No new outer application retry; conservative indeterminate classification preserves primary commit cause, including when driver finalization throws a secondary error |

The role of a transient-only label as an aborted-transaction signal depends on the driver/server protocol. In particular, native evidence for uncertainty followed by a definitive abort, contradictory labels and actual commit durability remains **unverified**. The application does not treat the same compound unknown/transient error as confirmation of abort. Native compatibility must be tested before release; mocks cannot validate labels supplied by a live server.

### Cleanup and outcomes — PASS locally, remaining coverage limits

The helper restores the original own method descriptor, or removes its temporary own override for an inherited method, before endSession. Missing/nonconfigurable commit methods fail closed before transaction work. Restore/endSession exceptions are separately caught and emit fixed diagnostics; they cannot replace the operation's returned value or primary error. Existing tests confirm acknowledged success survives cleanup failure and the cause of an indeterminate error remains the original commit exception.

The session-start failure path runs no target work. Self-account mutations retain their separate conditional-save branch; standalone saves do not acquire an unguarded transaction retry. A08A's known pre-write/no-match rejections and conservative unknown-write handling remain present.

No production session resource cleanup, genuinely nonconfigurable ClientSession, overlapping sessions, process kill, socket loss or server-side abort was exercised. There is no dedicated permanent test for observer restoration itself throwing, although its source catch is separate from session cleanup. Actual recovery/resource behavior remains unverified, not labelled passing because a fake endSession succeeded.

### Retry limits and termination — PASS for inspected control flow; environment bounds unverified

Installed sessions.js uses a120,000ms default overall retry window when no client-side operation timeout is configured, with deadline checks/backoff for fresh transaction attempts and deadline checks for commit acknowledgement retries. With client-side timeout enabled, its timeout context governs those attempts. The application adds no outer retry loop, resets no driver deadline, and assigns no new retry count/duration.

R2's terminal application error has no MongoDB retry labels; the inspected driver aborts/throws it instead of entering another target attempt. Neither UserController nor the global handler retries rejected work. Tests cover selected one/two/three commit sequences, **not real timeout exhaustion**, stalled wire operations or cancellation. The driver's retry deadline is not proof that every native operation or HTTP request has a hard wall-clock limit; actual client/server timeout configuration is unknown and was not inspected through providers.

### API caller truthfulness — PASS for local propagation; delivery/deduplication unresolved

Account create/update/delete handlers await the helper before returning success. They do not intercept uncertainty and resubmit the mutation. The error handler recognizes only the trusted error type for uncertainty metadata and keeps500 messages sanitized. Client API exports make direct Axios calls; their eight existing adapter tests preserve the same error and make one transport call. The inspected401 interceptor rejects rather than retries; account UI hooks show an error/return false.

The UI does not implement a dedicated reconciliation workflow. A person, proxy or future caller can still issue another request; retryable:false is advisory and cannot reach a disconnected client. There is no persistent request identity/operation ledger. A lost response, post-commit serialization error or process termination can still hide a successful effect. These limitations are accurately retained in R2 and must not be reinterpreted as exactly-once HTTP delivery.

## 5. Security regression status

**PASS locally:** the inspected source and unchanged regressions retain the604,800-second JWT limit with required integer iat/exp, HS256 signature validation, expired/missing/malformed-token rejection, strict token-version validation, missing-stored-version compatibility without claim-less fallback, bcrypt compatibility and current-account role/confirmation authority. Account lookup failure remains fail-closed.

Self-administration still binds admitted actor and expected epoch in the same conditional write. Cross-account administration still uses current admin/confirmed/epoch predicates plus a real actor revision write in the target's transaction. Safe retries recheck that original predicate; target state does not refresh actor authority. Actual concurrent MongoDB serialization remains unverified.

Canonical lowercase/uppercase/mixed-case self-delete still rejects400 before target/session/fence work, with zero document/collection deletion calls in the existing assertions. Valid other-account deletion and invalid-ID rejection remain covered. No new security bypass was identified. This is not universal cancellation of business/read requests admitted before revocation, and no deployed account/key legitimacy is established.

## 6. Five deferred financial/inventory risks

These five R1 characterizations were **re-traced in current source**, not newly rerun as supplemental probes. All remain outside the account-scoped observer. Existing passing normal payment tests are not fault/idempotency certification.

| Risk / failure scenario | Potential effect and source | R2 disposition | Required further action/approval |
| --- | --- | --- | --- |
| Same stock delta submitted again | ProductController adjustStock adds delta again; no adjustment identity. Retry can apply another stock effect | **Deferred; not addressed** | Separate implementation scope; any request identity/stock-ledger rules require approved design |
| Overlapping stock read/modify/saves | Both callers can save an absolute value derived from the same old quantity, losing an adjustment or overwriting a sale | **Deferred; not addressed** | Approved stock-concurrency correction and native independent-client tests; preserve established stock invariants |
| Second bulk activation write fails | setActiveProducts first disables all products, then enables selected IDs; failure can leave the first effect applied | **Deferred; not addressed** | Separate atomicity/failure-handling scope and verified topology; no compensation rule invented |
| Identical partial-payment request resubmitted while balance remains | DebtPaymentController can apply another balance increment and insert another payment; two requests are not identifiable as one business event | **Deferred; not addressed** | Approved submission-identity/API/data design; no silent collapse of legitimate payments or invented refund/credit policy |
| Financial abort/cleanup masks an uncertain commit | DebtPayment/Order manual commit/catch/abort and unawaited endSession can obscure an applied or uncertain result; Order population also happens after commit | **Deferred; not addressed** | Separate financial lifecycle/fault tests and remediation approval; account guard must not be assumed to cover these paths |

These are existing **FAIL/open financial/inventory controls**, not R2 regressions and not automatic requirements to redesign the bookstore during this review. Invoice/counter uniqueness, unchecked void restoration, expense resubmission and wider recovery risks also remain separately scoped. Any eventual integration exercise of those modules requires explicit synthetic-write/fault authorization.

## 7. Commands, actual results and limits

| Command/check | Fresh result |
| --- | --- |
| Backend `npm test` — existing Node test script |**129 passed;0 failed/cancelled/skipped/TODO**, exit0, including both R1 cases and18 R2 tests |
| Client `npm test` — existing Node test script |**16 passed;0 failed/cancelled/skipped/TODO**, exit0 |
| Client `npm run build -- --outDir <tool-temp>/uphsd-bookstore-r2-independent-build` |PASS exit0; Vite8.0.3,671 modules; existing753.13kB JS/large-chunk and outside-root output notices |
| Targeted installed ESLint API, recommended JS + Node globals |PASS:8 R2 runtime/test files;0 errors/0 warnings; in-memory lint config only |
| Client-wide installed ESLint API, repository configuration |**FAIL exit1:16 errors/13 warnings** across55 files; no fix attempted |
| Backend `node --check` |PASS:59 JS files;0 failures; compile-only, no module execution |
| `git diff --check` |PASS; existing unrelated LF/CRLF notices remain |
| Reverted-code/mutation experiment |NOT RUN; forbidden source/test changes. Sensitivity assessed from actual assertions/driver path and historical pre-fix evidence |
| Native database concurrency/protocol/timeout/resource recovery |NOT RUN; unverified and outside scope |
| Provider/deployed settings, production data or accounts |NOT ACCESSED |

The eight targeted lint files are accountCommitBoundary, accountMutationOutcome, adminAccountMutation, commitReplay.test, helpers, accountIdentity.test, accountFaults.test and a04Security.test. Backend has no configured lint script; installed client ESLint was used without installation or writing configuration. No test was selected out, weakened or marked skipped; full-suite skipped/cancelled/TODO counts are zero.

The tests use actual routing/JWT/bcrypt/Mongoose hooks and selected installed driver control flow, but synthetic collections/session state/wire results. The second R1 test intercepts only executeOperation for commit commands and never constructs a connected MongoClient. A fake apply-once commit routine cannot prove real commit deduplication. Older adapters model their own snapshots/locks; some controller actors use trusted unconditional fence fixtures. Those bounds remain visible.

## 8. Findings classification and A08B decision

| Finding | Classification | Disposition |
| --- | --- | --- |
| Original R1 probe1 and probe2 no-replay controls | **PASS locally** | Current assertions and source agree; target work stays single and outcome is indeterminate |
| Legitimate callback/commit retry, cleanup and primary-cause handling | **PASS locally** | Under reviewed API/label assumptions; coverage limits above |
| JWT/version/administrator/ObjectId regressions | **PASS locally** | No newly demonstrated bypass |
| Existing client-wide lint | **FAIL, pre-existing** |16 errors/13 warnings remain outside review remediation scope |
| Five financial/inventory controls | **FAIL/open, pre-existing and deferred** | Not account-R2 corrections; separate scope/approval needed |
| Native protocol/topology/concurrency/timeout guarantees | **BLOCKED for verification here** | Results must come from a separately authorized isolated matrix; not inferred from mocks |
| A08B target/isolation/effective privileges and execution scope | **BLOCKED pending evidence** | No confirmed disposable target or write/fault/cleanup authorization is supplied in the inspected phase evidence |

**Final recommendation: BLOCKED PENDING EVIDENCE.** No newly confirmed R2 code defect requires repair before planning an account-only isolated integration exercise. The blocker is the absence of a concrete, authorized safe test environment and execution scope, not a requirement to prove native behavior before native testing is permitted. The deferred financial risks and client lint remain production concerns; their existence does not automatically require unrelated changes before disposable account tests.

The missing **nonsecret prerequisites** are:

1. Exact disposable nonproduction target/environment and intended database/namespace, with evidence of ownership and isolation from real bookstore data. Do not infer identity from a default database name.
2. Authorized test identity and evidence of effective least-privilege permissions for the approved synthetic reads/writes and cleanup; no password/URI/token is requested for this report.
3. MongoDB server version/topology/transaction capability and intended driver/session versions, so compatibility and unsupported-topology cases are defined.
4. Approved test matrix, including independent-client actor/target contention, compound labels, unknown→abort/ack sequences, deadline exhaustion, commit response loss, abort and cleanup faults. Define which injected faults are permitted and confine them to that target.
5. Exact fixture/collection ownership, cleanup and recovery procedure. Database drops, existing-data changes or topology disruption are not implied permissions.
6. Explicit A08B execution authorization covering the connection, synthetic writes, faults and cleanup. A01 read-only production access and local-R2 authorization do not provide it.

Once these are reviewed and separately authorized, A08B can supply the missing native evidence. A01 production identity/access, deployment, credentials, backup/rollback and broader financial remediation remain distinct gates. Nothing in this review authorizes them.

## 9. Delivered files and stop condition

| File | Authorized change |
| --- | --- |
| `docs/UPHSD_BOOKSTORE_A08A_R2_INDEPENDENT_REVIEW.md` | New local review, evidence, limitations and blocked execution prerequisites |
| `docs/UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md` | Dated additive review entry only |

Preservation comparison covered176 baseline files: only the implementation plan changed, this report was added, and no file was removed. All application/tests, configurations, environment files, manifests/lockfiles, previous reports and unrelated changes hash-match the baseline. The plan's original43,668 bytes remain an exact prefix. All36 relative documentation links resolve. A heuristic scan found no connection-string/JWT-shaped values in the delivered documentation; no configuration contents were read for that check.

**Stop after this independent review. A08B has not begun.**
