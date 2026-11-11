# UPHSD Bookstore POS — Phase 10B account-security review

Date: 2026-11-02, Asia/Manila. Repository baseline: `2e9942e` plus the existing uncommitted Phase10A changes, lockfile changes and audit documents. **This phase is a read-only review and remediation proposal. No application code, test file, account, credential, active session, database record or environment setting was changed.**

## Executive summary

Phase10A's local account-provisioning, hashing, current-account authorization and backend redaction fixes remain present. The existing backend suite passes25/25. Synthetic observations additionally confirm that valid bcrypt variants remain compatible and current role/confirmation checks work, but password changes and administrator resets do not revoke old tokens.

The current local values of **MONGO_URI, MONGO_PASS and JWT_SECRET match the tracked HEAD versions**. These values remain retrievable from local Git history. Earlier startup code printed the database URI into a public log stream; the historical seed contained a fixed privileged password. This establishes exposure mechanisms and repository retention, not proof that a deployed service ran them or that anyone accessed them.

**Production credential validity, rotation status, deployed code, current accounts, actual stored password formats and past unauthorized access remain unknown.** No provider console, configured database, production API or real credential was used to test access. No rotation is claimed. Treat the potentially exposed material as requiring controlled verification and replacement; do not infer that the source fixes neutralized old secrets.

Highest-priority proposed actions are coordinated database/JWT credential containment, management-approved administrator/account review, and explicit session revocation on sensitive account changes. Their implementation and any real account operation require separate approval.

## 1. Scope, preservation and evidence boundaries

Reviewed the requested blueprint, implementation plan, security review, Phase10A results, requirements confirmation and database review, then reread the actual account model/controllers/routes, authentication middleware, token/password utilities, seed, app/diagnostics/error/logging code, client authentication/storage/API paths and existing security tests. The older documents intentionally describe the original audit baseline; their statements about missing hooks/public registration are not treated as the current source state.

The latest user authorization limits this Phase10B to account-security review. It does **not** authorize the broader capability/shared-membership/schema implementation previously listed under roadmap task10B. No GradeSense AI integration is introduced.

Evidence gathered:

- File hashing baseline:147 files, including both environment files, the two package-root lockfiles and `backend/node_modules/.package-lock.json`. Other dependency implementation files and Git internals were excluded from that preservation inventory.
- Local history review:42 reachable commits and396 relevant nondependency text blobs, using Git object reads. Sensitive values were compared only in memory; commands/results did not emit their values or secret fingerprints.
- Current scan:136 relevant first-party text/configuration/report files. Exact configured backend-secret values and the historical seed default were not found outside the actual environment files. No first-party local log files or configuration example/sample files were discovered. No repository build-output directory was present in the inspected tree.
- Backend tests:25 existing tests passed using synthetic documents/credentials, real handlers/hooks and mocked persistence/session methods. Local HTTP listeners were ephemeral loopback servers, not the configured application or database.
- Additional stdin-only probes:16 observations/assertions, plus1 Axios error-serialization check. No additional source/test files were written. Security gaps were tested as observations, not mislabeled as successful security controls.

Limits: the scan did not inspect provider logs, remote repositories, other clones, dangling/reflog-only objects, deployment secrets, CI logs/artifacts, backups, screenshots, browser storage or actual user records. Exact-value matching is not a complete detector of unknown, encoded, partial or transformed secrets. Absence of a local log file is not evidence that earlier service logs never existed.

Only this new report and an append-only implementation-plan summary are authorized writes. Final hash comparison confirms146 of147 baseline files unchanged, with only the plan changed and this report added. Environment files, all three pre-existing lockfiles, application/test source and other reports match the starting baseline. No baseline file was removed.

## 2. Confirmed controls retained from Phase10A

