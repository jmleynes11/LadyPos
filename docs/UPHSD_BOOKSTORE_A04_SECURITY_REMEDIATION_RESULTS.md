# UPHSD Bookstore POS — A04 local security remediation

Date: 2026-11-02, Asia/Manila. Existing LadyPos/ServeFlow checkout with preserved Phase10A, A02, tokenVersion and A03 work.

**Result: both A03 findings are resolved in the local implementation and passing local regression tests. Production deployment and real MongoDB concurrency/durability remain unverified and unauthorized.**

Final verification: **72 backend tests passed;8 client tests passed; client build passed.** No failed, skipped or TODO cases remain in those suites. Targeted lint passes; client-wide lint retains its existing16 errors/13 warnings.

Only local source, tests, this new report and an appended plan entry changed. No external service/configured database connection, production account/credential/token/session operation, migration, dependency installation, environment/lockfile edit or deployment occurred. A01 remains blocked. Prior reports retain their historical findings rather than being rewritten as if the defects never existed.

## 1. Review and policy basis

Reread A03's findings, token-version implementation/compatibility report and relevant implementation-plan entries against actual token issuance/verification, User model/controllers/routes, session handling and regression tests. Baseline backend `npm test` passed57 cases, including the two A03 characterizations that reproduced the defects. The source agrees with the reported findings; no conflicting behavior was assumed away.

The existing issuer uses `expiresIn: '7d'`. The approved token-version design explicitly preserves that expiry, and A03 proposes enforcing the existing seven-day maximum. **Seven days/604,800 seconds is therefore an established contract, not a newly invented session duration.** There is one inspected runtime token issuer. No alternate issuer, production configuration or production token was inspected.

Existing policy also establishes administrator-only account provisioning/administration, current-account role/confirmation authority, epoch increments on password/reset/role/confirmation changes and fresh login after those changes. This correction preserves those policies. It adds no self-role prohibition, last-admin rule, cookie/session redesign, grace window, recovery policy or new bookstore role.

## 2. F01 — token expiration: resolved locally

### Defect and correction

Previously `jwt.verify` checked the HS256 signature and honored exp when present, but did not require exp or limit exp-iat. A validly signed current-version token could omit expiry or exceed the issuer's seven-day contract.

Added `backend/utils/tokenPolicy.js` with a shared `ACCESS_TOKEN_LIFETIME_SECONDS` constant. Both issuance and protected-request validation use it. Issuance remains seven days and still supplies iat/exp automatically through jsonwebtoken.

After signature verification, before any account lookup, the middleware now requires:

- iat and exp are nonnegative/sensible safe-integer NumericDates matching the current issuer's format.
- exp is strictly after iat, and exp-iat is at most604,800 seconds.
- iat is not in the future; exp is strictly after the current server second.
- Existing HS256, nbf/expiration, ID, tokenVersion, current account existence/confirmation and persisted-role checks still pass.

There is no new clock grace period. Existing jsonwebtoken expiration/not-before validation has zero configured tolerance; the new temporal contract likewise grants none. Issuer/verifier clocks must agree sufficiently for deployment. Any future tolerance change requires review; an unbounded future iat must not extend effective lifetime.

Missing/malformed/expired/overlong tokens return the existing generic401. There is no fallback to an unexpired-looking version claim or legacy behavior. No issuer/audience scheme or signing-key change was introduced. A compromised signing key remains a separate unresolved exposure risk.

### Compatibility

Normal currently issued tokens already contain integer iat/exp separated by seven days. bcrypt2a/2b/2y login and the existing new-password hashing path remain compatible. Legacy accounts with an absent stored version still log in at effective version0 without backfill. Claim-less tokens remain rejected, including for those accounts. Malformed stored versions and missing/unavailable account lookups still fail closed.

Other previously accepted tokens lacking valid temporal claims now require fresh login. Only a future separately authorized deployment would apply that change to live sessions; no production session was invalidated here.

## 3. F02 — administrator demotion race: resolved locally

