# UPHSD Bookstore POS — A02 local security hardening

Date: 2026-11-02, Asia/Manila. Local baseline: `2e9942e` plus existing Phase10A fixes, audit/report history and pre-existing lockfile changes.

**Result: frontend diagnostic hardening implemented locally; token-revocation design prepared but not implemented pending approval.** Four executable security acceptance cases still fail under strict verification. This phase does not establish production security readiness.

This user-authorized **Phase A02: Local Security Hardening** is distinct from the older Phase10B report's approval label A02 for credential rotation. No rotation is authorized or performed here. A01 live verification remains blocked. No external service, configured database, real account, credential or active session was accessed or changed. Existing backend tests used ephemeral local loopback servers and mocked persistence only.

## 1. Review and confirmed current behavior

Reviewed [Phase10B security results](UPHSD_BOOKSTORE_PHASE_10B_SECURITY_RESULTS.md), [A01 verification history](UPHSD_BOOKSTORE_PHASE_10A01_VERIFICATION_RESULTS.md), the implementation plan and current source. Earlier reports remain preserved; their audit-baseline statements are not substituted for current implementation.

| Area | Current evidence and finding |
| --- | --- |
| JWT issuance | `backend/utils/generateToken.js` signs account ID/role using JWT_SECRET and seven-day expiry. No revocation/version/session claim is issued |
| JWT validation | `backend/middleware/authMiddleware.js` verifies HS256, account ID, current account existence/confirmation and persisted role. It does not bind a token to a persistent security revision |
| Password change | `UserController.updatePassword` verifies the current password, sets a new password and saves through the existing bcrypt hook. Existing tokens are not revoked |
| Administrator reset | `UserRoute` requires current administrator authorization; `updateUser` saves the reset password through the same hook. Existing tokens are not revoked |
| Role changes | Persisted roles govern the next protected request. Demotion removes admin permission, but restoration lets the same old token regain that permission |
| Confirmation changes | Unconfirmed accounts are denied; reconfirmation restores old-token access because no monotonic revocation state changed |
| Expiration/logout | Expired tokens are rejected. Browser logout is storage cleanup, not server revocation. No persistent session/version/revocation record exists |
| bcrypt compatibility | Existing2a/2b/2y-compatible hashes remain usable; no hash migration or plaintext fallback introduced. New writes continue using Phase10A's one-time hashing path |
| Frontend diagnostics | Raw Axios error objects, cached user data, order/debt payloads and selected IDs were logged. Axios errors can retain Authorization headers/config/request/response content even when backend error text is generic |

Actual source inspected includes User model/controller/routes, protect/authorizeRoles, generateToken/password utilities, frontend apiClient/AuthContext/error parsing, ExpensePage, DebtForm, PersonCard, ordersApi and ActiveProductsModal. No actual production account/hash/token contents are known or assumed.

## 2. Implemented local frontend correction

### Metadata-only diagnostic boundary

Added `client/src/shared/utils/safeDiagnostics.js`. It does not attempt to guess every possible secret inside arbitrary messages. It emits only:

- A fixed allowlisted event name; unknown event input becomes `client.failure`.
- A numeric valid HTTP status, when available.
- A known Axios error code, when available.
- An allowlisted HTTP method, when available.

Raw messages, response/request bodies, headers, URLs/query strings, stack traces, causes, cookies, passwords, stored user data and unknown codes/method strings are omitted. Consequently an unknown database/server secret in a returned error body is not copied into the diagnostic output. Unexpected object getters cannot make the formatter throw through error recovery. The formatter does not serialize raw Axios objects or invoke their toJSON methods.

Replaced error/storage console output with this boundary and removed request/selection payload logs. Only the centralized safe sink retains a console call in client/src. Its metadata still identifies the failing operation, HTTP status, request method and known transport code for debugging.

The401 interceptor logs the safe summary and continues rejecting the **original** error instance. It does not redirect, clear storage, revoke a session or alter requests. Existing forms, payment operations, product selection, API responses, user-facing validation/alerts and auth storage behavior are preserved. Original Axios objects remain available to existing callers; they are simply not emitted to console by these call sites.

### Implemented scope and limits

The changes cover application diagnostic output in inspected client source, including currently unused legacy components so they do not reintroduce raw logging if reused. This is not a promise to sanitize browser network inspectors, extensions, third-party capture tools, all user-facing error text or external logs. Existing backend Phase10A redaction is preserved. Deployed code/settings remain unverified under A01.

