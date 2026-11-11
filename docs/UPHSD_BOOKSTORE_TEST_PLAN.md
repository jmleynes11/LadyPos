# UPHSD Bookstore POS — test plan and audit results

Date: 2026-11-02, Asia/Manila. Baseline commit `2e9942e`. Local environment Node24.14.0/npm11.9.0. Tests below used existing dependencies. No installation, configured DB connection, seed, migration, production service request or deployment was performed.

## Actual checks executed for this request

| ID | Command/method | Result | Evidence limit |
| --- | --- | --- | --- |
| V01 | git status --short, rev-parse, hidden/source file inventory | Commit2e9942e; pre-existing modified backend/package-lock.json, backend/node_modules/.package-lock.json, client/package-lock.json and untracked docs/ | Local checkout only; existing work preserved |
| V02 | Read manifests, both lockfiles and installed package.json metadata | Versions agree for checked direct dependencies; Vite locked/installed8.0.3 vs manifest^8.0.1 | Not a clean install or dependency vulnerability scan |
| V03 | `node --check` for all nondependency backend JS | PASS:38 files,0 failures | Syntax, not business/runtime acceptance |
| V04 | Import all11 backend routes with Node ESM, without index.js or dotenv | PASS:11 imports; mongoose readyState remained0 | Module resolution only; no listener or HTTP requests |
| V05 | In client: `npm run build -- --outDir "$env:TEMP/uphsd-bookstore-audit-build-20261102"` | PASS exit0; Vite8.0.3,670 modules; CSS44.12kB/gzip8.95; JS751.22kB/gzip227.24; chunk warning | Temporary build output outside source; no browser/API/payment/hosting test |
| V06 | `npm run lint`, then existing ESLint API summary | FAIL exit1;18 errors,13 warnings across19 files | Actual lint failures; build passing does not override them |
| V07 | Seven isolated assertions A01–A07 described below | PASS assertions confirming defects/missing constraints; DB readyState0 | Synthetic in-memory DB/session adapters, not successful business workflows |
| V08 | Safe configuration-name inventory, tracked-file check, model/schema metadata | Both environment files tracked;9 source models; invoice/counter schema uniqueness absent | No secret values or actual DB indexes/records inspected |
| V09 | Validate seven required filenames, relative Markdown targets and fence pairs | PASS:7 documents;39 relative links;0 missing links/unclosed fences | Static document validation, not browser rendering |
| V10 | Compare document text against exact configured backend secret values without printing values | PASS:7 documents scanned;0 matches; DB readyState0 | Not a complete Git-history/bundle/secret-provider audit |
| V11 | Final git status/diff-name/diff-check against initial observed paths; review addition-only patches | PASS: tracked changes remain the same3 pre-existing lockfile paths; only7 bookstore Markdown files added by this task; no whitespace errors in tracked diff | Original untracked docs preserved by targeted additions; cross-call hash comparison unavailable as noted below |

Build warning: main JS exceeds500kB. That is a performance investigation item, not a failed build or proof of poor real-device latency. The outside-root output warning is expected because audit did not modify client/dist.

### Isolated defect checks

The Node stdin harness imported actual controllers, models, protect and authorizeRoles. It did not load dotenv; it used a synthetic JWT secret and synthetic ObjectIds. Mongoose database methods and session adapters were replaced only within that process. No application or real stored record was changed.

| ID | Executed path | Observed assertion |
| --- | --- | --- |
| A01 | Actual createUser + generateToken + protect + authorizeRoles; mocked User.findOne/create | Public input admin/confirmed=true returned201; issued token passed real admin guard; captured password remained raw; User.matchPassword absent |
| A02 | Actual getProfile; spy User.findById, canonical auth-style `{id,role}` | Lookup received undefined; User not found passed to error callback |
| A03 | Actual Product document validate | price1.25 and stock1.5 accepted; integer validation absent |
| A04 | Actual Invoice/InvoiceCounter schema.indexes | No declared unique indexes in either schema |
| A05 | Actual createDebtPayment and actual registered custom applyPayment hook; fake sale/session/DB adapters | Synthetic total1000, paid0/balance1000; collection100 returned201 but paid200/balance800 |
| A06 | Same path with amount1000 | Returned400 with `next is not a function` after duplicated application path |
| A07 | Actual markAsPaid -> createDebtPayment; spy customer lookup; order/customer IDs distinct | Customer lookup received order route ID; returned400 Customer not found |

A05/A06 invoked the custom registered hook function directly on a synthetic object; fake sale.save recomputed balance. This verifies duplicated call-path logic and error behavior, not Mongoose transaction rollback or database persistence. A03 validates a schema, not HTTP acceptance. A04 does not prove no live index exists. A01 does not create a real account or contact an external endpoint.

No persistent harness/test runner was added during this documentation phase. The preceding setup and assertions record the reproduction boundary; future regression tests must cover the corrected HTTP/service/real-DB paths rather than rely on internal hook lookup.

