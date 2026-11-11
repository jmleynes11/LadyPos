# B01-R2 — strict metadata validation remediation results

Date: 2026-11-04, Asia/Manila. Project: UPHSD Bookstore POS.

**Local remediation complete; ready for separately authorized independent B01-R2 review. B01-R1 is not retrospectively accepted; B02 remains blocked.**

## 1. Evidence and scope

The cited docs/UPHSD_BOOKSTORE_B01_R1_INDEPENDENT_REVIEW.md is absent. The prior independent review was delivered in chat without file changes because that request ended mid-restriction. This authorization restates the findings; each was reproduced against current source before edits. No missing historical report was fabricated or overwritten.

Reviewed Phase15C's approved role boundaries, Phase15E's capability/resource separation and Phase15F's complete route-specific inventory. The latter supplies canonical protected-route descriptions and criterion mappings; no permission, role or business rule is invented.

Before remediation:
- A non-array completionConstraints object with toJSON returning the expected guards was accepted.
- criteria set to "anything" was accepted.
- scope="unrestricted" and requiredCapability="allow-all" were accepted.

All are non-executable metadata defects, not demonstrations of runtime authorization bypasses.

## 2. Changed files and corrections

Only two existing B01 files changed; the eight-file architecture remains intact:

| File | Correction |
| --- | --- |
| backend/tests/routeInventoryAdapter.js | Structural array validation; independently loaded Phase15F row oracle; exact criterion membership/mapping and description validation; dense inventory and primitive identity checks |
| backend/tests/rbacRouteManifest.test.js | Four new regression tests covering serialization spoofing, invalid criteria, weakened descriptions and missing/sparse inventory metadata |

No production-located auth module, existing runtime file, login/authentication/security helper, pre-B01 test, frontend, model/schema, environment, lockfile or account was changed. B01 stays unattached.

### Finding1: completionConstraints structure

Root cause: JSON.stringify equated a malformed object's serialized output with a valid guard array.

Correction: completionConstraints must be an actual ordinary array with dense own data indexes and nonempty string entries. Objects, strings, null, undefined, sparse arrays, accessor slots, unexpected array properties (including own toJSON), extra/missing/wrong values fail. Exact entry comparison occurs only after structure validation, with no JSON serialization.

The same structural checks apply to actionRefs; inventory arrays must also have dense own data slots. This prevents a skipped missing slot from bypassing comparisons.

For the four completion handlers/aliases, mandatory guards remain:
current-account, server-price, state-validation, atomic-effects, operation-identity, audit.
The branch flag, mutation effect, sale/payment/receipt conjunction and action references remain independently required. These requirements are not derived from the manifest being validated.

### Finding2: approved criterion mappings

Root cause: checking criteria.length accepted arbitrary strings and did not establish valid/complete mappings.

Correction:
- Require a dense string array.
- Only RB01 through RB17 are valid identifiers.
- Reject unknown/case-altered references, missing/null/undefined entries, duplicates and missing mappings.
- Match the complete per-route criterion set from Phase15F; a valid but unrelated extra criterion is also rejected.
- Preserve legitimate mappings. Order of criterion references is not authority: reversing a legitimate set still passes.

The canonical Phase15F table must contain exactly59 unique protected registrations and only approved criterion references. Missing/unsupported authority fails visibly rather than falling back to the mutable manifest.

### Finding3: scope/capability descriptions

Root cause: truthiness checks accepted weakened or replacement prose.

Correction: load the existing Phase15F protected-route table from local documentation and match each method/path/row ID. Compare scope, requiredCapability and proposedPolicy exactly against that independent reference. Every protected row is checked, including unresolved policies. An unresolved declaration must retain its approved restriction; it cannot become an allow-all description.

Phase15C remains authoritative for business rights. Phase15E defines the layered design and capability vocabulary; Phase15F applies those boundaries to route rows. Its descriptions were used without changing any historical specification.

Descriptions are source-backed observations/proposed constraints, not an executable grant. A later legitimate description change requires reviewed authority/manifest updates; silently changing text in the manifest will fail validation. This test-only helper now reads a local Markdown document; it does not connect to any service.

## 3. New permanent regression tests

Four tests were added (focused45->49, full backend174->178):

1. Non-array custom toJSON object returning the complete guard list; assert rejection and toJSON call count0. Also objects, null/undefined, strings, empty/sparse/accessor/custom arrays, missing/extra/wrong guard values; valid mapping control.
2. Invalid criteria including "anything", RB00/RB18, lowercase IDs, null/undefined, sparse/empty/duplicate arrays, missing required references and unrelated valid extras; valid reversed mapping control.
3. For every one of59 protected routes, reject missing/null/empty/altered/non-string scope, capability and proposed-policy descriptions; valid manifest control.
4. Sparse inventories and missing method/path/handler/effect/binding/action/scope/capability metadata reject.

