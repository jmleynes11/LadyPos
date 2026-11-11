# UPHSD Bookstore POS — A07 consolidated security re-verification

Date: 2026-11-02, Asia/Manila. **Assessment: PASS WITH LIMITATIONS.**

The inspected local implementation enforces the seven-day JWT contract, guards the covered administrator account mutations against stale actor authorization, and blocks equivalent lowercase/uppercase/mixed-case self-delete IDs before deletion work. Fresh unchanged suites pass **88 backend tests and 8 client tests**. No new bypass of these three controls was identified in the reviewed paths. This is a local assessment, **not production readiness or native MongoDB concurrency/durability certification**.

Only this report and an appended implementation-plan entry are delivered. Application code and tests were not changed. No external service or database connection, migration, account/session/credential/permission change, deployment, environment/lockfile edit or dependency installation occurred. Local HTTP tests used synthetic credentials and mocked persistence. A01 remains blocked.

## 1. Method and evidence

Reviewed the historical [A03 review](UPHSD_BOOKSTORE_A03_TOKEN_SECURITY_REVIEW.md), [A04 remediation](UPHSD_BOOKSTORE_A04_SECURITY_REMEDIATION_RESULTS.md), [A05 verification](UPHSD_BOOKSTORE_A05_SECURITY_VERIFICATION.md), [A06 fix results](UPHSD_BOOKSTORE_A06_OBJECTID_SECURITY_FIX_RESULTS.md), and [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md). Historical assessments are preserved; A05's original FAIL is not rewritten.

Independently traced the actual issuer, middleware, all User account routes/controllers/save hooks, administrative mutation helper, canonical identity parser, mounted router checks and regression adapters. Also inspected the installed Mongoose save predicate/result handling and MongoDB driver's session/transaction error handling. Reran existing tests, build, syntax and lint checks without editing their inputs. No production token, account inventory, provider configuration or database record was inspected.

Primary source evidence:

| Component | Inspected evidence |
| --- | --- |
| JWT issuance and temporal policy | [generateToken.js](../backend/utils/generateToken.js), [tokenPolicy.js](../backend/utils/tokenPolicy.js) |
| Signature, account lookup, version and role enforcement | [authMiddleware.js](../backend/middleware/authMiddleware.js), [tokenVersion.js](../backend/utils/tokenVersion.js) |
| Account routes and mutations | [UserRoute.js](../backend/routes/UserRoute.js), [UserController.js](../backend/controllers/UserController.js) |
| Atomic actor guard and target security update | [adminAccountMutation.js](../backend/utils/adminAccountMutation.js), [User.js](../backend/models/User.js) |
| Canonical identity and deletion regressions | [accountIdentity.js](../backend/utils/accountIdentity.js), [accountIdentity.test.js](../backend/tests/accountIdentity.test.js) |
| Temporal/race/protected-route regressions | [a04Security.test.js](../backend/tests/a04Security.test.js), [a03TokenReview.test.js](../backend/tests/a03TokenReview.test.js), [tokenVersion.test.js](../backend/tests/tokenVersion.test.js), [tokenSecurity.test.js](../backend/tests/tokenSecurity.test.js) |

## 2. JWT security — PASS locally

- The inspected runtime has one JWT signer, called by login. It uses the shared **604,800-second** expiry. Newly issued tokens carry account ID, role, tokenVersion, iat and exp. Seven days is the established contract, not a new policy.
- `protect` explicitly permits HS256 signature validation only. Verification failures return generic401. The temporal policy then requires safe-integer iat/exp, nonnegative iat, exp greater than iat and current time, iat no later than current time, and exp-iat no greater than604,800 seconds. Missing, malformed, expired and overlong temporal claims cannot reach account lookup. There is no configured clock grace period.
- Token versions must be nonnegative safe integers and must match the current account. Missing/invalid token claims have no version-zero fallback. An absent **stored** version alone remains effective zero; malformed stored values fail closed. bcrypt2a/2b/2y login compatibility remains covered.
- Protected requests load current account existence, confirmation, role and tokenVersion. JWT role claims do not establish backend privileges. Missing/unconfirmed accounts and stale tokens return401; lookup failure reaches the sanitized error handler without admitting the request. Current persisted role controls administrator403 decisions.
- Existing route enumeration checks all11 mounted routers:59 protected method/path pairs reject anonymous, stale and claim-less requests, plus a HEAD rejection:178 HTTP denials. Login, minimal root/health diagnostics and CORS preflight are intentional public paths, not privileged mutation bypasses. No alternate runtime signer/verifier or unguarded mounted account mutation was found.

