# UPHSD Bookstore POS — A08A local fault-handling remediation

Date: 2026-11-02, Asia/Manila. **Local remediation completed with limitations; production readiness is not established.**

Account session cleanup no longer replaces an acknowledged result or the primary failure. Uncertain transaction/single-account write outcomes now receive an explicit non-retryable error contract. Callback-level unknown-commit errors cannot trigger an application callback replay through a transient label. Existing JWT, current-account authorization, actor fencing, token-version and canonical ObjectId protections remain covered by passing regressions.

Final verification: **111 backend tests passed;16 client tests passed;0 failures/cancellations/skips/TODOs.** Client build, targeted lint and syntax checks pass. Existing client-wide lint remains **16 errors/13 warnings**. Persistence and session/wire operations are synthetic; no real MongoDB concurrency, durability or commit recovery is certified.

## 1. Review, baseline and scope

Reviewed the [A04 remediation](UPHSD_BOOKSTORE_A04_SECURITY_REMEDIATION_RESULTS.md), [A05 verification](UPHSD_BOOKSTORE_A05_SECURITY_VERIFICATION.md), [A06 identity fix](UPHSD_BOOKSTORE_A06_OBJECTID_SECURITY_FIX_RESULTS.md), [A07 consolidated review](UPHSD_BOOKSTORE_A07_SECURITY_VERIFICATION.md) and existing [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md). Traced actual account controllers/save hooks, actor helper, error sanitization, client account requests and installed MongoDB transaction handling. Baseline backend suite passed88 cases before implementation.

The correction is limited to account mutation fault handling, a trusted error-envelope extension, and regression tests. No schema, collection, index, idempotency key, persistent operation record, recovery policy, role rule or new timeout was introduced. No existing audit report or test was rewritten. Existing payment/receipt regressions remain unchanged.

No external service or database connection, migration, account/session/credential/permission change, deployment, dependency installation or environment/lockfile edit occurred. HTTP tests used ephemeral loopback servers and synthetic accounts; no configured URI or live account was used. A01 remains blocked.

## 2. Confirmed defects and reproductions

| Finding | Evidence before correction | Minimal correction |
| --- | --- | --- |
| Cleanup obscures a committed success | `runAdminAccountMutation` awaited `endSession` in finally; a synthetic cleanup rejection changed an otherwise committed administrator update from200 to500 | Catch cleanup errors separately; emit a constant nonsecret diagnostic and retain the operation result |
| Cleanup obscures the primary failure | A callback rejection was replaced by the cleanup exception rather than retaining its identity/status | Preserve and propagate the primary error; cleanup cannot replace it |
| Commit uncertainty has no distinct result contract | A simulated committed update with a lost acknowledgement returned ordinary500 without uncertainty/retry metadata | Track callback completion and emit a trusted indeterminate error after unclassified finalization failures |
| Single-account acknowledgement loss is indistinguishable from a definite rejection | A password/version write applied in the adapter, then threw; old token was revoked but the response omitted uncertainty | Wrap standalone account saves conservatively, without retry or rollback assumptions |

The first four permanent regressions ran against the original implementation: **0 passed/4 failed**. They failed on500 versus expected200, replacement of the primary exception, and missing indeterminate metadata. After the targeted runtime patch, the same four passed. No real account write occurred.

## 3. Account mutation boundaries and outcome handling

| Path | Boundary retained | Fault handling after this change |
| --- | --- | --- |
| `POST /api/users/register` | Administrator actor fence plus insertion in one transaction | Await withTransaction result; preserve primary/cleanup outcomes; classify uncertain completion |
| `PUT /api/users/:id`, different account | Same-session actor fence and target save | Same transactional handling; target save remains inside the transaction, allowing driver-defined safe abort retries |
| `DELETE /api/users/:id` | Canonical self-delete rejection before any transaction; fenced other-account deletion | Same transactional handling; no deletion retry/fallback introduced |
| `PUT /api/users/:id`, self | Single atomic actor/expected-version conditional save with majority concern | New standalone-save wrapper; stale DocumentNotFoundError still becomes401 through the existing helper |
| `PUT /api/users/password` | Current-password validation and atomic password/epoch save | New standalone-save wrapper; acknowledgement loss does not undo revocation or trigger another save |
| `PUT /api/users/profile` | Existing self-only field whitelist/save | Same wrapper; uncertain profile writes do not manufacture an epoch increment |

