# UPHSD Bookstore POS — A08A-R2 commit-boundary replay correction

Date: 2026-11-03, Asia/Manila. **Both original R1 no-replay failures are resolved locally. Verification: PASS WITH LIMITATIONS.**

The account transaction helper now observes the owned session's public commit method and checks its latest outcome **before allowing another actor fence or target mutation**. Commit errors and their labels are left unchanged for the driver's acknowledgement/retry protocol. Compound uncertainty cannot be consumed by a transaction wrapper and then silently replay account work. Known-aborted retries remain supported under the driver's error-label contract.

Final local verification: **129 backend tests and16 client tests passed;0 failures/cancellations/skips/TODOs.** The18 new R2 cases include both original R1 probes. Build, syntax and targeted lint pass; existing client lint remains **16 errors/13 warnings**. These are local synthetic persistence/session/wire tests, not native MongoDB validation. No production readiness or A08B authorization is implied.

## 1. Review and reproduction before implementation

Reviewed the [A08A results](UPHSD_BOOKSTORE_A08A_FAULT_HANDLING_RESULTS.md), [A07 review](UPHSD_BOOKSTORE_A07_SECURITY_VERIFICATION.md), [R1 review](UPHSD_BOOKSTORE_A08A_R1_REVIEW.md) and [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md) against current account controllers, save/authorization hooks, outcome/error middleware, helper/session lifecycle and installed MongoDB transaction source.

The baseline backend suite passed111 tests. Before changing runtime code, added two permanent acceptance cases corresponding to R1:

1. Installed withTransaction loop; synthetic commit applies a modeled effect, then throws code50 with UnknownTransactionCommitResult and TransientTransactionError.
2. Installed withTransaction **and commitTransaction**; synthetic executeOperation response has code50 and TransientTransactionError. The installed commit method itself adds UnknownTransactionCommitResult.

Both failed the original target-callback count assertion: **expected1, actual2**. Result: **0 passed/2 failed**, exit1. No real database was connected or mutated. The target role/epoch effects are in-memory test state, not production accounts.

The same two cases pass after the correction. Historical R1 findings and prior reports remain unchanged rather than being rewritten.

## 2. Actual lifecycle and why the earlier catch was insufficient

The installed runtime uses MongoDB7.1.1 through Mongoose. Its withTransaction implementation handles callback errors and commit errors at different boundaries:

- Callback TransientTransactionError can trigger abort and a whole-transaction retry. Existing application callback handling already makes an unknown outcome terminal by wrapping it in an application error without retry labels.
- A commit error arises **after** the application callback returns. The driver can retry the same transaction's commit acknowledgement, or start another transaction/callback according to its labels and timeout conditions.
- In the reviewed implementation, code50 is excluded from ordinary unknown-commit acknowledgement retry. A simultaneous transient label can then choose a fresh callback. An outer application catch is too late if the driver consumes that error and subsequently returns success.

Relevant installed source: `backend/node_modules/mongodb/lib/sessions.js`, commit error decoration around lines344–354, callback retry around565, and commit retry decisions around604–614. Those files were inspected, not edited. The new application guard does **not** branch on code50, copy the driver's retry loop, assign its own retry duration, rewrite labels, or patch node_modules.

### Correction

New [accountCommitBoundary.js](../backend/utils/accountCommitBoundary.js) installs a temporary observer on the **individual owned session instance's public commitTransaction method**. It calls the original method with the original receiver/arguments, returns its result, or records and rethrows the same error object unchanged. State belongs to that session/helper invocation, not a global retry flag.

Before each subsequent application callback attempt, the administrative helper asks the observer whether the latest commit failure permits target work. The check precedes the actor fence, account lookup and target callback. Only a transient commit failure **without an unknown-commit label** permits whole-transaction replay under the driver's existing contract. Unknown takes precedence when labels are compound. An unclassified commit failure does not authorize replay.

Same-transaction commit retries do not re-enter target work and remain fully owned by the driver. Acknowledged commit clears the pending failure. A later transient-only abort result can clarify a previous uncertain acknowledgement under that API contract; the legitimate fresh callback is then allowed and must repeat the original actor-version fence. The application does not manufacture confirmation from an HTTP status, exception string or a custom error code.

