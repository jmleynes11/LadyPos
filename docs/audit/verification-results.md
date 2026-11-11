# Verification results and audit change record

Date2026-11-02, Asia/Manila. Baseline commit `2e9942e` with pre-existing local changes. Runtime Nodev24.14.0/npm11.9.0. No dependency installation, backend startup, configured DB connection, seed, migration or deployment was performed.

## Executed checks

| Check | Command / method | Observed result | Limit |
| --- | --- | --- | --- |
| Root identity | Get-Location; git rev-parse --show-toplevel | C:/Users/jmley/Desktop/LadyPos | Local checkout, not deployed state |
| Initial changes | git status --short | Modified backend/package-lock.json, backend/node_modules/.package-lock.json, client/package-lock.json | Changes predate audit and are preserved |
| Backend syntax | node --check for every non-node_modules backend JS file |38 checked, zero failures | Syntax only; no runtime DB/API acceptance |
| Backend import graph | Imported every routes/*.js module in an isolated Node ESM process | All11 routers loaded successfully without starting app or connecting DB | Confirms route/controller/model module resolution, not HTTP/business correctness |
| Client build | In client: `npm run build -- --outDir <temporary-directory>` | Exit0, Vite8.0.3;670 modules; CSS44.12kB/gzip8.95kB, JS751.22kB/gzip227.24kB; chunk-size warning | Local env build inputs; no deployed API reachability or page behavior verified |
| Client lint | `npm run lint`; JSON-format repeat for precise summary | ESLint exit1,18 errors/13 warnings | Quality findings, not proof every reported effect crashes |
| Isolated checks | Synthetic Node ESM script importing real controllers/models/auth; actual Mongoose pre-save pipeline; mocked query/session/persistence adapters | Eight assertions passed, reproducing defects/constraint gaps; mongoose9.3.3, connection.readyState0 | No database commit, rollback, index or actual HTTP/browser execution |
| Secret tracking | git ls-files backend/.env; key-name-only env inspection | Backend.env tracked; backend keys MONGO_URI/MONGO_PASS/JWT_SECRET; client key VITE_API_URL | Values never output; validity/strength not tested |
| Dependency tracking | git ls-files backend/node_modules count |2,525 tracked entries | Repository hygiene evidence, not vulnerability proof |
| npm dependency advisories | `npm audit --json --ignore-scripts` in each package; read-only network retries | Backend successful report:8 affected entries (1critical,3high,4moderate); client successful report:22 (12high,9moderate,1low); exit1 means findings | Initial and one later requests failed ENOTFOUND/ECONNRESET; successful reports supersede incomplete attempts; exploit reachability not tested |
| Docs/source consistency | Markdown relative links, code fences, finding IDs, source references and Git status comparison |21 Markdown files; zero broken relative links/unclosed fences;23 finding IDs present; no matched configured secret values in docs | Static Markdown validation; no browser rendering of diagrams performed |

Build output was directed outside the repository to a temporary directory, avoiding modifications to any application dist directory. npm audit is read-only with respect to dependency versions; no audit fix command was used. Advisory findings are detailed in [dependency audit](dependency-audit.md).

## Isolated reproduction details

Each test used synthetic IDs and credentials, never read dotenv, and asserted mongoose.connection.readyState remained0. A failed initial harness import from repository root was corrected by running in backend so dependencies resolved; an earlier one-line introspection syntax typo was corrected before the successful run. Those harness errors were not application findings.

| Assertion | Actual components executed | Synthetic setup and observed output |
| --- | --- | --- |
| F01 | createUser, generateToken, protect and authorizeRoles | Mock User.findOne/create; submit admin/confirmed; controller201; returned token passes actual admin guard |
| F02 | Real User schema validate and pre-save pipeline | Synthetic password remains unchanged; typeof matchPassword is undefined |
| F04 | Real protect output then getProfile | Spy on findById; receives undefined because handler reads _id; User not found error passed to next |
| F05a | createDebtPayment plus actual DebtPayment pre-save middleware | Fake transaction total1000, paid0, balance1000; collection100 yields response201 and paid200/balance800 |
| F05b | Same actual paths | Collection1000 returns400 `next is not a function` when second application detects no remaining balance |
| F06 | markAsPaid -> dynamically imported createDebtPayment | Order ID and customer ID differ; Customer query uses order ID;400 Customer not found |
| F08 | Actual Product document validation | price1.25 and stock1.5 pass; safe-integer rules absent |
| F07 | Actual Invoice schema.indexes inspection | No unique:true index declared; actual DB indexes/race outcome not tested |

The harness replaced model database methods/session adapters only within its process. It ran the real controller and real registered model hooks via Mongoose's internal hook runner; that internal runner is an audit technique, not an application API recommendation or future test dependency. The fake sale.save recomputed balance to expose duplicate application. Therefore these tests prove call-path/logic defects but do not certify real transactional behavior. Future regression must exercise the full DB/HTTP chain.

## ESLint detail

| File beneath client/src | Errors | Warnings | Main rules |
| --- | --- | --- | --- |
| features/auth/components/PasswordChangeModal.jsx |1|0|set-state-in-effect |
| features/auth/components/ProfileCard.jsx |1|0|set-state-in-effect |
| features/auth/components/SecurityCard.jsx |1|0|set-state-in-effect |
| features/auth/components/UserModal.jsx |1|0|set-state-in-effect |
| features/financials/pages/ExpensePage.jsx |0|1|exhaustive-deps |
| features/financials/pages/FinancialPage.jsx |0|2|exhaustive-deps |
| features/invoices/pages/InvoicePage.jsx |1|1|immutability declaration ordering, exhaustive-deps |
| features/orders/components/AddOrderModal.jsx |1|1|set-state-in-effect, exhaustive-deps |
| features/orders/components/UpdateOrderModal.jsx |1|1|set-state-in-effect, exhaustive-deps |
| features/orders/pages/OrdersPage.jsx |0|1|exhaustive-deps |
| features/orders/pages/PosPage.jsx |0|1|exhaustive-deps |
| features/people/components/PersonCard.jsx |1|0|no-unused-vars |
| features/people/pages/PersonPage.jsx |2|2|set-state-in-effect, exhaustive-deps |
| features/products/components/ActiveProductsModal.jsx |1|1|immutability declaration ordering, exhaustive-deps |
| features/products/pages/ProductPage.jsx |1|1|set-state-in-effect, exhaustive-deps |
| shared/components/Layout.jsx |2|0|set-state-in-effect |
| shared/hooks/AuthContext.jsx |2|0|no-unused-vars, only-export-components |
| shared/utils/useApi.js |1|1|preserve-manual-memoization, exhaustive-deps |
| shared/utils/useServerReady.js |1|0|no-unused-vars |
| **Total** |**18**|**13**| |

## Checks intentionally not run

Full backend startup/seed might connect to the configured external database and emit its URI. No such operation was needed for this audit. Live registration/login/checkout/collection, actual indexes, multi-session races, real rollback/ambiguous-commit behavior, UI/printer interaction, vulnerability exploitation, restore/migration rehearsal, clean npm ci and production deployment were not run. No complete business workflow is certified functional.

## Documentation and source change validation

Existing nondependency files were inventoried before documentation creation (108 files), excluding .git, node_modules and docs. Final Git diff/status is compared with the recorded initial status: the only pre-existing tracked changes are the three lockfile paths. Generated reports are docs additions until the user chooses to commit. No source/config/lockfile correction was made to repair findings. Audit tooling and build output stayed in temporary paths; only project documentation is delivered under docs.

Final observed `git status --short`: the same three modified lockfile paths plus `?? docs/`. `git diff --name-only` contains only those original lockfiles; no application source modification or deletion appears. `git diff --check` produced no whitespace errors. All21 created files are Markdown beneath docs. A nonprinting exact-value check against configured backend secret values found no matches in documentation; environment values themselves were not output.
