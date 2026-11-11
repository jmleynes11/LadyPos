# UPHSD Bookstore POS — A05 read-only security verification

Date: 2026-11-02, Asia/Manila. **Assessment: FAIL.**

The two A04 target fixes pass the inspected local checks: the JWT seven-day contract is enforced, and the reported administrator-demotion restoration sequence is denied by the current guards. However, an additional synthetic HTTP acceptance probe found a bypass of the explicit administrator self-delete restriction. The canonical spelling of the caller's ObjectId returns400; an uppercase spelling of the **same** ID returns200 and invokes the mocked delete operation. This prevents a passing overall account-security assessment, even though the existing suites are green.

**No real account was deleted.** All probe persistence methods were mocked. No application code or existing test was changed. No external service/database connection, migration, deployment, dependency installation, environment/lockfile edit, credential change or production account/session operation occurred. Only this report and an appended implementation-plan entry are delivered. A01 remains blocked.

## 1. Review method and evidence boundaries

Reviewed the requested [A03 review](UPHSD_BOOKSTORE_A03_TOKEN_SECURITY_REVIEW.md), [A04 remediation results](UPHSD_BOOKSTORE_A04_SECURITY_REMEDIATION_RESULTS.md) and [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md). Then traced actual issuance, middleware, all User mutations, model hooks, mounted routers, existing regression adapters and relevant installed Mongoose/MongoDB driver code. The conclusions below do not assume the reports or passing mocks prove live behavior.

Reran the unchanged backend/client suites, client build and lint checks. Additional probes executed from stdin with synthetic identities/keys and mocked persistence; no probe file or permanent test was added. Only ephemeral127.0.0.1 HTTP listeners were used. Application startup, seed CLI and dotenv configuration loading were not invoked for the probes.

Assessment applies to this local checkout. Deployed code, database identity, account counts/legitimacy, real credential validity/rotation and provider permissions remain unknown. It is not a production audit or authorization to release.

Final preservation comparison covered163 baseline files: only the implementation plan changed, this report was added, and none were removed. Application source, all existing tests, prior reports, environment files and all three pre-existing lockfiles hash-match the baseline. The plan's original30,866 bytes remain an exact prefix. Eighteen relative documentation links resolve; private configured-secret comparisons in the two delivered documents found zero matches and printed no secret values. Whitespace verification passes.

## 2. JWT expiration and current-account checks

| Requirement | Source and test evidence | A05 finding |
| --- | --- | --- |
| Every current runtime access-token issuance has expiry | `backend/utils/generateToken.js:5`, shared `tokenPolicy.js:2`; `UserController.loginUser` is the inspected runtime caller | PASS locally: same604,800-second constant supplies expiry and validation; no alternate runtime signer found |
| Mandatory valid iat/exp | `tokenPolicy.js:4`; `authMiddleware.js:22`; A04 controlled-clock test | PASS: safe integers, nonnegative issuance, exp>iat, iat<=current second and exp>current second |
| Expired/excessively long-lived tokens | Same predicate plus jsonwebtoken verify; A03/A04 temporal cases | PASS: expired/equal-boundary expiry, absent claims and lifetimes above seven days reject401; exactly seven days remains valid before expiry |
| Signature/algorithm/malformed claims | `authMiddleware.js:18`; A03 wrong-key/none/raw-claim cases and tokenVersion regressions | PASS: HS256 allowlist, wrong signatures/unsigned tokens, malformed dates/IDs/versions and unsupported algorithms reject |
| Token-version revocation | `utils/tokenVersion.js`; `authMiddleware.js`; User save hook and reset/role/confirmation tests | PASS in covered local flows: stale versions remain denied after security changes and restoration; claim-less tokens never fall back to0 |
| Legacy missing account field | `accountTokenVersion`; User initialization/hydration tests | PASS: absent stored field alone has effective0; new versioned JWT/login works without backfill; malformed stored values fail closed |
| Current authorization | `authMiddleware.js` account lookup and authorizeRoles; security HTTP tests | PASS: persisted role/confirmation/existence govern access; a signed admin role claim does not elevate a current ordinary user |
| Lookup failure | Middleware error path, existing missing/unavailable lookup tests | PASS with mocked failures: no protected handler; missing/unconfirmed401, unavailable lookup safe500. Actual driver buffering/timeout behavior remains unverified |

