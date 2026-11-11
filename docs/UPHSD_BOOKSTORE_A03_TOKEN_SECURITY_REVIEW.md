# UPHSD Bookstore POS — A03 token security review and rollout plan

Date: 2026-11-02, Asia/Manila. Scope: local review, regression tests and a proposed release procedure. **Production rollout is not cleared or authorized.**

The token-version design rejects stale tokens across the tested security changes and preserves bcrypt login compatibility. This review confirms two remaining constraints: the verifier does not require expiry or enforce the issuer's maximum lifetime, and an administrative request admitted before demotion can restore its caller's role after demotion. Both have executable local characterizations. Neither was fixed during this review.

Final local results: **57 backend tests passed, including two known-limit characterizations;8 client tests passed; client build passed.** Passing characterizations establish limitations, not passing security acceptance for those limitations. No production or configured database/service connection, migration, account/credential/session action or deployment occurred.

This user-authorized **Phase A03 token review** is distinct from the older Phase10B proposed approval label A03 for named account remediation. No account remediation is authorized here. A01 remains blocked. All earlier reports retain their original findings and execution history.

## 1. Review scope and evidence

Reviewed the token-version implementation report, A02 hardening results, Phase10B results, A01 verification history and implementation plan against actual current code and tests. Earlier reports describe earlier source states: their missing-revocation/raw-client-log findings are not substituted for current local behavior. No deployed source state is inferred.

Inspected User schema/hooks, all User controller and route handlers, token/password utilities, protect/authorizeRoles, all11 mounted routers, app/error/logger/health entry points, existing security/payment/receipt tests and client AuthContext/apiClient/useProfile/DashboardGuard/auth API behavior.

| Review item | Current evidence | Conclusion and verification limit |
| --- | --- | --- |
| Issuance/signature | `backend/utils/generateToken.js:4`; `backend/middleware/authMiddleware.js:17` | Issuer signs ID/role/version with seven-day expiry. Protector permits HS256 only. Wrong-key signatures, unsigned tokens and unsupported algorithm fail locally |
| Expiration/claims | `authMiddleware.js:17–22`; new `backend/tests/a03TokenReview.test.js` | Expired/not-yet-valid tokens and malformed exp/nbf are rejected. Missing exp and oversized lifetime are accepted if otherwise valid; F01 below |
| Version validation | `backend/utils/tokenVersion.js:3`; `authMiddleware.js:21–27` | Only nonnegative safe-integer claims are accepted. Missing/null/string/boolean/array/object/fractional/negative/overflowing and unequal versions do not fall back to0 |
| Legacy accounts | `tokenVersion.js:7`; `backend/models/User.js:19–32` | Missing stored field alone means effective0. New accounts initialize0; login does not backfill. Mixed plus strict validation preserves malformed types for rejection, avoiding Number coercion |
| Password/change/reset | `UserController.js:133–158`,`:191–222`; `User.js:35–66` | Existing current-password/admin guards and single bcrypt path remain. Security fields and next version share one conditional document save |
| Role/confirmation transitions | `UserController.js:210–218`; `User.js:40–53` | Actual transitions increment; restoration increments again; previously issued tokens stay stale. Combined updates increment once; ordinary profile/same-value updates do not |
| Current authorization | `authMiddleware.js:25–46`; `routes/UserRoute.js:18–29` | Current persisted account role controls authorization, not JWT role claims. Provisioning/list/admin-update/delete remain administrator-only. Existing admin/user definitions are unchanged |
| Missing/unconfirmed accounts | `authMiddleware.js:26`; `UserController.js:65–72` | Protected requests401; unconfirmed login403; wrong credentials401. Existing bcrypt2a/2b/2y fixtures authenticate |
| Failed lookup/outage | `authMiddleware.js:24–32`; `middleware/errorMiddleware.js`; `app.js:37` | Protected handler does not run. Lookup failure produces generic500; disconnected readiness503. Real driver buffering/timeout/failover behavior is unverified |
| Route coverage | `backend/app.js:47–57`; all11 route modules; A03 route sweep |59 protected method/path pairs reject anonymous, stale and claim-less requests; one automatic HEAD denial also checked. No missing version guard found on inspected business routes |
| Concurrent writes | `User.js:35–66`; existing tokenVersion tests and new A03 tests | Conditional matching permits one competing security writer; stale retry fails. Lost-ack simulation cannot repeat a committed reset. Real MongoDB concurrency remains unverified; actor authorization across admission/write is a separate limit, F02 |
| Frontend logout/invalidation | `AuthContext.jsx:85–98`; `apiClient.js:16`; `useProfile.js:103` | Logout clears local browser stores, not a backend epoch.401 does not clear auth or redirect. Password-change success leaves the cached JWT in place; subsequent protected use requires fresh login |