| Component | Current source evidence | Verified behavior / limit |
| --- | --- | --- |
| Administrator provisioning | `backend/routes/UserRoute.js:18`; `UserController.js:9` | Backend current-account/admin guards deny anonymous401 and ordinary-user403 before writes; administrator provisioning still works; no new user's token returned |
| New password writes | `backend/models/User.js:22`; `backend/utils/passwords.js:3` | Changed passwords hash once with bcrypt cost10; unrelated saves and failed-save retry preserve hashes; new-write6-character/72-byte validation; no bulk legacy conversion |
| Login | `UserController.js:51`; `User.js:29` | bcrypt comparison, generic invalid-credential401 and unconfirmed403; plaintext/malformed stored formats rejected |
| Protected requests | `backend/middleware/authMiddleware.js:16` and`:23` | HS256 verification plus current account/confirmation; persisted role replaces stale token role on each protected request |
| Self password change/admin reset | `UserController.js:133` and`:191`; `UserRoute.js:24` and`:28` | Self change requires current password; reset requires backend administrator authorization. Both save through the same hashing hook |
| Safe diagnostics | `backend/app.js:35`; `backend/index.js`; `backend/config/config.js:4` | Minimal root/readiness responses; no public log stream; constant connection messages; configured DB was not contacted |
| Backend error/log handling | `safeErrors.js:1`,`:30`; errorMiddleware/logger/responseHelpers | Existing tests verify generic5xx, redaction, legacy JSON-error wrapping and exclusion of request query/body credentials from request logs |
| Seed containment | `backend/utils/seedAdmin.js:8` and`:19` | Protected supplied password required; existing seeded account is not overwritten; no fixed password in current utility. Standalone seed was not executed |

All eleven mounted business/account router modules use `protect` either at router level or on each applicable route. Public login, minimal diagnostics and CORS preflight are intentional exceptions; the frontend guard is not the authority for protected API access. Finer business-action permissions are still incomplete as described below.

## 3. Findings, risk and controlled remediation

Severity describes potential impact, not demonstrated live exploitation. **Confirmed** means source/local history or synthetic behavior establishes the stated condition. **Unverified live state** means additional approved evidence is required before account/credential action.

### B01 — Critical: credential material retained in Git; live validity unknown

**Affected components:** tracked `backend/.env`, historical `backend/index.js`, provider/deployment credentials. `client/.env` is also tracked, but its API URL is a public configuration value and no embedded URL credentials were detected.

**Evidence:** MONGO_URI/MONGO_PASS/JWT_SECRET are present locally and equal their values in HEAD. Local history exact-value matches occur in `backend/.env`. In historical HEAD `2e9942e`, `backend/index.js:211` logs the URI,`:140` registers the unauthenticated log stream and`:70` serves the log viewer. These historical mechanisms have been removed from the working tree. Current root/readiness endpoints do not return configuration. The historical stream could disclose the URI if that version was run and accessed; actual deployment/access was not verified.

**Impact:** a still-valid database credential could allow access according to its actual provider grants, which are unknown. A still-deployed exposed JWT key could allow forged tokens for known confirmed account IDs. Current role lookup does not make a compromised signing key safe. MONGO_PASS has no direct current application reference, but may still duplicate a credential used elsewhere; do not assume it is harmless or delete it blindly.

**Recommended remediation:** first identify deployed instances, secret consumers and provider credential IDs through an approved operator. Preserve restricted access/audit evidence. Replace database credentials with reviewed least-privilege credentials, update authorized consumers through protected configuration, verify service operation, then revoke old credentials. Replace the JWT signing key across all serving instances in a coordinated cutover and explicitly approve resulting logouts. Never send replacement values through reports/chat/source. Rotation should precede any repository-history cleanup.

**Required changes:** credential rotation/provider access and deployment configuration; JWT rotation invalidates affected active tokens. No application-user records need changing merely to replace connection/signing secrets. No such action was performed.

**Compatibility/recovery:** JWT cutover requires reauthentication; mixed old/new-key servers can produce inconsistent authentication. Database cutover can interrupt service if consumers/grants are missed. Prepare a tested replacement credential and coordinated maintenance/recovery plan. If cutover fails, repair grants/configuration or issue another fresh protected credential; do not restore an exposed key as rollback. Preserve existing business data.

**Live decision:** current configuration equality is evidence of unchanged local files, not proof of deployed validity or proof that rotation never occurred elsewhere. Provider state, revocation records and deployed environment must be checked before claiming successful containment.

### B02 — High: password changes/resets do not revoke previously issued tokens

**Affected components:** `generateToken.js:3`, `authMiddleware.js:16`, `UserController.js:133`/`:191`, User schema and logout behavior.

