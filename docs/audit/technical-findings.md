# Technical findings

Evidence is from the current checkout on 2026-11-02. Static findings identify code behavior and risks; isolated reproductions use synthetic objects and mocked database/session adapters. No live data corruption or external compromise is asserted. Priority and severity are separate.

## F01 — CRITICAL / P0 — Public administrator creation and approval bypass

**Evidence:** `backend/routes/UserRoute.js:18` exposes registration without protect/authorization. `backend/controllers/UserController.js:24-43` accepts body role and confirmed, saves them, and returns a token. `authMiddleware.js:13-15` verifies the token without checking account confirmation. Even default unconfirmed registration receives access to ordinary protected endpoints. Login UI states that only admins create accounts (`client/src/features/auth/pages/LoginPage.jsx`).

**Impact:** Anyone reaching the API can obtain administrator access and manage accounts; no successful later password login is necessary. **Verification:** isolated controller test with mocked User persistence generated a real signed token and passed the actual protect/admin middleware. **Remedy:** protect provisioning as an admin operation, force server-controlled defaults, validate role changes and account confirmation, revoke affected sessions. **Acceptance:** unauthenticated and ordinary-user provisioning denied; body privilege fields cannot escalate; unconfirmed accounts cannot use protected endpoints.

## F02 — CRITICAL / P0 — Incomplete password lifecycle

**Evidence:** UserController:26 passes password unchanged while commenting that a pre-save hook hashes it. `backend/models/User.js:3-20` has no such hook or `matchPassword` method. Login:58 uses bcrypt comparison; updatePassword:147 calls the absent method; admin update:204-206 alone explicitly hashes.

**Impact:** Registration stores plaintext and normal registration-to-login is broken. Existing record formats are unknown. **Verification:** actual User validation and pre-save pipeline leave a synthetic password unchanged; `matchPassword` is undefined. **Remedy:** one password service hashes exactly once on every password-writing path, excludes hashes from reads, compares through bcrypt and never trusts client policy. Classify existing credentials without printing values and require controlled reset where needed; do not blindly hash all stored values. **Acceptance:** registration/admin reset/self-change work with hashes; failure and migration tests cover mixed legacy formats and token invalidation.

## F03 — CRITICAL / P0 — Tracked environment and publicly streamed connection URI

**Evidence:** `git ls-files backend/.env` confirms tracking. Environment names were inspected without printing values. `backend/index.js:211` logs `process.env.MONGO_URI`; lines 31-62 collect every console entry; lines 140-155 expose historic/live entries without auth. Routes precede CORS at line 164. The log page uses `innerHTML` at lines 124-127 and includes messages that can contain request/error data.

**Impact:** Configured database URI is publicly retrievable from process logs while retained; credential compromise is possible if it contains credentials. Repo history may retain environment secrets. HTML insertion adds an XSS risk if attacker-controlled messages reach it; no payload was executed. **Remedy:** disable public log viewer/stream, redact sensitive fields, remove secret files from future tracking through reviewed change, rotate affected database/JWT secrets and review access/history exposure. Do not copy secret values into tickets. **Acceptance:** anonymous log requests denied or removed, secrets absent from logs/artifacts and tracked files; old credentials invalidated through controlled operations. No rotation or history rewrite was performed during audit.

## F04 — HIGH / P1 — Identity mismatch and frontend profile persistence defect

**Evidence:** middleware sets `{id,role}` at authMiddleware:14. UserController:88,98,141 and216 read `req.user._id`. Self-delete protection therefore compares against undefined. `client/src/shared/utils/useProfile.js:63,87` passes updater functions to `AuthContext.jsx:13`. React's setUserState accepts that updater, but the wrapper also serializes the function directly into localStorage at line17.