Fresh tests cover valid tokens, boundary expiration, wrong signatures/unsigned tokens, malformed claims, missing temporal claims, future issuance, excessive lifetime, stale/malformed versions, absent stored versions, failed lookups, and role/confirmation restoration without reviving old tokens. Login racing a security change may issue a stale token, but subsequent protection rejects it.

Limits: this is the inspected local route inventory, not proof about deployed or future consumers. Issuer/audience constraints and signing-key rotation were not added or verified. A compromised signing key is not remedied by these checks. Expiration and current-account checks occur at request admission; they do not cancel every request already executing. Real deployment clock alignment remains unknown.

## 3. Administrator authorization — PASS locally with transaction limitations

### Mutation inventory and ordering

| Path | Authorization/mutation boundary |
| --- | --- |
| `POST /api/users/register` | Current administrator admission, then actor write fence plus account insertion in one transaction |
| `PUT /api/users/:id`, self target | Canonical identity selects self branch; one target save includes admitted actor ID/admin/confirmed/epoch and target expected-version conditions |
| `PUT /api/users/:id`, other target | Actor fence and target save share one transaction/session |
| `DELETE /api/users/:id` | Canonical self-delete rejection first; other-account actor fence and deletion share one transaction/session |
| `PUT /api/users/password` | Current account/current-password validation and atomic password/version save; no administrator target selection |
| `PUT /api/users/profile` | Self-only profile whitelist; no role, confirmation, password or tokenVersion assignment |
| `GET /api/users` | Administrator check at admission; no mutation fence or universal in-flight cancellation |

The privileged helper constructs its predicate from server-owned `req.user`, including the version validated against the account at admission. It requires canonical actor ID, role admin, confirmed true and that original epoch. It does not substitute a later-loaded target's version for the actor's admitted authority.

For self updates, the controller attaches that guard to Mongoose document `$where`; the save hook combines it with the expected target version in the **same updateOne** as the security fields and incremented epoch. This document property is an additional query predicate, not MongoDB server-side JavaScript. BSON ObjectIds are retained in the predicate. A guard miss becomes DocumentNotFoundError and then401. The original restoration sequence therefore cannot load a newly demoted account and save it back to admin using the earlier authorization.

For other targets, the transaction performs a real `$inc:{__v:1}` actor write, checks acknowledged/matched/modified results, then performs the target operation in the same session. Snapshot reads, primary preference and majority write concern are requested. The existing actor `__v` acts as a write fence; merely administering another account does not increment its tokenVersion or change its updatedAt. Callback retries repeat the original actor guard.

**The precise guarantee is commit ordering, not cancellation at the instant a demotion request starts.** If demotion commits before the stale actor fence/self conditional write, the covered stale mutation must fail. If the administrative transaction acquires its actor fence first, its target mutation may commit before demotion commits. Its HTTP response can arrive later. The A04 tests exercise both intended orderings with controlled adapters. Previously admitted administrator reads and unrelated business requests are not wrapped in this account-mutation fence and may finish after revocation; the source does not implement global cancellation. This boundary must not be described as immediate revocation of every in-flight operation.

Security-sensitive target saves increment tokenVersion together with password/role/confirmation changes and condition on the expected prior epoch. Competing stale security saves fail rather than overwrite a later state. Version restoration does not revive prior tokens. The separate seed utility is an offline privileged account-creation entry point, not a public web route; it was not executed. Other applications, scripts or direct database writers are outside this verification.

## 4. Canonical ObjectId and self-delete — PASS locally

`canonicalAccountId` accepts strict24-character hexadecimal strings or trusted ObjectId instances supported by the installed driver, then returns the driver's lowercase hexadecimal representation. It rejects malformed lengths/characters, whitespace, arbitrary coerced objects, buffers and invalid/forged instances. Valid all-zero/all-digit IDs remain syntactically valid rather than being mistaken for malformed values.

`deleteUser` validates the target and compares canonical actor/target identities **before** invoking the administrative helper, target lookup or either deletion boundary. It reuses the canonical target for the operation. The helper also canonicalizes actor/target identities when choosing the self-update branch. Related account-management paths were inspected; no remaining raw case-sensitive identity comparison in these paths was found.

