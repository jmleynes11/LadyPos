# UPHSD Bookstore POS — Phase 10A results

Date: 2026-11-02, Asia/Manila. Baseline commit `2e9942e` with the existing local lockfile changes and untracked audit documentation preserved. **Authorized Phase 10A implementation is complete in the local checkout, subject to the verification limits below. Nothing was deployed. No next phase has started.**

## Authorization, review and baseline

The user authorized critical security containment, correction of the reported linked-payment/full-settlement/receipt defects, and regression tests. The seven audit documents were reviewed with the current routes/controllers/models/client code. Their original findings remain historical audit evidence; they were not overwritten to make the baseline appear fixed. Only an execution addendum was appended to the implementation plan.

Initial working tree: modified `backend/package-lock.json`, `backend/node_modules/.package-lock.json`, `client/package-lock.json`, plus existing untracked docs/. No application source modifications were present. A 136-file SHA-256 baseline, including environment files and existing documents but excluding Git/dependency directories, was retained in tool session storage. This avoids the previous audit's temporary-directory retention problem.

Before source corrections, the first 17 regression cases were executed:3 passed and14 failed. They reproduced partial payment100 becoming200, full settlement returning400, order/customer ID confusion, receipt DTO omissions, missing password hashing/comparison and error/diagnostic exposure. That first run also included harness limitations: five HTTP cases initially hit sandbox loopback restrictions, and the rerun exposed missing denied-path query mocks/buffering timeouts. Those harness failures are not counted as independent application vulnerabilities. Local-loopback execution was then permitted, missing mocks were supplied, and buffering was disabled in the test helper. No MongoDB connection occurred.

## Security corrections

### Administrator provisioning and authentication

- Existing POST `/api/users/register` now requires a valid current confirmed account and backend `admin` role. Anonymous requests receive401; ordinary users receive403. This preserves the existing login UI's administrator-created-account policy. Administrator creation of both `user` and `admin` accounts remains supported.
- Provisioning validates existing role/confirmation types, defaults to `user`/unconfirmed and returns the created account DTO without its password or an impersonation token. The existing admin UI does not consume that token. Login remains the token-issuing endpoint.
- User's pre-save hook hashes changed passwords with existing bcryptjs, cost10. Creation, administrator reset, self-change and seed provisioning use the same path. Unchanged password hashes are preserved; an in-process failed-save retry does not double-hash the already generated digest. No stored fields/indexes were added or renamed.
- New password writes require a string of at least6 characters, consistent with existing UI/change-password validation, and at most72 UTF-8 bytes to avoid bcrypt truncation. Existing bcrypt logins remain compatible. Legacy plaintext is never accepted as a fallback or automatically converted. No existing password was read from the live database or reset.
- Protected requests now verify JWT HS256 and load the current account's role/confirmation. A deleted, unconfirmed or demoted account cannot retain privilege merely through a stale signed role claim. Existing seven-day token lifetime remains unchanged; logout/password reset does not yet revoke all previously stolen valid tokens.
- Profile/password/self-delete identity references now use the middleware's canonical `req.user.id`. This restores the intended backend path; the separate client profile-state setter defect is outside this phase.

### Diagnostics, errors and provisioning utility

- Express app construction moved to `backend/app.js`, with no listener/DB connection/env-file load on import. `index.js` remains the production entry point on the same port, with the same route mounts and CORS origins. This is a small extraction of the existing backend, not a rewrite.
- The unsafe public live-log viewer/stream and global console interception were removed. `/` returns minimal UPHSD Bookstore POS service metadata; `/logs-stream` returns404. Health responses contain only readiness status.
- Startup/connection failures no longer print the MongoDB URI, database host or raw driver error. Request logs record route templates/status, excluding query strings, bodies and authorization headers. Order diagnostic strings redact configured secrets/connection strings.
- Global errors preserve intentional4xx statuses; unexpected5xx messages are generic. Common response helpers redact sensitive strings. A central error-response wrapper also protects legacy controllers returning their own `{error}` envelopes, without changing successful response shapes.
- The standalone admin seed no longer contains a fixed password or pre-hashes independently. Explicit execution requires protected `SEED_ADMIN_PASSWORD` input. Missing/invalid input fails before connecting; an existing `admin` record is not replaced. The standalone script was not run against any database. Its exported function was tested only with mocked methods. No environment file was edited.