Public exceptions are `POST /api/users/login`, minimal `GET /`, `GET /api/health` and CORS preflight. These do not expose staff data or bypass a business controller's guard. The public health endpoint may ping the database when connected; this review did not start the configured application or connect it.

Most guarded requests invoke one account lookup in protect. Existing duplicate protect calls mean `POST /api/products/set-active` and the order pay/complete/void PATCH routes invoke it twice. The version check adds a field/comparison to each existing invocation. The prior report's general one-lookup description should be read with these route-specific exceptions; no runtime call was removed.

## 2. Findings and remaining vulnerabilities

Severity describes potential impact, not evidence of a live compromise. Runtime corrections beyond the completed design were not implemented in this review.

### F01 — Medium: verifier does not enforce the issuer's time contract

**Confirmed locally:** a correctly HS256-signed JWT with valid account/version but no exp is accepted. A token with a30-day-old iat and expiry30 days ahead is also accepted. The actual issuer creates seven-day tokens; malformed or expired exp is rejected. New `KNOWN LIMIT` coverage uses a synthetic key and actual protect. This is not unsigned-token acceptance or a way to bypass signature/version checks without an appropriately signed token.

`jwt.verify` currently supplies an algorithm allowlist but no required-claims/max-age contract. Normal current issuance does not generate these exceptional tokens. Their production presence and any alternative issuer are unknown. The separate potentially exposed-key risk remains more severe: adding expiry checks cannot make a compromised signing key safe.

**Proposed correction for approval:** require valid issued-at/expiry claims, reject future/invalid chronology and enforce the existing seven-day maximum at verification. Confirm clock-tolerance/legacy-issuer compatibility before specifying exact boundaries; do not add a permissive fallback. Add denial regressions in place of this characterization after approval. Issuer/audience binding would require a separately reviewed issuer/consumer contract. No temporal-verifier or configuration change was made here.

### F02 — High: admission-time authorization does not bind an administrative write to the actor's security state

**Confirmed through the actual HTTP route with mocked persistence:**

1. A synthetic administrator starts `PUT /api/users/:ownId` requesting role admin. Its token passes protect and authorizeRoles.
2. Pause the controller's account lookup. A separate synthetic save demotes that account and advances its version0->1.
3. Resume the controller. It loads the now-demoted account, applies the already-admitted role request and successfully saves role admin with version1->2.
4. The original version0 token still receives401 afterward. Nevertheless, the admitted request has restored the privileged role without another login.

The target-document conditional update is atomic and increments correctly. It guards the version the controller loaded; it does not prove that the actor remains authorized at write time. This is a concrete consequence of the previously documented in-flight-operation limitation, not a missing route guard or stale JWT being accepted on a new request. Other actor/target races were not exhaustively tested.

**Proposed correction for approval:** design privileged writes around the actor's authenticated security version/current authorization as well as the target's version. Define revocation semantics for already-admitted administrative requests. A self-target conditional version check can address this demonstrated case, but does not alone solve different-actor/different-target operations. A second role read by itself still leaves a check/write race. Review an atomic actor/target strategy and any database/transaction/audit requirements before implementation. Do not silently impose new self-role/last-administrator policies. No permission or runtime change was made here.

Production approval should resolve F01/F02 through approved fixes and tests, or explicitly record the accepted residual behavior and responsible approver. This document neither approves that risk nor authorizes release.

### F03 — Critical conditional exposure: live credentials, administrators and deployment remain unknown

Phase10B established historical secret retention/exposure mechanisms. A01 has not verified provider validity, rotation, deployed fixes, actual account formats or administrator legitimacy. Token versions cannot contain possession of a signing key or a privileged database credential. A legitimate administrator cannot be inferred from an admin role or timestamp alone.

