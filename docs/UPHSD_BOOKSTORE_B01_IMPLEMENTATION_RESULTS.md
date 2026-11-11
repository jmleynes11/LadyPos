# B01 — Backend RBAC policy foundation results

Date: 2026-11-03, Asia/Manila. **Ready for independent local review; no runtime RBAC enforcement.**

## Authorization and scope

Implemented the eight new files authorized by the Phase15F contract, using Phase15C's four business roles and five settled owner decisions. Read Phase15C/D/E/F and the implementation plan against current source. No existing runtime file, existing test, model, dependency, environment file, account or security helper was modified. No policy is imported by existing runtime entry points.

The results filename follows the user's explicit B01 instruction; it replaces the earlier proposed results filename only. Previous reports remain unchanged.

## Eight created files

| File | Purpose |
| --- | --- |
| [roles.js](../backend/auth/roles.js) | Four exact business labels, strict membership and immutable definitions; no persisted role mapping |
| [capabilities.js](../backend/auth/capabilities.js) | Central approved base/conditional action ceilings and scope/field/state/audit requirements; unresolved capabilities explicitly listed |
| [policy.js](../backend/auth/policy.js) | Pure deny/eligible constraint plans, strict conditional facts and separate exact canonical ownership comparison; no database or HTTP permit |
| [fieldPolicy.js](../backend/auth/fieldPolicy.js) | Separate immutable field/alias profiles; cost/private/security data excluded; pure field eligibility |
| [routeManifest.js](../backend/auth/routeManifest.js) | Phase15F data-only route observations, action references, proposed constraints, branch-sensitive completion, tombstones, HEAD and OPTIONS distinctions |
| [rbacPolicy.test.js](../backend/tests/rbacPolicy.test.js) | Role/action matrix, independent owner-decision assertions, conditional ceilings, fail-closed malformed/unresolved inputs, ownership and field separation |
| [rbacRouteManifest.test.js](../backend/tests/rbacRouteManifest.test.js) | Actual registration comparison, I/O traps, negative coverage drift, derived HEAD/control metadata and pure module checks |
| [routeInventoryAdapter.js](../backend/tests/routeInventoryAdapter.js) | Test-only version-dependent Express registration recorder and graph validator; restores recorder in finally; no listener or handler execution |

Role strings are business labels, not new User.role values. A synthetic conditional action is not a stored grant. Eligibility is not executable authorization; scope/actor/state/field/audit requirements still need future enforcement. Guest is not a fifth role; both guest/student ordering remain required later work.

## Route and security evidence

Manifest covers59 protected explicit pairs across11 mounts, public login and2 diagnostics (62 explicit application registrations);23 protected HEAD derivatives;3 retired410 debt routes;2 effectful invoice ensure GET/HEAD paths. Action references are validated against the registry. Combined sale/completion effects are recorded as per-effect requirements, not an OR privilege shortcut.

The adapter identifies wrapped User handlers by exported function identity; function names alone were insufficient. Controller ownership and captured role-closure contents are source-backed metadata, not proven by graph introspection. Installed Express/router internal shape is version dependent and unsupported shapes fail visibly.

Current JWT expiry/version, password hashing, current-account authorization, Administrator actor guards, canonical self-delete and R2 commit handling are untouched. Full backend regressions pass with mocked/synthetic persistence and local loopback tests, including both original R1 probes. Native MongoDB concurrency/durability is NOT verified. No database/provider/external service connection or account/session/credential operation occurred.

## Commands and actual results

| Verification | Result |
| --- | --- |
| backend: node --test tests/rbacPolicy.test.js tests/rbacRouteManifest.test.js |40 passed,0 failed/cancelled/skipped/TODO |
| backend: npm test (final repeat after metadata changes) |169 passed,0 failed/cancelled/skipped/TODO; includes129 existing and40 new tests |
| client: npm test |16 passed,0 failed/cancelled/skipped/TODO |
| client: npm run build |PASS; existing >500kB chunk notice |
| node --check on all8 new files |PASS |
| Installed client ESLint API, recommended JS rules + Node globals, all8 new files |0 errors,0 warnings |
| client: npm run lint |FAIL:16 errors,13 warnings, unchanged existing baseline; no client repair |
| git diff --check |PASS; pre-existing line-ending notices only |

The first focused run was39 passed/1 failed due to wrapped handler identification; corrected only the new collector and retained assertions. Initial full-suite execution hit sandbox EACCES on127.0.0.1 HTTP connections. The approved loopback-capable retry and final repeat passed169/169. No test was weakened to evade the environment restriction; initial truncated full-suite output did not retain aggregate counts.

Syntax/targeted lint used existing installed tools through an ephemeral stdin script, without creating a ninth source/tool/config file. Build-generated client/dist files were removed after verification because none existed in the baseline; no existing file was deleted. Empty generated directories have no runtime attachment.

## Criteria, preservation and remaining limits

All17 exact Phase15B acceptance criteria and their Phase15D classifications remain in the unchanged historical documents. B01 contributes pure policy/metadata/regressions only; it does not complete four-role API authorization, shared record scope, audit persistence, kiosk identity, account migration or real-database acceptance.

Pre-document preservation comparison covered186 baseline files: all hash-matched; exactly8 authorized code/test files were added after generated build output cleanup. The implementation plan is appended only. Existing dirty files/lockfiles and all prior reports are preserved. No new policy import exists in original runtime files.

Remaining gates: persisted role mappings, legacy compatibility, scoped data attribution, activation/grants, audit consistency, payment/refund/void effects, guest privacy, all five deferred financial/inventory risks, omitted cost reset, client lint debt and native verification. Unresolved capability rights remain denied in the standalone policy; no existing API behavior changes.

Rollback of this unattached batch requires only reverting its new files under authorization; no database restore, epoch rollback or session operation. No substantive scope deviation or implementation blocker remains. Independent review must assess policy fidelity and test/collector limitations; passing synthetic tests are not production readiness.

**Stop after B01. B02-B12, A08B, migrations and deployment remain unauthorized.**

