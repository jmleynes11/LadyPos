# Folder architecture

Status: documentation created now; application layout changes below are proposed only. Do not rename `client` to `frontend` or `backend` to another wrapper. Existing package entry points and configuration remain valid and should be preserved.

## Current structure

```text
LadyPos/
  .git/
  backend/
    index.js
    package.json, package-lock.json
    .env                         # tracked; contents withheld
    config/config.js
    controllers/                 # eight HTTP/domain controllers
    middleware/                  # auth, errors, request logger
    models/                      # nine models
    routes/                      # eleven routers
    utils/                       # response/token/seed and legacy person helpers
    node_modules/                # 2,525 tracked entries
  client/
    index.html
    package.json, package-lock.json
    .env                         # local ignored; names inspected only
    vite.config.js, eslint.config.js, .gitignore, README.md
    public/                      # assets, Netlify fallback, Apache settings
    src/
      main.jsx
      app/App.jsx
      features/{auth,products,orders,people,invoices,financials}/
      shared/{components,hooks,utils}/
      services/ThemeToggle.jsx
      styles/App.css
      index.css
  docs/                          # new populated documentation tree
```

There was no root README, root package manifest, root/backend ignore, environment example, test suite, CI workflow, migration directory or backend service directory. No empty application directories were created by this audit.

## Recommended structure

```text
LadyPos/
  README.md                      # proposed project-specific setup/index
  .gitignore                     # proposed shared excludes; preserve client rules
  docs/
    README.md
    audit/*.md
    architecture/*.md
    implementation/*.md
    recommendations/*.md
  backend/
    index.js                     # retained single executable entry
    app.js                       # conditional future app factory; never listens
    package.json, package-lock.json
    .env.example                 # proposed server variable names, dummy values only
    config/
    routes/
    controllers/
    services/                    # create when extracting actual domain behavior
    validators/                  # create with real request schemas
    middleware/
    models/
    utils/
    scripts/                     # create with reviewed migration/index/provision tools
    tests/
      unit/
      integration/
  client/
    index.html
    package.json, package-lock.json
    .env.example                 # proposed public API origin example
    vite.config.js, eslint.config.js, .gitignore, README.md
    public/
    src/
      main.jsx
      app/
      features/{auth,products,orders,people,invoices,financials}/
        pages/, components/, services/ or api/
      shared/
        components/
        hooks/
        utils/                   # actual common money/DTO helpers only
      services/ThemeToggle.jsx   # retain; move only with a reviewed reason
      styles/App.css
      index.css
    tests/                       # create with real component/browser scenarios
  .github/workflows/             # conditional on chosen CI host
```

Paths above describe a future populated structure, not a request to scaffold placeholders. No duplicate root test runner, workspace manager, root `.env` or root package manifest is necessary for two small npm applications.

## Directory disposition

| Directory | Exists | Disposition and contents | Consumers / reason |
| --- | --- | --- | --- |
| `docs/` and its four report directories | Created now | Retain actual Markdown audit/design/plans; index at docs/README | Reviewers/developers; independent POS documentation |
| `backend/` | Yes | Retain package root and executable | Node process/deploy; no value in renaming |
| `backend/config/` | Yes | Retain DB connect; later validated environment reader | Startup, tests; fail fast without printing values |
| `backend/routes/` | Yes | Retain HTTP mounts, validation and capability wiring | Express app; document aliases before retirement |
| `backend/controllers/` | Yes | Retain paths; gradually narrow to HTTP adaptation | Routers; fixes can land without broad moves |
| `backend/models/` | Yes | Retain real schema/index definitions; remove mutation hooks only with service replacement | Services/report queries; no immediate Order/Person file rename |
| `backend/middleware/` | Yes | Retain auth/error/logging; add policy middleware when implemented | Routes/app; consistent enforcement |
| `backend/utils/` | Yes | Retain pure response/token helpers; review obsolete person helpers and seed | Current imports; do not delete during audit |
| `backend/services/` | No | Create real sales/payment, inventory, invoice, account/report functions incrementally | Controllers; single business-rule owner |
| `backend/validators/` | No | Create request/DTO schemas only with actual endpoints | Routes/controllers; shared bounded validation |
| `backend/scripts/` | No | Create reviewed idempotent data/index migrations and secure provisioning tools with dry-run | Release operators/CI; no runtime auto migration or duplicate seed |
| `backend/tests/unit/` | No | Create pure money/state/policy tests | CI; deterministic business invariants |
| `backend/tests/integration/` | No | Create isolated replica-set API/model/session tests | CI; protect atomicity, uniqueness and authorization |
| `client/` | Yes | Retain independent Vite npm application | Static build; no redundant frontend root |
| `client/public/` | Yes | Retain referenced assets/fallback; pick host configuration on deployment review | Vite/static host; `.htaccess` has no effect on Netlify |
| `client/src/app/` | Yes | Retain route/provider composition | main.jsx; lazy pages can be introduced later |
| `client/src/features/` and six feature directories | Yes | Retain domain UI/API folders; choose service naming when touching files | Routes and local components; no mass rename |
| Feature `pages/`, `components/`, `services/`, auth `api/` and `utils/` | Yes where used | Retain nonempty existing subfolders, retire unreachable legacy code through later review | Corresponding feature; preserve imports |
| `client/src/shared/components/` | Yes | Retain layout/loading and genuinely shared UI | App/features; no domain business rules |
| `client/src/shared/hooks/` | Yes | Retain auth/guard; relocate misclassified helpers only in a justified change | React tree; source movement not needed for urgent repairs |
| `client/src/shared/utils/` | Yes | Retain current hooks/helpers; add money normalization if shared; no parallel duplicate client | Feature adapters; boundary consistency |
| `client/src/services/`, `styles/` | Yes | Retain ThemeToggle and CSS until a focused reorganization is worthwhile | Layout/main CSS; low priority cosmetics |
| `client/tests/` | No | Create with executed component and browser tests; use subfolders only as needed | CI/browser runner; no empty test tree |
| `.github/workflows/` | No | Create only if GitHub Actions is the selected CI | Release gate; provider not assumed |
| `backend/node_modules/` | Yes and tracked | Keep local installed runtime for audit; propose removing from version tracking, not deleting user files | npm-generated; lockfile is dependency source of truth |

## Proposed file changes and safe order

Add root `.gitignore` covering both node_modules, build outputs, local env and logs, with explicit environment-example exceptions; this does not remove already tracked secrets by itself. Add server/client examples in their package roots because dotenv/Vite resolve there. Add a project-specific root README linking these reports while preserving the existing template README. Environment removal from tracking and secret rotation are a reviewed security change; history rewrite is separate.

First fix P0 defects in existing paths with focused tests. Next extract the real account/payment/inventory functions and validators as their contracts stabilize. Extract app construction for safe API tests without importing `index.js` or opening real DB connections. Add real migration scripts before new unique indexes. Consolidate legacy aliases/components only after usage search and compatibility tests. No source file was moved, renamed, deleted or rewritten during the audit.