### Exact defect reproduced

`PUT /api/users/:id` first passes protect/authorizeRoles. Previously the controller then independently loaded the target and applied the requested role. In the A03 interleaving, demotion committed between authorization and that load. The controller loaded version1/role user and then saved role admin/version2, restoring privilege despite the original token being stale afterward.

Simply checking the role again would leave a check/write race. Binding only to the target's freshly loaded version would reproduce the same defect. Both actor authority and the target update need a concurrency boundary.

### Self-target update: one atomic conditional save

`protect` now retains the **validated current** tokenVersion in server-owned req.user alongside ID/role. No request-body version or JWT role claim is accepted as this authority.

For an administrator updating their own account, `adminAccountMutation` builds a predicate pinned to the admitted actor's ID, role admin, confirmed true and authenticated epoch. Version0 matches stored numeric0 or absence, never null/string values. The controller attaches this predicate to the document save. The existing User hook combines it with the target's expected-version predicate in the **same updateOne**. Object IDs remain BSON ObjectIds in the raw save condition.

If demotion, reset or another security change has committed first, the atomic write cannot match, even if the controller loaded the new target state or the role was later restored. A stale conditional self-save returns401 requiring sign-in; no role/password/epoch update commits. Self updates request majority acknowledgement. Legitimate authorized self-demotion/unconfirmation remains possible under the existing policy; no new role rule was imposed.

### Different-target mutations: transactional actor write fence

Account creation, another account's update/reset/role change and another account's deletion use the same helper. Otherwise an already-admitted administrator could still grant/reset a second account after being demoted.

Inside one transaction:

1. Conditionally update the actor using admitted ID/epoch plus current admin/confirmed state.
2. Increment the actor's existing Mongoose `__v` revision by1. This is a real write, not a second read or a no-op increment.
3. Require an acknowledged match **and a modified document** before running the target operation.
4. Read and mutate the target using the same session; preserve existing save hooks/password hashing and epoch increments.
5. Commit before returning success. Always end the session. Each driver callback retry rechecks the actor from the original admitted version.

The transaction explicitly uses primary reads, snapshot read concern and majority write concern. A real actor write provides the document write-conflict/locking boundary needed to serialize revocation with the different-target mutation. If demotion commits first, the guard fails or a conflicting transaction retries and then fails its original epoch predicate. If the privileged transaction obtains that boundary first, it completes before the competing demotion commits. It does not restore privileges after a committed demotion. This is serialization of mutations, not cancellation of every request as soon as a demotion is initiated.

The actor's tokenVersion and updatedAt are **not** advanced merely for administering another account. This avoids introducing a logout-after-every-admin-action policy or misleading account-update timestamps. The target's actual security changes still advance its version as before. Responses retain their existing fields; creation/reset does not return an impersonation token.

### Schema and operational consequences

No schema was edited. Local schema inspection confirms that `__v` is already the User model's Number version key; no new lock field/collection/index/backfill is introduced. The actor's internal revision is an additional write within the transaction. An old record missing __v can acquire that existing bookkeeping field through the increment; malformed/nonincrementable/no-op revisions fail closed rather than bypassing the guard. No existing record was changed in this phase.

**Cross-account administration now requires transaction-capable MongoDB.** Unsupported transactions, failed session creation, failed actor checks and transaction failures have no nontransactional fallback. This is an availability/release dependency. Existing financial flows already use MongoDB sessions/transactions, but actual target capability is still unknown under A01. Login and ordinary profile/self-password behavior were not wrapped in these administrative transactions.

## 4. Regression tests and actual results

### Existing cases preserved and strengthened

The two A03 characterizations remain in `a03TokenReview.test.js`, converted into stronger denial assertions: bad temporal claims receive401; the exact paused self-admin request receives401 and leaves role user/version1 intact. No test was deleted or disabled to get a green result.