## Payment and receipt corrections

### One collection, one balance update

The linked DebtPayment pre-save hook was removed because the controller already updates the transaction inside its session. It was the second owner of the same financial effect and contained an invalid callback-style error path. The controller remains the only current application writer of that effect; source search found its two DebtPayment.create call sites and no other active payment writer. The payment model keeps its existing stored fields/indexes.

Regression evidence: a100 payment against1000 changes paid to100/balance900 with one sale write and one payment insert. A1000 settlement succeeds with paid1000/balance0. The real Transaction validation and invoice-status post-save hooks run in these tests; collection methods and sessions are mocked.

`markAsPaid` now constructs an explicit payment request using the sale's customer ID and an empty route-parameter object. It no longer passes the order route ID as the customer ID or mutates the incoming request body. Method/reference are preserved. Sequentially paying an already paid order returns the existing result with no second payment write.

General customer collections retain the existing oldest-first behavior and method/reference/overpayment checks. A1200 collection against balances1000 and500 produces balances0 and300, with one payment record. No new debt, credit, cancellation, refund, tax, due-date or settlement policy was introduced. Payment amount rounding behavior remains as before; broader integer/amount validation belongs to the approved workflow/integrity design.

### Invoice and receipt compatibility

List/detail/ensure invoice responses now share additive receipt fields through invoiceDto: stable string orderId, items with name/quantity/recorded unitPrice/subtotal/total, invoice total, recorded payment/balance/method/reference and cashier when available. Existing populated transaction data remains available. Receipt money comes from stored sale amounts, never today's product selling price. Detail customer email/address compatibility was retained.

The real receipt component now consumes that DTO, formats centavos as PHP, includes unit prices/payment/balance/cashier/status and uses provisional UPHSD Bookstore text. The operator's personal phone/address no longer masquerades as official bookstore details. No official logo, institutional contact, tax or statutory receipt wording was invented. Missing legacy transaction/price/name information is handled without a render crash or invented price.

The invoice page uses compatible status filters and amount formatting, passes filters to its API, checks receipt data before printing and reports fetch/print-preparation failures. Its declaration-order lint error was corrected. Physical printing and browser interactions have not been verified. The Orders page's invoice action still ensures a record and displays a toast; broader POS-to-preview UX is not claimed complete.

**Historical limitation:** product names still come from populated current Product records because the existing sale schema has no name snapshot. Reprints can reflect a renamed product. Invoice statuses and recorded payment summaries can change with later collections. This phase establishes field/amount compatibility, not immutable archival receipts. Snapshot/numbering migrations require separate design/approval.

## Changed files and reasons

Paths are relative to the repository. New files are marked new. Every path is within Phase10A or its reporting/testing support.