Fresh permanent tests establish:

- Lowercase, uppercase and mixed-case self-delete requests each return400 with the existing self-delete message.
- Each variant invokes **zero document deleteOne calls, zero collection deleteOne calls, zero sessions and zero actor fences**. Only the middleware actor lookup occurs; the account and its revision remain unchanged in the adapter.
- An authorized administrator can delete a different account using a case variant:200 and the expected transaction/deletion calls.
- Anonymous, ordinary-user, unconfirmed and stale-actor deletion requests are rejected without deletion or transaction work.
- Malformed PUT/DELETE IDs return400 before target lookup/mutation. A valid absent account retains404. Uppercase self-update still selects the atomic self guard.

The assertions that failed in A05 now pass in unchanged A06 permanent tests, including mixed case and both deletion boundaries. No separate replay of A05's transient stdin probe was needed or counted as an additional test. Actual ObjectId parsing uses installed BSON/Mongoose code; account persistence remains mocked. Routine response/request logging is not prohibited, and these tests do not claim the absence of every possible logging side effect.

## 5. Database atomicity, failures and uncertain outcomes

| Operation/failure | Source behavior and limitation |
| --- | --- |
| Self administrative update | One conditional document write, with majority concern; no multi-document transaction needed for this branch. Requires native verification of BSON predicates, acknowledgement and concurrency |
| Provision another account; update/delete another account | Multi-document transaction required because actor and target are different records. Deployment must support transactions, sessions and required concerns; no unguarded fallback exists |
| Missing/stale actor, guard miss | Fails before target callback; local regressions cover demotion/reset/confirmation changes and retry rechecks |
| Session/transaction unavailable | Error propagates; no fallback privileged target write. Synthetic transaction-unsupported regression passes. Availability on standalone/unsupported topology is not established |
| Target error or abort before commit | Awaited transaction rejection prevents success response. Adapter verifies staged actor/target rollback; this is not native rollback proof |
| Transient transaction/commit errors | Installed `backend/node_modules/mongodb/lib/sessions.js` `withTransaction` handles labelled retries. Adapter forces a simplified callback retry; it does not reproduce native conflicts, error labels, backoff or retry exhaustion |
| Unknown commit outcome or lost response | A failure response cannot prove no write committed. The driver can retry commits but can ultimately propagate uncertainty. Application has no durable operation-result/reconciliation protocol for these administrator writes |
| Cleanup failure | `finally { await session.endSession(); }` can replace an earlier result/error if cleanup throws. Installed driver suppresses many cleanup failures, but timeout/finalization failures remain possible. A05's synthetic demonstration remains relevant; no real post-commit cleanup fault was verified here |

No partial password/role/confirmation plus version update is apparent in the reviewed conditional-save implementation. Cross-account actor/target atomicity depends on actual MongoDB transaction guarantees. Conversely, an HTTP500 after a possible commit or during cleanup can coexist with a fully applied change; it is not evidence of a split transaction. Reload/reconcile authorized state before repeating an uncertain write. Do not reset epochs or blindly resend an old account snapshot.

No native transaction, database durability, backup recovery, replication/failover, majority-read visibility or cross-process locking test was run. An A01 read-only identity is not authorization for write-based integration testing.

## 6. Test quality and unresolved coverage

The suites execute real application routing, JWT/bcrypt code, Mongoose hooks and generated conditional writes against synthetic persistence adapters. A04 includes paused interleavings at target load, actor fence and commit, competing writes, callback retry, unsupported transactions and aborts. A06 spies on both document and collection deletion boundaries. The route enumeration prevents the inspected mounted business handlers from silently losing early protection.

Limitations retained from A05:

