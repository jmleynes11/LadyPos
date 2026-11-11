# Phase14 — UPHSD Bookstore UI and branding audit

Date: 2026-11-03, Asia/Manila. Read-only local source audit; no UI implementation or native database verification.

## Executive summary

Retain the existing React/Vite application, feature folders, authentication and useful catalog/cart/order/invoice components. The current implementation is an authenticated, user-owned POS with customer/debt/expense features. It is **not yet a shared university bookstore catalog, public kiosk or centralized cashier queue**. Changing labels alone cannot supply those workflows or safe staff permissions.

Branding is mixed: Invoice.jsx already prints UPHSD Bookstore, while the browser title, login, navigation and loading assets still identify ServeFlow. No approved institutional logo or color guideline was found. Recommend provisional **UPHSD Bookstore** text branding, system name **UPHSD Bookstore POS**, and the exact formal title **UPHSD BookstorePOS: Point-of-Sale and Inventory Management System for the University Bookstore.** Use the formal title in project/about documentation, not every compact navigation label. No official logo should be invented.

Highest priorities before workflow implementation: confirm kiosk/payment/stock-reservation rules, shared ownership design and role permissions; preserve security/data history; correct misleading interface promises and accessibility gaps within an approved scope. Existing credit, expense and legacy delivery data must remain until their future treatment is approved. No GradeSense AI integration was found in the inspected application; independence remains a requirement.

## 1. Scope, files and verification limits

Inspected client/main/index entry configuration; App router; Layout/LoadingScreen; AuthContext/DashboardGuard; login/register/account components; product page/services/legacy components; POS/orders/payment sheet/services; customers/debt views; dashboard/expense/chart modules; invoice page/component/API; theme/CSS/print rules; public asset references and package metadata. Traced relevant User/Product/Order/DebtPayment/Invoice/Financial controllers, models and routes against existing audit/security/test evidence.

Frontend inventory: `client/src/main.jsx`, `app/App.jsx`, `index.css`, `styles/App.css`, `services/ThemeToggle.jsx`, `shared/{components,hooks,utils}`, `features/{auth,products,orders,people,invoices,financials}`, `public`, `index.html`, package/Vite/ESLint files and four client test files. Backend evidence paths below are relative to backend; UI paths below are relative to client unless otherwise specified.

Fresh safe local checks: **client npm test16 passed;0 failed/cancelled/skipped/TODO**, and client-wide installed ESLint **16 errors/13 warnings**, exit1. Tests use synthetic storage, SSR rendering and Axios transport adapters, not live services. Prior independent review records backend129 passes and build/syntax/targeted-lint passes; those were **not rerun** or represented as new Phase14 verification.

No browser session, running application/server, external fonts, database, deployment or real account was opened. Thus visual appearance, touch interaction, browser focus, contrast, responsive correctness and physical printing are **unverified at runtime**. This audit supplies source evidence, not screenshots or an end-to-end acceptance claim. No code/tests/assets/configuration/environment/lockfile changes or installations occurred. A08B remains unstarted.

## 2. Existing frontend architecture

React createRoot/StrictMode wraps AuthProvider in `src/main.jsx`. `App.jsx` builds a React Router browser router, blocks rendering on useServerReady, then mounts RouterProvider and react-hot-toast Toaster. Existing installed-stack evidence from the previous local review: React19.2.4, React Router7, Vite8.0.3, Tailwind4, Axios1.13.6 and Recharts. package.json declares compatible ranges, not proof of production versions. TanStack Query is declared, but these inspected pages mainly use hooks/effects/direct Axios; do not describe them as an established query-cache architecture.

| Routes | Mounted implementation | Actual purpose/limits |
| --- | --- | --- |
| `/`, `/login` | Redirect to LoginPage | Actual login handler calls AuthContext; defaults successful login to `/pos` |
| `/register` | RegisterPage | Public form markup with no submit/API handler; misleading account-creation promise. Backend registration is administrator-only |
| `/profile` | ProfilePage | Profile/security cards; AdminUserTable conditionally rendered for cached role admin |
| `/products` | ProductPage | Inline create/edit form, search/list, stock field, active toggle/deactivation |
| `/pos` | PosPage | Authenticated catalog/cart with selected customer and payment fields; submits **pending** orders |
| `/orders`, `/transactions` | Same OrdersPage | Pending/completed/debt tabs; transactions alias starts completed tab |
| `/customers`, `/customers/:id` | Same PersonPage | Customer/debt/payment workflow; routed detail path alone does not prove a distinct customer page |
| `/dashboard`, `/finances` | Same FinancialPage | Collected-amount KPIs and daily/weekly/monthly grouping chart |
| `/invoices` | InvoicePage + Invoice | Invoice listing/ensure DTO and browser-print flow |
| `/expenses` | ExpensePage | Create/list/edit/delete expense integration |

