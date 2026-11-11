# UPHSD Bookstore POS — local token-version implementation

Date: 2026-11-02, Asia/Manila. Existing LadyPos/ServeFlow checkout, baseline commit `2e9942e` plus preserved Phase10A/A02 and unrelated working-tree changes.

**Result: additive account token versions implemented and tested locally. Backend48/48 and client7/7 tests pass, with no TODO cases. No production readiness or deployment is claimed.**

Authorization covers local implementation and synthetic verification only. A01 remains blocked. No external service or configured database was connected; no real account, password, credential, session, environment file, lockfile, deployment setting or historical record was changed. Original audit reports remain historical evidence and were not rewritten.

## 1. Verified defects and implementation boundary

Reviewed the Phase10B, A01, implementation-plan and A02 evidence against current User schema/controller/routes, token generator, protect/authorizeRoles, password utility and tests. The baseline test run reproduced four token-reuse defects: password change, administrator reset, role demotion/restoration and unconfirmation/reconfirmation did not permanently revoke previously signed tokens. Phase10A already loads current roles/confirmation; that gate alone cannot remember an intervening security transition.

All current security writers use User document saves:

- `PUT /api/users/password` -> `UserController.updatePassword` verifies the current password and saves the replacement.
- `PUT /api/users/:id` -> administrator-only `updateUser` saves password, role and confirmation changes.
- `POST /api/users/register` -> administrator-only `createUser` creates an account; `seedAdmin` also uses model creation. No seed command was executed.
- Profile updates save only their existing allowed fields. Request-supplied tokenVersion is not forwarded by provisioning/profile/administrative controllers.

No current application query-update/bulk-update security writer was found. Keeping the existing save path preserves Phase10A hashing behavior and avoids a controller/service rewrite. No payment, inventory, branding, role definition or recovery policy changed.

## 2. Account state and JWT contract

One additive User field, `tokenVersion`, represents a nonnegative JavaScript safe integer. New accounts initialize it to0 during validation before insertion. Existing accounts with an **absent** field have effective version0 without a backfill. Null, strings, objects, arrays, fractions, negative and overflowing values never become zero through coercion.

The Mongoose field deliberately uses Mixed storage with a strict integer validator, rather than Number casting: invalid persisted types remain distinguishable and fail authentication. Valid application writes store numbers only. This is not a database collection validator, new collection, index or migration.

There is deliberately **no schema default** on hydration. Local inspection of the installed Mongoose9.3.3 showed that a hydrated default is included in later update deltas. A stale legacy profile document could otherwise write default0 over a newer epoch. Initialization only on new-account validation prevents that rollback; a dedicated regression covers the generated update and persisted result.

`generateToken` adds a signed `tokenVersion` claim and preserves account ID, existing role claim, HS256 and seven-day expiry. No password-derived value or secret is added. Existing bcrypt2a/2b/2y-compatible hashes remain usable without conversion. The token remains opaque to the unchanged client.

On protected requests, `protect` verifies the signature/algorithm and existing expiration checks, validates the claim and account ID, loads `_id role confirmed tokenVersion`, and compares the claim with current stored/effective state. Current persisted roles remain authoritative; JWT role claims do not grant permissions. Current confirmation and account existence remain required. No version cache or fallback to JWT role data was added.

## 3. Legacy-token policy and compatibility trade-off

The earlier A02 report proposed accepting a claim-less token while its account remained version0. That proposal was not an implementation. This local implementation adopts the safer strict policy described before the legacy check was implemented: **claim-less tokens are rejected; legacy accounts remain login-compatible.**

| Account/token state | Behavior |
| --- | --- |
| Missing stored field + newly issued numeric claim0 | Accepted if signature, expiry, current account and confirmation checks pass |
| Stored valid version + equal numeric claim | Accepted subject to current authorization |
| Claim less than or otherwise different from current version |401; fresh login required |
| Token has no version claim, including legacy signed tokens |401 even for effective version0; fresh login required |
| Malformed/unsupported claim type or range |401, with no zero fallback |
| Malformed stored field | No protected handler runs; generic500 through the existing safe error boundary; issuance also fails |
| Missing/deleted or unconfirmed account |401 on protected requests; existing unconfirmed-login403 remains |
| Account lookup unavailable | No protected handler runs; generic500 through existing safe error handling |

Unchanged version-zero **versioned** tokens remain usable. A prior legacy token does not become valid after a role/confirmation restoration or a future security event. No indefinite legacy exception, restart-relative grace period, new configuration option or alternate verifier was added.

This preserves existing-account/bcrypt authentication, not continuity of all old sessions. **A future rollout would require holders of claim-less tokens to log in again**, including unchanged accounts. That operational effect requires explicit deployment/cutover approval; it has not occurred. If legacy-session continuity is required, stop rollout and obtain approval for a fixed, nonrenewing compatibility deadline and tests. An unbounded version-zero exception would retain replay exposure on unchanged accounts. No grace-window policy is silently selected here.