**Impact:** Profile/password handlers cannot find the actual user; backend self-delete safeguard fails. If a frontend profile update succeeds after the API is repaired, React can update in-memory state, but JSON.stringify(updater) is undefined and localStorage receives invalid user JSON. **Verification:** real protect output sent to profile handler caused `findById(undefined)`; persistence mismatch is static JavaScript/React contract evidence, not a browser reproduction. **Remedy:** single identity shape; explicit self-delete/last-admin policy; resolve updater before serializing or persist state in a dedicated effect. **Acceptance:** get/edit/password/self-delete tests and reload/session persistence tests pass.

## F05 — CRITICAL / P0 — Debt payments applied twice; full settlement fails

**Evidence:** `DebtPaymentController.js:61-78` increases paid amount before creating payment. `models/DebtPayment.js:50-77` again updates the linked transaction. Hook catch calls `next(err)` even though Mongoose 9 pre hooks no longer receive a next callback.

**Impact:** A small linked collection can reduce debt twice; larger payments can roll back with an unrelated error. **Verification:** real controller plus real model pre-save pipeline with mocked adapters: total=1000, initial paid=0, payment=100 produced paid=200, balance=800; payment=1000 returned HTTP400 `next is not a function`. Database commit/rollback was not exercised. **Remedy:** apply payment once in a transaction service; payment model validates only; explicit allocation records; retry-safe key. **Acceptance:** 100 changes paid by exactly100, full1000 settles once, excess rejected, failure leaves all records unchanged on a replica set.

## F06 — HIGH / P1 — Order settlement uses the wrong customer ID

**Evidence:** OrderController:511-520 replaces body then delegates using the original request. DebtPaymentController:21 prefers `req.params.id` over body.customer. `/orders/:id/pay` supplies an order ID there.

**Impact:** Typical order settlement fails with Customer not found before payment application. **Verification:** isolated actual delegation observed Customer lookup by transaction ID, HTTP400. **Remedy:** controller-independent payment service with explicit named arguments; never repurpose HTTP requests between controllers. **Acceptance:** order-pay and customer-payment routes settle the same transaction consistently, including differing customer/order IDs and owner-denial tests.

## F07 — HIGH / P1 — Invoice identity and lifecycle are inconsistent

**Evidence:** Invoice schema:51-52 and InvoiceCounter:21 indexes omit unique. InvoiceController:28-52 uses check-then-create; 130-145 GET ensure writes without a session and does not require completed/nonvoid status; 152-161 changes invoice status independently of transaction/stock/payment.

**Impact:** Concurrent first issue/ensure can create duplicates or inconsistent counters; invoices may exist for pending/void sales or disagree with sales reports. Actual installed indexes are unknown. **Remedy:** reviewed duplicate analysis, unique owner-number/owner-transaction/owner-type-year indexes, transaction-safe upsert, read-only GET and one reversal workflow. **Acceptance:** parallel issue returns one invoice/number, uniqueness enforced in DB, invalid states rejected, independent invoice void cannot conceal a live sale.

## F08 — HIGH / P1 — Inconsistent money units and insufficient numeric constraints

**Evidence:** active ProductPage:47,61 and PosPage:8-14 convert PHP to/from centavos; active ExpensePage sends raw amount and displays it directly; ExpenseController:15 and Expense schema:8 store unrestricted Number. Product schema:10-14 uses Number/min only. Backend `money` helpers round existing units, not multiply by100. Legacy ProductFormModal uses raw sellingPrice but is not imported by active ProductPage.

**Impact:** Cross-domain totals cannot safely be combined; decimal/truncation/unsafe-integer values may be accepted; future migration can multiply already-centavo records incorrectly. **Verification:** real Product validation accepted price1.25 and stock1.5. **Remedy:** canonical integer PHP centavos and bounded integer item counts; document legacy units per field/dataset, convert explicitly at boundaries and reject invalid values. **Acceptance:** PHP12.34 persists as1234 in sales and expenses, displays correctly; fractions in stored units and unsafe totals rejected; migration reconciles values without guessing units.

## F09 — HIGH / P1 — Inventory adjustments can overwrite concurrent stock changes