No session-storage redesign,401 logout flow, password recovery, capability redesign, credential rotation, dependency change or backend authentication change is included.

## 3. Token-revocation alternatives — approval required

The requirement is stronger than checking current role/confirmation: an old token must remain rejected after a security state changes **and later changes back**. Current-value comparisons alone cannot remember that intervening transition.

| Alternative | Compatibility and data/session effects | Assessment |
| --- | --- | --- |
| Compare JWT role/confirmation to current values | No schema addition, but changing back to the original value restores old access; password changes remain unbound | Does not satisfy permanent revocation requirement |
| Use User.updatedAt versus token issuedAt | Existing field, but unrelated profile changes invalidate sessions; timestamp precision, missing legacy dates, concurrent updates and clock boundaries require new policies | Broad side effects and fragile migration; not selected |
| Derive signing validation from password hash | Can bind new tokens to password changes, but legacy signed tokens need a transition; role/confirmation cycles still need persistent revision state | Does not solve the complete requirement without additional state; also must not expose hashes |
| Rotate the signing key | Invalidates all tokens sharing that key; production configuration/credential operation and account-wide logout | Prohibited here and not the targeted backward-compatible solution |
| Persistent per-session/JTI registry or denylist | Supports per-session/logout controls; adds durable session data/index/retention and more operational/query surface | Valid larger alternative if per-device revocation is approved; not minimal for current requirement |
| **Monotonic account tokenVersion/security epoch** | Additive User field and signed claim; legacy version-zero compatibility; revoke all prior tokens for only the account whose security state changes | **Recommended for approval**, not implemented |

No alternative above has been activated. Merely documenting an epoch does not fix current token replay. A compromised signing key remains a separate critical risk; token versions are not a replacement for approved credential containment.

## 4. Recommended backward-compatible design

### Proposed persisted state and JWT contract

Add one server-controlled User tokenVersion field: nonnegative safe integer, with0 as the defined initial compatibility version. Add a matching signed version claim to newly issued JWTs. Keep existing JWT algorithm, signing-key configuration, account ID, expiry and bcrypt comparison behavior unless separately approved.

Proposed legacy rule: a record with no version has effective version0; a valid legacy token with no version is accepted **only** while the account's effective version is0 and all current account/signature/expiration checks succeed. Once the account reaches version1 or greater, legacy/unversioned tokens fail permanently. Malformed, negative, noninteger or overflowing version values must not silently reset to0. Actual existing records/token formats remain unknown and require approved preflight before any production rollout.

Current persisted role/confirmation checks remain mandatory. A matching version is not authorization to assign roles, complete payments or bypass confirmation. The client must never choose/update an account version. No password hash, password-derived verifier or secret belongs in JWT claims.

### Proposed event semantics

Increment the version in the **same atomic User write** as each successful password change, administrator password reset, actual role transition and actual confirmation/security-state transition. Confirmation false->true and role restoration must increment again. The version must be monotonic and must never be rolled back to revive old tokens.

Use a reviewed account-security service with a single-document atomic/conditional update or equivalent proven concurrency strategy. Concurrent security changes must not lose increments, overwrite each other's security state or issue a new token from stale state. Hash a new password once through the existing tested password utility; if using query updates instead of save hooks, explicitly account for middleware differences and validation. Do not increment in an unrelated post-save write: that leaves a revocation race/failure window. Audit all current security writers, including provisioning/administrative utilities, before implementation.

Expected transition example: a token issued for version0 is denied after demotion at version1 and remains denied after restoring the original role at version2. An unchanged account's version-zero tokens continue to work. A new valid login reads the current version and receives a matching token. Account state alone must never substitute for revocation history.

### Proposed reauthentication policy for approval

Recommend that a security change invalidates **all previously issued tokens for the affected account**, including the caller's previous token, and requires a fresh login. A fresh valid token for the currently confirmed account must work. Administrator reset must not return an impersonation token for the affected user.

This affects sessions when a later approved implementation is used; it is not authorized by this report. An alternative is to issue a replacement token only after a verified self-password change while invalidating other tokens, but that requires an explicit client/session UX decision. Per-device logout/revocation and global incident logout remain separate scope. No current session was cleared or invalidated.