The shared transaction helper now:

1. Resets per-attempt callback state when the driver invokes a fresh attempt.
2. Requires an acknowledged/matched/modified actor fence as before. Null/absent fence results now produce the same denial without a TypeError; no target callback is invoked.
3. Awaits the target callback and records whether it completed before transaction finalization.
4. Converts callback errors labelled UnknownTransactionCommitResult into an application error with **no driver retry labels**. Unknown-commit takes precedence over a simultaneous TransientTransactionError label.
5. Preserves ordinary callback rejections when the driver propagates the same error. If abort/finalization instead throws a different error, preserves the original callback error as the private cause of an indeterminate error; emits only a constant diagnostic.
6. Conservatively treats errors after a completed callback, or other observed unknown-commit errors, as indeterminate. It does not infer that the target was rolled back from a generic exception.
7. Awaits endSession once in finally; catches cleanup failure without replacing success, rejection or uncertainty. No background cleanup promise is left unhandled by this helper.

`saveAccountMutation` calls a standalone document save once. Known Mongoose validation/cast/no-match/version/parallel-save rejections and a definite duplicate-key server error retain their existing error handling. Unknown-commit labels override that classification. Write-concern errors are never treated as definite duplicate-key rejection, even when their numeric code overlaps. Other save errors are conservatively indeterminate, including failures that actually happened before dispatch but lack a trustworthy phase indicator. The wrapper does not retry, restore an epoch, replace a password or assert that a write committed.

### What the application can distinguish

| Outcome | Meaning and response |
| --- | --- |
| Acknowledged success | Existing200/201 DTO/message, returned only after the awaited save/transaction result. A subsequent session-cleanup failure cannot change it into a failed mutation |
| Known rejection | Existing validation/authentication/authorization/conflict/not-found conventions remain. No new claim that every ordinary4xx/5xx throughout the application proves rollback |
| Indeterminate account mutation | HTTP500 plus the fixed fields below. The write **may or may not** have committed; no success or rollback assertion is made |

```json
{
  "success": false,
  "message": "Internal server error",
  "data": null,
  "code": "ACCOUNT_MUTATION_OUTCOME_UNKNOWN",
  "operationOutcome": "indeterminate",
  "retryable": false
}
```

Only the trusted application error class adds these fields in the global handler. A driver error with similarly named properties cannot forge the envelope. Causes, driver labels/details, account data, credentials and tokens are not serialized or logged. Existing500 message sanitization remains in force, including the response-sanitizing middleware. Constants distinguish cleanup/finalization diagnostics without revealing raw exceptions. These log messages are not a durable account-security audit trail.

## 4. Retry behavior and compatibility

- There is **no new outer retry loop** around an account save or transaction. The standalone wrapper calls save once.
- The installed driver's existing withTransaction protocol remains authoritative for safe aborted-transaction retries and commit-acknowledgement retries. A retry after an aborted transaction repeats the original actor-version predicate; it cannot substitute refreshed authority after demotion.
- An unknown callback outcome is converted to a non-driver application error so it cannot cause callback replay based on a conflicting transient label. A terminal transaction finalization failure is returned as indeterminate rather than automatically resubmitted by the application.
- Native commit-acknowledgement retries use the same transaction protocol; they are distinct from rerunning a new HTTP account mutation. Native retryable writes were not disabled or reconfigured.
- The inspected account API functions call Axios directly. The account hooks catch errors and report failure; no automatic mutation retry loop was found. Eight new client tests execute the actual API functions through a network-free adapter and verify one call, unchanged error propagation, and preserved uncertainty metadata. No client runtime behavior was changed.
- `retryable:false` is an explicit response instruction, **not a persistent deduplication mechanism**. It cannot prevent a person, proxy or future client from ignoring it and issuing a new request. A lost HTTP response may convey no metadata at all. Resolve authorized current state before a new submission; no automatic reset/restore/reconciliation occurs here.