All routes under DashboardGuard use the same Layout. The guard checks cached authentication state, not per-role navigation permissions. Layout's NAV_TABS are offered without role filtering. Mobile bottom tabs show four destinations, with the drawer exposing the wider menu. There is no mounted kiosk, inventory movement, report export, supplier, category-management or application-brand settings page. Root is a login redirect, not a customer storefront.

### Reusable code versus disconnected components

Reuse Layout, theme tokens, API hooks/envelope normalization, toast handling, receipt DTO/component, cart interaction and supported forms. The import search found ProductCard, ProductFormModal, ActiveProductsModal, AddOrderModal, UpdateOrderModal and FinanceChart definitions without current mounted-page imports. Treat them as **unmounted candidates**, not verified product functionality. For example, ProductCard directly formats sellingPrice unlike the mounted centavos-aware ProductPage; do not report that legacy display as a live-page defect or reconnect it without checking units/API contracts. `styles/App.css` was not found imported; current entry imports index.css. Preserve unused code until removal/reuse is approved.

## 3. Branding inventory and proposed treatment

| Location | Confirmed current evidence | Recommended approved-phase change |
| --- | --- | --- |
| `index.html:5,11` | serveflow.svg favicon; title ServeFlowPOS; viewport/lang present; external Google Poppins stylesheet | System browser title; provisional text/initial icon or supplied approved asset; approve production typography/offline dependency separately |
| `public/serveflow.svg`, `serveflow.png` | Referenced by login/register/Layout and loading respectively | Replace rendered references using approved asset or text. Asset existence does not prove ownership/official authorization |
| `public/favicon.svg`, `icons.svg`, `react.svg`, `vite.svg`, `hero.png` | Assets present; favicon.svg is not the favicon currently linked by index.html; several are not referenced by mounted source | Inventory/review assets before reuse. Do not claim stock assets are university marks or delete them during branding work |
| LoginPage | ServeFlow logo alt text/header, Login to ServeFlow, ready-to-serve copy | UPHSD Bookstore staff sign-in copy and accessible text treatment; preserve authentication |
| RegisterPage | ServeFlow identity and Create your account form | Propose an administrator-provisioning explanation/controlled destination after approval; never expose public admin registration |
| Layout | serveflow.svg and alt ServeFlow in shared navigation | Provisional bookstore text lockup; keep responsive navigation behavior |
| LoadingScreen | serveflow.png; kettle/matcha/brewing/plating/garnish messages; animated pseudo-progress | Accurate bookstore/loading copy; no implied measured progress or fabricated readiness time |
| Invoice.jsx | Already **UPHSD Bookstore**; item prices/payments/cashier and thank-you text | Retain current brand and data compatibility; add only management-approved institution/receipt details |
| OrdersPage type filter; Order model | Grab/Foodpanda options/legacy customer types | Decide exposure for new bookstore orders. Preserve historical enum values/data until migration/compatibility treatment approved |
| index.css | ServeFlow theme comment; teal/amber light tokens and separate dark palette | Neutral provisional palette using existing tokens; never label colors official without supplied guidelines |
| package names | serveflow-pos-client/backend | Internal technical names; no rename necessary for branding; lockfiles remain untouched |
| backend/app.js | UPHSD Bookstore POS diagnostic identity already; ServeFlow Netlify CORS origin remains | Keep existing diagnostic brand. CORS/hosting settings require separately confirmed deployment targets; not a cosmetic rename |
| docs/README.md and historic docs | LadyPos/ServeFlow identity and original checkout paths | Preserve historical audit records. Future current-facing overview can state new identity with provenance; do not rewrite past findings |