**Evidence:** ProductController:111-114 reads stock then sets/clamps and saves. updateProduct:76-79 writes full `productPayload`, including stock. That payload resets omitted sku, costPrice, isActive and stock at lines8-15; active ProductPage omits costPrice. setActiveProducts:131-135 is two independent writes.

**Impact:** Read10, sale reduces to9, adjustment+5 saves15 instead of14. Stale metadata edits can undo deductions or clear cost; overly negative adjustment silently clamps to0; activation failure can leave everything inactive. These are code-derived scenarios, not live observations. **Remedy:** conditional atomic increments with reasons and movement records, separate metadata updates from stock commands, preserve omitted fields, transactional active set. **Acceptance:** parallel sale/adjustment reconciles counts, negative stock rejected, metadata edit preserves stock/cost/sku, failure rolls back activation.

## F10 — HIGH / P1 — Completion and customer rules have bypasses

**Evidence:** OrderController:227-232 omits paymentStatus when resolving creation customer; credit can create Walk-in debt despite resolver's intended rule at58-59. Completion of an existing pending transaction at410-429 uses saved items without rerunning active-product checks and ignores simultaneous item edits. completionPayload:112-141 does not explicitly validate status enum before deriving amounts.

**Impact:** Pending items can sell after deactivation, customer-credit policy is inconsistent and completion may not reflect submitted edits. **Remedy:** explicit state machine, eligibility recheck at stock write, canonical payment/status validation and named-customer policy. Define snapshot versus repricing policy. **Acceptance:** inactive pending product, invalid status, anonymous credit and mixed edit/complete scenarios have deterministic server responses and no unintended stock/payment writes.

## F11 — HIGH / P1 — Creation and collection lack request idempotency

**Evidence:** createTransaction:209-310 creates a new transaction per POST; schema has no idempotency key. DebtPayment creation has no key either. Existing completion guard:163-170 protects repeated completion of one already-recorded sale, not repeated creation or payment requests. Client disabling buttons cannot prevent network retry duplication.

**Impact:** Retrying after a lost response can duplicate orders, deductions and collections. **Remedy:** scoped request keys with persisted payload hash/result and unique index; transactional commit/replay; retry transient transactions using supported APIs. **Acceptance:** same key+payload returns same committed identity; conflicting payload returns409; parallel attempts create one effect; ambiguous commit recovery tested.

## F12 — HIGH / P1 — Receipt and invoice UI contracts are broken

**Evidence:** `Invoice.jsx:24,36` requires `invoice.items` and total; Invoice schema has neither. List API populates transaction; ensure API returns invoice without populated transaction. InvoicePage:82 reads inv.total; :91 sends inv.orderId (virtual may be populated object, not an ID). Filters:54,59 pass arguments to a function that accepts none at23. OrdersPage:132-137 only ensures and reloads, never prints.

**Impact:** Receipt render throws on absent items; totals are blank; print/filter controls fail intent. **Remedy:** single receipt DTO from server with immutable product/store/money snapshots; consistent identifier use, actual printing and supported filter enums. **Acceptance:** real completed sale to issue/list/view/reprint works, totals match stored transaction, repeated prints cause no writes, pending/void policy enforced.

## F13 — HIGH / P1 — Tokens outlive current account privileges

**Evidence:** generateToken:7 sets7d; protect verifies claims only, without User lookup, confirmation/deletion checks, token version or revocation. Account changes do not invalidate JWT. apiClient:15-16 only logs401; AuthContext trusts stored user.

**Impact:** Deleted/unconfirmed/demoted users can keep privileges encoded in existing tokens. Browser storage tokens increase impact of XSS; that alone is not a demonstrated exploit. **Remedy:** server checks current account and session version/state, explicit logout/password-change invalidation, shorter policy-based lifetime; frontend clears stale auth and responds to401. **Acceptance:** existing tokens fail after deactivation, demotion, password reset and logout as defined; UI recovers from expiry.

