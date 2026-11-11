# Source and inspection inventory

Root: `C:/Users/jmley/Desktop/LadyPos`. Commit `2e9942e` plus existing lock changes. 108 pre-existing files outside .git, node_modules, docs and build output. The full application source is small enough to inventory; coverage depth varies as stated below.

## Entry points and configuration

Client: index.html -> src/main.jsx -> AuthProvider -> app/App.jsx. App maps login/register, profile, customers, orders/transactions, POS, products, finances/dashboard, invoices and expenses. Main imports index.css, which includes Tailwind. Vite config installs React/Tailwind plugins; ESLint flat config configures browser JS/JSX and Hook rules. Backend: index.js -> DB config, middleware, eleven routers, eight controllers and nine models. Console/SSE routes are inline in the entry point. npm manifests/locks are separate, with no root package manager/workspace.

Core route, controller, model, auth, configuration, API adapter and transaction code was read. Supporting UI components were inspected for imports/contracts and selected logic and compiled/linted; this is not an exhaustive browser/visual/accessibility/print review. Environment values were not copied into reports. Dependencies were not manually source-audited; local Mongoose hook runner was inspected for the isolated reproduction, and npm advisory scans were performed.

## Current first-party files

| Path | Coverage |
| --- | --- |
| `backend/.env` | Key names and tracking only; values withheld |
| `backend/config/config.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/controllers/DebtPaymentController.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/controllers/ExpenseController.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/controllers/FinancialController.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/controllers/InvoiceController.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/controllers/OrderController.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/controllers/PersonController.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/controllers/ProductController.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/controllers/UserController.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/index.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/middleware/authMiddleware.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/middleware/errorMiddleware.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/middleware/logger.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/models/DebtPayment.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/models/Expense.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/models/Financial.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/models/Invoice.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/models/InvoiceCounter.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/models/Order.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/models/Person.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/models/Product.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/models/User.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/package-lock.json` | Resolved package/version and advisory graph inspection |
| `backend/package.json` | Configuration/documentation inspection |
| `backend/routes/CustomerRoute.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/routes/DashboardRoute.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/routes/DebtPaymentRoute.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/routes/ExpenseRoute.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/routes/FinancialRoute.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/routes/InvoiceRoute.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/routes/OrderRoute.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/routes/PersonRoute.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/routes/ProductRoute.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/routes/TransactionRoute.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/routes/UserRoute.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/utils/formatPerson.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/utils/generateToken.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/utils/personService.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/utils/responseHelpers.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `backend/utils/seedAdmin.js` | Static source inspection; syntax checked; core paths isolated where noted |
| `client/.env` | Key names and tracking only; values withheld |
| `client/.gitignore` | Configuration/documentation inspection |
| `client/README.md` | Configuration/documentation inspection |
| `client/eslint.config.js` | Configuration/documentation inspection |
| `client/index.html` | Configuration/documentation inspection |
| `client/package-lock.json` | Resolved package/version and advisory graph inspection |
| `client/package.json` | Configuration/documentation inspection |
| `client/public/.htaccess` | Configuration/documentation inspection |
| `client/public/_redirects` | Configuration/documentation inspection |
| `client/public/favicon.svg` | Asset existence/reference inventory only; no visual or metadata security audit |
| `client/public/hero.png` | Asset existence/reference inventory only; no visual or metadata security audit |
| `client/public/icons.svg` | Asset existence/reference inventory only; no visual or metadata security audit |
| `client/public/react.svg` | Asset existence/reference inventory only; no visual or metadata security audit |
| `client/public/serveflow.png` | Asset existence/reference inventory only; no visual or metadata security audit |
| `client/public/serveflow.svg` | Asset existence/reference inventory only; no visual or metadata security audit |
| `client/public/vite.svg` | Asset existence/reference inventory only; no visual or metadata security audit |
| `client/src/app/App.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/auth/api/authApi.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/auth/components/AdminUserTable.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/auth/components/ConfirmModal.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/auth/components/PasswordChangeModal.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/auth/components/ProfileCard.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/auth/components/SecurityCard.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/auth/components/UserModal.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/auth/pages/LoginPage.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/auth/pages/ProfilePage.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/auth/pages/RegisterPage.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/auth/utils/errorhandler.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/financials/components/FinanceChart.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/financials/pages/ExpensePage.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/financials/pages/FinancialPage.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/financials/services/expenseApi.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/financials/services/financialApi.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/invoices/components/Invoice.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/invoices/pages/InvoicePage.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/invoices/services/invoiceApi.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/orders/components/AddOrderModal.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/orders/components/UpdateOrderModal.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/orders/pages/OrdersPage.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/orders/pages/PosPage.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/orders/services/ordersApi.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/people/components/DebtForm.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/people/components/PersonCard.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/people/components/PersonForm.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/people/pages/PersonPage.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/people/services/api.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/products/components/ActiveProductsModal.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/products/components/ProductCard.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/products/components/ProductFormModal.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/products/pages/ProductPage.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/features/products/services/productApi.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/index.css` | Styling/configuration context; no exhaustive visual QA |
| `client/src/main.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/services/ThemeToggle.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/shared/components/Layout.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/shared/components/LoadingScreen.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/shared/hooks/AuthContext.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/shared/hooks/ClickTooltip.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/shared/hooks/DashboardGuard.jsx` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/shared/utils/apiClient.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/shared/utils/phoneUtils.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/shared/utils/useAdminUsers.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/shared/utils/useApi.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/shared/utils/useProfile.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/shared/utils/useServerReady.js` | Static import/API/data-flow inspection; lint/build; selected logic reviewed in detail |
| `client/src/styles/App.css` | Styling/configuration context; no exhaustive visual QA |
| `client/vite.config.js` | Configuration/documentation inspection |

## Missing infrastructure and coverage limits

No root/backend README, root/backend .gitignore, package-local env examples, project business specification, first-party automated test files/test scripts, CI workflows, Docker/container deployment files, migration runner, backup/restore scripts or deployment platform manifest were found outside dependency trees. Only client template README, public SPA fallback/Apache settings, hardcoded CORS and health/start scripts describe deployment. No new empty application directories were created.

Backend models are User, Product, Customer in Person.js, Transaction in Order.js, Invoice, InvoiceCounter, DebtPayment, Expense and unused Financial. Known aliases are intentional compatibility surfaces; no separate People/Order collection should be invented from filenames. See the database/API plans.

No production DB data/index/topology/permission inspection, full dependency source review, deployed-service/host review, browser hardware printing, load testing or backup restoration occurred. Source evidence and observed commands support the findings; an existing UI or successful build is not proof of functional business behavior.