The search found ServeFlow in active source and LadyPos primarily in repository/documentation history; no active LadyPos UI string was found. No email-sending/template module or notification email workflow was found. Customer email fields are not mail functionality. Toast/error/empty states are mostly generic, but Sale submitted/Order completed/Invoice ready wording needs workflow review. No branded application footer was found; Layout footer provides logout/theme. Public SVG files may contain embedded vector artwork rather than searchable brand strings; raster/vector visual provenance was not established by text search.

Official assets still required: approved university/bookstore logo files and usage permission, institutional color/typographic guidance, and approved receipt identity details. No institutional contact, address, tax registration or legally compliant receipt status is inferred.

## 4. Bookstore workflow mapping

Classification uses the requested vocabulary. A narrow verified test does not verify an entire workflow.

| Intended workflow | State | Actual implementation/evidence and gaps |
| --- | --- | --- |
| Customer/student kiosk ordering | **Missing**; business design **Blocked by an unresolved requirement** | No kiosk route/public catalog API. PosPage is guarded staff UI, requires customer selection and accesses staff/customer data. Reusing it as a public kiosk would expose the wrong API/permission model. Confirm identity/payment/pickup/reservation/session-reset rules first |
| Staff order queue | **Partially implemented** | OrdersPage pending/completed/debt tabs call GET/PUT `/api/orders`; model pending/completed/void; completion invokes backend stock/invoice flow. Queries filter owner to req.user ID, so this is not a centralized cross-cashier queue. No claim/processing lease, pickup stage or confirmed public order number. Counts derive from loaded records (request limit200), not guaranteed global queue totals |
| Cashier POS/checkout | **Partially implemented** | Product search/cart/quantity bounds, customer lookup and payment sheet exist. PosPage submit explicitly sends orderStatus pending. OrdersPage completion separately sends completed and paid/partial/debt values. No approved cashier role; no external payment gateway. Existing payment tests cover mocked collection/settlement, not actual end-to-end checkout or native concurrency |
| Product/inventory management | **Partially implemented** | ProductPage and `/api/products` CRUD/stock/active endpoints; Product model stock is authoritative. Mounted page edits absolute stock, not a movement ledger. No incoming-stock history, adjustment audit UI, responsible-user movement trail, approved thresholds or native concurrency proof. Stock endpoint is not surfaced by the current productApi hook |
| Availability: cannot order unavailable items | **Partially implemented** | POS shows quantity/disabled stock<=0; caps quantities from cached stock; active-only catalog. Backend buildItems checks owned active products and server prices; stock guard occurs on completion. Pending submissions do not establish a stock reservation/authoritative availability guarantee. No public kiosk availability contract. UI stock<10 badge is a hardcoded presentation rule, not an approved per-product threshold |
| Account administration | **Partially implemented**; security primitives **Implemented and verified locally** | Profile admin section and admin API protect registration/list/update/delete; bcrypt/JWT/version/actor/ObjectId regressions documented. Only admin/user roles exist. Public register form is **UI only; backend behavior unverified as a registration workflow** (administrator-only API is verified). Forgot Password button has no implemented action; no recovery workflow claim |
| Sales/inventory reporting | **Partially implemented** | Dashboard has authenticated owner-scoped summary/revenue endpoints, chart and recent transactions. No role-separated financial access, inventory movement/stock-in reports, product/category sales breakdown UI, full reporting/filter/export module or profit verification |
| Receipt DTO/rendering subset | **Implemented and verified locally** | `client/tests/invoice.test.js` executes actual Invoice rendering against backend invoiceDto: centavos, recorded prices/payment details and missing history. Native invoice creation, print hardware/layout and institutional/legal acceptance remain unverified |

### Important transaction and reporting semantics