| File | Reason |
| --- | --- |
| backend/routes/UserRoute.js | Guard account provisioning with current-account/admin authorization |
| backend/controllers/UserController.js | Validate provisioning/reset inputs, remove creation token, use canonical identity and model password methods |
| backend/models/User.js | Single hash-on-change hook and password comparison method; no persisted schema change |
| backend/middleware/authMiddleware.js | Validate token and current account/role/confirmation |
| backend/utils/passwords.js — new | Shared new-password validation/hashing for model/provisioning |
| backend/utils/seedAdmin.js | Remove fixed privileged credential and double-hash risk; explicit protected input; import-safe testable function |
| backend/index.js | Retain startup but remove URI logging and unsafe console/log-stream plumbing |
| backend/app.js — new | Extract existing middleware/routes into import-safe app factory; safe diagnostics/error wrapper |
| backend/config/config.js | Constant connection success/failure output without URI/host/raw error |
| backend/middleware/logger.js | Exclude query/body/credential-bearing raw errors from request logs |
| backend/middleware/errorMiddleware.js | Correct error status handling and generic/redacted responses/logging |
| backend/utils/safeErrors.js — new | Configured-secret/URI redaction and legacy error-response protection |
| backend/utils/responseHelpers.js | Apply safe error messages across existing controller envelopes |
| backend/models/DebtPayment.js | Remove duplicate financial mutation/error callback hook; retain data/index definitions |
| backend/controllers/DebtPaymentController.js | Remove redundant transaction console message; collection algorithm otherwise preserved |
| backend/controllers/OrderController.js | Correct order-to-customer settlement delegation; redact order error logs |
| backend/controllers/InvoiceController.js | Consistent populated receipt data and additive DTO on list/detail/ensure |
| backend/utils/invoiceDto.js — new | Shared response contract using recorded sale prices/totals |
| client/src/features/invoices/components/Invoice.jsx | Match DTO, centavo amounts, provisional bookstore header and safe legacy handling |
| client/src/features/invoices/pages/InvoicePage.jsx | Compatible filters/totals/print-data handling and load error recovery |
| backend/tests/helpers.js — new | Native HTTP/controller harness, query adapters and no-DB assertions |
| backend/tests/security.test.js — new | Provisioning/auth/hash/login/seed/error/logging regressions |
| backend/tests/payments.test.js — new | Linked/full/general/HTTP/replay/failure-session payment regressions |
| backend/tests/invoices.test.js — new | Consistent list/detail/ensure DTO with recorded prices |
| client/tests/invoice.test.js — new | Compile actual JSX with installed Vite transformer and render actual API DTO |
| backend/package.json | Add native Node test command; dependency versions unchanged |
| client/package.json | Add native Node test command; dependency versions unchanged |
| docs/UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md | Append dated Phase10A execution status; original audit retained |
| This results document — new | Findings, verification evidence, compatibility/data risks and next-phase decisions |

No dependency installation, new package, lockfile correction, migration, collection/index/field rename, data merge, historical rewrite, source deletion, production configuration edit or deployment occurred. The log viewer was replaced as authorized containment; ordinary business modules and route paths were retained. Receipt/diagnostic text is provisional; full application rebranding has not started.

## Actual verification

| Check | Result | Boundary |
| --- | --- | --- |
| Backend `npm test` | PASS25 tests,0 failures,0 skipped | Native Node runner; actual Express routes/controllers and Mongoose hooks; synthetic credentials/documents and mocked persistence/session methods |
| Client `npm test` | PASS2 tests,0 failures,0 skipped | Actual receipt JSX compiled with installed Vite transformWithOxc; React server rendering against actual DTO; no browser/physical printer |
| Client production build to tool temp output | PASS exit0; Vite8.0.3,670 modules; JS752.35kB/gzip227.54; CSS44.12kB/gzip8.95 | No deployment; existing >500kB bundle warning remains |
| Backend syntax | PASS46 JS files,0 errors | Includes new source/tests; syntax only |
| Existing client ESLint API check | FAIL overall:17 errors/13 warnings | Baseline18/13; one invoice error removed; no new diagnostics from receipt component/test files; remaining unrelated failures preserved |
| Diff review/whitespace | Reviewed source diff; git diff --check passes | Existing CRLF-conversion notices are Git notices, not code failures |
| Baseline hash comparison before report | All118 unchanged baseline files match;18 authorized existing source/manifests changed;9 new source/test files;0 removed | Existing28 audit documents and both package-root lockfiles matched. backend/node_modules was excluded from hash inventory; its pre-existing lock diff remains untouched by task actions |
| Final preservation/documentation check | PASS:19 existing files changed within scope,10 new files,0 removed; environment files and package-root lockfiles hash-match baseline; only original document changed is the plan appendix;9 documentation links valid,0 configured-secret matches | Dependency directory excluded from hash inventory; no live-data assertion follows from file checks |

Tests assert registration401/403 before writes; legitimate admin hash creation; stale admin role denial; deleted/unconfirmed account denial; default role/status and invalid field rejection; hash-once/retry/login/change/reset compatibility; invalid login/token handling; protected seed behavior; constant/redacted errors/logs and diagnostic404/503; linked partial/full/general payment math; one sequential order settlement effect; overpayment/reference rejection; abort-on-insert-failure; real protected payment HTTP path; invoice response contract and rendered amounts/legacy fallback.