## 4. Atomic security changes and concurrency

The User pre-save hook advances the epoch once for each successful save containing a changed password, role or confirmation state. A combined update advances once. Separate restoration changes advance again. Same-value role/confirmation assignments and ordinary profile saves do not advance it. An administrator reset to the same plaintext password still hashes anew and advances the epoch.

The hook places the security fields and next version in **one conditional updateOne**. Mongoose document `$where` supplies a normal query filter; no MongoDB JavaScript `$where` expression is used. The filter includes the document ID and expected version; expected0 matches numeric0 or an absent field, never null/string values. No separate post-save database increment occurs.

Concurrent security saves loaded at the same version cannot both match. One succeeds; a stale writer receives Mongoose DocumentNotFoundError, which the existing controller error boundary reports as a generic500. No partial security update is reported as success. Reload current state and repeat authorization/password validation before a deliberate retry; do not automatically retry a stale security snapshot. This conservative response preserves the existing error contract; friendlier conflict UX is outside this change.

The hook retains pending expected/next state and Phase10A's hash-retry marker in memory after a failed save, so a retry does not double-hash or advance twice. It clears/restores the conditional filter after success. A retry after another writer wins still fails its original condition. Persisted version/password do not change on a rejected write. In an ambiguous network acknowledgement case, reload instead of assuming either success or failure; a subsequent stale conditional retry cannot repeat the committed change.

Existing-account direct version reassignment through document saves is rejected. Overflow fails before the write; versions never wrap, decrease or reset to zero. No admin API accepts a client-selected version. Newly created accounts and approved security events are the only current application paths that populate this field.

Successful security changes return their existing responses, without a replacement/impersonation token. Prior tokens for that account fail on subsequent protected requests. Fresh login reads the current account and issues a matching token if the account is confirmed. The client currently keeps its cached token until its existing logout/login flow is used; automatic401 logout/storage changes were not introduced.

## 5. Changed files

| File | Reason |
| --- | --- |
| `backend/models/User.js` | Add validated field, new-account initialization, conditional atomic epoch advance and successful-save cleanup; preserve bcrypt hook/retry compatibility |
| `backend/utils/tokenVersion.js` — new | Shared strict account-version and claim validation, with only missing account state interpreted as0 |
| `backend/utils/generateToken.js` | Sign current effective account version in new tokens |
| `backend/middleware/authMiddleware.js` | Reject absent/malformed/stale claims and check current account version with existing role/confirmation lookup |
| `backend/tests/tokenSecurity.test.js` | Convert A02's four TODO security requirements into passing denial regressions; remove now-obsolete acceptance-of-vulnerability characterizations |
| `backend/tests/tokenVersion.test.js` — new | Hydrated synthetic accounts and conditional collection adapter covering compatibility, atomic writes, failures, concurrent writers and diagnostic safety |
| This document — new | Design, compatibility/rollout effects, evidence and remaining risks |
| `docs/UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md` | Append execution summary only; preserve previous entries |

No existing controller, route, client source, dependency manifest, lockfile, environment file or earlier report was edited in this implementation.

## 6. Regression evidence and actual results

Baseline immediately before source changes: backend34 cases,30 passed,0 ordinary failures,4 executed TODO failures; client7/7 passed. The TODO cases observed200 where401 was required. Original Phase10A25 cases passed. Client lint baseline was16 errors/13 warnings.

Final verification:

| Check/command | Actual result | Scope/limit |
| --- | --- | --- |
| Backend `npm test` | **48 passed,0 failed,0 TODO/skipped** | Actual routes/controllers, JWT/bcrypt and Mongoose hooks; mocked persistence, ephemeral local loopback HTTP only |
| Client `npm test` | **7 passed,0 failed/TODO** | Existing receipt rendering and A02 metadata-only Axios logging/interceptor regressions |
| Client `npm run build -- --outDir <tool-temp>/uphsd-bookstore-token-version-build` | PASS exit0; Vite8.0.3,671 modules | Existing large-chunk warning; output outside repository, no deployment |
| Client-wide installed ESLint, JSON formatter | FAIL exit1: **16 errors/13 warnings, unchanged from baseline** | Existing React hook/state, unused-variable and refresh rules; no client files changed |
| Targeted installed ESLint9 with recommended JS rules and Node globals, via in-memory config | PASS:6 changed/new backend JS files,0 errors/warnings | Backend has no lint script/config; no lint dependency/config installed or added |
| `node --check` across backend JS excluding node_modules | PASS:49 files,0 failures | Syntax only |
| `git diff --check` | PASS | Existing unrelated LF/CRLF notices remain |

Preservation review compared153 baseline files: only the five existing files listed above changed, three requested implementation/test/report files were added, and none were removed. Both environment files, all three pre-existing lockfiles, client source and all prior reports hash-match the baseline. The implementation plan's original25,007 bytes remain an exact prefix. Private comparisons found zero configured-secret matches in the six changed/new backend JS files and two delivered documents; no secret values were printed.