## 5. Schema, rollout, migration and recovery gates

This portion is stopped before implementation because the user requires approval before schema/migration/session-impact work.

| Required item | Proposed plan; not executed |
| --- | --- |
| Reason | Persist irreversible security-state transitions without invalidating every unchanged account's legacy JWT |
| Existing fields affected | User password/role/confirmed write paths; generateToken/protect and approved client reauthentication behavior. No product/payment/inventory field changes |
| Proposed schema | Add tokenVersion as a validated nonnegative safe integer; no collection/identifier rename or password-format conversion |
| Existing records | Define missing value as effective0. Prefer no blanket backfill; any explicit backfill must be separately reviewed/approved. Do not overwrite an existing unexpected field/value |
| Preflight | A01 remains blocked. Before real rollout, verify target, accounts/version-field collisions, legitimate recovery administrators, deployed consumers and relevant legacy token-format metadata without retrieving secrets |
| Backup | Approve restricted backup/recovery handling before any live data migration; do not copy sensitive account fields into reports |
| Rollout | Coordinate every authentication-serving instance. An old verifier that ignores versions would bypass revocation; an old security writer would fail to advance state. Review a controlled cutover and sensitive-write timing before deployment |
| Migration/session effects | Unchanged effective0 accounts retain otherwise valid legacy tokens under the proposed rule. Only a deliberate account security event advances its epoch; no silent bulk session invalidation or forced account reset |
| Rollback/recovery | Preserve stored versions and revocation decisions. Use a version-aware compatible rollback; never deploy an old verifier that accepts revoked JWTs, decrease epochs, restore exposed keys or restore insecure passwords. Recover legitimate access through verified fresh login/reset procedures |
| Residual risk | Version checking does not fix a compromised JWT key, unknown account legitimacy, missing recovery/audit, broad permissions, in-flight already-authorized requests or historical data integrity |

A future implementation needs actual regression coverage for concurrent updates, failed security writes, old/new claim compatibility, malformed versions, unchanged-account continuity, stale-version rejection after reversal, new login after changes and coordinated multi-instance behavior. The current local tests establish the gap and acceptance conditions, not those future guarantees.

## 6. Changed files

| File | Change/reason |
| --- | --- |
| client/src/shared/utils/safeDiagnostics.js — new | Central allowlisted diagnostic formatter/sink; no raw free-text/error serialization |
| client/src/shared/utils/apiClient.js | Safe401 diagnostic; preserves original rejection and request behavior |
| client/src/shared/hooks/AuthContext.jsx | Stop logging raw invalid cached user data; retain storage/session behavior |
| client/src/features/financials/pages/ExpensePage.jsx | Four raw Axios-error logs replaced with safe operation events |
| client/src/features/people/components/DebtForm.jsx | Replace raw submit error log |
| client/src/features/people/components/PersonCard.jsx | Replace raw operation errors; remove transaction payload log |
| client/src/features/orders/services/ordersApi.js | Remove order/request payload log |
| client/src/features/products/components/ActiveProductsModal.jsx | Remove selected-ID payload log |
| client/tests/safeDiagnostics.test.js — new | Synthetic secret exclusion, metadata preservation, actual interceptor rejection, nonmutation and source logging guard |
| backend/tests/tokenSecurity.test.js — new | Current token-gap characterization, explicit approval-blocked security acceptance cases and bcrypt/legacy compatibility |
| This results document — new | Findings, alternatives, proposed epoch/schema/session plan, actual tests and approval request |

No backend authentication/model/controller/runtime source changed. No environment files, lockfiles, package manifests, A01 report, implementation-plan entries or prior reports changed. No dependencies installed, provider/database accessed, account modified, credential rotated, active session invalidated or deployment performed. User changes and Phase10A fixes are preserved.

## 7. Tests and actual results

### Baseline before changes

Backend `npm test`:25 passed,0 failures/TODO. Client `npm test`:2 passed,0 failures/TODO. Existing first-party test commands use installed dependencies; no clean install or package update occurred.

### Implemented logging tests

Client `npm test`: **7 passed,0 failures,0 TODO**. Includes the existing2 receipt cases and5 new diagnostics cases:

1. Real synthetic AxiosError carries Authorization/cookies/password request fields and arbitrary server/message/stack/cause secrets; emitted output contains only expected event/status/code/method. Error serialization remains unchanged for callers.
2. Unknown event/code/method/status strings, raw stored-user-like input and throwing accessors cannot leak payloads into diagnostics.
3. Network/cancellation errors without responses remain useful; invalid statuses are omitted.
4. Actual apiClient interceptor, loaded with a nonsecret test base URL and mocked Axios adapter, logs safely and rejects the exact original error. No network request is made.
5. Source guard checks client/src console calls stay inside the safe diagnostic boundary; old raw call sites cannot silently return.

These tests do not use actual credentials or load provider/database configuration. No real browser, captured session or production error was inspected.

### Token security and compatibility tests

Backend default `npm test`: **34 cases:30 passed,0 ordinary failures,4 TODO security acceptance cases**. The original25 cases pass. New ordinary cases comprise4 explicitly named **KNOWN GAP characterizations** and1 bcrypt2a/2b/2y plus legacy-unversioned-token compatibility case. Passing characterizations mean the vulnerability was reproduced, not fixed.

The4 desired security assertions execute and currently observe200 where401 is required, after:

- Password change.
- Administrator reset.
- Role demotion and restoration.
- Unconfirmation and reconfirmation.

Fresh tokens for the current confirmed account are also checked as still valid. Default TODO annotations identify the implementation approval gate rather than hiding a completed fix. They must be removed/updated when a revocation design is approved and implemented; gap characterizations must then be converted to denial regressions.

**Strict gate executed:** in an isolated PowerShell test process, set A02_REQUIRE_TOKEN_REVOCATION=1, then run `node --test --test-name-pattern='SECURITY ACCEPTANCE' tests/tokenSecurity.test.js`. **Exit1:0 passed,4 failed,0 TODO.** Each failure is the expected current200-versus-required401 gap. This test-only process setting changes no environment file or application process. The default suite's exit0 is not revocation acceptance; the strict gate is red.

Actual controller/model save and auth/token paths execute with synthetic accounts, mocked collection methods and no database connection. Tokens/hashes are synthetic and never used against a live service. Default legacy tests use ephemeral loopback HTTP only; no external service connection occurs. Real concurrent database writes, historical account compatibility and production token contents remain unverified.

### Build, lint and review

| Check | Result | Limit |
| --- | --- | --- |
| Client production build to tool temp directory | PASS exit0, Vite8.0.3,671 modules; JS753.13kB/gzip227.79; CSS44.12kB/gzip8.95 | Existing >500kB chunk warning remains; no deploy or asset/network fetching |
| Client lint | FAIL exit1:16 errors/13 warnings | Prior baseline17/13. Caught storage error now used removes one unused-variable error; other pre-existing issues remain. No new helper/test diagnostics |
| New backend test syntax | PASS node --check; test execution also loads it | Not a real DB verification |
| Source logging inventory | Only safeDiagnostics has a console call under client/src | Static code guard, not third-party/browser-capture inspection |
| Diff review | Logging-only changes at existing call sites; no workflow/permission changes | Existing unrelated working-tree changes preserved |
| File/document preservation and secret check | PASS:7 existing client files changed,4 new helper/test/report files,0 removed;149-file baseline compared;2 relative report links valid;0 configured-secret matches in new files/report | All prior reports, backend runtime, environment files and all3 lockfiles hash-match baseline; no production inference |

No real database/provider/production API, A01 account inventory, credential rotation, recovery workflow, migration, global/session invalidation or deployment was tested or performed.

## 8. Remaining decisions and review gate

Approval is needed for the recommended additive tokenVersion design and its exact legacy-token compatibility rule, the covered password/reset/role/confirmation transitions, atomic/concurrent write strategy and affected-account fresh-login policy. Alternatives are recorded above; none is silently selected for implementation.

Recommended next scope for approval is **local implementation and synthetic tests of that reviewed epoch design only**, retaining A01's no-live-access gate. Any actual database migration/backfill, account change, production session invalidation, configuration/credential operation or deployment still requires separate authorization and the applicable verified-target safeguards. There is no need to reauthorize the completed frontend logging correction.

Existing exposed-secret/account-legitimacy risks, incomplete recovery/audit/rate controls, client storage/401 behavior, unrelated lint defects and broader bookstore role/data decisions remain. Do not interpret an epoch as incident credential containment or full production hardening.

Stop for user review here. No auth schema, migration, account-wide logout or further implementation follows automatically.