- PosPage loads at most the requested200 products/customers and filters locally; no scan-device integration exists merely because the placeholder says Search or scan products. Paginated catalogs can be incomplete without additional loading/search design.
- A pending submission displays Sale submitted while completion is a later action. OrdersPage's printInvoice action ensures an invoice and reports readiness; it does not itself call window.print. InvoicePage selects an ensured DTO, then schedules window.print. Avoid promising immediate checkout receipt delivery without tracing this route.
- Existing UI supports cash/gcash/bank/credit, paid/partial/debt and void actions. Those are legacy capabilities, not approved bookstore payment/refund/credit policies. Preserve history and ask which options remain exposed.
- FinancialPage uses `/dashboard/summary` and `/dashboard/revenue` via financialApi. FinancialController summary sums **amountPaid** over completed, nonvoid owner transactions; outstanding debt sums relevant balances, order count counts those transactions, customer count excludes soft-deleted customers. Chart groups amountPaid by transaction createdAt and daily/weekly/monthly format, defaulting to the last30 days. Its range selector changes grouping, not the all-time summary. Later debt collections can change historical order-period collected totals. Label/define these measures before calling them daily sales or cash collected on payment date. Revenue is not profit.
- Receipt prices come from recorded transaction unitPrice/subtotal, not current catalog prices. invoiceDto uses current populated product names and explicitly reports missing historical names; immutable name snapshots are not stored. Any snapshot/schema proposal requires separate data review, not a branding patch.
- **Source-confirmed cost-edit conflict:** mounted ProductPage's form/payload omits costPrice, while ProductController's shared productPayload defaults an omitted costPrice to0 and updateProduct applies that payload. Editing through the current page can therefore overwrite an existing cost value with0. This was established by request/default tracing, not a live data test; no existing cost record was read or changed. An approved product-edit correction must preserve fields absent from the form and test recorded cost preservation. Do not reconnect the unmounted legacy cost form as a shortcut.

## 5. Actual permissions and conflicts

User model enum is **admin/user** with confirmed state and tokenVersion. There is no Cashier, Manager/Inventory Staff or Customer/Student role. DashboardGuard and client cached roles are UI conveniences; backend protect loads current role/confirmation/version and remains authoritative.

| Surface | Actual authority |
| --- | --- |
| Staff provisioning/list/role/reset/delete | UserRoute protect + authorizeRoles admin; ProfilePage only shows AdminUserTable for cached admin |
| Products, absolute stock edits/deactivation/stock adjustment | ProductRoute permits admin and user; owner-scoped controller queries. Catalog responses are not a public safe catalog DTO |
| Orders/payments/invoices/customers | Protected authenticated routes and owner checks; not a cashier-only permission model |
| Dashboard/finances | protect only, not management-role restriction; any confirmed user can view their owner-scoped financial data |
| Expenses | Protected routes; create/list linked to requester, edit/delete controller allows creator or admin. This differs from uniformly owner-only catalog rules |

Consequences: the current ordinary user has broader inventory/financial capabilities than a proposed cashier; shared bookstore resources cannot be obtained by only hiding links; administrators do not automatically see every other owner's product/order through owner-scoped endpoints. Do not substitute another account ID, remove owner filters or merge records as a quick shared-queue change. Cost price exists in Product and requires an explicit visibility decision before a public/customer DTO or new role exposure. Multi-cashier shared inventory/catalog design remains unapproved.

### Proposed role matrix — UNCONFIRMED, no assignments or permission changes

| Proposed role | Candidate pages/responsibilities | Candidate permitted data/actions | Restrictions/confirmation required |
| --- | --- | --- | --- |
| Administrator | Accounts, security, approved configuration; oversight pages | Provision/review accounts, permissions and approved access | Preserve guarded role/reset/confirmation/deletion behavior; define oversight scope and last-admin policy separately |
| Cashier | POS, queue, receipts and own relevant history | Process approved orders/payments; read saleable catalog; issue approved receipts | No account/role administration or unrestricted stock editing. Void/discount/credit/refund and financial summary visibility require approval |
| **Inventory Staff and Store Manager (combined)** | Catalog, stock, incoming/movement views; operational oversight | Proposed catalog/stock management with audit trail | Confirm price/cost visibility, sales/report access, ability to act as cashier, adjustment authority and separation-of-duties expectations |
| Customer / Student | Future kiosk catalog/cart/order acknowledgement | Public-safe product availability and own ephemeral order reference, if approved | No staff/customer/account/financial data access. Decide anonymous versus identified operation and secure kiosk reset; do not grant staff user tokens |

This proposes boundaries only. Management/inventory responsibilities overlap with cashier completion and admin oversight. Confirm whether users can hold multiple roles or use one combined role, and which functions require backend permissions. No schema/role enum change is authorized by this audit. A frontend-only role map is insufficient.