1. The transaction adapter implements its own in-memory lock/staging rules; it assumes the behavior it models. Its forced retry is not MongoDB's commit/error-label protocol. Filter matching is simplified JavaScript equality, not the full BSON query/type system.
2. The fence-first demotion test checks an unfinished promise immediately after starting a save. That assertion alone does not prove the competing writer reached a blocked native write. Its final event order provides adapter evidence only; a native test needs independent clients and an explicit writer-entered barrier.
3. Several older controller tests use an unconditional successful actor-fence mock. They prove controller compatibility, not actor legitimacy; negative A04 cases supply separate local checks.
4. Native multi-administrator cross-updates, same actor/multiple targets, deletion versus revocation, actor disappearance, profile/security contention, snapshot conflicts, cleanup faults, response loss and retry exhaustion remain incomplete. Permanent tests do not fully cover every false/absent fence-result variant and session-start/cleanup failure. A05 supplemental probes are historical evidence, not new A07 test runs.
5. Browser reauthentication/storage behavior, real stored malformed BSON values, actual legacy account inventory and deployed consumers are unverified. Client logout clears browser stores without invalidating server tokens. The401 interceptor logs sanitized metadata and rejects the error; it does not automatically clear cached identity or log out. Backend checks remain authoritative.

No application code or test was altered to improve counts or hide gaps.

## 7. Fresh verification results

| Check | A07 result |
| --- | --- |
| Backend `npm test` | **88 passed;0 failed/cancelled/skipped/TODO**; exit0; mocked persistence, local HTTP only |
| Client `npm test` | **8 passed;0 failed/cancelled/skipped/TODO**; exit0; receipt/logout/safe diagnostic coverage |
| Client `npm run build -- --outDir <tool-temp>/uphsd-bookstore-a07-build` | PASS exit0; Vite8.0.3,671 transformed modules; output outside repository |
| Build notices | Existing753.13kB JS bundle and >500kB chunk warning; outside-root output directory not emptied; no deployment |
| Client-wide installed ESLint JSON run | **FAIL exit1:16 errors and13 warnings**, independently confirmed unchanged |
| Targeted installed ESLint recommended JS + Node globals | PASS:15 reviewed runtime/test files,0 errors/0 warnings; no lint configuration or dependency added |
| Backend `node --check` | PASS:55 JS files,0 failures |
| `git diff --check` | PASS; existing LF/CRLF notices remain |
| Real MongoDB integration/concurrency/durability | **NOT RUN**, outside authorization |
| Provider/deployed account/credential verification | **NOT RUN / UNKNOWN**, A01 remains blocked |

Backend has no configured lint script. The targeted lint used the already installed client ESLint API with an in-memory recommended-JS/Node configuration. Its15-file scope covered the identity/admin/JWT utilities, auth middleware, User controller/model/route, test helper and five security regression files; it is not a repository-wide backend lint claim.

## 8. Remaining risks, next action and approval gates

- **Native transaction/concurrency and failure-result semantics remain open.** Next technical step is separately approved coverage of missing fault/barrier cases and cleanup/uncertain-result handling, followed by tests against an explicitly authorized isolated transaction-capable database with synthetic accounts, independent clients and an approved cleanup scope. No such connection or change is authorized by this report.
- **A01 remains blocked:** exact provider/deployment/database ownership, account collection, effective read-only grants, revision, account inventory, administrator legitimacy and credential lifecycle evidence are unknown. Local driver's fallback database name is not proof of the intended bookstore database. Do not bypass that gate.
- **Historical credential exposure remains unresolved:** no rotation, revocation or legitimacy determination has been performed. Local verification cannot establish whether exposed credentials remain valid.
- **Existing client lint, cached-role/storage/401 handling, recovery/audit/rate controls and broader permission/last-admin policy remain separately scoped.** No new policy is inferred.
- **Release/backup/rollback gates from A03 remain:** no downgrade to a verifier without epoch/temporal enforcement; no lowering/restoring old epochs or exposed keys. Database restoration can revive prior credentials/security state and needs coordinated approved recovery. Deployed transaction capability, clocks, artifacts, backups and recovery remain unverified.

Before production consideration, require the separate isolated integration authorization, completed A01 target/access verification, reviewed failure outcomes, explicit handling of existing lint/release blockers, and a specific rollout approval. **A07 does not authorize production rollout, A01 resumption, remediation, credential rotation, migration or session invalidation.**

## 9. Delivered files and preservation

| File | Change |
| --- | --- |
| `docs/UPHSD_BOOKSTORE_A07_SECURITY_VERIFICATION.md` | New independent local findings, evidence, test results and limitations |
| `docs/UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md` | Dated additive A07 execution summary only |

**Final assessment: PASS WITH LIMITATIONS.** The three targeted controls pass local re-verification; native database behavior, unresolved operational risks and production identity/readiness are not certified. Stop for review.