Tests exercise observable rejection, not serializer/helper-call equivalence. Existing original finding regressions remain intact.

## 4. Required verification and actual results

| Verification | Result |
| --- | --- |
| Custom toJSON original stdin regression |PASS; non-array rejected; serializer calls0 |
| Original invalid-criteria probe |PASS; string rejected |
| Original weakened scope/capability probes |PASS; both rejected |
| All four original B01 F01-F04 finding groups |4/4 PASS through separate stdin assertions, with positive catalog/minimal-submit controls |
| Focused B01 suite |49 passed,0 failed/cancelled/skipped/TODO |
| Full backend npm test |178 passed,0 failed/cancelled/skipped/TODO |
| Client npm test |16 passed,0 failed/cancelled/skipped/TODO |
| Client npm run build |PASS, Vite8.0.3; existing >500kB chunk notice |
| node --check, all eight B01 files |8 pass |
| Installed ESLint recommended JS/Node configuration, all eight files |0 errors,0 warnings |
| Full client lint |Not rerun; prior16 errors/13 warnings remain historical |
| Native MongoDB/browser/production |Not run, unverified |

Backend regressions use synthetic/mocked persistence and existing approved127.0.0.1 HTTP fixtures. New metadata tests trap connection, collection I/O, sessions and network/listener execution. Independent stdin probes construct registration graphs only; no health/domain handler or database operation runs. No dependency installation, deployment, migration, session/credential action or external/database connection occurred.

## 5. All17 acceptance criteria

No historical classification is promoted by these test-infrastructure fixes:

| Criteria | Status retained / R2 contribution |
| --- | --- |
| RB01 | Not Implemented: persisted-role mapping/compatibility remains later; no account change |
| RB02 | Partially Implemented: metadata coverage strengthened; runtime four-role enforcement remains later |
| RB03 | Already Implemented local security foundation, preserved |
| RB04 | Partially Implemented: existing admin protections unchanged |
| RB05 | Already Implemented local identity foundation, preserved |
| RB06 | Partially Implemented: scope description integrity improved; actual shared record scope remains later |
| RB07 | Not Implemented end-to-end; standalone field restrictions preserved |
| RB08 | Not Implemented end-to-end; direct Manager adjustment decision unchanged |
| RB09 | Not Implemented end-to-end; Manager reversal authority/Cashier request-only decision unchanged |
| RB10 | Partially Implemented: metadata constraints validated; no financial/concurrency guarantee added |
| RB11 | Not Implemented: both guest/student modes remain mandatory later work |
| RB12 | Not Implemented end-to-end; five approved decisions unchanged |
| RB13 | Already Implemented local actor/version foundation, preserved |
| RB14 | Already Implemented local commit-replay foundation, preserved |
| RB15 | Partially Implemented: no frontend/runtime attachment |
| RB16 | Cannot Verify live migration; no inventory/migration executed |
| RB17 | Not Implemented durable audit; declaration is not persistence |

All17 exact requirements remain in unchanged Phase15B/D/E/F documentation. Four business roles, conditional ceilings and all five owner decisions remain unchanged.

## 6. Limitations, preservation and next gate

Structural validation applies to ordinary in-process metadata, not a hostile JavaScript execution sandbox. Getter slots and custom array serialization are rejected; no claim of complete arbitrary Proxy isolation is made. Express graph metadata cannot prove controller role closures, native transaction ordering or production behavior.

Phase15F is now a test oracle dependency. If its formatting/route inventory changes, tests intentionally fail for review; a different deployment/package layout must retain approved test documentation or use a separately reviewed immutable oracle. No runtime package depends on this document.

B01 eligibility is still not an HTTP permit. Shared ownership, actual grants/lifecycle, durable audit, guest privacy, reversal effects, five deferred financial/inventory risks, omitted cost reset and native MongoDB verification remain open. Existing admin/user authentication and all prior security foundations remain unchanged.

Preservation evidence follows the final snapshot check. Only these two B01 test files, this new results report and the appended implementation-plan entry are authorized.

Final comparison covered 209 baseline files: only the two authorized B01 test files and implementation plan changed; only this report was added; none were removed. All other hashes match, including runtime/security files, prior reports, frontend, build output, environment files and lockfiles. The original 64409 plan bytes remain an exact prefix.

**Recommendation: separate independent B01-R2 acceptance review. Do not begin B02 or A08B until explicitly authorized after acceptance.** No automatic next batch or production operation follows.