Require the A01 evidence in section5 and a separate controlled credential/account decision. No secret was tested for validity or claimed rotated. No account was selected for remediation.

### F04 — Medium/High on shared devices: frontend session handling remains limited

The actual logout callback clears **all** localStorage/sessionStorage, including unrelated keys; it has no backend revocation call. The new SSR-context test executes this storage behavior with synthetic stores and a nonnetwork auth stub. It does not test browser navigation, effects, cross-tab synchronization or state rerenders.

Source still prefers local storage during restoration, writes user data locally even for session-only login and can retain an earlier opposite-store token. DashboardGuard uses cached user presence.401 merely emits the A02 safe diagnostic and rejects the error; several auth APIs use direct Axios instead of that interceptor. Cached UI role/identity may therefore remain stale, although backend guards control API access. Browser logout does not make an independently copied otherwise-valid JWT invalid.

Fresh login after legacy cutover/security changes is currently a manual logout/login operation. Approve consistent storage/account-switch/401 behavior and any server logout scope separately. No cookie/session redesign or browser session cleanup occurred. A02 metadata-only logging remains in place and its tests pass.

### F05 — Integrity boundary: external writes, old instances and restore can bypass revocation history

Inspected application security writers use User saves. Direct database/query/bulk writes, unknown external tooling, an old verifier or an old password/role writer can bypass the intended contract. No current business-route guard omission was found. Their live inventory is unknown. Field removal, version decreases, restoring old account snapshots or intentionally reusing an account ID can revive prior credentials/tokens if not separately contained.

Do not infer safety from an old app ignoring the additive field: it also ignores revocation. Account versions must survive code rollback. An older database snapshot cannot be restored and reopened with the same signing key on the assumption that revocation survived. Section7 defines the recovery gate.

### F06 — Availability and broader controls remain outside completed scope

Stale conditional saves fail with generic500, including an ambiguous-ack retry; operators must reload and verify state before retrying. A login racing a security change may return200 with an already-stale token; the new test proves the next protected request rejects it and a later fresh login uses current state. No in-flight-request cancellation is provided.

No application login limiter, full recovery flow, durable security-event provenance, per-device session registry, last-admin protection or new bookstore capability matrix was introduced. Provider/edge controls are unknown. Existing broad permissions, client lint errors and bundle warning remain. These are not automatically included in a token-version release or repaired by this review.

## 3. Legacy-token and schema policy

Retain the current strict policy; do not weaken it to avoid sign-in interruptions.

| Condition | Current behavior |
| --- | --- |
| Stored field absent, newly signed claim0 | Effective account version0; authenticate subject to current signature/time/account/confirmation checks |
| Valid stored version and equal numeric claim | Current authorization applies; F01 temporal-contract limitation still applies |
| Claim-less legacy token |401 for every account, including version0; fresh login |
| Missing/malformed/unsupported/stale claim |401, no zero fallback |
| Malformed stored version | Issuance fails; protected request generic500 without handler access |
| Password/reset/role/confirmation transition | Prior versions stale; later restoration never lowers version |

Existing bcrypt accounts do not require a password-format migration merely to log in. Absent versions are not written by login or ordinary profile saves. New account creation initializes0; approved security events populate/advance the field atomically. No collection rename, backfill, new index or database-level validator is needed by this design. Unexpected production field collisions/types must stop rollout rather than trigger repairs.

Future deployment of this strict verifier forces holders of claim-less tokens to sign in again, even for unchanged accounts. The number affected is **unknown**. Password resets are not implied. Management must approve the maintenance/sign-in impact and a verified recovery path before release. Unconfirmed accounts remain denied. No grace period, key rotation or bulk epoch bump is part of the local change.

## 4. Automated tests and limits

