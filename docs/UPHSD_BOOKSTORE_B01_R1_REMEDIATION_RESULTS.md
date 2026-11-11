# B01-R1 remediation results
Date: 2026-11-04, Asia/Manila.

**Local remediation complete; independent B01-R1 review required. B02 remains unauthorized.**

## Findings and root causes

All original cases were reproduced before editing: sparse field/grant arrays produced eligibility; the collector accepted health GET-to-POST drift; the validator accepted erased createOrder constraints; customer submit fields allowed price.

| Finding | Root cause | Correction |
| --- | --- | --- |
| F01 | Array.some/every skip missing indexes; explicit undefined grant arrays resembled absence | Shared dense-string-array validation, strict own properties and nonempty field selection; missing/null/undefined/holey field arrays deny; malformed grant arrays deny |
| F02 | App-level diagnostic method hardcoded GET | Actual registered methods observed; unsupported shapes/methods and substituted handler source rejected; registration recorder restored on failure |
| F03 | Route identity comparison omitted completion semantics | Independently pinned branch flag, mutation effect, sale/payment/receipt action conjunction and mandatory guards for createOrder/createTransaction/updateOrder/markAsCompleted |
| F04 | Catalog projection reused for order submission/status | Separate orderSubmit command, orderStatus projection and item-field specification; no submitted price/paid/stock/identity fields |

Omitted conditionalActions is valid for base permissions. Empty dense grants mean no conditional grants; conditional eligibility denies. Explicit undefined/null/sparse arrays deny. Empty field selections deny. No persisted role, actual account grant or runtime API is affected.

## Modified files

Only the original eight B01 source/test files changed:

- backend/auth/roles.js: shared dense string-array predicate; four approved labels unchanged.
- backend/auth/capabilities.js: distinct submit/status profiles and server-price/item-validation requirements.
- backend/auth/policy.js: strict condition validation and own-property conditional lookup.
- backend/auth/fieldPolicy.js: separate read/command purposes, dense fields, item-field checks.
- backend/auth/routeManifest.js: explicit completionConstraints metadata on completion-capable routes.
- backend/tests/routeInventoryAdapter.js: actual public methods/handler-source observation and stronger metadata/semantic validator.
- backend/tests/rbacPolicy.test.js: malformed-array and field-direction/item regressions.
- backend/tests/rbacRouteManifest.test.js: original drift/erasure probes, partial weakening, handler/shape changes, restoration; I/O barriers now apply before every metadata test.

No ninth source/helper/configuration file was added. Existing runtime, authentication, controllers, routes, schemas, accounts and pre-B01 tests remain untouched. Previous reports remain historical. The new foundation is still unimported by runtime callers.

## Exact field specifications

| Profile | Purpose | Allowed names |
| --- | --- | --- |
| sale | Read projection | name, sku, price, category, availability |
| orderStatus | Own-subject read projection | reference, orderStatus |
| orderSubmit | Command specification | items |
| order item | Command-item specification | product and quantity, both required exactly once |
| catalog | Administrator command specification | name, sku, price, category |
| stock | Direct Manager command specification | delta, reason |
| account | Account field specification | identifier, name, phone, address, role, confirmed |
| none | Unresolved | No eligible nonempty selection |

Submit rejects price/sellingPrice, costPrice, stock, paymentStatus, amountPaid, owner, studentUser, guestAccess, orderStatus and unknown names. Item specification excludes price/subtotal/cost/identity extras. Existing aliases do not add excluded canonical fields to any profile.

These helpers validate field names only. They do not parse a real payload, validate product/quantity values, establish identity, reserve stock, settle payment or execute serialization. Returned guards require later product/quantity/server-price validation, own-subject privacy and approved workflow enforcement. No new payment/refund/reservation/pickup rule is invented.

## Original probes and tests