## F14 — MEDIUM / P2 — Lint baseline fails

**Evidence:** executed `npm run lint`:18 errors,13 warnings across19 files; result detail in verification report. Includes Hooks effect rules, immutability declaration ordering, unused bindings, Fast Refresh export and memoization dependencies.

**Impact:** Cannot claim a clean quality gate; warnings expose stale function/dependency design. Lint messages do not by themselves prove every reported page crashes. **Remedy:** resolve actual hook/data lifecycle issues, remove unused symbols, keep checks enabled; do not blindly add unstable API functions to dependency arrays. **Acceptance:** lint exits0 and affected UI workflows remain stable.

## F15 — HIGH / P1 — Transaction and release behavior has no automated safety net

**Evidence:** package manifests have no test scripts; no application test files, CI workflows, migration runner, backup/restore evidence found outside dependencies. Build/syntax checks cannot exercise DB invariants.

**Impact:** Security, payment and concurrency defects can recur unnoticed. **Remedy:** meaningful unit, replica-set integration, API and browser suites plus build/lint gates and restoration rehearsal. **Acceptance:** critical scenarios in testing strategy run reproducibly; CI blocks regression; backup restored into isolated environment with reconciled totals.

## F16 — MEDIUM / P2 — Request limits and client pagination are incomplete

**Evidence:** ProductController:5/31-38 and order/customer/invoice/payment limit helpers lack finite validation/upper bound; search strings become regex. PosPage:44-45, ProductPage:26 and OrdersPage:45 fetch only200; PersonPage list50/detail20; InvoicePage defaults20 without paging UI. Customer aggregation computes all summaries before facet paging.

**Impact:** Large/unbounded requests and costly regex degrade service; users miss records beyond the first page; no measured latency claim. **Remedy:** strict bounded schemas, literal search, server filters/pagination and pagination UI; index/explain/load measurements. **Acceptance:** invalid limits rejected, over-cap values handled predictably, record201 can be found, representative queries meet recorded targets.

## F17 — HIGH / P1 — Revenue charts are not collection or accounting ledgers

**Evidence:** FinancialController:60-74 groups mutable transaction.amountPaid by transaction.createdAt. A later debt payment updates that amount. Expense/Financial models and costPrice are not used in summary. Product line items have no cost snapshot; date grouping omits timezone.

**Impact:** Later collection restates original sale period; collection date and completion date are not respected; dashboard cannot substantiate profit or financial statements. **Remedy:** define sales versus collection basis, immutable dated payment allocations/events, completion-date sales reports, approved business timezone, explicit expense/cost/refund definitions if in scope. **Acceptance:** sale on day1/collection on day2 appears in correct separate reports; expenses do not alter sales totals; no unsupported net-profit claim.

## F18 — HIGH / P1 — Error status and response contracts drift

**Evidence:** UserController sets res.status then throws Error at14-15,20-21,62-63,67-68; errorMiddleware:3 uses only err.statusCode or500. Other domains use `{success,message,data}` while Expense emits raw docs/`{error}` and User emits raw DTOs. Client adapters unwrap differently.

**Impact:** Expected401/403/409 become500 and client auth handling fails; raw internal error messages may reach clients. **Remedy:** typed domain errors with stable safe codes, map them once, consistent DTO envelope with temporary adapters. **Acceptance:** invalid login401, unconfirmed403, duplicate409, validation400/422 and unexpected500; safe error bodies and client recovery verified.

## F19 — MEDIUM / P2 — Repository and dependency hygiene gaps

**Evidence:** 2,525 tracked backend/node_modules entries; no root/backend ignore; client ignore does not protect backend. Declared pg/dayjs/direct mongodb/React Query have no application imports found. Two package lockfiles plus the tracked backend installed-tree lock were modified before the audit. Initial advisory requests failed; successful retry findings are F23.