| Execution | Actual result |
| --- | --- |
| Baseline backend `npm test` |48 passed,0 failed/TODO |
| Baseline client `npm test` |7 passed,0 failed/TODO |
| First expanded backend run |55 passed,1 failed out of56: test helper attempted JSON parsing on an empty HEAD response; not a route-guard failure |
| After test-helper correction |56 passed; later added the F02 characterization |
| Final backend `npm test` |**57 passed,0 failed/TODO/skipped**; includes2 explicit KNOWN LIMIT characterizations, not2 fixed controls |
| Final client `npm test` |**8 passed,0 failed/TODO**; includes actual-provider logout callback/storage and existing redaction/receipt cases |
| Client production build to `<tool-temp>/uphsd-bookstore-a03-build` |PASS, Vite8.0.3,671 modules; existing >500kB chunk warning; no deployment |
| Client-wide installed ESLint JSON run |FAIL: existing16 errors/13 warnings; no diagnostics on new tests |
| Targeted installed ESLint recommended JS + Node globals |PASS,3 changed/new test/helper files,0 errors/warnings; no config/dependency addition |
| Syntax |PASS:50 backend JS files plus new client test |
| `git diff --check` |PASS; unrelated existing LF/CRLF notices remain |

New backend coverage:

- Real HMAC validation rejects wrong-key signatures and algorithm none; raw signed malformed exp/nbf/payload/ID/version claims fail before account lookup. Existing tests cover valid/expired/not-yet-valid JWTs and all required version shapes.
- Runtime mounted-router inventory and actual HTTP sweep cover all11 routers and59 protected method/path pairs: anonymous/stale/claim-less denials plus HEAD, **178 denials** total. Public login is separately identified; its existing login/provisioning tests still pass.
- Actual profile routing permits a valid account, rejects a missing account and returns generic500 for a synthetic unavailable lookup. No protected handler runs on those failures.
- Competing password resets for stored0 and absent versions have one winner. A stale document retry cannot overwrite it. Separate role/confirmation races and restoration denials remain covered by existing tests.
- A simulated commit followed by lost acknowledgement cannot commit a repeated reset or revive the old token. Reloaded account state supports a fresh valid token.
- Login/security-change race and F01/F02 characterizations distinguish safe stale-token denial from remaining time/write-authorization limits.

All backend persistence is mocked. JWT/bcrypt, current controllers, Mongoose hydration/validation/save/update generation and HTTP routers execute locally; test connections are ephemeral loopback only. The new harness forbids Mongoose connection entry points. This does not establish actual database write concern, failover, conditional-update durability, production account compatibility or deployed authorization.

**Real database checks not run:** BSON version-type round trips; acknowledged conditional writes; separate-client concurrent password/role/confirmation changes; write/commit/network interruption; restore preserving invalidation; real indexes/topology/startup behavior. These require a separately approved, disposable isolated target and writable test identity. A01's read-only production identity must not be repurposed to perform them.

Browser end-to-end sign-in/401/manual recovery, remembered/session-only switching, multi-tab behavior and actual staff login remain unverified. No production JWT/hash/password was retrieved or displayed.

## 5. A01 dependencies — all live evidence remains unknown

| Required nonsecret evidence | Current status / required authority |
| --- | --- |
| Render workspace/service name and ID; environment designation; API hostname | Unknown; authorized administrator must confirm ownership and intended resource |
| Deployed revision/deploy ID/time, repository/branch, artifact provenance; all issuers/verifiers/security writers | Unknown; local dirty checkout is not proof of deployment. A commit matching older HEAD does not include uncommitted fixes |
| Frontend provider/site/build revision and intended API binding | Unknown; local Render/Netlify references are hints, not ownership/deployment evidence |
| Atlas project/cluster IDs and exact intended bookstore database; actual account collection | Unknown. User model expects users by default; live collection unknown. Local driver's test fallback must not be treated as the intended database |
| Names-only configuration/binding/revision evidence for MONGO_URI/JWT_SECRET and client VITE_API_URL | Unknown. Current backend supplies no explicit dbName override; administrator must confirm actual selected database without disclosing a URI. No tokenVersion environment setting was added |
| Read-only method/identity alias, effective direct/inherited/custom permissions and cluster/database scope | Unknown; must prove restricted scope before any connection. An intent to run reads or a read preference is not permission evidence |
| Aggregate account roles/confirmation/password-format counts and management administrator roster/provisioning evidence | Unknown, not zero. No hashes/raw account exports. Role alone is insufficient evidence of legitimacy |
| Aggregate existing tokenVersion presence/type/invalid-range/collision counts | Not obtained; approve this narrow additional preflight alongside A01 metadata. Do not retrieve sample values or overwrite collisions |
| Credential lifecycle/rotation metadata and signing-key consumer inventory | Unknown; review redacted IDs/status/timestamps, not secret values or raw historical logs |
| Database topology, effective write concern, buffering/timeouts, backup/restore capability and existing index behavior | Unknown; verify through authorized metadata and isolated tests before release |

