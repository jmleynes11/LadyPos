# B01-R2 independent acceptance review

Date: 2026-11-04, Asia/Manila. Project: UPHSD Bookstore POS.

**Executive verdict: PASS WITH LIMITATIONS for the local, unattached B01-R2 scope.** The three R2 remediation groups and all four original B01 finding groups pass fresh independent probes. No new blocking defect was reproduced within the reviewed scope. This does not accept the full runtime RBAC system or authorize B02.

## 1. Baseline, files and independence

Used the documented reproduced findings in [B01-R2 results](UPHSD_BOOKSTORE_B01_R2_REMEDIATION_RESULTS.md), not an assumed R1 review file. The R1 independent-review file is absent; no historical file was fabricated. Read the original B01 implementation results, B01 independent review (present), implementation plan and Phase15C/D/E/F requirements. Phase15C remains authoritative.

Inspected all eight current files:
- backend/auth/roles.js — four exact business labels and shared validation.
- backend/auth/capabilities.js — approved base/conditional ceilings and required constraints.
- backend/auth/policy.js — standalone eligibility, conditions and canonical ownership comparison.
- backend/auth/fieldPolicy.js — read/command/item profiles and protected fields.
- backend/auth/routeManifest.js — complete data-only route/action/effect inventory, HEAD and OPTIONS metadata.
- backend/tests/routeInventoryAdapter.js — collector, structural validator and Phase15F oracle.
- backend/tests/rbacPolicy.test.js — original and remediation policy regressions.
- backend/tests/rbacRouteManifest.test.js — R2 negative/positive metadata and collection tests.

Also inspected current User role schema, authentication middleware, runtime import references and relevant source-backed compatibility/security evidence. Actual live accounts, secrets and provider configuration were not read.

Independent checks ran as temporary stdin scripts with synthetic data copies and restored in-process registration instrumentation. No application/test/configuration code was edited, no permanent probe was added, no domain/health handler was invoked by metadata probes and no database/provider connection occurred.

## 2. R2 remediation findings

### Group1 — Completion constraint structure: PASS

The validator first requires an actual ordinary Array, dense own data indexes and nonempty strings, without extra array properties. It compares expected values only after structural validation. It no longer uses JSON serialization to prove guard structure.

Independently tested all four completion-handler registrations with undefined/null/object/string/empty/sparse/accessor/custom-serialization arrays, missing/extra/invalid entries and a non-array custom toJSON object returning the exact guards. Every malformed case rejected. Serializer/getter invocation counter stayed0, showing rejection did not depend on executing the malicious representation.

The required branch flag, mutation effect, action conjunction and current-account/server-price/state-validation/atomic-effects/operation-identity/audit guards remain independently required. Valid original metadata passes.

### Group2 — Criterion references: PASS

References must be dense string arrays, unique, drawn from RB01-RB17 and equal to each route's complete Phase15F mapping. The oracle is not taken from the manifest being validated.

Across all59 protected routes, independently tested arbitrary strings, missing/undefined/null/object/empty/sparse values, unknown/case-altered references, missing requirements and duplicates. All rejected. Reversing legitimate reference order passed, preserving mappings without granting semantic significance to order.

The positive Phase15F comparison independently parsed the document and checked each current method/path/scope/capability/policy/reference set. All59 matched.

### Group3 — Scope/capability/policy descriptions: PASS

scope, requiredCapability and proposedPolicy must agree exactly with the independent Phase15F row for the method/path and row ID. This replaces truthiness acceptance with a complete authority-backed value check.

For all59 protected routes, replaced each of the three fields with undefined, null, empty, weakened or arbitrary strings, object/array and numeric values. All1,416 negative cases rejected. Valid source-backed descriptions pass.

Exact equality is appropriate for canonical non-executable descriptions; it is not a claim that prose itself enforces resource access. Phase15C supplies business authority, Phase15E supplies layered permission design and Phase15F supplies the concrete route wording. No new role or permission was inferred. Serialization and a superficially nonempty string cannot substitute for the approved value.

## 3. Four original finding groups

| Original group | Independent result |
| --- | --- |
| F01 sparse policy fields/grants | PASS: sparse field and mixed sparse grant arrays deny; legitimate base/conditional behavior retained by inspected tests |
| F02 public GET-to-POST drift | PASS: temporary health registration redirect is rejected; application.get restored in finally |
| F03 erased completion requirements | PASS: branchSensitive=false/actionRefs=[]/composition=allow copy rejected |
| F04 shared read/submit field profile | PASS: catalog price read eligible; submitted price denied; items-only command eligible; item price extra denied |

These are synthetic registration/data probes, not live HTTP permission bypass tests. Field helpers specify names and required guards; they do not validate real product/quantity values, establish identity or execute a workflow.

## 4. Independent probe counts

The fresh stdin runner executed2,237 probe cases, with0 failures:

| Group | Cases |
| --- | --- |
| Completion malformed/serialization/accessor cases and zero-invocation assertion |49 |
| Independent authority row comparisons |59 |
| Altered scope/capability/policy descriptions |1,416 |
| Invalid criteria and valid reordered-reference controls |708 |
| Route coverage/valid manifest control |1 |
| Original F01-F04 finding groups |4 |

These are review probe cases, not additional permanent Node test registrations. Several cases contain multiple assertions; counts must not be added to suite totals as if they were disjoint application tests.

## 5. Newly executed suite/build checks