**Impact:** Bloated diffs, inconsistent installs and accidental secret/dependency commits. **Remedy:** root ignore and reviewed untracking, deterministic clean installs, engine policy and advisory review; verify dependency usage before removal. **Acceptance:** clean checkout installs/builds, backend dependencies no longer tracked in future commits, secrets excluded, advisory report reviewed. No package removal or untracking during this audit.

## F20 — HIGH / P1 — Seed utility contains a fixed privileged password

**Evidence:** `backend/utils/seedAdmin.js:21-34` creates a confirmed admin using a source-defined fixed password. The value is intentionally not reproduced here. Script is not invoked by startup; execution and account existence are unknown.

**Impact:** Running it can create a predictable privileged credential. **Remedy:** controlled one-time provisioning from protected input, generated password or reset flow; disable repeat seeding and record audit event. **Acceptance:** no fixed password in utility; existing account is not silently changed; privilege provisioning requires an operator-controlled secret; no source credential appears in logs.

## F21 — LOW / P2 — Startup, readiness and bundle operations need hardening

**Evidence:** index.js:212-214 fixed5000/listen-before-connect; no shutdown handler. useServerReady:12-21 retries every2s indefinitely; App:89-92 gates even login. Built JS751.22kB, gzip227.24kB; all main pages eagerly imported.

**Impact:** Port-based hosting may fail, shutdown can interrupt work and outages leave a permanent loading screen; initial download is large. **Remedy:** validate config, honor PORT, await DB readiness, drain on termination, separate liveness and readiness, actionable retry UI and lazy page loading after core repairs. **Acceptance:** port/config/outage/shutdown tests pass, SPA remains recoverable, bundle warning evaluated with actual device/network budget.

## F22 — HIGH / P1 — Business ownership and sensitive-operation policy are unresolved

**Evidence:** ownerIdFrom in core controllers always resolves to current user; ProductRoute allows admin and user identically; other business routers mostly use protect only. Expense edit/delete has creator-or-global-admin logic. No Store, membership, cashier session or capability layer exists. processedBy records user but not a shared location.

**Impact:** Individual accounts do not share inventory/queue. If cashiers are intended, server policies do not separate price/stock/void/report powers. This is a conditional scope mismatch, not proof of forbidden access under a policy that was never specified. **Remedy:** decide R01 and capability policy first; enforce explicit owner/store scope and sensitive capabilities consistently. **Acceptance:** approved role/ownership matrix has executable allow/deny and cross-owner tests; shared store added only if confirmed.

## F23 — HIGH / P1 — Advisory-flagged dependency trees

**Evidence:** read-only npm audit retries succeeded after network failures. Backend reports8 affected entries:1critical/3high/4moderate; client22:12high/9moderate/1low. Exact locked versions, representative advisory URLs and runtime/development scopes are in [dependency audit](dependency-audit.md). Backend critical entry is proxy-addr2.0.7; other entries include body-parser, mongoose and path-to-regexp. Client direct entries include axios, react-router/react-router-dom, Vite and lint tooling.

**Impact:** Known package risks require review, but scanner severity is not demonstrated app exploitability. IP trust is not an inspected app authorization boundary; browser Axios and client Router may not use server-adapter/framework trigger paths. **Remedy:** review advisory reachability and compatible patched dependency tree; preserve user lockfile changes; run clean-install/regression checks; avoid blind forced fixes or suggested major nodemon downgrade. **Acceptance:** every observed finding is fixed or has documented accepted reachability/mitigation evidence; follow-up scan and runtime/build tests reviewed. No package upgrade or exploit attempt occurred.

## Sources for platform-specific recommendations

Mongoose9 removed callback-style pre middleware: [migration guide](https://mongoosejs.com/docs/migrating_to_9.html). Multi-document invariants require an appropriate transaction boundary: [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/). Security baseline: [Express production security](https://expressjs.com/en/advanced/best-practice-security/) and [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Sources accessed2026-11-02; local source remains evidence for application defects.