**Evidence:** tokens contain account ID/role with seven-day expiration; no token version, password-change epoch, session registry or revocation check exists. P07/P08 confirm that the same synthetic token remains authorized after actual self-change/admin-reset handlers save a new hash. P13 confirms expiry rejection. P14 confirms that a different synthetic signing key rejects the old synthetic token; this did not rotate the real key.

**Impact:** an acquired token can outlive a legitimate password change/reset until expiration or another effective control intervenes. Browser logout clears browser storage only; no backend logout/revoke endpoint was found. A password reset alone is insufficient compromised-session recovery.

**Recommended remediation:** approve explicit revocation semantics before code work. A minimal compatible candidate is an additive account token-version/epoch checked against signed claims and incremented atomically with password/reset/security changes. Decide whether logout revokes only the current session or all sessions; per-session logout requires an appropriate session identifier/registry or equivalent design. Preserve the existing framework rather than rewrite authentication.

**Required changes:** approved application/model compatibility work, potentially additive database fields/backfill rules and deliberate session invalidation. No current field, token or session changed in this phase.

**Compatibility/recovery:** a migration must define handling of legacy tokens/records without a version; do not silently log everyone out or accidentally accept old unversioned tokens after an account epoch changes. Rehearse on synthetic data, retain invalidation state and a compatible app rollback. After incident containment, do not roll back by re-enabling revoked tokens. Provide a controlled reauthentication path and verified administrator recovery access.

### B03 — High: account state changes restrict access but do not permanently revoke a token

**Affected components:** `authMiddleware.js:23`; `UserController.js:198`/`:210`; current User confirmation/role fields.

**Evidence:** P09 confirms demotion removes administrator permission on the next protected request but the old token remains usable for ordinary access. P10 confirms promotion grants administrator permission to that same previously issued token without reauthentication. P11 confirms unconfirmation denies access, but reconfirmation restores the old token. P12 confirms a missing current account is denied. These operations used only synthetic in-memory account documents and mocked saves.

**Impact:** role/confirmation checks work as designed in Phase10A, but are not equivalent to revocation. A stolen token can regain access or elevated permission following account restoration/promotion. Already-authorized in-flight requests were not tested as cancellable.

**Recommended remediation:** include approved role and confirmation/security-state changes in the B02 revocation design; require reauthentication/step-up for sensitive privilege changes if approved. Separate an account's enabled state from irreversible token invalidation. Do not change any actual role or confirmation flag during review.

**Required changes:** application enforcement, possible token-version field and intentional session invalidation on approved events; account-role changes require a named approved account list, not inference from this report.

**Compatibility/recovery:** affected operators may need to sign in again after administrative changes. Preserve role/confirmation change history and an alternative verified administrator. Correct an erroneous role assignment through a separately authorized action, while retaining revocation state rather than reviving old tokens.

### B04 — High: administrator legitimacy/legacy seed exposure require a live account review

**Affected components:** historical `UserRoute.js`/`UserController.js:27`, historical seed and current users/admin operations.

**Evidence:** original source allowed public role/confirmation assignment and issued tokens; historical seed contains a fixed privileged credential retained in Git. Current admin-only route and protected-input seed are verified, but neither identifies how an existing account was created. No durable creator/security-event trail is stored. The current seeded account, administrator count, confirmation states and legitimacy were not queried.

**Impact:** if the old registration/seed was used, an unwanted administrator or known default credential may remain. Conversely, arbitrary disable/reset/removal could lock out legitimate administrators and orphan historical ownership. Current code blocks self-delete (`UserController.js:225`) but does not protect the last administrator from self-demotion/unconfirmation or other removal paths.

**Recommended remediation:** after approving read-only live access, inventory only necessary account metadata, role/confirmation, creation/update dates and password-format counts. Do not export hashes/passwords/tokens. Management must reconcile administrators against an authorized roster, provisioning evidence and available provider/access logs. Treat uncertain accounts as a review finding; select targeted resets/restrictions only through explicit approval. Approve last-admin/step-up/audit rules before implementing them.

**Required changes:** initial inventory is read-only; later named account resets/role/confirmation changes and session invalidation are separately authorized database/account actions. Do not automatically delete or disable suspected accounts. No account inventory or remediation was performed here.