Repository search found one runtime signer and one runtime verifier, with no decode-only alternative authorization path. All11 mounted business/account routers use protect on the reviewed59 protected method/path pairs. The existing runtime sweep again produced178 anonymous/stale/claim-less/HEAD denials. This is negative route coverage, not exhaustive successful business-operation coverage.

Public login, minimal root/health diagnostics and CORS preflight are intentional exceptions; none was found to dispatch a protected account mutation without its guard. The standalone seed is a separate privileged bootstrap writer, not an HTTP token bypass; it was inspected but not executed. Old deployments, direct database commands and external maintenance writers remain outside the verified source paths.

Time checks use zero configured tolerance. Alternate issuer compatibility and cross-instance clocks are unknown. Expiration is checked at request admission; this is not cancellation of all requests that expire while already in progress. Claim-less/invalid-temporal tokens require fresh login after any future release; no live session change occurred here.

## 3. Administrator demotion fix and atomicity

### Self-target updates

`backend/utils/adminAccountMutation.js:10` constructs the actor predicate from server-owned req.user: BSON account ID, current admin/confirmed state and the authenticated version. `UserController.js:219` attaches it to the self save. `models/User.js:35` combines that predicate with the target's expected-version filter in the same write, including role/password/confirmation and next epoch.

Installed Mongoose code confirms document.$where is applied to save filters and zero matchedCount becomes DocumentNotFoundError (`node_modules/mongoose/lib/model.js`, `_applyCustomWhere` and save result handling). The helper converts stale self-save failure to401. No separate authorization read or later version increment substitutes for this predicate. Majority acknowledgement is requested.

Existing tests deny the exact A03 sequence paused before target load, plus A04 interleavings paused after target load before write for stored0 and absent versions. The competing demotion remains stored; the stale request does not restore role or replace its password. **No local recurrence of the A03 self-restoration defect was found.** Native database conditional behavior has not been exercised.

### Different-target account administration

`UserController` routes creation, another account's update/reset and deletion through `runAdminAccountMutation`. Inside one session/transaction it conditionally increments the actor's existing __v revision, requires acknowledged/matched/modified counts, and runs the target read/write using that same session. It keeps the actor's tokenVersion/updatedAt unchanged merely for administering another account. Success is sent outside the helper after withTransaction returns.

Primary/snapshot/majority options are explicit. A04 tests model demotion before the actor fence, restoration/reset before the fence, failure before commit and callback retry; normal privileged flows also pass. The same original authenticated version is checked on each retry. Unsupported transactions fail closed; there is no unguarded or nontransactional fallback.

The intended ordering is important: **committed demotion first means denial; actor write fence first means the privileged transaction can finish before demotion commits.** A request may deliver its HTTP response after another event without its database mutation occurring after that event. Response timing alone is not proof of unauthorized retention. The inspected guard does not authorize role restoration after an already-committed demotion in its supported data model.

Real transaction isolation/write conflicts, deadlock resolution, majority durability and independent-client ordering are **not verified**. Cross-account administration needs a transaction-capable deployment; a standalone/unsupported target can lose this functionality by failing safely. Actual topology/grants remain unknown.

## 4. Confirmed additional finding — self-delete ID comparison bypass

**A05-F01: Medium severity; security acceptance FAIL.**

Evidence: `backend/controllers/UserController.js:229` compares String(req.params.id) with String(req.user.id). `utils/adminAccountMutation.js:25` likewise chooses its self-target path by string equality. MongoDB ObjectId hexadecimal spellings can differ in letter case while identifying the same account. The guard compares textual spellings rather than canonical identity.

The stdin-only HTTP probe used the actual app/router/protect/authorizeRoles/deleteUser/helper flow with a synthetic confirmed administrator and valid current-version token. Its mocked findById/deleteOne validated BSON ObjectId equality against the same synthetic account, so a different account was not substituted.