## 6. UX, accessibility and responsive evidence

| Observation | Evidence and implication |
| --- | --- |
| Reusable responsive navigation | Layout uses matchMedia768px, desktop sidebar, mobile drawer/bottom tabs, Escape handling, body scroll lock, focus trap and ARIA navigation/dialog labels. Retain these strengths; source does not prove browser focus restoration, hidden-drawer tab isolation or nested dialog behavior |
| Responsive POS foundation | index.css/PosPage switch cart layout near1180px; two/three/four product columns, smaller-screen rules near430px and min-h-11 controls exist. Fixed viewport/overflow containers and stacked sheets need actual phone/tablet, zoom and keyboard testing; global overflow-x hidden can conceal overflow rather than fix it |
| Inconsistent form accessibility | ProductPage has input IDs/htmlFor labels. Login/register visible labels lack explicit association; password-eye button lacks an accessible name. PosPage search relies on placeholder. Review names, required/error associations, autofill and validation feedback |
| Dialog semantics vary | Layout mobile drawer has dialog semantics/focus handling; OrdersPage PaymentSheet is styled div/backdrop with close button but lacks equivalent dialog semantics/focus trap in that component. UserModal and other dialogs need a shared audited pattern; do not infer all modals inherit Layout's trap |
| Readiness blocks entire app | useServerReady polls API health every2s until success; App hides even login until ready. Loading screen has no timeout/retry choice and misleading time/progress copy. Do not launch browser during this local audit: readiness would call an environment-defined service and fonts are external |
| Failed login handling | LoginPage awaits login without local catch; AuthContext sets error then rethrows. Rendered error state exists, but browser rejection/focus behavior is unverified. Forgot Password has no handler; public register is inert. These are functional promises needing approved treatment |
| Error and data loading gaps | FinancialPage promises lack catch/error UI and summary-null stays Loading; ProductPage async loads/saves/deactivation lack robust error/busy feedback. OrdersPage has toast/loading handling. Standardize under an approved phase, without auto-retrying ambiguous writes |
| Storage/session UX | AuthContext caches role/user; remember-me handling spans local/session storage; logout clears both stores, not server epochs. apiClient401 logs safe metadata and rejects rather than auto-clearing identity. Users can see stale menus after revocation until refresh; backend remains authoritative |
| Motion/theme/contrast | index.css token themes and ThemeToggle persistence are reusable. Loading uses animated bounce/progress; no reduced-motion override was found in inspected styles. Fixed light loading/receipt styles differ from token screens. Contrast and screen-reader usability were not measured; no WCAG compliance claim |
| Printing | index.css hides body except print-area; InvoicePage invokes browser print after selected render. SSR receipt tests do not verify paper width, pagination, cut-off, printer drivers or browser print behavior |
| Empty/error states | Receipt absent data is explicit; generic Loading/toasts exist. POS has no convincing complete empty/loading/error catalog flow in inspected rendering. Distinguish empty catalog, filtered no matches, stock exhausted, unavailable server and unauthorized access |

The existing16 lint errors/13 warnings remain visible. They are not permission to sweep unrelated UI or bypass hook rules to make a rebrand build pass. No automated accessibility suite or browser workflow tests were found; client tests focus receipts/logout/diagnostics/API no-retry behavior.

## 7. Security and data-integrity constraints

Preserve tokenPolicy/generateToken/authMiddleware seven-day expiration enforcement, tokenVersion and current-account role/confirmation checks; User password hashing/security epoch hooks; canonical accountIdentity self-delete protection; adminAccountMutation atomic actor predicates/fences; accountCommitBoundary observer/replay guard; safeDiagnostics and sanitized backend errors. Existing security reports are authoritative history of local checks, not claims that native MongoDB has been tested.

No UI action should silently retry an indeterminate write or treat every failed response as rollback. The five open financial/inventory risks remain: repeated stock deltas, overwritten concurrent stock adjustments, partial activation, payment resubmission, and financial error masking. The account-scoped R2 observer does not fix those modules. Any new checkout, queue claim, stock ledger or shared catalog proposal must retain historical transactions/products/accounts and receive separate design/testing approval.