**Compatibility/recovery:** maintain a verified legitimate administrator and protected backup/restore procedure before account changes. Preserve account IDs and transaction ownership/history. Recover a legitimate user's access through verified identity and fresh credentials, not the historical default password. Do not restore an unverified privileged assignment as an automatic rollback.

### B05 — High where insecure records exist: live password formats are unknown; recovery is incomplete

**Affected components:** User password records, `User.js:29`, password utility/controller, `LoginPage.jsx:92`, account routes.

**Evidence:** synthetic bcrypt `$2a$`, `$2b$`, `$2y$` hashes authenticate (P01); plaintext/malformed hashes are rejected without conversion (P02). A bcrypt hash of an older short password remains comparable (P16); the new-write minimum is not applied retroactively. Actual database format counts/costs are unknown. New writes use bcrypt10; validators enforce6 characters/72 UTF-8 bytes. Self-change verifies current password and administrator reset is protected, but no recovery token, delivery, identity-verification, one-time-use/expiry, reset notification or forced-change mechanism was found. The Forgot Password button has no handler/link and there is no corresponding recovery API.

**Impact:** pre10A raw-password records, malformed values or double-hashed history may be unusable and remain sensitive if plaintext exists. A structurally valid bcrypt hash does not prove its owner or password is secure. An account with an unknown/forgotten password cannot use the current self-change route; a generic recovery claim would be false. Existing credential policy/rate controls warrant approval review, not a silent policy change.

**Recommended remediation:** privately classify formats/cost ranges through approved aggregate queries, never by logging values. Retain existing bcrypt verification for compatible accounts. Use management-approved out-of-band identity verification for targeted resets; do not guess plaintext, bulk rehash existing values or introduce plaintext fallback. Approve a recovery design with short-lived single-use protected reset challenges, authorized delivery, safe anti-enumeration responses, attempt limits, audit and B02 revocation, or explicitly retain a documented administrator-assisted process. Decide new-password policy/forced-change requirements separately.

**Required changes:** format inventory is read-only; targeted password resets affect records and require explicit account approval. A recovery/forced-change design may add model/API/configuration and delivery-service dependencies; none is approved or installed in this phase.

**Compatibility/recovery:** keep known-good bcrypt records unchanged. Older short passwords remain login-compatible until an approved reset; new writes obey current validation. A future reset should record success/identity approval without storing plaintext and preserve user IDs/history. Failed delivery/process must not consume the only legitimate recovery path. Do not roll back by restoring plaintext or an exposed old password.

### B06 — High for role separation: confirmation is consistent, finer permissions remain broad

**Affected components:** eleven backend routers, ProductRoute, order/payment/invoice/expense/dashboard routes, User roles.

**Evidence:** source inspection finds backend `protect` on all current staff/business routes and consistent current-account confirmation checks through that middleware. Account management/provisioning has administrator guards. Product routes allow both existing roles; several other business routes require authentication without a finer capability guard. User schema still defines only `admin` and `user`. Existing owner filters are preserved; there is no new shared-store or bookstore role matrix implementation.

**Impact:** confirmation enforcement is not missing in the current code, but it does not establish separation among cashier, inventory staff and manager actions. A confirmed ordinary user still has broad existing business powers within the current owner scope. The correct reductions and account mapping are business decisions, not assumptions that may be enforced during this review.

**Recommended remediation:** approve capability/action and sensitive-data visibility rules, identify current users to map and implement backend allow/deny tests consistently across aliases before any future role/data migration. Preserve owner scoping until a separately approved shared-store design exists.

**Required changes:** explicit permission policy, application enforcement and possibly additive role/membership records/migration. Existing role assignments must not be remapped without approval. No current permissions were changed.

**Compatibility/recovery:** new restrictions may change legitimate operations; stage with representative staff and explicit allow/deny criteria. Keep approved provenance/mapping and compatible app rollout controls; do not recover from a failed migration by opening unrestricted shared data or silently escalating accounts.

### B07 — Medium/High on shared devices: browser token/storage behavior needs a coherent policy

**Affected components:** `AuthContext.jsx:15`,`:25`,`:64`,`:84`; `DashboardGuard.jsx`; `apiClient.js:15`.