The A03 collection adapter now evaluates the complete generated predicate, including the actor condition, instead of only the last target-version clause. Existing direct controller tests now supply a separate trusted administrator context and mock its session/fence. This represents the actual administrator reset/restoration workflow instead of bypassing authentication or letting a demoted fixture act as its own administrator. Prior password/role/confirmation, payment and receipt assertions remain.

### New A04 coverage

`backend/tests/a04Security.test.js` adds15 cases:

- Controlled clock: absent iat/exp, expiry boundary, expired/overlong lifetime by one second, malformed/string/null/fractional/overflowing claims, negative/future issuance all reject before lookup. Exactly seven days and a valid final-second token work; stale/missing versions remain denied; newly issued tokens and missing-field accounts remain compatible.
- Pause **after target load but before the self write**, commit a competing demotion, then resume. Both stored0 and absent-version accounts deny the stale role/password update and preserve the competing write. This complements A03's pause before target load.
- Pause an admitted cross-account update, creation or deletion before its actor fence; commit demotion; resume and verify401 with no target mutation or committed actor revision.
- Acquire the actor fence first, then start a competing demotion. The controlled adapter holds that write until the privileged transaction commits; the final state reflects commit-before-demotion ordering.
- Fail a transaction after staged changes: no success precedes commit, and neither actor revision nor target change commits.
- Retry after a simulated transaction abort and administrator demotion: original authorization is rechecked and the target stays unchanged.
- Provision/update/delete successfully as an unchanged administrator, including absent actor epoch; actor revision advances while its token remains usable and its epoch stays absent.
- Unsupported transaction support returns safe500 and performs no fallback write.
- Password reset, role restoration and confirmation restoration all keep an admitted actor stale despite its current admin/confirmed values.
- A successful callback retry commits one target epoch/password effect and one actor revision, with bcrypt compatibility preserved.

These cases use actual HTTP routing, guards, controllers, JWT/bcrypt, Mongoose query casting, hydration and save hooks with a **controlled asynchronous persistence adapter**. Promise gates create overlapping requests/writes; this is not just a sequence of completed handler calls. The adapter stages commits and models locks, however: it does not prove real MongoDB isolation, write conflicts, durable majority acknowledgements or network recovery. No real database concurrency is claimed.

### Executed verification

| Check | Actual result and limits |
| --- | --- |
| Baseline backend `npm test` |57 passed, including2 then-unfixed characterizations |
| Existing suite after corrections |57 passed; those2 cases are now denial regressions |
| New A04 isolated test file |Initially11 passed after correcting the harness;4 further epoch/retry cases added |
| Final backend `npm test` |**72 passed,0 failed,0 cancelled/skipped/TODO**, including existing login/authorization/payment/receipt tests and178 HTTP guard denials across11 routers/59 protected method/path pairs |
| Client `npm test` |**8 passed,0 failed/TODO**; receipt, safe Axios logging and logout/storage regressions |
| Client production build to `<tool-temp>/uphsd-bookstore-a04-build` |PASS exit0, Vite8.0.3,671 modules; existing753.13kB JS bundle remains; no deployment |
| Client-wide installed ESLint JSON run |FAIL exit1: **existing16 errors/13 warnings**; no client source changed and no new client regression |
| Targeted installed ESLint recommended JS + Node globals |PASS:11 changed/new backend JS files,0 errors/warnings; no dependency/config installation |
| Backend syntax checks |PASS:53 JS files,0 failures |
| Diff/whitespace review |PASS; existing unrelated LF/CRLF notices remain |

Some initial expanded runs stalled in the new test adapter: Mongoose cloned its plain-object mock session and separated the simulated lock/staging state. Those incomplete runs were not counted as passing verification. The mock now uses a class instance, preserving identity like a real ClientSession; cleanup gates release before server teardown. Temporary nonsecret phase traces were removed. Only previously identified stalled A04 test processes were stopped; application/unrelated processes were excluded. Final results above come from completed reruns.

Real MongoDB tests, staging/production API checks, provider metadata, production hash/token compatibility, server clock alignment, actual backup/recovery and browser end-to-end reauthentication were **not run**. New tests forbid Mongoose connection entry points; persistence is mocked and HTTP listeners are ephemeral loopback servers. No configured URI or production account was used.