Review current redacted provider grants/ownership attestations before a future connection. Prefer administrator-produced bounded aggregate/metadata evidence if agent access is unnecessary. Database built-in read does not itself prevent returning sensitive fields: the inventory procedure must additionally restrict outputs. No `$out`/`$merge`, write-permission probes or application startup/seed for read-only inventory.

Even completed A01 would establish evidence, not authorize deployment, credentials/account changes or migrations. This phase's no-connection restriction remains in force until an explicit later instruction permits the approved verification scope.

## 6. Staged rollout proposal — no execution authorized

| Stage | Future work and evidence required to exit | Approval gate |
| --- | --- | --- |
| S0 — Resolve review findings | Review F01/F02; approve specific local corrections/semantics and denial tests, or record explicit residual-risk disposition. Retain strict version/legacy checks. Resolve frontend manual-reauthentication support requirements | R1: user reviews this report; runtime fixes need separate implementation authorization |
| S1 — Identify and verify target | Complete section5/A01 with exact ownership/readonly scope and redacted metadata; establish legitimate recovery administrator and credential status. Stop on target/grant ambiguity; never infer bookstore ownership from test | R2: A01 prerequisites plus explicit permission to resume scoped external reads; no writes implied |
| S2 — Assemble reviewed release | Identify an immutable source/artifact including intended Phase10A/A02/version fixes and approved follow-ups. Preserve unrelated working-tree/lockfile changes; do not release an arbitrary dirty checkout. Verify actual runtime/build/start/health/CORS/API bindings, reproducibility and compatible rollback artifact. Existing lint/secret findings need explicit disposition | R3: approve exact release contents and any build/install/repository work separately; no secret file in release provenance/report |
| S3 — Isolated integration and recovery rehearsal | Use an explicitly confirmed disposable environment with synthetic accounts/data and separate credentials. Exercise all security events, actual concurrent writers, missing/malformed versions, failure/acknowledgement behavior, sign-in/UI recovery, rollback and restoration. Check acknowledged writes, driver timeouts and model startup/index effects. No production clone/raw hashes in reports | R4: approve exact isolated target and test writes/cleanup; no production credential/data use |
| S4 — Backup and cutover preparation | Approve encrypted restricted backup/snapshot, recovery owner, retention and management-defined RPO/RTO. Record only backup IDs/timestamps/scope and restore rehearsal outcomes. Approve maintenance window, recovery access and staff instructions for forced legacy reauthentication; preserve unfinished business work without inventing cancellation/payment rules | R5: explicit backup/recovery operations and session-impact/window approval; no automatic account resets |
| S5 — Coordinated release | Block external business traffic at every old API entry point, pause old security writers and drain admitted requests. Frontend-only maintenance is insufficient if direct API hosts remain reachable. Deploy approved version-aware issuers/verifiers/writers together; verify every instance before reopening. No rolling mixture of legacy verifier/writer and new code. No seed, bulk version bump, backfill or migration | R6: explicit production deployment/configuration authorization identifying exact targets, revision, operator and approved impact; all earlier gates satisfied |
| S6 — Verify, observe and close | Check deployed provenance, names-only bindings and readiness, then approved test-account allow/deny/security-event checks. Verify fresh login, current role/confirmation, stale/legacy denial and normal approved POS paths. Record aggregate safe telemetry and management-approved acceptance outcomes before general reopening | R7: approve live verification scope and any exact account/security writes separately; review closeout before another phase |

No step in this table authorizes the next. If effective index/autovalidator/startup behavior implies an unapproved database change, stop and obtain its own reviewed plan. The additive field itself needs no new index or backfill. Do not use production account mutations as deployment probes without explicit targets/actions approval.

Before cutover, staff communication must distinguish sign-in interruption from password reset: existing compatible passwords remain usable; legacy tokens will not. The current client needs manual logout/login after rejection. Unknown incompatible account formats or forgotten passwords require approved identity-verified recovery, not plaintext fallback or blanket resets. Interruption duration and affected account counts are unknown; management must set the window and support coverage.

### Monitoring and post-release checks