| Probe group | Before | After |
| --- | --- | --- |
| F01 sparse fields, sparse grants on base action, mixed sparse conditional grant | eligible | deny |
| F02 temporary public health GET-to-POST registration | accepted | observed POST and rejected |
| F03 erased branch flag/action references/composition | accepted | rejected |
| F04 Customer order.submit price | eligible | deny; catalog price read and minimal items command remain eligible |

**All four original finding groups now pass separate stdin assertions.** No real handler/health/database request ran; temporary registration substitutions were restored. Permanent tests include missing/null/undefined/mixed sparse arrays, valid base/no-grant behavior, protected item fields, each completion alias, deleted/missing guards, wrong actions/OR composition, changed handlers and unsupported shapes.

Completion constraints are current-account, server-price, state-validation, atomic-effects, operation-identity and audit. Validator expectations are independent of supplied manifest metadata.

| Required verification | Actual result |
| --- | --- |
| Focused node --test tests/rbacPolicy.test.js tests/rbacRouteManifest.test.js |45 passed,0 failed/cancelled/skipped/TODO |
| Full backend npm test, final run |174 passed,0 failed/cancelled/skipped/TODO; includes final item-field assertions |
| Client npm test |16 passed,0 failed/cancelled/skipped/TODO |
| Client npm run build |PASS, Vite8.0.3; existing large-chunk notice |
| node --check on all eight files |8 pass |
| Installed ESLint recommended JS + Node globals, all eight files |0 errors,0 warnings |
| Full client lint |Not rerun; historical16 errors/13 warnings are not fresh results |
| Native MongoDB/browser/production |Not run, unverified |

Five permanent tests were added (focused40->45, backend169->174). An initial targeted lint check flagged intentionally sparse array literals; fixtures now create holes with indexed assignment, preserving assertions without disabling rules. Backend regressions use approved local loopback listeners and mocked/synthetic persistence. No external/database connection occurred.

## All17 criteria and compatibility

Historical Phase15D classifications remain unchanged:

| Criterion | Historical classification |
| --- | --- |
| RB01 | Not Implemented |
| RB02 | Partially Implemented |
| RB03 | Already Implemented |
| RB04 | Partially Implemented |
| RB05 | Already Implemented |
| RB06 | Partially Implemented |
| RB07 | Not Implemented |
| RB08 | Not Implemented |
| RB09 | Not Implemented |
| RB10 | Partially Implemented |
| RB11 | Not Implemented |
| RB12 | Not Implemented |
| RB13 | Already Implemented |
| RB14 | Already Implemented |
| RB15 | Partially Implemented |
| RB16 | Cannot Verify |
| RB17 | Not Implemented |

All17 exact requirements remain preserved in unchanged Phase15B/D/E/F documents. RB01/RB02/RB07/RB10/RB12 foundation validation improves; no runtime role/scope/field/effect acceptance is promoted. RB03/RB05/RB13/RB14 security controls remain preserved and local regressions pass. RB04/RB06/RB08/RB09/RB11/RB15/RB16/RB17 retain their later implementation/evidence gates.

Existing admin/user login compatibility is preserved because no role enum, authentication adapter, token, password, account or runtime import changed. Manager adjustments remain direct, no new second approver; five approved owner decisions unchanged.

## Limitations and next gate

Eligibility is not authorization. Native transactions, live account legitimacy, shared data scope, audit consistency, actual guest privacy, refund/void effects, all five deferred integrity risks and omitted cost reset remain open. Test-only Express graph inspection is version dependent; anonymous handler source validation does not prove closure semantics.

Preservation is verified against the pre-phase snapshot; results appended below. Only this new report and the plan append accompany the eight-file changes.

Final snapshot comparison: exactly the eight authorized foundation/test files and the appended plan changed; only this report was added; no file was removed. All other baseline hashes match, including prior reports, runtime/security files, frontend, environment/lockfiles and derived build output. The plan's original 63227 bytes remain an exact prefix.

**Ready for separate independent B01-R1 review. Do not start B02 until that review accepts remediation and the owner separately authorizes implementation.** No A08B, migration, role assignment, deployment or production action follows automatically.