If the driver attempts a fresh transaction after an uncertain compound commit, its wrapper may still be **entered**, and the driver may start then abort an empty transaction. The target callback is not run again: there is no second actor revision write, role/password change or target effect. The fix prevents unsafe mutation replay; it does not claim to prevent every internal driver callback entry or empty transaction start.

### Per-boundary behavior

| Observed boundary/result | Allowed behavior |
| --- | --- |
| Callback abort with transient-only error; no uncertain commit | Driver may retry the transaction; original actor fence must pass again |
| Commit returns unknown-only/nonterminal uncertainty | Driver may retry acknowledgement for the same transaction; target work stays single |
| Commit returns non-timeout compound unknown/transient labels and acknowledgement later succeeds | Same-transaction acknowledgement retry remains available; no new target effect |
| Commit uncertainty leads driver to request another callback | Guard rejects before the actor fence/target, returning indeterminate outcome |
| Latest commit result is transient-only, indicating abort under the driver contract | Driver-requested fresh callback is allowed; it cannot refresh stale actor authority |
| Commit failure is unclassified or terminal | No application retry is initiated; preserve uncertainty rather than assert rollback |
| Session lacks an observable commit method or cannot accept the observer | Fail closed before withTransaction, actor fence or target work; still attempt session cleanup |

The common label predicate reads both supported hasErrorLabel and errorLabels representations. Compound-label tests also preserve RetryableWriteError alongside unknown/transient labels. The original exception and its label set are never edited by application code.

## 3. Error propagation, cleanup and compatibility

[adminAccountMutation.js](../backend/utils/adminAccountMutation.js) retains A08A's callback-error handling and cleanup separation. It now consults the observer before target work and retains the recorded primary commit exception if wrapper finalization produces a secondary exception. Unknown results continue using the existing trusted AccountMutationIndeterminateError and sanitized500 envelope:

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

The observer restores the original own-property descriptor, or removes its temporary own override when the method came from the session prototype. Restoration precedes endSession. Observer-restoration and session-cleanup failures emit fixed, nonsecret diagnostics and cannot overwrite an acknowledged result or primary failure. Causes, credentials, tokens, account records and driver details are not added to responses/logs.

No new schema, migration, operation ledger, persistent idempotency key, account version field or recovery policy was added. Account authorization, BSON identity predicates, User save hooks and token checks were not changed. Self-target conditional writes still follow their existing single-document path. Cross-account administration still requires transaction support; no nontransactional fallback was introduced.

The design uses public session methods and the actual driver's label contract rather than a version-specific copy of its internal retry algorithm. Verification covers the installed MongoDB7.1.1 implementation. A different driver/session implementation, an upgrade that changes public commit dispatch or label semantics, or nonconforming provider errors requires compatibility review **before** release; no such deployment is approved here. Server production of the R1 compound input after an actual commit remains unknown. The correction is conservative even when that input is synthetic or server-unreachable.

## 4. Permanent regressions and observed results

New [commitReplay.test.js](../backend/tests/commitReplay.test.js) adds **18 tests**. They execute the installed withTransaction loop with synthetic sessions, and the second original probe also executes the installed commitTransaction method with only the wire operation substituted. Assertions include observable modeled role/epoch state, applied-effect counts, returned value versus indeterminate rejection, response metadata, primary error identity, unchanged labels, and cleanup/restoration.

Coverage includes:

- Both original failing R1 probes: target callback1, actor fence1, commit attempt1, modeled applied effect1, epoch1, and explicit indeterminate rejection retaining the original commit error.
- Nested code50 write-concern shape and compound Unknown/Transient/RetryableWrite labels.
- Non-timeout compound and unknown-only acknowledgement retries: target callback1, commit attempts2, one modeled committed effect/epoch increment and acknowledged success.
- Confirmed-abort commit retry: target callback2, one modeled committed effect and epoch1. The abandoned attempt does not commit its staged change.
- Uncertainty followed by a transient-only abort signal: legitimate callback retry remains supported without duplicating a committed modeled effect.
- Actor revocation between confirmed abort and retry: second actor fence rejects401; target callback stays1 and modeled committed effects stay0.
- Unretryable commit failure with no modeled commit: still conservative indeterminate handling, never an invented guarantee that the real database rolled back.
- Compound uncertainty with both modeled applied and unapplied outcomes, plus cleanup failure: identical non-retryable uncertainty envelope and preserved primary cause.
- Unlabelled commit failure whose wrapper throws a secondary error: original primary cause retained.
- Acknowledged success plus cleanup failure, callback-level safe and unsafe label combinations, inherited method restoration, and missing/nonconfigurable observer failure before writes.