Success payloads and existing rejection statuses/messages remain compatible. New uncertainty fields are additive on the affected500 responses; some previously generic500 errors are now conservatively marked indeterminate. No HTTP503/Retry-After hint was introduced. No recovery action, financial policy or permission change was invented.

## 5. Regression evidence and test limits

New [backend account fault regressions](../backend/tests/accountFaults.test.js) contain **23 tests**, covering:

- Acknowledged update plus cleanup failure; primary rejection/404 plus cleanup failure; zero leaked exception text.
- Session-start and unsupported-transaction failures with no target write/fallback.
- Seven absent/false/malformed fence-result variants with401 and zero target deletions.
- Create/update/delete committed-adapter states followed by acknowledgement and cleanup failures: indeterminate response, one callback/committed effect and no application replay.
- A pre-commit failure with no adapter commit, still conservatively indeterminate rather than a false rollback guarantee.
- Lost acknowledgements on self-role/password/profile writes; correct epoch behavior, bcrypt compatibility and stale-token rejection after applied security writes.
- Unknown/transient callback labels, safe commit acknowledgement retry, terminal commit uncertainty, safe aborted callback retry, and authorization loss before that retry.
- Abort failure retaining the primary cause; known save rejections versus write-concern ambiguity; trusted metadata and private causes.

Six of these tests call the **installed MongoDB7.1.1 ClientSession.prototype.withTransaction implementation** with synthetic session state/start/commit/abort methods. They verify its local control flow: an uncertain commit can retry acknowledgement without replaying the target callback; safe transient abort can retry with another actor fence; terminal uncertainty and unknown callback errors do not become a new application mutation. This is stronger than replacing withTransaction itself in those cases, but **is still not a real ClientSession/server test**. Wire responses, error labels, transaction state, server conflicts and durability are supplied by the test.

The remaining HTTP tests run actual app/middleware/controller/JWT/bcrypt/Mongoose hooks against an in-memory adapter. They do not establish server isolation, BSON query equivalence, lock timing, majority durability, failover or native rollback. The earlier A04 controlled transaction tests and A06 deletion-boundary assertions remain unchanged and passing.

New [client account retry regressions](../client/tests/accountMutationRetry.test.js) add **8 tests** for registration, edit, deletion, profile/password changes and administrator creation/update/deletion API exports. Tests load actual module source with only Vite environment/module resolution substituted, and replace Axios transport with a throwing adapter. No request leaves the process. React/browser lifecycle, button resubmission and proxy behavior are not exercised.

During test expansion, two runs exposed fixture assumptions:20/22 then22/23 passed. Fixes were limited to synthetic case-insensitive ObjectId lookup and the installed Mongoose/MongoDB error-constructor shapes. No application assertion was weakened or existing test edited. Final completed suites below include all corrected regressions.

## 6. Commands and actual results

| Verification | Result |
| --- | --- |
| Baseline backend `npm test` |88 passed;0 failed/cancelled/skipped/TODO |
| First4 fault regressions before correction |0 passed/4 failed; confirmed reproductions |
| Same4 after correction |4 passed/0 failed |
| Final backend `npm test` |**111 passed;0 failed/cancelled/skipped/TODO**, exit0:88 existing +23 new |
| Client `npm test` |**16 passed;0 failed/cancelled/skipped/TODO**, exit0:8 existing +8 new |
| Client build to `<tool-temp>/uphsd-bookstore-a08a-build` |PASS exit0; Vite8.0.3,671 modules; existing753.13kB JS/>500kB chunk notice and outside-root output notice remain |
| Client-wide installed ESLint API/JSON run |FAIL exit1: **16 errors/13 warnings** across existing source findings; new test file introduces none |
| Targeted installed ESLint recommended JS + Node globals |PASS:6 changed/new runtime/test JS files;0 errors/0 warnings; in-memory configuration only |
| Backend `node --check` |PASS:57 JS files;0 failures |
| `git diff --check` |PASS; existing unrelated LF/CRLF notices remain |
| Native MongoDB integration, concurrency, recovery and provider verification |**NOT RUN**; unauthorized in A08A |

The unchanged JWT temporal/signature/version/bcrypt tests,178 route guard denials, administrator race tests, all ObjectId self-delete cases, and payment/receipt regressions remain passing. No test was removed, skipped or weakened to obtain these results.