A08B preflight remains **BLOCKED PENDING EVIDENCE**. No database behavior, provider identity, production credential rotation or live administrator legitimacy was verified in Phase14. Keep the POS independent of GradeSense AI. Do not rename internal routes, collections, environment keys or package identifiers merely for branding.

## 8. Decisions requiring confirmation

1. Approve provisional text branding and palette, or provide authorized institutional assets/guidelines. Confirm where the exact formal title should appear and management-approved receipt details.
2. Confirm the four proposed role groups, combined manager/inventory scope, multiple-role needs, financial/cost visibility and admin oversight boundaries before any backend permissions change.
3. Confirm customer-facing versus staff-operated kiosk, anonymous/identified use, payment location/methods, pickup, order statuses, inventory reservation/expiry and cancellation. No defaults are silently selected.
4. Define shared catalog/store ownership and queue access across cashiers while preserving existing owner-linked data. Existing project restrictions prohibit automatic catalog merging/migration.
5. Confirm bookstore product fields/categories: existing name/SKU/category/price/stock/activity are reusable. ISBN, description, image, threshold, variants/uniform sizes and cost editing need justified requirements. Suggested textbook/supply/uniform/merchandise categories are not a confirmed catalog.
6. Confirm what new-entry UI should expose for debt/credit, expenses, Grab/Foodpanda and void actions. Preserve historical data/options until a compatibility policy is approved; refunds/discounts/accounting are not inferred.
7. Define reported sales/collections dates, timezone, per-user/store totals, payment-date versus order-date reporting and authorized dashboards. No invented totals or profit claims.

## 9. Prioritized implementation sequence — PROPOSED ONLY

| Priority/sequence | Proposed scope | Acceptance criteria / gate |
| --- | --- | --- |
| P0 — confirm requirements | Resolve identity/assets, role, kiosk/stock/payment/ownership/reporting decisions | Approved written scope; no frontend-only permission change or new business policy |
| P1 — minimal branding | Login/Layout/loading/title/icon references and current documentation, preserving the already branded receipt | Visible current screens consistently UPHSD Bookstore; formal title preserved where appropriate; no fabricated official logo/colors/contact/tax data; no route/schema/env/lock changes |
| P1 — accessibility and truthful states | Approved handling for inert register/forgot-password promises; associated labels, named controls, dialog/focus/error/readiness patterns | Keyboard/screen-reader checks; bounded truthful readiness/error feedback; no lost auth behavior or raw sensitive logs; avoid auto-resubmitting uncertain writes |
| P2 — product/catalog adaptation | Approved product fields/categories and stock/availability presentation | Correct centavos display, clear out-of-stock states, server validation retained; no overwrite/migration without approval; quantity/history changes reviewed separately |
| P2 — role/shared-store design | Backend permissions, safe customer DTO and shared-resource/queue architecture | Permission matrix enforced per endpoint; authorized cross-cashier scope; legacy data preservation plan; tests for denied direct API calls |
| P3 — approved kiosk/queue/cashier integration | Reuse cart/order pieces after ownership/state/payment rules approved | Explicit pending versus completed behavior; unique approved customer-facing order reference; no duplicate submission/settlement; authoritative stock; kiosk privacy/reset; native integrity evidence requires separately authorized A08B |
| P3 — receipt/report refinement | Approved receipt content and reports/dashboards | Recorded prices preserved; no sensitive financial data to unauthorized roles; correct dates/calculations and missing-history handling; print verified on approved devices |
| P4 — integration and release review | Responsive/browser/accessibility/regression verification and reviewed rollout | Phones/tablets/desktops, zoom, keyboard/focus, print and failures covered; existing security/payment/receipt tests retained; lint debt handled in approved scope; deployment separately authorized |

Recommended first implementation scope is **branding-only with provisional text assets**, after approval, without roles/workflow/data changes. Accessibility and workflow work should be separately reviewable. Preserve the current client/backend separation; no framework rewrite or generic folder restructuring is justified by this audit.

## Deliverables and stop

Only `docs/UPHSD_BOOKSTORE_PHASE_14_UI_BRANDING_AUDIT.md` and an additive dated implementation-plan entry are delivered. Prior reports, application/tests, assets, configurations/environment files, manifests/lockfiles and unrelated working-tree changes are preserved. **No recommendation has been implemented. UI implementation requires explicit approval; A08B has not begun.**