**Evidence:** user data is written to localStorage even when remember is false; token/user restoration prefers localStorage over sessionStorage. A session-only login does not explicitly clear an earlier local token. Failed login clears localStorage but not previous sessionStorage. Authentication UI is based on cached user presence; a401 interceptor only warns. Logout clears both stores but does not revoke a backend token. These are source findings; no actual browser account/storage was inspected.

**Impact:** stale stored identity/token combinations or retained account data can confuse account switching and shared-device use; cached roles may disagree with the backend. Tokens readable by page JavaScript are exposed if a script compromise occurs. This is not evidence that an XSS attack or actual cross-account action occurred; current backend checks remain the authority.

**Recommended remediation:** approve one consistent remember/session/logout/account-switch policy. Clear obsolete opposite-store auth keys during successful login and both relevant auth stores on failure/logout as designed; avoid clearing unrelated application storage. Validate/refresh identity and handle401 centrally. Couple any revocation requirement with B02. A cookie-based redesign is not implicitly approved and would require its own CSRF/CORS/security design.

**Required changes:** client/session handling and any approved server logout/revocation support; no existing browser session may be cleared during this review. No database change is needed for storage cleanup alone.

**Compatibility/recovery:** define whether users will be signed out during transition and how an interrupted legitimate cart is handled. Rehearse separate accounts/tabs/reloads; recover through a fresh valid login, not by restoring stale browser tokens. Do not change payment/order states as a side effect.

### B08 — Medium/High: frontend console logging can bypass backend redaction

**Affected components:** `AuthContext.jsx:37`; `ExpensePage.jsx:35`,`:57`,`:88`,`:97`; `ordersApi.js:20` and additional legacy debug statements.

**Evidence:** AuthContext logs raw invalid stored user data; ExpensePage logs whole Axios error objects. Axios requests attach bearer authorization. L01 confirms that a real AxiosError's config and serialization retain a **synthetic** Authorization header. Combined with the raw console calls, this establishes a potential token/PII logging path; actual browser capture or disclosure was not observed. Order debug statements also log customer/payment-related payloads. The Phase10A server JSON wrapper does not sanitize browser console objects.

**Impact:** browser diagnostics, shared-device access or console/session capture tooling can receive credentials or personal/payment-reference data even when server error text is generic. This does not contradict the successful backend redaction tests; their boundary is narrower.

**Recommended remediation:** in a separately approved focused change, replace raw client error/payload/storage logging with minimal safe messages/correlation references. Do not serialize Axios config/headers/body or cached user data. Use a central redacted client diagnostic helper if justified and add synthetic header/PII regression cases. Review any real captured logs under controlled access before deciding retention/deletion.

**Required changes:** client logging/test code; no account/database change for the code fix. If actual leaked tokens are established, approve affected-session invalidation and review captured-log handling separately. No logs or sessions were modified here.

**Compatibility/recovery:** operational diagnostics will be less detailed but safer; retain nonsecret error codes/status. Roll back functional UI changes independently while retaining redaction. Never restore raw credential logging as recovery.

### B09 — Medium/High: recovery, brute-force and sensitive-action audit controls are incomplete

**Affected components:** public login, admin reset/role/confirmation changes, User model and middleware.

**Evidence:** no application login/reset attempt limiter, MFA/step-up challenge, password-reset notification, durable security-event trail or per-session device inventory was found in current first-party routes/models. Provider/edge controls are unknown. Valid administrator bearer access permits reset/role/confirmation updates without a further challenge. Existing tests verify the current authorization boundary, not these absent controls.

**Impact:** automated guessing and misuse of a compromised administrator session are harder to contain or investigate. This is a code-control gap, not a claim that brute-force attempts occurred or that no external protection exists.

**Recommended remediation:** approve threat-appropriate login/recovery throttling and privileged-action reauthentication/audit requirements. Determine which controls exist at the actual deployment edge first. Record actor/target/action/time/result and approved reasons without passwords/hashes/tokens. Avoid lockout rules that enable denial of service without a confirmed policy.

**Required changes:** application/edge configuration, possibly durable audit records and approved dependencies; no automatic account lockout/disable or new authentication factor in this review.