## 5. Changed files and reasons

| File | Change |
| --- | --- |
| `backend/utils/tokenPolicy.js` — new | Shared established seven-day lifetime and strict temporal-claim predicate |
| `backend/utils/generateToken.js` | Issue using the shared unchanged duration |
| `backend/middleware/authMiddleware.js` | Enforce time contract before lookup; retain validated server-side actor epoch |
| `backend/utils/adminAccountMutation.js` — new | Admitted-actor predicate, atomic self-update condition and transactional different-target fence/session lifecycle |
| `backend/controllers/UserController.js` | Attach self predicate; execute provisioning/update/delete under the shared boundary; defer success until commit; reuse existing save hooks/DTOs |
| `backend/tests/a03TokenReview.test.js` | Convert both historical gap cases to denial regressions; enforce the full generated filter in the adapter |
| `backend/tests/a04Security.test.js` — new | Temporal boundaries and asynchronous actor/target/transaction regressions |
| `backend/tests/helpers.js` | Explicit external-admin fixture/session and complete account-filter matcher |
| `backend/tests/security.test.js` | Provide trusted actor context for provisioning/reset under the strengthened boundary |
| `backend/tests/tokenSecurity.test.js` | Use an independent authorized administrator for reset/restoration; retain old-token denial and bcrypt cases |
| `backend/tests/tokenVersion.test.js` | Supply authorized actor context while preserving atomic-version/stock-independent existing tests |
| This report — new | Outcomes, policy basis, evidence, compatibility and remaining gates |
| `docs/UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md` | Dated execution entry appended; prior entries preserved |

User schema, routes, client runtime, payment/inventory/business modules, environment files, manifests and dependency lockfiles were not changed.

Final preservation comparison covered159 baseline files: nine existing files changed as listed, four were added, and none were removed. All prior reports, schema/client files, both environment files and all three pre-existing lockfiles hash-match the starting baseline. The implementation plan's original29,005 bytes remain an exact prefix. Fourteen relative documentation links resolve. Private configured-secret comparisons across the eleven source/test files and two delivered documents found zero matches; no secret values were printed.

## 6. Remaining risks and release gates

- **Native database validation pending:** in a separately approved disposable target, verify actor/target conflict behavior with separate clients, transaction retries, acknowledged/ambiguous commits, self conditional writes, malformed/missing __v/version values and compatible driver/topology behavior. Do not replace those checks with these mocks or use A01 read-only production grants for test writes.
- **Operational change pending review:** account administration against another account adds a transactional actor revision write and can fail on standalone/unsupported deployments. There is contention on an administrator's document during its transactions; concurrent security changes may wait or retry. No live performance/latency measurement exists.
- **Clock/issuer compatibility unknown:** normal local tokens comply, but unverified issuers, malformed historical claims or clock differences can cause fresh-login interruptions after a future release. No grace exception or key operation was added.
- **A01 remains blocked:** exact deployment/database ownership, live versions/account inventory, legitimate administrators and credential lifecycle remain unknown. Local test success does not establish that any deployed defect is fixed. Do not infer bookstore ownership from the local test fallback.
- **Other security gaps remain:** historical credential exposure, recovery/audit/rate controls, client storage/401 handling, fine-grained permissions and last-admin policy still need separate scope. This patch does not make a compromised signing key safe or cancel every already-admitted business/read request.
- **Recovery must preserve security:** do not roll back to a verifier/writer that ignores epochs or time checks, lower epochs or restore old account state/keys to regain compatibility. Keep the A03 maintenance, backup, forced-login and version-aware recovery gates. Database restore, rotation, account actions and session cutover require explicit approval.

The next recommended action is review of this local diff/results, followed only by a separately authorized isolated native-MongoDB integration scope with exact target and write/cleanup permissions. A01/provider verification and production rollout are separate approvals and have not resumed. Local A04 ends here for review.