### Lint result by file under client/src

| File | Errors | Warnings |
| --- | --- | --- |
| features/auth/components/PasswordChangeModal.jsx |1|0|
| features/auth/components/ProfileCard.jsx |1|0|
| features/auth/components/SecurityCard.jsx |1|0|
| features/auth/components/UserModal.jsx |1|0|
| features/financials/pages/ExpensePage.jsx |0|1|
| features/financials/pages/FinancialPage.jsx |0|2|
| features/invoices/pages/InvoicePage.jsx |1|1|
| features/orders/components/AddOrderModal.jsx |1|1|
| features/orders/components/UpdateOrderModal.jsx |1|1|
| features/orders/pages/OrdersPage.jsx |0|1|
| features/orders/pages/PosPage.jsx |0|1|
| features/people/components/PersonCard.jsx |1|0|
| features/people/pages/PersonPage.jsx |2|2|
| features/products/components/ActiveProductsModal.jsx |1|1|
| features/products/pages/ProductPage.jsx |1|1|
| shared/components/Layout.jsx |2|0|
| shared/hooks/AuthContext.jsx |2|0|
| shared/utils/useApi.js |1|1|
| shared/utils/useServerReady.js |1|0|
| **Total** |**18**|**13**|

Rules include react-hooks/set-state-in-effect, immutability declaration order, preserve-manual-memoization, exhaustive-deps, no-unused-vars and react-refresh/only-export-components. Some diagnostics apply to currently unused legacy components; they still fail the configured repository lint command. Do not disable rules wholesale to label testing complete.

## Acceptance suite to implement after approval

All tests below are **planned / NOT RUN** unless explicitly listed under actual checks. Use an isolated synthetic dataset and disposable transaction-capable MongoDB, never the configured existing DB. Proposed harness/tool installation needs separate authorization. An approved app factory should allow HTTP tests without importing the listener or loading production configuration.

| ID / area | Required scenarios and expected results | Layer/data |
| --- | --- | --- |
| T01 Login/password | Valid confirmed hashed account succeeds; invalid/empty/malformed credentials fail safely; unconfirmed/disabled rejected; create/reset/change hash once and compare; no plaintext/hash/token in responses/logs | Unit + HTTP + disposable DB; existing user preserved |
| T02 Authorization | Each approved role/action allow and deny; missing/expired/tampered token; deleted/demoted/deactivated user loses access; cross-owner/store references denied; kiosk cannot call staff APIs or set paid/admin | HTTP integration; full capability matrix and alias coverage |
| T03 User management | Authorized provisioning only; duplicate identifier/phone semantics; search and page2 actually reach server; self/last-admin restrictions per approved policy; deactivate preserves referenced history | HTTP/UI + DB; synthetic users |
| T04 Products | Create/edit/search/SKU/ISBN/category validation; preserve omitted stock/cost; deactivate not delete; invalid prices/unsafe integers/fractions rejected; record201 reachable through search/paging | Unit/HTTP/UI; catalog >200 entries |
| T05 Product availability | Inactive/out-of-stock excluded from kiosk sale selection; threshold boundary0/exact/above; unconfigured threshold labeled; availability rechecked after stale cart and concurrent sale | HTTP/UI + DB; current vs stale data |
| T06 Kiosk | Browse/select/quantity/cart/review/confirm; no payment-status control; safe session reset/back navigation/timeouts; accessible touch layout; only own reference/status; rejected stock returns clear error | Browser + HTTP; approved workflow branch |
| T07 Number generation | Parallel order/invoice/counter creation yields unique scoped numbers and stable replay; period rollover/timezone; duplicate key handling; existing issued numbers preserved | DB integration/concurrency; approved format/scope |
| T08 Queue/claim | Central shared-store visibility; isolated other store; two claims/completions yield one winning authorized actor/effect; release/expiry/cancellation and terminal-state rejection; no reservation inferred | Multi-session HTTP+DB; approved states/claim policy |
| T09 Payment validation | Authoritative DB prices/totals despite forged inputs; valid cash tender/exact/change; insufficient/negative/fractional/overflow payment rejected; allowed electronic evidence required; credit/partial only if approved; unsupported status/method rejected | Service+HTTP+DB; no live money |
| T10 Duplicate prevention | Same key/body replay returns original order/payment/receipt; changed body/key reuse conflict; double click/reconnect/timeouts; repeat completion/settlement/void causes no extra payment, stock effect or number | HTTP/DB fault injection; durable replay across process restart |
| T11 Receipt | Correct stable brand/number/date/time/item snapshots/unit prices/qty/subtotals/total/tender/change/cashier; rename/price edit does not alter reprint; pending order cannot issue payment receipt; printer failure reprints same sale | Contract/browser print/PDF or paper review; approved receipt content |
| T12 Stock-in/adjustments | Authorized positive receiving records with actor/time/reference; correction reason/permission; missing actor/invalid delta rejected; nonnegative stock; replay only one movement; metadata edits preserve quantities | Service/HTTP/DB + movement reconciliation |
| T13 Stock deduction/rollback | One decrement per settled approved sale; pending action follows approved reservation rule; multi-item shortage rolls back sale/payment/invoice/all stock changes; cancellation restores only actual approved effects | DB integration and injected failures at each write |
| T14 Concurrent cashiers | Initial stock1; two distinct cashiers sell last item concurrently: one success, one conflict, final stock0, one sale/payment/receipt/movement. Repeat same order in parallel: one financial effect. Race adjustment vs sale and invoice ensure/issue | Real concurrent DB sessions with conflict retries, no adapter-only proof |
| T15 Sales calculations | Known completed totals across day/week/month boundaries; pending excluded; approved reversal handling; product/category aggregation matches detail; later collection appears on payment date rather than restating sales | Unit+DB report fixtures; explicit Asia/Manila convention after approval |
| T16 Inventory reports | Whole-dataset counts/thresholds/category filters; current stock matches ledger opening+movements; receiving filtered by effective/recorded date as labeled; role DTOs omit costs/financial data | DB aggregate+HTTP; known stock fixture |
| T17 Payment/legacy records | Initial/later payment events reconcile once; linked/general allocations match amounts if retained; full/partial/debt paths no double application; old ambiguous units/missing snapshots remain labeled | DB integration; synthetic legacy formats; no guessed reconstruction |
| T18 Responsive/accessibility | 360/390px mobile,768px tablet, desktop1180px+ and actual kiosk resolution; no hidden checkout controls/overflow; keyboard/focus trap/Escape, screen reader labels, contrast, loading/error/empty states and print | Browser/device/manual QA; authenticated seeded test environment |
| T19 Build/deployment | Existing build and lint pass; clean reproducible install only when authorized; correct API base/PORT/CORS/TLS; SPA deep links; no public logs/secrets in bundles; DB-down recovery/readiness/shutdown; restore/rollback rehearsal | Isolated CI/staging; infrastructure evidence required |
| T20 Preservation/migration | Dry-run counts/checksums, duplicates/orphans/units report; restore backup; additive backfill idempotency; old/new app compatibility; correct rollback preserves post-cutover valid transactions | Isolated restored copy and approved migration plan |
| T21 Expenses/retained modules | Positive consistent monetary units on create/update; authorized reads/edits, approved retention and history; no unsupported profit/income statement; existing customer/debt history retained | HTTP/UI/DB regression for retained scope |