**Compatibility/recovery:** assess staff workflow/network sharing before enabling limits; keep controlled verified recovery access and operational monitoring. Adjust an approved overly strict limit without erasing audit evidence, restoring exposed credentials or broadly disabling authorization.

## 4. Credential and account compatibility conclusions

| Item | Current result | What is not established |
| --- | --- | --- |
| bcrypt2a/2b/2y | Synthetic fixtures compatible through the actual login flow | Actual live format/cost distribution and integrity of any particular record |
| Existing shorter-password bcrypt | Comparator remains compatible; new-write rules are separate | Management acceptance of legacy password strength or need for targeted resets |
| Plaintext/malformed format | Rejected without fallback/conversion | Which accounts have these values; no database hashes inspected/exported |
| Double-hashed legacy record | No automatic repair mechanism; a bcrypt-looking outer hash alone cannot prove the original password is usable | Extent of any double-hashed history; do not classify it as good merely from prefix |
| New/change/reset/seed writes | Existing25-case suite and probes confirm one hashing path | Real provider/database write success; current legitimate administrator recovery access |
| Existing JWT after password/reset | Synthetic old token still accepted | Actual issued-token inventory or stolen-token incidence |
| Role/confirmation transitions | Current role enforced; denial/restoration behavior observed | A confirmed staff matrix or permanent token invalidation |
| Current local secrets | Equal committed baseline; material remains in Git | Provider validity, production values, previous rotations or compromise |

No password recovery, account legitimacy or credential rotation is marked complete on this evidence.

## 5. Recommended controlled execution sequence — not authorized for execution

1. **Approve scope/operator and obtain evidence.** Identify the actual deployed version/environment/secret consumers, access to provider audit/revocation records and a legitimate administrator recovery contact. Establish restricted evidence/backup handling. Provider verification must not disclose secret values in logs or this report. Do not assume the working tree is deployed; HEAD still contains the historical pre10A implementation.
2. **Coordinate B01 containment.** Prepare least-privilege replacement database credentials and a new JWT key through an approved secure channel; plan consistent deployment/configuration and service checks; explicitly approve affected-session logout. Revoke old credentials only through the approved cutover. Retain evidence of completion with credential IDs/status/time, never secret values. A failed rotation must use a fresh recovery credential rather than restore a potentially exposed one.
3. **Perform approved read-only account profiling.** Return necessary metadata and aggregate password-format/cost counts, not hashes/passwords/tokens. Reconcile administrator accounts against the management roster and provisioning/access evidence. Confirm who may perform recovery and last-admin protections before changing accounts.
4. **Approve exact remediation targets and session semantics.** Select named legitimate/suspect accounts and actions; separate password reset, role/confirmation change and session invalidation approvals. Design B02/B03 revocation with an additive compatibility/rollback plan. Specify login/recovery/step-up rules, delivery/identity-verification and session logout scope. Do not turn this proposal into automatic bulk resets or disables.
5. **Approve focused code/hygiene work.** Implement/retest revocation/recovery/client redaction/storage controls in small reviewable changes after their decisions. Exclude real secrets from future tracking/config examples; any untracking/history rewrite needs explicit repository approval and collaborator/clone/backup coordination. History cleanup is not rotation and cannot retrieve already copied data. Preserve Phase10A functionality and all business records.
6. **Verify before release/closeout.** Exercise approved behavior in an isolated environment, verify deployment/edge controls and redacted operational evidence, then obtain release authorization. Record actual credential revocation/account remediation/session invalidation separately. No install, release or production action follows automatically from this sequence.

## 6. Tests executed and actual results

### Existing automated suite

Command from backend: `npm test` (`node --test tests/*.test.js`). **PASS25 tests,0 failures,0 skipped.** Existing source/test files unchanged. This includes login/invalid credentials, password save/change/reset compatibility, administrator-only provisioning, current-role enforcement, missing/unconfirmed account denial, seed input/no-overwrite, backend error/log redaction, safe diagnostics and retained payment/invoice regressions.

Database operations/session methods are mocked; source handlers/Mongoose validation/save hooks execute. HTTP tests use ephemeral127.0.0.1 listeners. No configured URI/real token/password/account was used. Standalone seed and production listener were not run.

### Additional observational probes