| DELETE input | Required self-delete result | Observed result |
| --- | --- | --- |
| Canonical lowercase spelling of caller's ID | Existing400 self-delete denial; no delete call |400;0 mocked delete calls |
| Uppercase spelling of exactly the same ID | Same denial |200; actor-fence path entered;1 mocked delete call |

A characterization probe exited0 after observing those results. A separate negative acceptance assertion required400 for the case variant and **failed exit1 with200 versus400**. That failing process also emitted a Windows/libuv shutdown assertion after the uncaught test assertion; the clean-exit characterization independently establishes the same routing/result, so the finding is not inferred from the shutdown diagnostic.

Impact is violation of an explicit administrator-account protection and possible loss of the caller's account/recovery access. This is **not** anonymous deletion, a signature/version bypass or evidence of a production deletion. Legitimate administrator authorization is still required. No claim is made that A04 introduced this comparison or that a last-administrator policy already exists.

Proposed next local remediation, requiring separate authorization: compare validated canonical ObjectIds consistently in the self-delete guard and helper dispatch, retain the existing self-delete restriction and add permanent canonical/uppercase/mixed-case regression coverage. Do not change last-admin, account deletion or recovery policy as a side effect. No fix was applied in this read-only phase.

## 5. Failure outcomes and partial-change assessment

Additional stdin-only fault/branch probes observed:

| Probe | Result and interpretation |
| --- | --- |
| Unacknowledged actor write, no actor match, or no modification | All3 rejected401;0 target callbacks; all3 created sessions ended |
| Session creation throws | Error propagated before target callback; no fallback work |
| withTransaction simulates successful completion, then endSession throws | Helper rejects; existing error boundary produces safe500 after the simulated completion marker |

The last result is an **outcome-reporting limitation**, not evidence of split transaction application. `adminAccountMutation.js:47–48` awaits cleanup in finally, so a cleanup exception can override a successful result. This fault injection does not prove the installed driver normally throws after a successful commit; its endSession implementation suppresses many cleanup errors. It identifies an untested error-boundary case.

More generally, a lost/unknown commit acknowledgement can yield a failed response even when the complete transaction applied. Installed driver source distinguishes callback retries and unknown-commit retries; the mock does not reproduce that protocol. The existing A04 rollback test fails before committing staged data. It cannot establish that **every500 means rollback**, nor that resubmitting a new HTTP request cannot repeat a completed administrative action. Reload/verify authorized current state before an operator retry; no automatic repair, epoch reset or new retry policy is approved here.

For a definite transaction abort, actor revision and target are designed to roll back together. Self saves are one conditional document update. No split-write path was found in inspected successful admin mutation code. Real failure atomicity and commit ambiguity still need native database verification.

## 6. Test quality and missing coverage

Strengths: real JWT crypto/bcrypt and Mongoose hooks/query casting execute; negative tokens fail before lookup; route inventory tests actual mounted routers; actor/target changes are interleaved with Promise gates; positive cases prevent simply denying all access. Prior A03 findings remain as strengthened denial assertions. No existing test was changed, weakened, deleted or skipped during A05.

Limits and missing cases:

1. **Database properties are encoded in the adapter.** A04's waitForLock/staged Map and synthetic commit/abort implement the very isolation/rollback behavior being modeled. Its view can read live backing data; it is not a real snapshot engine. Passing it cannot independently certify MongoDB concurrency.
2. **One barrier assertion is weak.** `a04Security.test.js:227–229` checks demotionFinished immediately after creating an asynchronous save. That alone does not prove the second writer reached a blocked database operation. Add an explicit writer-entered barrier in a later approved test change; still require independent database clients for integration proof.
3. **Matching and BSON semantics differ.** `tests/helpers.js:35` uses strict JavaScript field equality; its limited matcher does not implement all MongoDB type/array/query behavior. The fake increment uses JavaScript `(value ||0)+amount`. Malformed/missing __v and BSON version types, unsupported data shapes, numeric edge cases and raw concurrent corruption need native checks. This is a coverage risk, not a newly demonstrated token bypass.
4. **Some unit actors are unconditional mocks.** mockAdminActor returns a successful fence for an independent trusted fixture; these controller tests establish behavior/hashing, not actual actor legitimacy. A04's more complete adapter and negative actor cases supply additional local evidence, still without a database.
5. **Retries differ from the driver.** The adapter can force one retry rather than use actual error labels, commit retries and timeout/backoff. Add native transient/unknown-commit tests, network interruption, commit-success/response-loss, session-start/cleanup faults and retry-exhaustion cases under an approved isolated scope.
6. **More concurrent actor/target combinations are missing.** Different administrators mutating each other, same actor with multiple targets, concurrent target-only/profile updates, deletion versus revocation, actor deletion and both transaction orderings need independent-client tests. Do not replace these with sequential requests or assume no contention.
7. **Self-delete case variants are absent from permanent tests.** The A05 negative acceptance probe proves that a green72-test suite misses a real control-path defect. An approved correction must retain this case as a permanent regression.
8. **Live/UX boundaries remain untested.** Real stored formats, clocks, deployed consumers, browser reauthentication/account switching, provider settings, backup restoration and historical revocation preservation are unknown. Cached UI/logout behavior remains as documented; backend rejection remains authoritative.

No new permanent tests were added because A05 explicitly prohibits changes to existing tests/application code. The supplemental probes were process-local and nonpersistent.

## 7. Commands and actual verification results

| Check | A05 result |
| --- | --- |
| Backend `npm test` |**72 passed;0 failed/cancelled/skipped/TODO**; persistence mocked, local HTTP only |
| Client `npm test` |**8 passed;0 failed/TODO** |
| Supplemental self-delete acceptance |**FAIL exit1:** expected400, actual200; mocked delete invoked once |
| Supplemental fence/session/cleanup branches |PASS for their stated observations; cleanup fault exposes outcome ambiguity rather than proving a real commit |
| Client build to `<tool-temp>/uphsd-bookstore-a05-build` |PASS exit0, Vite8.0.3,671 modules; existing753.13kB JS/large-chunk warning; no deployment |
| Client-wide installed ESLint JSON run |FAIL exit1: existing16 errors/13 warnings |
| Targeted installed ESLint recommended JS with Node globals |PASS:13 reviewed runtime/test files,0 errors/warnings; no configuration/dependency added |
| Backend `node --check` |PASS:53 files,0 failures |
| `git diff --check` |PASS; pre-existing LF/CRLF notices remain |

Existing passing suites do not negate the failing supplemental acceptance criterion. No production/database integration test was attempted or labeled passing.

## 8. Unresolved risks, next action and approval boundary

1. **First action for approval:** scoped local canonical-identity/self-delete correction with permanent negative/positive regression tests, followed by repeat independent review. This report itself authorizes no implementation.
2. Review failure-result/cleanup semantics and strengthen the missing local barriers/error cases in a separately authorized phase. Preserve temporal/version guards and avoid blindly retrying uncertain administrative writes.
3. Separately authorize exact isolated native-MongoDB targets, permissions and test cleanup before executing the concurrency/durability/type/commit matrix. A01 read-only production grants are not write-test authorization.
4. A01 still needs confirmed service/project/database ownership, effective read-only access and nonsecret deployment/account/credential evidence. No provider target, administrator legitimacy, deployed fix or credential rotation is verified by A05.
5. Retain the A03 release/backup/strict-legacy/rollback gates. Historical signing-key exposure, incomplete recovery/audit/rate controls, client storage/401 handling, broader permissions and last-admin policy remain separately scoped risks. Do not restore old epochs/keys or relax validation to recover compatibility.

**Final assessment remains FAIL** because A05-F01 is a confirmed local account-protection bypass. JWT expiration and the covered A04 demotion fix pass local verification, with native database limitations. Production rollout, A01 resumption and remediation remain unauthorized. Stop for user review.