### Fixture arithmetic

Use clearly synthetic integer-centavo fixtures: product A price12500/stock2, B price3500/stock1. Sale A×1+B×1 totals16000. Cash tender20000 yields applied16000/change4000 if cash workflow is approved. Completed sale contributes16000 sales, not20000. A pending order contributes no completed sales or collected money. Cost remains unknown; no profit assertion.

Place a sale at a local midnight boundary and a collection on the following date to distinguish createdAt, completedAt and paidAt. Define ISO/local week expectations only after the management decision. Generate quantities around1/0/negative/fraction and safe-integer overflow. Include stale product price/active flag, >200 catalog/orders, missing legacy timestamps and malformed scope references.

## Safety boundaries and checks not run

Not run: live API/DB/browser login, CRUD, kiosk, checkout, full payment, invoice/print, multi-cashier races, actual index queries, migrations, backup/restore, load tests, advisory refresh, credential compromise testing, clean npm ci or staging/production deployment. Running index.js would connect to configured MongoDB and print its URI; it was intentionally not started. Existing seed would write a fixed privileged account; it was not run. Build output must not be deployed or shared as a production artifact without configuration review.

Current UI and receipt failures are static contract findings, not a completed browser reproduction. Static absence findings are based on first-party source/route/test/config inventory. Third-party dependency test files are not application acceptance tests.

## Completion and phase reporting gates

Each approved phase reports changed files, executed commands/results, unrun checks with reason, data/config effects and remaining defects. Security and transaction release blockers require executable regression results. A successful build, schema validation or adapter-based reproduction alone never proves checkout, receipt, reporting or concurrency correctness.

Documentation delivery validation passed for the seven required files,39 relative links, fence pairs and configured-secret comparison. Git status and tracked diff names match the initial three modified lockfile paths plus untracked docs/. The seven application-independent Markdown additions are the only writes made by this task. All existing documents were left untouched.

A 128-file hash baseline was written to the tool's temporary directory, but that directory was not retained between tool invocations. The attempted cross-call comparison could not run and is **not claimed as a successful hash verification**. Source preservation evidence is the initial/final Git comparison and targeted addition-only edits. One PowerShell inspection command also failed to parse and was corrected before execution; neither tooling failure is an application defect. No business acceptance claim follows from documentation validation.

Related: [security](UPHSD_BOOKSTORE_SECURITY_REVIEW.md), [implementation roadmap](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md). Older [verification results](audit/verification-results.md) and [testing strategy](implementation/testing-strategy.md) remain preserved and separately dated evidence.
