# B01 independent local review

Date: 2026-11-03, Asia/Manila. Project: UPHSD Bookstore POS.

**Verdict: FAIL for B01 contract acceptance. Runtime containment passes; no active permission bypass was demonstrated. Do not proceed to B02 implementation before separately authorized B01 remediation and re-review.**

## 1. Summary and scope

Reviewed Phase15C/D/E/F, the implementation plan and B01 implementation results against all eight actual B01 files. Phase15C remains authoritative. The four approved business labels and five owner decisions are represented in the core eligibility policy; no fifth role or persisted role mapping was created. Existing tests pass, but independent local probes demonstrate fail-closed validation and manifest-coverage defects not caught by those tests.

This was read-only for application code and tests. Probes ran from stdin with synthetic inputs or temporary in-process Express registration instrumentation restored in finally. No probe file, permanent regression, runtime route change, model/schema change, database/provider connection, account/session action, migration or deployment occurred. Only this report and an additive plan entry change. No fix or B02/A08B implementation is performed.

## 2. Files inspected

| B01 file | Assessment |
| --- | --- |
| backend/auth/roles.js | Exactly Administrator, Store Manager, Cashier, Customer / Student; strict labels and recursively frozen definitions |
| backend/auth/capabilities.js |32 actions with base/conditional role ceilings and scope/guard profiles; unresolved domains listed; field-direction gap below |
| backend/auth/policy.js | Unknown role/action denial, typed conditional facts, immutable eligibility plans and separate lowercase canonical ownership equality; sparse-array validation defect |
| backend/auth/fieldPolicy.js | Distinct field profiles/aliases and exclusions; sparse-array defect and shared read/submit profile concern |
| backend/auth/routeManifest.js | Full59 protected explicit registrations match Phase15F;23 protected HEAD derivatives; current/proposed metadata remains unattached |
| backend/tests/rbacPolicy.test.js | Meaningful five-owner-decision and negative tests; action matrix largely derives its expectation from the registry under test |
| backend/tests/rbacRouteManifest.test.js | Current route set/count, effect flags and selected negative drift tested; omissions reproduce below |
| backend/tests/routeInventoryAdapter.js | Test-only mount recorder, early-protect detection and alias identity normalization; public-method observation and semantic drift validation incomplete |

Also traced backend/app.js, authMiddleware.js, User role enum/security-hook behavior, UserRoute and existing token/security/account/commit regression evidence. Existing runtime imports were searched; matches for new auth-module imports occur only in the new tests. No production entry/router/controller/model imports these files.

Documentation inspected: Phase15C finalized specification; Phase15D impact assessment; Phase15E blueprint/B01 contract; Phase15F technical review; B01 implementation results; existing plan. Existing reports are historical and not overwritten.

## 3. Findings

### F01 — Malformed sparse arrays receive eligibility — FAIL, medium, local helper

Evidence: policy.js lines8-11; fieldPolicy.js lines14-16. Array.some/every skip holes. The validators check array type and inspect only present elements.

Read-only reproductions:

- evaluateFields("Store Manager", "inventory.adjust", new Array(1)) returns effect eligible despite containing a missing field.
- evaluateRolePolicy("Administrator", "product.price.write", {conditionalActions:new Array(1)}) returns eligible rather than rejecting malformed conditions.
- evaluateRolePolicy("Administrator", "sale.process", {conditionalActions:[, "sale.process"]}) also returns eligible: the hole is ignored and the present synthetic conditional action satisfies includes.

Expected contract behavior: malformed field/grant arrays deny or safely reject, not silently become valid. No real grant was created, and the third example still explicitly contains a synthetic approved action; this is not proof of an account privilege escalation. Sparse arrays are JavaScript inputs, not a demonstrated JSON endpoint exploit (JSON serialization turns holes into null). The pure API nevertheless violates Phase15F's malformed-input requirement.

Recommended separately authorized correction: validate every array index and representation before evaluation; add missing-index/mixed-sparse tests and define empty-array semantics. Do not attach this helper to runtime as a workaround.

### F02 — Public method drift is hidden by collector — FAIL, medium, test infrastructure

Evidence: routeInventoryAdapter.js lines38-43 always emits method GET for app-level diagnostic routes, without inspecting layer.route.methods.

Read-only probe temporarily redirected registration of /api/health from application.get to application.post, delegated normal route construction, collected metadata and restored application.get in finally. No health handler/request/database call occurred.

Observed: collectRoutes still reports GET /api/health and validateInventory accepts the changed graph against the unchanged manifest. Expected: observed POST versus declared GET must fail inventory validation. Handler identity/protection at these app-level diagnostic records is similarly hardcoded, limiting their independent verification.

Recommended correction: inspect actual methods/handler/auth metadata, reject unsupported shapes/methods, derive HEAD from observed GET and add changed-method/handler tests. Do not modify app.js or health behavior to accommodate the collector.

### F03 — Completion constraints can be erased without validator failure — FAIL, medium, coverage

