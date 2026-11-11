# POS project audit

Date: 2026-11-02, Asia/Manila. Repository: `C:/Users/jmley/Desktop/LadyPos`, commit `2e9942e` plus pre-existing lockfile modifications. Independent project: **LadyPos / ServeFlow POS**, with no GradeSense AI dependency or imported architecture identified.

## 1. Executive summary

The application is **partially implemented**. It contains substantial POS, inventory, customer credit, invoice, expense and dashboard code. Its frontend builds, but critical access-control and financial-integrity defects prevent a production-readiness claim. Local isolated checks reproduced administrator privilege injection, plaintext password handling, broken profile identity lookup, double payment application and incorrect settlement customer lookup. No end-to-end workflow has been certified functional.

This audit creates plans and reports only. It does not repair these defects, change the schema, move source files, install dependencies or deploy.

## 2. Purpose and scope

Package names and UI identify ServeFlow POS. Code supports an authenticated product catalog, pending-to-completed order workflow, stock deduction, customers, debt collection, invoices, expenses and collected-amount dashboards. Login UI explicitly says accounts are created by admins (`client/src/features/auth/pages/LoginPage.jsx:111`); the API contradicts that policy.

No business proposal or POS requirements specification was present. `client/README.md` is a Vite template. Bookstore use, ISBN, kiosk access, multi-cashier shared stores, statutory receipts, refunds, discounts, suppliers, receiving and full accounting are not confirmed requirements. Delivery channel labels are data values, not service integrations. See [requirements inventory](requirements-inventory.md).

## 3. Confirmed technology stack

| Layer | Observed technology |
| --- | --- |
| Frontend | JavaScript ESM, React 19.2.4, React DOM, React Router 7.13.2 |
| Build/styling | Vite 8.0.3 observed at build; manifest `^8.0.1`; React Vite plugin; Tailwind CSS 4.2.2; custom CSS variables |
| Client data/UI | Axios 1.13.6; React state/context; Recharts 3.8.1; react-hot-toast |
| Backend | Node.js ESM; Express 5.2.1; nodemon development script |
| Persistence | MongoDB via Mongoose 9.3.3; embedded line items; no migration tool |
| Identity | jsonwebtoken 9.0.3, seven-day bearer JWT; bcryptjs 3.0.3 used inconsistently |
| Configuration | dotenv; backend `MONGO_URI`, `MONGO_PASS`, `JWT_SECRET`; client `VITE_API_URL` |
| Tooling | npm and separate lockfiles; ESLint 9 with React Hooks and refresh rules; no project test runner |
| Deployment evidence | Netlify origin in CORS; `_redirects` and Apache `.htaccess` in public assets; actual hosting state unverified |

PostgreSQL is not the database implementation: `pg` is declared but no application import was found. `mongodb`, `dayjs` and client React Query also have no direct application usage found. MongoDB is still indirectly required by Mongoose. No package is labeled vulnerable merely from its version.

## 4. Current architecture

Two npm applications: `client/` and `backend/`. `client/index.html` loads `src/main.jsx`, then auth context and `src/app/App.jsx`. Browser routes share a layout and authentication guard. Feature pages call hook-based Axios adapters. State uses React hooks, not the declared React Query package.

`backend/index.js` constructs Express, console-log streaming, CORS, health and eleven route mounts, then listens on fixed port 5000 and initiates MongoDB connection. Controllers own HTTP concerns and most business rules. Mongoose validation and save hooks also mutate totals, debt payments and invoice statuses. This split ownership causes a demonstrated payment defect. Business data is generally scoped to the authenticated user's ID through `owner` or `userId`, not a shared store identifier.

## 5. Feature assessment

Full detail: [feature inventory](feature-inventory.md).