### Both original probes after correction

| Observation | Before correction | After correction |
| --- | --- | --- |
| Target callback invocations |2 |**1** |
| Actor fence writes |2 |**1** |
| Commit attempts |2 |**1** |
| Modeled committed effects |2 |**1** |
| Modeled target epoch |2 |**1** |
| Helper result |Reported success |**Indeterminate rejection**, primary cause preserved |
| Database connection state |Disconnected |Disconnected |

The driver can attempt a second empty transaction entry; that entry is denied before mutations. The table counts the protected target callback and its effects, not driver-internal wrapper entries.

Four existing test files had their session **adapters** extended with the public commitTransaction method, invoked at their modeled commit point. They previously exposed withTransaction but omitted that public method. This represents the real session API required for observation. Their original assertions remain unchanged; no case was removed, weakened, skipped or converted to a passing characterization. The A04 unsupported-transaction fixture also retains its intended withTransaction failure path instead of being accidentally rejected earlier for a missing mock method.

### Exact verification

| Check | Actual result |
| --- | --- |
| Baseline backend `npm test` |111 passed;0 failed/cancelled/skipped/TODO |
| First two permanent R1 regressions before runtime correction |**0 passed/2 failed**, both expected callback1 versus actual2; exit1 |
| Same two after correction |**2 passed/0 failed**, exit0 |
| Complete new R2 file |**18 passed/0 failed/cancelled/skipped/TODO**, exit0 |
| Final backend `npm test` |**129 passed/0 failed/cancelled/skipped/TODO**, exit0:111 existing +18 new |
| Client `npm test` |**16 passed/0 failed/cancelled/skipped/TODO**, exit0; unchanged client/runtime tests |
| Client build to `<tool-temp>/uphsd-bookstore-a08a-r2-build` |PASS exit0; Vite8.0.3,671 modules; existing753.13kB JS/large-chunk and outside-root output notices remain |
| Targeted installed ESLint recommended JS + Node globals |PASS:8 changed/new runtime/test JS files;0 errors/0 warnings; no config/dependency added |
| Client-wide installed ESLint |FAIL exit1: **16 errors/13 warnings**, independently confirmed unchanged |
| Backend `node --check` |PASS:59 JS files;0 failures |
| `git diff --check` |PASS; pre-existing unrelated LF/CRLF notices remain |
| Native MongoDB concurrency/protocol/durability or provider verification |**NOT RUN**, outside this phase |

Existing JWT expiry/signature/malformed-token and epoch checks, bcrypt compatibility,178 mounted-route guard denials, administrator demotion/actor checks, canonical lowercase/uppercase/mixed-case self-delete, and payment/receipt regressions remain passing.

## 5. Changed files and reasons

| File | Change |
| --- | --- |
| [accountCommitBoundary.js](../backend/utils/accountCommitBoundary.js) — new | Per-owned-session commit observation, replay eligibility, primary error retention and method restoration |
| [adminAccountMutation.js](../backend/utils/adminAccountMutation.js) | Install/consult/restore commit observer before target replay; retain primary finalization exception |
| [accountMutationOutcome.js](../backend/utils/accountMutationOutcome.js) | Share the label predicate; preserve the existing unknown-commit API and standalone-save behavior |
| [commitReplay.test.js](../backend/tests/commitReplay.test.js) — new |18 permanent R2 outcome/replay/cleanup/compatibility regressions |
| [helpers.js](../backend/tests/helpers.js) | Supply/invoke public commit method in trusted session adapter |
| [a04Security.test.js](../backend/tests/a04Security.test.js) | Supply/invoke public commit method at modeled successful commit; preserve unsupported-transaction probe |
| [accountIdentity.test.js](../backend/tests/accountIdentity.test.js) | Complete synthetic session API without changing identity/deletion assertions |
| [accountFaults.test.js](../backend/tests/accountFaults.test.js) | Complete synthetic session API without changing A08A fault assertions |
| This report — new | Reproduction, correction, actual verification, deferred risks and limits |
| `docs/UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md` | Dated additive R2 execution summary only |

