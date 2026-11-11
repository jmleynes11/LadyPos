# UPHSD Bookstore POS — folder architecture

Date: 2026-11-02. Current baseline `2e9942e` plus pre-existing lockfile changes. This document describes actual paths and a proposed incremental target. No source files were moved, renamed or created during audit.

## Current structure

```text
LadyPos/
  .git/
  backend/
    .env                         tracked; values must remain confidential
    package.json                 start/dev scripts; ESM Express application
    package-lock.json
    node_modules/                installed dependencies; 2,525 tracked entries
    index.js                     app creation, middleware, mounts, logs, listener
    config/config.js             mongoose.connect(MONGO_URI)
    middleware/
      authMiddleware.js          JWT protect and role guards
      errorMiddleware.js         global error response
      logger.js                  request completion/error logs
    routes/
      UserRoute.js
      ProductRoute.js
      CustomerRoute.js           current customer routes
      PersonRoute.js             compatibility routes, legacy debt actions
      OrderRoute.js              pending/completed order commands
      TransactionRoute.js        transaction aliases
      InvoiceRoute.js
      DebtPaymentRoute.js
      ExpenseRoute.js
      DashboardRoute.js
      FinancialRoute.js          summary/revenue aliases
    controllers/
      UserController.js
      ProductController.js
      PersonController.js
      OrderController.js
      InvoiceController.js
      DebtPaymentController.js
      ExpenseController.js
      FinancialController.js
    models/
      User.js
      Product.js
      Person.js                  registers Customer, not Person
      Order.js                   registers Transaction, not Order
      Invoice.js
      InvoiceCounter.js
      DebtPayment.js
      Expense.js
      Financial.js               not used by active reporting routes
    utils/
      generateToken.js
      responseHelpers.js
      seedAdmin.js               DB-writing standalone utility; not run
      formatPerson.js            legacy embedded-debt representation
      personService.js           legacy embedded-debt mutation
  client/
    .env                         tracked; VITE_API_URL, no secret allowed
    .gitignore                   client-only ignore rules
    package.json                 dev/build/lint/preview scripts
    package-lock.json
    node_modules/
    index.html                   browser title/favicon/font/main.jsx entry
    vite.config.js               React and Tailwind build plugins
    eslint.config.js             JS/React hooks/refresh checks
    README.md                    original Vite template
    public/
      _redirects                 Netlify SPA fallback
      .htaccess                  Apache SPA fallback/cache rules
      serveflow.svg              currently referenced brand logo/favicon
      serveflow.png              loading-screen logo
      favicon.svg, icons.svg     additional assets; usage must be checked
      hero.png, react.svg, vite.svg
    src/
      main.jsx                   StrictMode/AuthProvider/application mount
      index.css                  active theme, layout, responsive/print rules
      app/App.jsx                browser route map and health readiness gate
      features/
        auth/
          pages/                 LoginPage, RegisterPage, ProfilePage
          components/            profile/security/user/password/confirm UI
          api/authApi.js         Axios authentication/admin adapters
          utils/errorhandler.js
        products/
          pages/ProductPage.jsx
          components/            ProductCard/FormModal/ActiveProductsModal
          services/productApi.js
        orders/
          pages/                 PosPage, OrdersPage
          components/            AddOrderModal, UpdateOrderModal
          services/ordersApi.js
        people/
          pages/PersonPage.jsx   CustomerList and CustomerProfile
          components/            PersonCard, PersonForm, DebtForm (legacy UI)
          services/api.js
        invoices/
          pages/InvoicePage.jsx
          components/Invoice.jsx
          services/invoiceApi.js
        financials/
          pages/                 FinancialPage, ExpensePage
          components/FinanceChart.jsx
          services/              financialApi.js, expenseApi.js
      shared/
        components/              Layout, LoadingScreen
        hooks/                   AuthContext, DashboardGuard, ClickTooltip
        utils/                   apiClient/useApi, useProfile/useAdminUsers,
                                 phoneUtils, useServerReady
      services/ThemeToggle.jsx
      styles/App.css             empty; not an active styling architecture
  docs/
    README.md                    pre-existing audit index, preserved
    audit/                       pre-existing source/features/security/checks
    architecture/                pre-existing models/API/flows/folder design
    implementation/              pre-existing roadmap/testing/deployment
    recommendations/             pre-existing decisions/risks/priorities
    UPHSD_BOOKSTORE_*.md          seven bookstore documents added here
```

Dependency implementation files and Git internals are not application modules. The audit inspected manifests/lock versions, application sources, routes, models, configuration and existing documentation references, without trying to review every third-party dependency source. No repository AGENTS.md file was found by file discovery; session-provided instructions apply.