Current local request logs provide timestamp/method/mount-or-route pattern/status and a constant500 error message. They do not distinguish signature, expiry, legacy and stale-version401 reasons or provide a durable security-event audit. Do not invent reason-level dashboards or infer successful revocation from401 totals alone. Any additional counters/telemetry need separate implementation approval and must exclude token/header/body/password/hash/account payloads.

Use approved aggregate401/403/5xx and login-success rates, readiness503, latency/timeout and process restart observations against an established baseline. Management must define acceptable thresholds, observation window and response owner; none is assumed here. Use `/api/health` for database readiness, not the root running message alone. Do not retrieve raw historical logs that may contain credentials.

Expected legacy401 increases must be distinguished by controlled checks from failures of fresh valid logins. Unexpected acceptance of stale tokens, missing version checks on any serving instance, loss of legitimate recovery access, inconsistent epochs or unapproved writes are stop/restrict-traffic conditions. Do not repair those by relaxing validation, switching to an old verifier, resetting versions or changing order/payment state.

Live checks that change a password, role or confirmation state deliberately invalidate that account's prior tokens; such checks need explicit account/action approval. A release authorization alone must not be stretched into bulk resets, credential rotation or production test-account creation. No live check was run in A03.

## 7. Rollback and recovery

| Situation | Required safe approach |
| --- | --- |
| Candidate fails before traffic | Keep candidate off serving paths and retain production/data state. Reassess with the approved release owner; no database restore or credential reversal |
| App regression after cutover | Restrict affected traffic and use a tested **version-aware** rollback artifact that retains epoch checks, strict legacy handling and atomic security writes. A pre-tokenVersion application is not a safe rollback target |
| Security save reports an ambiguous failure | Reload current approved account state; do not blindly resend an old security snapshot, reset its epoch or assume failure means no write. Conditional retry tests are simulated, not a provider durability proof |
| Older database snapshot must be restored | Keep protected traffic closed. Restoring older passwords/roles/epochs may revive revoked tokens. Obtain explicit recovery approval for a coordinated fresh signing key/session cutover or a demonstrably complete, approved monotonic-epoch reconciliation before reopening. Current app lacks a durable security-event ledger proving such reconciliation; do not assume it exists |
| Credential containment fails | Use an approved fresh recovery credential/cutover; do not restore a possibly exposed old secret. Rotation and resulting logouts require separate authorization |
| User cannot sign in | Verify identity through the approved recovery administrator; authorize exact targeted action if necessary. Preserve IDs/history; do not restore plaintext, known default passwords, unverified roles or old epochs |

No rollback should lower/unset tokenVersion, restore the old verifier, accept claim-less tokens, restore an exposed credential or erase security history. Backup restoration is a separately approved data operation, not a routine code rollback. No backup was created, restored or tested here.

## 8. Files changed and stop condition

| File | Reason |
| --- | --- |
| `backend/tests/a03TokenReview.test.js` — new | Signature/claim checks, route-wide denials, HTTP lookup failures, competing resets, lost acknowledgement/login races and two explicit outstanding-limit characterizations |
| `backend/tests/helpers.js` | Treat an empty JSON-labelled HEAD response as no body; fixes only the local HTTP helper |
| `client/tests/logout.test.js` — new | Execute actual provider logout callback with synthetic storage through SSR; no network authentication |
| This report — new | Findings, test evidence, strict legacy policy, A01 dependencies, staged rollout/rollback and explicit gates |
| `docs/UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md` | Append concise A03 summary only |

No application runtime source, environment files, manifests, lockfiles or prior reports were edited. Existing Phase10A/A02/tokenVersion work and unrelated working-tree changes remain preserved. No dependency installation, production contact, migration, deployment, account/credential/session operation or further phase followed.

Final preservation comparison covered156 baseline files: only the implementation plan and HTTP test helper changed, three files were added as listed, and none were removed. All runtime source, prior reports, both environment files and all three pre-existing lockfiles hash-match the baseline. The plan's original26,918 bytes remain an exact prefix. Thirteen relative documentation links resolve; private configured-secret comparisons across the five delivered files found zero matches and printed no secret values. Final syntax, targeted lint and whitespace checks pass.

User review of F01/F02 and gates R1–R7 is required before any further implementation or production action. This report prepares a plan; it does not grant release approval.