- Products, customers, pending orders, checkout, expenses and reports have UI and database code; database-backed operation remains unverified.
- Registration API is insecure and stores plaintext; the standalone registration page has no submit handler. Login compares bcrypt hashes and therefore cannot authenticate ordinary plaintext registrations as intended.
- Profile/password operations are broken by `id`/`_id` mismatch and missing `matchPassword`; frontend profile updates also pass a functional setter to a wrapper that does not support it.
- Linked debt payments are broken: controller and model apply the same money twice, with full settlement failing. Settlement from an order additionally queries the customer using the order ID.
- Receipt rendering is broken by API/component shape mismatch. The order-page print action only ensures an invoice and displays a toast.
- Stock deduction has a conditional `$gte` guard and transactions; concurrent success, rollback and retry behavior are not verified. Manual stock edits are unsafe under concurrency.
- No kiosk-specific UI or device authentication, refunds, discounts, stock movement ledger, full accounting, or automated business tests were identified.

## 6. Major technical findings

| ID | Severity | Verified basis |
| --- | --- | --- |
| F01 | CRITICAL | Public registration accepts role/confirmation and issues an immediately usable admin JWT |
| F02 | CRITICAL | Registration passes raw passwords; User model has no hash hook or password comparison method |
| F03 | CRITICAL | Tracked backend environment file; startup logs database URI to a public SSE stream |
| F04 | HIGH | Auth middleware emits `id`; user profile/password handlers and self-delete guard read `_id` |
| F05 | CRITICAL | Linked debt payment updates in both controller and save hook; isolated reproduction doubles a small payment |
| F06 | HIGH | Order settlement passes transaction route ID into a customer-ID resolver |
| F07 | HIGH | Invoice/counter indexes are nonunique; GET ensure mutates and invoice void can diverge from sale |
| F08 | HIGH | Currency contract differs across active expenses and centavo-based POS; integer schema rules absent |
| F09-F12 | HIGH | Stock overwrite/race exposure, completion/customer-policy bypasses, missing create idempotency and receipt mismatch |
| F13-F22 | HIGH to LOW | Stale authorization, failed lint, missing test/release controls, request limits, reporting semantics, legacy code, startup and seed risks |
| F23 | HIGH | npm flagged eight backend dependency entries (one critical) and22 client entries; application reachability needs assessment |

See [technical findings](technical-findings.md) for exact source lines, impacts and actions. Concurrency risks are code-supported risks, not observed database corruption.

## 7. Security assessment

Critical exposure is rooted in the registration route, incomplete password handling and credential-bearing logs. JWT checks do not load account existence, confirmation or current role. Most business routes grant every authenticated account its own full operator privileges. This is not a confirmed cashier/manager permission model. There is no application rate limiter, security header middleware, durable security audit log, or logout revocation. No upload surface was found. No external exploit or credential validation was attempted. Details: [security audit](security-audit.md).

## 8. Database assessment

Nine models: User, Product, Customer (in `Person.js`), Transaction (in `Order.js`), Invoice, InvoiceCounter, DebtPayment, Expense and Financial. ObjectId references are application relationships, not database-enforced foreign keys. User identifier and sparse phone indexes declare uniqueness; invoice identity, transaction-to-invoice mapping and counter identity do not. Index installation and actual records were not inspected.

Checkout and void use MongoDB sessions and multi-document transactions. Manual stock update and invoice ensure do not. Payment allocation across several transactions records no per-transaction breakdown. Currency units, historical cost, payment reversals and migrations require design work. See [database design](../architecture/database-design.md).

## 9. API assessment

REST under `/api`: users, products, people/customers aliases, orders/transactions aliases, invoices, debt-payments, expenses, dashboard/financials aliases. Response envelopes differ between user/expense and transaction domains. Most query validation is ad hoc. Three legacy debt mutations intentionally return 410. GET invoice ensure performs writes. Error middleware discards response status set by user handlers and usually responds 500. Full existing route inventory and proposed contracts: [API design](../architecture/api-design.md).

## 10. Build and test status

Executed on Node v24.14.0/npm 11.9.0 using existing dependencies:

| Check | Actual result |
| --- | --- |
| Client production build to temporary output directory | PASS, Vite 8.0.3; JS bundle 751.22 kB, gzip 227.24 kB; chunk warning |
| Client ESLint | FAIL: 18 errors, 13 warnings |
| Syntax checks for 38 backend JS files | PASS, zero syntax failures |
| Import all11 backend router modules | PASS; no backend listener or DB connection started |
| Eight isolated defect/constraint checks | Assertions passed, confirming defects or absent constraints; no DB connection |
| npm advisory scans in both apps | Initial network failures; retries returned backend8 entries (1critical/3high/4moderate), client22 (12high/9moderate/1low); no automatic fixes |
| API/database/browser E2E/concurrency/restore tests | NOT RUN |

Passing compilation or a defect reproduction is not passing business acceptance. [Verification results](verification-results.md) records the limits.

## 11. Architectural strengths

Existing feature folders, separate client/server manifests, centralized bearer verification, model-level minima/enums, backend-derived cart prices, duplicate-line quantity merging, conditional stock deductions, session propagation in checkout, soft product/customer deletion and transaction-based debt summaries are useful foundations. Retain them while correcting their integration.

## 12. Architectural weaknesses

Identity conflates operator and data owner; business rules span controllers/model hooks; idempotency and uniqueness are incomplete; legacy aliases and components drift from current contracts; financial dashboards lack accounting definitions; reproducible tests, migrations, backup verification and deployment runbooks are absent. Backend dependency binaries/sources are tracked (2,525 entries under `backend/node_modules`).

## 13. Recommended folder structure

Retain `client/` and `backend/`. Retain the feature-based client and existing backend routes/controllers/models. Add real backend services, request validators, and tests only when implemented. Add database migration/index scripts with reviewed operations, package-local safe environment templates, root ignore/README and CI in a future implementation phase. The only directories created now are populated `docs/audit`, `docs/architecture`, `docs/implementation`, `docs/recommendations`. See [folder architecture](../architecture/folder-architecture.md).

## 14. Implementation roadmap

1. Establish baseline and settle scope/ownership/currency decisions.
2. Contain critical registration, password and credential/log exposure.
3. Establish canonical auth identity, current-account enforcement, authorization and shared service contracts.
4. Repair payments, settlement, inventory, invoices, state transitions and duplicate handling.
5. Complete supported customer/order/report/receipt UI and remove visible contract drift.
6. Prove database rollback, concurrency, access, browser and reporting behavior; pass lint/build.
7. Rehearse configuration, backup/restore and rollback in staging before a reviewed release.

Full gates: [roadmap](../implementation/implementation-roadmap.md).

## 15. Prioritized actions

P0: F01-F03 and F05. P1: F04, F06-F13, F15, F17-F18, F20, F22-F23. P2: F14, F16, F19, F21. Optional P3 work is explicitly conditional on business scope. See [backlog](../recommendations/prioritized-improvements.md).

## 16. Known limitations and unresolved decisions

No primary business specification, live database inspection, deployed-service review, credential validation, advisory exploit-reachability verification, E2E run, load test or restore rehearsal. Browser visuals and printer hardware were not inspected. Shared-store cashiers versus independent owner accounts, kiosk need, walk-in/credit rules, currency migration, tax/discount/refund rules, reporting basis and recovery targets remain unresolved. Record decisions rather than treating candidates as requirements.

## 17. Overall readiness and change record

**Partially implemented; production release blocked by critical security and financial-integrity defects.** It is suitable for targeted remediation followed by controlled testing, not an assertion that testing or stabilization is complete.

Only documentation under `docs/` was added. Existing application source, configuration, data, lockfiles and template README were left unchanged. The first implementation phase is baseline/scope decisions plus immediate P0 containment, with regression checks, before adding features.

Delivery validation:21 Markdown files,23 documented findings, zero broken relative links or unclosed code fences. Final Git status contains only the three original modified lockfile paths and new docs/. No tracked application source modification/deletion occurred.