Evidence: validateInventory key compares method/path/mount/normalized handler/protected only. Semantic checks specially cover invoice ensure effect and retired handlers; they do not validate order completion constraints.

Read-only probe cloned ROUTE_MANIFEST and changed the createOrder row to:
branchSensitive=false; actionRefs=[]; actionComposition="allow".
validateInventory(collectRoutes(), modifiedManifest) returned normally.

Expected: lost required completion/payment/receipt constraints must fail, as Phase15F explicitly requires negative effect-drift coverage. This does not change a real transaction; it demonstrates a gap in the claimed reusable validator.

The existing final manifest test separately asserts branch flags/actionRefs on the current artifact, so those particular static changes would be caught by that test. It does not assert actionComposition's meaning. A validator-level pass and a suite-level assertion are different guarantees. General actionRefs checks only require registered names, not per-route correct authority.

Recommended correction: an independently reviewed semantic expectation for effect-sensitive routes and aliases, explicit composition/required-action/state validation and permanent negative tests. Avoid deriving all expected policy from the same edited metadata.

### F04 — Field-profile direction is unspecified — PASS WITH LIMITATIONS, design concern

capabilities.js line18 assigns the same sale profile to catalog reading, order.submit and order.status. evaluateFields("Customer / Student", "order.submit", ["price"]) returns eligible, while submission/cart fields such as items are not represented in the profile.

Because this is eligibility metadata with own-subject/privacy/workflow guards, the result does not authorize a product price mutation or show a runtime bypass. It does make the field specification unsafe to interpret as a ready-made write-payload allowlist. Read projection and submitted command fields need distinct contracts. Resolve before any B08 binding, preserve server prices and keep unknown customer fields denied. Do not invent order/payment semantics during this review.

## 4. Permission and ownership assessment

- Administrator-only product pricing and account administration are represented; Manager/Cashier/Customer price denial is tested independently for the core price action.
- Manager direct receiving/adjustment, reason/movement/audit constraints, reversal approval/application and all-cashier history eligibility are present. No second inventory approver is imposed.
- Cashier personal-history scope is own-processor; independent reversal approval/direct stock/price/all-history are denied; request capability is distinct.
- Customer own-subject order eligibility is distinct from staff permissions. Guest is rejected as a role label; actual guest/student identity/public ordering remains intentionally deferred, not implemented by a new guest staff role.
- Conditional Admin/Manager operational actions deny without explicit synthetic condition facts; no wildcard or automatic role hierarchy. Actual grants, role adapters and persistence remain unapproved later work.
- checkResourceOwnership accepts equal lowercase24-hex IDs only, denies case variants/objects/unknowns and does not fetch/resolve store membership. It requires already canonical identities; it is not a substitute for accountIdentity or a four-role record-scope resolver.
- Eligibility plus a scope string does not enforce ownership. A later caller must validate actual actor/target/scope and all field/state/atomic/audit guards. No constraint plan is an executable HTTP permit.
- Protected manifest method/template coverage matches Phase15F exactly:59 protected explicit pairs,11 mounts,23 protected HEAD forms. Three retired debt paths and effectful invoice ensure paths are identified. OPTIONS metadata is not authorization.
- Source-backed current allowlists, controller scope and outcome descriptions are not automatically proven by route graph inspection. Native transactions/durability remain unverified.

## 5. Compatibility and security foundations

**PASS for local runtime nonattachment.** Existing User.role remains enum user/admin with default user. protect still uses current persisted role/confirmation/epoch and existing HS256/time/version checks. New business-label helpers intentionally deny raw admin/user strings; this does not break login because no existing runtime caller invokes them. Wiring them directly without a separately approved adapter would break compatibility and is prohibited.

Existing JWT lifetime, tokenVersion invalidation, bcrypt compatibility, admin actor-version fences, canonical ObjectId self-delete, safe diagnostics and R2 commit no-replay paths remain unchanged. The169-test backend regression run passes including existing security/commit suites; this uses synthetic persistence and local loopback HTTP only.

No actual administrator legitimacy, account counts/states, production login, token contents, deployment revision or credential validity was inspected. Compatibility is source/regression-based, not certification of live accounts. Existing protect-only business permission gaps, five financial/inventory risks, omitted cost reset and client lint debt remain open and are not fixed by B01.

## 6. Test results and probe limitations

| Command/check | Actual result |
| --- | --- |
| backend: node --test tests/rbacPolicy.test.js tests/rbacRouteManifest.test.js |40 passed,0 failed/cancelled/skipped/TODO |
| backend: npm test (approved local loopback scope) |169 passed,0 failed/cancelled/skipped/TODO |
| client: npm test |16 passed,0 failed/cancelled/skipped/TODO |
| node --check on eight B01 files |8 files pass |
| Installed ESLint recommended JS/Node config on eight files |0 errors,0 warnings |
| Independent stdin acceptance probes |F01 malformed examples returned eligible; F02 changed public method accepted; F03 erased completion constraints accepted |
| Field-direction observation |F04 price field eligible for submit; classification limited to ambiguous standalone specification |
| Full client lint / production build |Not rerun in this read-only review. B01 historical build passed and full lint16 errors/13 warnings remain the documented baseline |
| Database/native/browser verification |Not run; no configured database/provider/browser or production connection |