| Command/check | Fresh result |
| --- | --- |
| backend node --test tests/rbacPolicy.test.js tests/rbacRouteManifest.test.js |49 passed,0 failed/cancelled/skipped/TODO |
| backend npm test |178 passed,0 failed/cancelled/skipped/TODO |
| client npm test |16 passed,0 failed/cancelled/skipped/TODO |
| client npm run build |PASS, Vite8.0.3; existing large-chunk notice |
| node --check, all eight B01 files |8 pass |
| Installed ESLint recommended JS rules/Node globals, eight B01 files |0 errors,0 warnings |
| Full client lint |Not rerun; previously documented16 errors/13 warnings are historical |
| Native database/browser/deployment |Not run, unverified |

Backend suites use mocked/synthetic persistence and approved local loopback HTTP fixtures. Existing auth, identity and R1/R2 commit-regression suites are included in the178. Build and lint tooling were already installed; no dependency/configuration change was made. No browser accessibility/printing or native concurrency/durability claim is made.

## 6. Manifest coverage and architecture

- 59 protected explicit method/path pairs across 11 business mounts.
- 60 explicit business registrations including public login; 2 additional public diagnostics = 62 explicit application registrations.
- 23 protected GET-derived HEAD forms, with the same metadata/constraints as their GET origins.
- 3 retired 410 debt registrations and 2 effectful invoice ensure GET/HEAD paths remain distinguished.
- OPTIONS is middleware preflight metadata, not a role grant.
- Method/path/handler/guard changes and missing/duplicate/unsupported registration shapes have existing regressions. The fresh GET-to-POST probe independently confirms the former public-method blind spot is closed.

The original eight-file architecture is intact. Import search found new auth-module imports only in the new B01 tests; runtime entry points, middleware, controllers and models do not call them. User.role remains admin/user; protect continues to validate JWT time/signature/version and load current role/confirmation/epoch. The new business-label evaluator intentionally does not accept raw admin/user strings; it cannot affect existing authentication while unattached.

Compared with the preserved pre-R2 snapshot, only routeInventoryAdapter.js, rbacRouteManifest.test.js and the additive plan changed; the R2 results report was the only new file. Thus R2 stayed inside its authorized implementation scope. That historical comparison is distinct from this review's own preservation check below.

## 7. All17 acceptance criteria preserved

Each exact Phase15B requirement remains carried in Phase15D/E/F; those documents and classifications are not rewritten or promoted by this review.

| Criterion | Historical status retained / review interpretation |
| --- | --- |
| RB01 | Not Implemented end-to-end; four labels correct, no actual account mapping |
| RB02 | Partially Implemented; local metadata verification passes, runtime four-role API enforcement later |
| RB03 | Already Implemented local security foundation; preserved/regressions pass |
| RB04 | Partially Implemented; admin account authority preserved, later role lifecycle required |
| RB05 | Already Implemented local canonical identity foundation; preserved |
| RB06 | Partially Implemented; metadata integrity accepted, shared subject/resource enforcement later |
| RB07 | Not Implemented end-to-end; standalone field/price ceilings verified only |
| RB08 | Not Implemented end-to-end; Manager direct inventory decision preserved |
| RB09 | Not Implemented end-to-end; Manager approval/Cashier request distinction preserved |
| RB10 | Partially Implemented; completion metadata accepted, financial/concurrency guarantees later |
| RB11 | Not Implemented; both guest/student workflows remain mandatory |
| RB12 | Not Implemented end-to-end; five owner decisions preserved |
| RB13 | Already Implemented local actor/version foundation; unchanged/regressions pass |
| RB14 | Already Implemented local commit-replay foundation; unchanged/regressions pass |
| RB15 | Partially Implemented; no frontend/runtime policy activation |
| RB16 | Cannot Verify real migration; no account inventory or migration performed |
| RB17 | Not Implemented durable audit; a declared guard is not audit persistence |

Accepting B01-R2 local repairs does not close these later acceptance obligations.

## 8. Limitations and B02 recommendation

**PASS WITH LIMITATIONS** applies to ordinary local metadata, current registered source and standalone policy helpers.

- Test-only Express/router internals are version dependent. Public anonymous handler-source checks do not prove captured closure semantics.
- Phase15F's Markdown table is a test oracle dependency. Missing/unsupported formatting or route-count changes fail for review. It must be packaged with tests or replaced only through an approved equivalent oracle.
- General arbitrary JavaScript Proxy isolation is not promised. This is a local metadata validator, not an execution sandbox.
- Scope/field/role descriptions and eligibility plans do not enforce current endpoints. Runtime binding requires a reviewed adapter, current-account checks, real resource predicates and mutation/audit consistency.
- Live admin legitimacy, deployed revision, account inventory, credential lifecycle and native transaction behavior remain unverified.
- Five deferred financial/inventory risks, omitted cost reset and historical client lint debt remain open and separately scoped.

**B01-R2's reviewed local defects no longer block consideration of B02.** The owner may consider a separately bounded B02 authorization after its applicable Phase15C/15E decisions are resolved: persisted role identifiers, legacy compatibility/mappings, conditional duties, lifecycle/session semantics and required audit integration. This review does not approve those choices, assign accounts or authorize B02 execution. A01/A08B/production gates remain independent.

## 9. Preservation and stop

Only this new report and an additive review entry in the implementation plan are delivered. Source/tests/configuration/environment/lockfiles/accounts/security behavior remain unchanged during review. All previous reports remain historical; the absent R1 review file remains absent.

Final snapshot comparison covered 210 baseline files: only the implementation plan changed, this report was added and none were removed. All other baseline hashes match, including all eight B01 files, previous reports, runtime/frontend/build artifacts, environment files and lockfiles. The original 65876 plan bytes remain an exact prefix. All17 exact criteria were independently matched in Phase15D/E/F. **Stop after this review. No remediation, B02, A08B, migration, session action or deployment starts automatically.**