No account schema/controller/route/authentication policy, client runtime/UI, order/payment/inventory/expense implementation, environment file, manifest, dependency lockfile or installed dependency was edited. Previous reports and unrelated working-tree changes are preserved.

Final preservation comparison covered173 baseline files: only the six listed existing runtime/test files and implementation plan changed; three listed files were added; none were removed. Prior reports, protected/unrelated source, both environment files and all three pre-existing lockfiles hash-match the baseline. The plan's original41,139 bytes remain an exact prefix. All35 relative documentation links resolve; private configured-secret comparisons across the ten delivered files found zero matches without printing values.

## 6. Five R1 financial/inventory characterizations — unchanged scope

R1's **five financial/inventory probe risks** map to four formal findings F02–F05; F03 contains two different stock risks. They are listed separately here to preserve all five requested items. R1-F01 is the account commit-boundary finding addressed by R2.

| R1 risk | Evidence reference | R2 disposition |
| --- | --- | --- |
| Repeating the same stock adjustment applies its delta again | F03; ProductController adjustStock | **Deferred; separate approval required.** No adjustment identity/ledger or stock policy was added |
| Concurrent stock read/modify/saves overwrite one adjustment | F03; absolute stock save without expected-state condition | **Deferred; separate approval required.** No stock write algorithm/catalog change |
| Second bulk-activation write fails after all products were deactivated | F04; two updateMany operations | **Deferred; separate approval required.** No activation transaction/compensation change |
| Identical partial-payment resubmission creates another payment while balance remains | F05; separate HTTP submissions have no durable identity | **Deferred; API/data policy approval required.** No payment deduplication or credit/refund/settlement rule invented |
| Financial abort/cleanup failure obscures an uncertain commit or primary error | F02; Order/DebtPayment manual lifecycle | **Deferred; separate financial fault-handling approval required.** The new observer is account-scoped and does not harden those controllers |

None of these five is claimed addressed by R2. R1's additional invoice/counter uniqueness, post-commit population, expense creation/replay, unchecked void restoration, and lost HTTP/manual resubmission limitations remain open. Unique indexes, persistent reconciliation or financial/inventory ledgers require their own reviewed data design and approval; no migration or business policy is inferred.

## 7. Remaining limitations and stop condition

- **Synthetic evidence only:** tests substitute account persistence, session state, commit/abort/wire outcomes and staged effects. They do not prove real server label combinations, document locking, transaction support, commit durability, majority acknowledgement, cross-client races, failover or resource recovery. A08B has not run.
- **Driver/session compatibility:** the public commit method must be observable on the owned session; missing/nonconfigurable methods fail closed before writes. Same-session use is scoped to one helper invocation. Different deployed drivers/adapters and future upgrades require review/integration before release. No installed driver behavior or retry timeout was rewritten.
- **Unknown is not failure:** the indeterminate envelope does not prove applied or rolled back state. Acknowledgement retry uses the driver's transaction protocol; a person/proxy making a new HTTP request is different. No durable request deduplication, operation ledger or automatic reconciliation was added, and lost responses still may carry no metadata.
- **Existing gates remain:** A01 deployment/database/account/administrator/credential evidence is unverified. Historical credential exposure, backup/rollback controls and existing client lint findings remain. No credentials, production accounts or active sessions were changed.

Next recommended action: independent local review of this diff and the expanded outcome/retry matrix. Only after review and **separate explicit authorization** may a confirmed isolated MongoDB target be used to verify native transactions, compound labels, concurrency and recovery. Such authorization must define identity/isolation, synthetic data, write/fault/cleanup rights and recovery controls. A01 read-only production access is not integration-test permission.

**Stop for review. Do not start A08B, production rollout, provider verification, credential remediation or broader financial/inventory implementation automatically.**