The Node stdin harness imported actual User/login/change/reset/token/protect/role/redaction functions, reused existing query/invoke adapters, generated synthetic bcrypt hashes/tokens and mocked collection writes. It did not load dotenv or connect to MongoDB. Temporary signing-key changes existed only inside that isolated process and did not affect any running application or real session.

| Probe | Result |
| --- | --- |
| P01 | PASS: synthetic2a/2b/2y hashes log in |
| P02 | PASS: plaintext/malformed format rejected; no conversion |
| P03 | PASS: wrong login password401 |
| P04 | PASS: unconfirmed login403 |
| P05 | PASS: incorrect current password401 with0 collection writes |
| P06 | PASS: self-change succeeds; new password matches, old password fails |
| P07 | GAP CONFIRMED: token issued before self-change remains accepted |
| P08 | RESET PATH PASS / GAP CONFIRMED: new reset password matches, old fails, old token still accepted |
| P09 | PASS: demotion removes admin permission403, ordinary authentication remains |
| P10 | GAP CONFIRMED: old token obtains promoted account's administrator access without reauthentication |
| P11 | STATE CHECK PASS / GAP CONFIRMED: unconfirmation401, reconfirmation restores old token |
| P12 | PASS: missing current account401 |
| P13 | PASS: expired token401 |
| P14 | PASS synthetic mechanism: changing only test-process signing key rejects prior synthetic token; no actual rotation |
| P15 | PASS: synthetic configured secret/URI/token/password error fields redacted |
| P16 | PASS compatibility: existing short-password bcrypt comparator works |
| L01 | OBSERVED: real AxiosError retains synthetic bearer header in config/toJSON; actual browser log capture not tested |

All16 observational assertions matched expected current behavior; L01 also matched. **This is not16 passing security requirements:** P07/P08/P10/P11 explicitly reproduce missing revocation/reauthentication protections. No persistent new regression test file was added during the read-only phase.

### Not run / still requires approved live verification

Real existing-account logins, actual hash classification, provider/deployed-secret validation, actual session invalidation, password resets, administrator-role review against real records, production diagnostics/log access, remote-history/clone inspection, browser storage/session-capture inspection, edge rate controls, backup/restore or deployment were not performed. Client build/lint were not rerun because no application code changed; Phase10A's recorded results are historical evidence, not fresh results for this phase.

## 7. Outstanding approval gates

| Approval ID | Exact scope requiring approval | Effect if later authorized |
| --- | --- | --- |
| A01 | Read-only provider/deployment evidence and narrowly scoped account metadata/format-count inventory, with target environment and operator identified | Establish real credential/account/deployment state; no account/secret changes implied |
| A02 | Database/JWT credential rotation, named consumers, cutover/revocation timing and expected logout/outage | Changes protected configuration/provider credentials and invalidates applicable tokens; separate release/configuration approval required |
| A03 | Exact account remediation list after roster/identity verification | Targeted reset/role/confirmation/session actions only; no blanket reset, disable or deletion |
| A04 | Revocation/recovery/last-admin/step-up/rate-limit policy and implementation scope | Reviewed application/additive schema/migration plan and tests; deliberate session behavior; no authentication rewrite |
| A05 | Focused frontend logging/storage/401 handling remediation | Client code/tests; session-clearing behavior only as approved |
| A06 | Future secret exclusion/untracking and any history/remote cleanup plan | Repository coordination; no history rewrite, deletion or lockfile/dependency change in this phase |

Approval of the report is not approval of every action. The user must select specific scopes before implementation or real account/credential work. No current password, role, confirmation, secret or session was changed, and no exposed credential is claimed rotated.

## 8. Delivery record

Created this report and appended a Phase10B summary to [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md). Prior findings and Phase10A results remain intact. Final validation passed: only the plan changed plus this report was added; the original plan's bytes are preserved as an exact prefix;11 relative documentation links resolve; fences are paired; configured-secret and historical seed-credential comparisons found0 matches in the two delivered documents. `git diff --check` reports no whitespace errors. Existing Git CRLF-conversion notices concern unchanged Phase10A files, not new source edits.

The phase stops for explicit approval of a controlled remediation scope. The original broader roadmap10B, shared-store changes and all other implementation phases remain unstarted by this review.