## Frontend route architecture

`main.jsx -> AuthProvider -> App.jsx -> DashboardGuard -> Layout -> feature page`.

| URL | Actual page/access |
| --- | --- |
| `/` | Redirect `/login` |
| `/login`, `/register` | Public pages; register form lacks submission logic |
| `/profile` | ProfilePage; admin user table conditionally shown |
| `/customers`, `/customers/:id` | PersonPage list/profile |
| `/pos` | PosPage; creates pending orders |
| `/orders`, `/transactions` | Same OrdersPage; transaction URL chooses completed tab |
| `/products` | ProductPage |
| `/dashboard`, `/finances` | Same FinancialPage |
| `/invoices` | InvoicePage |
| `/expenses` | ExpensePage |

All staff routes share an authentication guard, not role-specific guards. App's server-health gate also blocks login while the backend/DB is unavailable. No `/kiosk`, inventory page, receiving page, category page or standalone report/settings route exists. Profile/theme are the current settings surface. No React Query provider/use was found despite the dependency.

Most feature adapters unwrap `{success,message,data,pagination}`. Auth and expense handlers return different shapes. Preserve compatibility through tested DTO/adapters instead of simultaneous broad route and response rewrites. Legacy components are not assumed active just because files exist: ProductPage is inline UI; current OrdersPage does not import the order modals; PersonPage does not import PersonCard/DebtForm; FinancialPage renders its chart directly rather than FinanceChart.

## Backend/API architecture

`index.js` registers logging, public log HTML/SSE, CORS, health, JSON parsing, eleven routers and global error middleware. It listens on port 5000 and then starts DB connection. Controllers own HTTP handling and most business rules. Order/DebtPayment model hooks also mutate financial state, which causes duplicated payment logic.

Mounted families: `/api/users`, `/products`, `/people`, `/customers`, `/orders`, `/transactions`, `/financials`, `/dashboard`, `/invoices`, `/debt-payments`, `/expenses`. Public `/api/health`, `/` and `/logs-stream` are inline. For method/handler-level inventory reuse [existing API design](architecture/api-design.md); source was reread and route modules imported during this audit. New kiosk/stock-history/report endpoints remain proposals.

Models live in backend/models; database connection in config; bearer/role guards in middleware. There is no active standalone domain-service layer: `utils/personService.js` refers to obsolete embedded debts and is not a current payment service. No migration runner, app factory, first-party test folder, CI workflow, Dockerfile, infrastructure definition or backup script was found. Static-host assets are evidence of intended hosting only.

## Recommended target, created only when used

```text
backend/
  app.js                         proposed app factory, no listener/DB side effects
  index.js                       validated config, DB readiness, listener/shutdown
  routes/ controllers/ models/ middleware/ config/ utils/   retained
  services/                      extracted order/payment/inventory/invoice rules
  validators/                    bounded typed requests and transition validation
  serializers/                   approved role-specific DTO/receipt contracts
  tests/                         domain, HTTP contract and disposable-DB checks
  migrations/                    reviewed dry-run/backfill/index scripts
client/src/
  app/ shared/ features/         retained
  features/kiosk/                restricted kiosk UI after workflow approval
  features/inventory/            receiving/movement/report pages as implemented
  features/reports/              sales/inventory views only when warranted
  features/*/hooks/              move feature hooks only if touched and beneficial
  shared/config/brand.js         optional shared provisional brand text
```

Keep controllers thin by extracting one tested service at a time; one service owns each financial effect and transaction session. Validators reject malformed values before DB work. Serializers exclude costs/PII from cashier/kiosk responses and make receipt fields stable. An app factory enables isolated HTTP tests without starting production connections. Versioned migrations support review, dry runs and rollback.

Retain existing internal Person/Order names, virtual aliases, URL compatibility and User ownership until an approved mapping exists. Avoid generic repository rewrites, wholesale TypeScript migration, Redux, SQL conversion or unused directories. A shared-store design may need a Store/membership representation, but no such collection/folder is presumed approved. Root ignore/environment templates and CI are future controlled maintenance; do not untrack files or alter secret history during audit.

Deployment target remains separate frontend static hosting plus independently configured Node API and MongoDB. Confirm actual host/PORT/TLS/CORS, transaction-capable DB topology, secrets, backup/restore and release rollback before deployment. Installing dependencies, publishing, moving data and changing hosting remain outside this documentation phase.

Related: [blueprint](UPHSD_BOOKSTORE_SYSTEM_BLUEPRINT.md), [database review](UPHSD_BOOKSTORE_DATABASE_REVIEW.md), [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md). The older [folder architecture](architecture/folder-architecture.md) remains preserved and is not rewritten to duplicate this bookstore target.