The new acceptance probes were temporary in-process instrumentation/data copies only, not permanent tests or source modifications. They expose missing acceptance coverage despite the green suite. F02 proves metadata misobservation under registration substitution, not a network route exploit. F03 is a validator mutation probe; distinguish it from tests that inspect the original artifact.

## 7. Missing coverage and required follow-up

Separately authorized B01 remediation should precede B02:

1. Dense/sparse/empty arrays, mixed holes and supported conditional representation; assert safe rejection of malformed inputs.
2. Actual app-level HTTP method/handler/protect observation; recorder restoration on failure; unsupported mount/path/shape cases with observed graph evidence.
3. Independent per-route completion/action-composition requirements, public/HEAD effects and missing constraints on every effect-sensitive alias.
4. An independent expected role-action matrix, rather than predominantly rule.base.includes(role) as both implementation and oracle. Current focused owner checks do not independently exhaust every prohibited action.
5. All graph collection tests should install I/O barriers, not only the first test; current second test calls collectRoutes without those traps. Current imports are safe by inspection, but fail-closed future-change containment is incomplete.
6. Explicit read-field versus write-command intent before using field profiles in customer/staff APIs; no runtime attachment during repair.

No tests were added, weakened or edited here. These are proposed scoped repairs, not execution authorization. No requirement to inspect production data is needed to reproduce the local defects.

## 8. All17 mandatory criteria preserved

The exact requirements remain unchanged in Phase15B and are carried verbatim by Phase15D/E/F. This report does not replace or weaken them.

| Criteria | Review status / remaining work |
| --- | --- |
| RB01 | Four business labels correct; stored-role mapping/round-trip/migration remain later; malformed input weakness F01 open |
| RB02 | Current route set observed; validation/negative coverage fail F02/F03; complete runtime four-role API tests remain later |
| RB03 | Existing token/current-account/epoch security preserved; no new account writer |
| RB04 | Admin account ceiling represented and existing account APIs unchanged; future injection/assignment acceptance still mandatory |
| RB05 | Existing canonical self-delete protections/regressions preserved; new lowercase ownership helper does not replace them |
| RB06 | Ownership requirements declared, not implemented shared scope; real record/subject privacy tests remain later |
| RB07 | Core price/cost/stock restrictions represented; malformed/field-direction gaps F01/F04 require attention before binding |
| RB08 | Direct Manager stock eligibility; ledger/reason/concurrency behavior not implemented or natively verified |
| RB09 | Manager approval and Cashier request-only eligibility; aliases/effects/history consistency still require later implementation |
| RB10 | Completion requirements recorded but validator fails to protect them F03; state/concurrency/idempotency remain later |
| RB11 | Both ordering modes remain mandatory; no guest identity/public ordering or student enrollment implementation |
| RB12 | Five settled owner decisions retained; exhaustive independent role oracle remains incomplete |
| RB13 | Existing admin actor/epoch transaction guards unchanged and regressions pass locally |
| RB14 | Existing R1/R2 commit regressions pass; no native guarantee inferred |
| RB15 | No frontend/runtime visibility change; future frontend and direct API consistency required |
| RB16 | No account inventory/mapping/migration/recovery executed; live acceptance remains unverifiable |
| RB17 | Audit requirement declared only; durable consistency/persistence/access still missing, request logs insufficient |

Phase15D historical classifications are preserved, not silently rewritten as newly passed requirements. Four local security foundations do not make the entire four-role system implemented.

## 9. Verdict, B02 recommendation and preservation

| Area | Verdict |
| --- | --- |
| Four business roles/core approved ceilings | PASS with remaining field/coverage limitations |
| Runtime isolation / existing login and security compatibility | PASS locally; production unverified |
| Standalone malformed-input fail-closed requirement | FAIL — F01 |
| Manifest observation and semantic drift rejection | FAIL — F02/F03 |
| Native/shared data/audit/migration acceptance | Not verified or implemented, as scoped |
| Overall B01 contract acceptance | **FAIL** |

**B02 implementation is not recommended until a separately authorized narrow B01 remediation addresses F01-F03 and receives independent re-review.** F04 must be explicitly resolved before field-profile binding. Do not activate permissions, rename stored roles, migrate accounts or weaken security to obtain passing tests.

Preservation comparison covered 207 baseline files: only the implementation plan changed, this review was added and none were removed. All original source/test/configuration/environment/lockfile/report hashes match; the original 61877 plan bytes remain an exact prefix. All 17 exact criteria were independently matched in Phase15D/E/F; git diff whitespace checks pass with pre-existing line-ending notices only. Stop for review; no remediation, B02, A08B, account or production operation follows automatically.