## 7. Changed files and reasons

| File | Change |
| --- | --- |
| [accountMutationOutcome.js](../backend/utils/accountMutationOutcome.js) — new | Trusted indeterminate error, unknown-commit detection and conservative standalone-save wrapper |
| [adminAccountMutation.js](../backend/utils/adminAccountMutation.js) | Separate cleanup from primary outcome; track callback/finalization phase; stop uncertain callback replay; deny absent fence results safely |
| [UserController.js](../backend/controllers/UserController.js) | Use the wrapper for profile/password and administrative self saves; transactional target saves keep existing driver retry behavior |
| [errorMiddleware.js](../backend/middleware/errorMiddleware.js) | Add fixed uncertainty/retry metadata only for the trusted error type; retain sanitized messages |
| [accountFaults.test.js](../backend/tests/accountFaults.test.js) — new |23 permanent local fault regressions |
| [accountMutationRetry.test.js](../client/tests/accountMutationRetry.test.js) — new |8 actual client account API single-attempt/error propagation regressions |
| This report — new | Findings, reproduction, design, actual results and unresolved boundaries |
| `docs/UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md` | Dated additive execution summary only |

No User schema/save hook, token policy, auth middleware, canonical identity parser, route, client runtime/UI, financial/inventory/order logic, manifest, environment file or lockfile changed. All existing reports/tests and unrelated working-tree changes are preserved.

Final preservation comparison covered168 baseline files: only the three listed existing runtime files and implementation plan changed; the four listed new files were added; none were removed. Existing tests, previous reports, environment files and all three pre-existing lockfiles hash-match the baseline. The plan's original36,557 bytes remain an exact prefix. All31 relative documentation links resolve; private configured-secret comparisons across the eight delivered files found zero matches without printing secret values.

## 8. Remaining limitations and next action

1. **Real database outcomes remain unverified.** Separate authorization is required for an identified isolated transaction-capable MongoDB target, synthetic account writes, independent-client concurrency, injected network/commit/abort/cleanup faults and cleanup procedures. A01 read-only production grants do not authorize those tests. This phase does not assume transaction support or add a nontransactional fallback.
2. **No durable operation ledger/idempotency or automated reconciliation exists.** Classification is conservative; some provably local failures without a trusted phase marker also receive indeterminate status. A08A does not guarantee exactly-once HTTP delivery or deduplicate manual retries. Persistent deduplication/recovery would need a separately reviewed API/data design and approval before implementation.
3. **Post-response/transport ambiguity remains.** Socket loss, serialization/post-commit response failures or process termination can hide an acknowledged result. Metadata cannot reach a disconnected client. Consumers must not infer rollback from an untagged500 or absence of a response. The existing UI still displays its normal error message rather than a dedicated reconciliation workflow.
4. **Related financial transaction risks remain separately scoped.** Inspected OrderController and DebtPaymentController retain manual commit/abort paths and unawaited endSession calls; OrderController also performs population after commit. Abort/population/cleanup failures can complicate responses there. No payment, stock, settlement, refund or financial retry behavior was changed. Existing passing payment tests do not certify those fault paths. Extending fault handling there requires its own reviewed scope.
5. **Driver/protocol assumptions remain.** Safe native retries rely on correct transaction/error-label semantics and same-transaction commit acknowledgement. The synthetic driver-loop tests are not topology/protocol validation. Existing A07 native concurrency/BSON/barrier/backup risks remain.
6. **Operational and security gates remain.** Cleanup diagnostics require monitoring but are not a durable audit log. A01 provider/database/account/administrator/credential evidence remains unknown; historical credential exposure is unresolved. Client lint remains16 errors/13 warnings. No key rotation, live session invalidation, account recovery, production backup or deployment was performed.

Next recommended action: independent local review of this narrow diff and outcome contract, then explicit authorization of any missing local fault coverage or isolated MongoDB integration matrix. Broader financial handling, persistent reconciliation and UI changes require separate scope. Retain A03's version-aware rollout/rollback and epoch/key recovery gates.

**Stop for review. No MongoDB integration testing, A01 access attempt or production rollout follows from A08A.**