The fake-session abort test proves that the application calls abort and avoids reporting success. It **does not prove real MongoDB rollback**. Concurrent sessions/write-conflict retry, ambiguous commit and durable replay are not simulated as successful production guarantees.

Not run: live database queries/index inspection, production or configured API startup, real credential login, clean install, advisory refresh, database migrations/backup/restore, browser E2E, physical printing, real replica-set transactions/rollback/concurrent cashiers, load tests or deployment. No existing backend business suite was present; the new suite is the first first-party automated suite. The configured database remained disconnected in tests.

## Remaining vulnerabilities and data-integrity risks

1. Previously exposed secrets remain in tracked environment files/Git history and may remain active elsewhere. This local source change cannot revoke them or repair an already deployed old service. Rotation, history handling, session invalidation and review of potentially unauthorized admin accounts require controlled authorization. No actual compromise is asserted.
2. Legacy plaintext/uncertain password records are unchanged and cannot authenticate through bcrypt login. Management must approve a controlled account review/reset; do not bulk guess/re-hash records. Previously issued valid tokens for a still-confirmed current account can remain valid until expiry unless the secret/account state changes; full logout/reset revocation is unresolved.
3. Historical doubled/missing/ambiguous payment records were not inspected or repaired. Applying this code does not correct existing balances. Reconcile against trustworthy external evidence on a protected restored copy before any approved repair.
4. There is no durable request idempotency key for partial/general collections or order creation. The removed duplicate hook is fixed; resubmitting a separate partial-payment request can still collect twice. Sequential completed-order replay is tested, not all concurrent/restart cases. Do not claim universal duplicate prevention.
5. Invoice/counter schema indexes remain nonunique; actual DB indexes are unknown. GET ensure remains mutating; independent invoice/sale void behavior and refund/stock reversal semantics remain unresolved. No unapproved unique-index build or numbering migration occurred.
6. Amount rounding/clamping/paid-status inference in existing checkout, currency ambiguity in legacy expenses/components, stock metadata overwrite/read-save adjustments, missing movement/audit ledgers and real transaction concurrency/retry remain audit findings for later authorized work.
7. Current roles remain admin/user and data remains owner-scoped. Current-account checks do not implement the proposed manager/cashier/inventory role matrix or shared catalog. No catalog/order merge occurred. Existing last-admin safeguards, rate limits, comprehensive session revocation and finer sensitive-action permissions remain incomplete.
8. Receipt names are not immutable historical snapshots. Official receipt content/compliance, approved printer/paper, date/time convention and full POS preview/reprint workflow remain unverified or unresolved. No cash tender/change fields were invented.
9. Deployment/startup recovery/backup/advisory controls, client profile setter and other unrelated lint/UI defects remain. Existing CORS names, fixed port and start-before-DB behavior were preserved to avoid unrelated production configuration changes.

## Decisions and next steps, in priority order

No new business-policy decision was needed to remove the duplicate hook, correct customer identity or align receipt fields. Policy-dependent extensions were left unimplemented.

1. **Authorize controlled exposure/account containment:** decide who may rotate database/JWT credentials, inspect privileged accounts, reset insecure legacy passwords and coordinate token invalidation without losing legitimate access. No production change is authorized merely by this report.
2. **Authorize an isolated transaction-capable test environment:** verify real rollback, duplicate/concurrent settlement and stock behavior with synthetic data; approve separate read-only profiling/backup access before any historical reconciliation or unique-index design. Dependency installation, if needed, still requires authorization.
3. **Confirm D02/D03 decisions before Phase10B/07:** existing-user/store mapping and roles/sensitive actions; accepted payment methods/verification; retain credit/partial behavior versus historical-only; cancellation/refund/void rules. Approve durable idempotency/numbering migration only with backup/rollback design.
4. **Confirm D01/D04/D05 before broader features:** kiosk operator/payment/pickup/states/reservations/price policy; catalog/categories/thresholds; report periods; official assets/receipt content/hosting/recovery targets. Full rebranding and kiosk/shared inventory remain separate phases.
5. **Authorize remaining UI/lint/receipt snapshot and integration work** after its dependencies are settled, then stage/review a release. Do not infer production readiness from this phase's green isolated regressions.

Phase10A stops here for user review. No broader implementation, data operation or release follows automatically.