Token regression coverage includes:

1. Current versioned token accepted for an authorized confirmed account; seven-day issuance preserved.
2. Old tokens rejected after self-password changes and administrator resets; newly logged-in tokens work. Passwords remain bcrypt-compatible.
3. Role and confirmation transitions increment; old tokens remain rejected after restoration. Current ordinary roles receive403 at admin gates; unconfirmed accounts cannot log in or use current tokens.
4. Legacy missing-field accounts can log in using2a/2b/2y-compatible hashes without writing/backfilling; claim-less tokens fail before and after a version change.
5. Missing/null/string/fractional/negative/object/array/overflowing/unequal claims fail; invalid signature syntax, expired/not-yet-valid and unsupported signing-algorithm tokens fail.
6. Malformed stored versions fail on both access and issuance without coercion. Missing accounts and failed lookups never reach protected handlers.
7. Security fields and version share a single generated write; conflicting writers from stored/missing version snapshots have one winner. Reloaded retry advances again. This simulates conditional matching, not a live database concurrency test.
8. Failed writes preserve the old persisted password/version; retry hashes/increments once. Later saves clear the old condition. Version overflow and direct reassignment do not write.
9. Unrelated profile/same-state updates do not revoke; a stale legacy profile cannot restore epoch0. New inserts initialize0 and malformed new values fail validation.
10. Success/stale/malformed checks emit no account/token diagnostics. A synthetic driver error containing a synthetic token/key reaches only the existing constant500 log and generic response. A02 client redaction tests still pass.

Not tested: real MongoDB write concern/network failover/replica concurrency, live account/hash formats or version-field collisions, browser end-to-end reauthentication, deployed build parity, multi-instance rollout, provider permissions, real credential rotation or backup restore. No actual production token, hash or credential was retrieved. Test mocks do not establish those facts.

## 7. Performance and database implications

Phase10A already performs one account lookup for each valid protected request. This change selects one additional scalar in that lookup and compares it in memory; it adds no second lookup or session-registry query. Missing/malformed version claims fail before account lookup. Login adds the version from the already loaded account.

Security saves retain the existing read and single document write, with an expected-version predicate and scalar in the same write. No multi-document transaction is required for this one-account update. The existing ID index identifies the document; no version-only index is proposed. Contention produces a failed stale write instead of silent overwriting. No performance benchmark against a live workload was run. Current database availability remains required for protected access; there is no permissive cache during outages.

## 8. Future migration/deployment and rollback requirements

No migration or deployment command is supplied or executed. Missing-field semantics remove any need for a blanket backfill. Future live work remains subject to A01 target ownership/read-only evidence and explicit approval.

Before approving a release:

- Confirm actual deployment/Atlas database and legitimate recovery administrator access; review aggregate existing-field type/range/collision evidence without exposing sensitive account data.
- Approve the strict legacy-token cutover and expected fresh-login impact, or separately design/approve a bounded alternative before changing this policy.
- Coordinate every token issuer/verifier and security writer. Old verifiers bypass version checks and old writers omit increments; a mixed-version rollout cannot provide the claimed revocation guarantee.
- Verify acknowledged database writes and real conditional/concurrent behavior in an explicitly authorized isolated environment. No w:0/unacknowledged security-save path is authorized or introduced.
- Review restricted backup/recovery and rollback handling. Do not backfill, repair unexpected versions or modify existing accounts automatically. A database-level validator, other schema additions and data cleanup need separate approval.

Rollback must remain version-aware. Do not deploy the pre-version verifier, remove the guard, lower/unset stored epochs or restore old epoch values to recover compatibility: revoked tokens could regain access. If an operational rollback cannot preserve those checks, stop protected access while a compatible correction is reviewed. Account recovery must use a verified fresh login/authorized reset, never restored exposed credentials or hashes. No recovery operation was performed here.

## 9. Remaining risks and final gate

A01 environment, administrator legitimacy, actual credential validity and rotation remain unknown. Token versions do not contain a compromised signing key: someone holding that key can forge current-version claims. Existing source-history secret exposure, missing account audit/recovery/rate controls and broad existing roles remain separate findings.

The guard applies to the inspected User save writers, not direct database commands, future query/bulk updates, old deployed instances or privileged provider changes. Those writers must adopt atomic epoch advancement before use. Account deletion/recreation with an intentionally reused ID, manual epoch removal and restoring old account backups must not reset revocation history. No such operation is performed or approved.

A request already past authorization may finish while another request changes security state; this change does not cancel in-flight operations or provide per-device/global incident logout. Concurrent stale security writes currently produce safe generic500 responses. The client does not yet clear rejected cached JWTs automatically. Existing lint/build warnings remain. Real database and production compatibility require later authorized verification.

Local implementation ends here for review. Production migration/backfill, deployment, legacy-session cutover, account/credential remediation, session invalidation and all further phases require separate explicit authorization.
