# Phase15A — provisional bookstore branding results

Date: 2026-11-03, Asia/Manila. **Branding-only implementation completed locally.**

Primary brand: **UPHSD Bookstore**. Application name: **UPHSD Bookstore POS**. Formal title: **UPHSD BookstorePOS: Point-of-Sale and Inventory Management System for the University Bookstore.**

Reviewed the [Phase14 audit](UPHSD_BOOKSTORE_PHASE_14_UI_BRANDING_AUDIT.md), latest [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md), and actual branding references before editing. Replaced rendered ServeFlow identity with provisional text in login/register, shared navigation and loading; updated browser title/metadata and linked a new text-only favicon. Existing typography, theme colors, form/navigation containers and interactions were reused. No institutional logo, seal, official color scheme, endorsement, address or tax detail was invented.

## Changes and files

| File | Purpose and scope |
| --- | --- |
| [LoginPage.jsx](../client/src/features/auth/pages/LoginPage.jsx) | Remove ServeFlow image; heading UPHSD Bookstore; application sign-in copy and button brand. Submit handler, state, inputs and authentication calls unchanged |
| [RegisterPage.jsx](../client/src/features/auth/pages/RegisterPage.jsx) | Replace image/header branding with text. Existing form behavior unchanged; public provisioning was not enabled |
| [Layout.jsx](../client/src/shared/components/Layout.jsx) | Replace sidebar image with text using existing theme typography. Shared desktop/mobile sidebar uses this component; navigation, role exposure, focus/drawer effects and logout unchanged |
| [LoadingScreen.jsx](../client/src/shared/components/LoadingScreen.jsx) | Replace image and coffee/food-service messages with bookstore text. Eight-message rotation, five-second interval, existing progress/bounce treatment and readiness integration unchanged. New copy makes no measured progress or fixed wait-time claim |
| [index.html](../client/index.html) | Browser title/application-name and formal-title description; point favicon to bookstore-text.svg. Existing viewport, font link and application entry unchanged |
| [bookstore-text.svg](../client/public/bookstore-text.svg) — new | Plain UPHSD/POS text on a rounded rectangle using the existing teal token value. Explicit provisional title; no university emblem or assertion that the color is official |
| [index.css](../client/src/index.css) | Change only the legacy theme-name comment. No CSS rule, color token or breakpoint changed |
| This report — new | Results, scope, verification and deferred issues |
| `docs/UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md` | Dated additive entry only; historical content preserved |

Dashboard/account/product headings such as Dashboard, Account and POS did not contain obsolete product branding and were not rewritten. Layout supplies the updated application identity. Generic footer/empty-state/toast text remains. Invoice.jsx already printed **UPHSD Bookstore**; its receipt header, price/payment fields, print behavior and thank-you text were preserved, with no receipt/API edits.

The diff contains branding strings, replacement of old brand images with text, the new provisional favicon/metadata and the CSS comment. There was no intentional change to roles, permissions, workflows, API contracts or data handling. No route, hook, controller, model, protected middleware, account mutation helper, price/cost/stock implementation, dependency manifest, lockfile, environment file or deployment configuration was edited.

Final preservation comparison covered179 baseline files: only the six named existing client files and plan changed; the favicon and this report were added; none were removed. All backend files, existing tests, client auth/data hooks, protected/unrelated source, prior reports, environment files and the three pre-existing lockfiles hash-match the baseline. The plan's original49,288 bytes remain an exact prefix. Documentation links resolve and the linked text favicon exists.

## Actual verification

| Check | Result |
| --- | --- |
| Existing client `npm test` | **16 passed;0 failed/cancelled/skipped/TODO**, exit0; matches expected baseline |
| `npm run build -- --outDir <tool-temp>/uphsd-bookstore-phase15a-build` | **PASS exit0**, Vite8.0.3,671 modules; output outside repository, no deployment |
| Build output | HTML0.83kB, CSS44.08kB, JS753.02kB; existing >500kB chunk warning and outside-root output notice remain. No code-splitting/behavior change attempted |
| Targeted installed ESLint: four touched JSX files | Login/Register/Loading each0 errors/0 warnings; **Layout2 pre-existing errors/0 warnings**, both react-hooks/set-state-in-effect. Same file/rule/count before and after; not a clean targeted-lint pass |
| Full client installed ESLint using repository configuration | **FAIL exit1:16 errors/13 warnings across55 files**, unchanged from expected baseline; no new reported lint failures |
| Legacy-string source search | No ServeFlow/LadyPos/Lady Pos match in active `client/src` or `client/index.html` after changes |
| Diff/whitespace review | PASS; edits reviewed as branding-only. Existing unrelated LF/CRLF Git notices remain |
| Browser/accessibility/responsive/print/favicons | **NOT RUN**; no runtime visual, contrast, touch/focus, browser-cache or physical print claim |
| Backend tests/native MongoDB | **NOT RUN** in this phase; backend source was not changed. Prior129 backend passes are historical evidence only |

Targeted/full lint used the already installed ESLint JavaScript API and existing configuration, without installation, fixes or config writes. Before editing, targeted lint established the same two Layout effect errors; their code was left unchanged. Existing tests use SSR/synthetic storage and network-free Axios adapters. No new tests were added for reversible text/asset edits; existing receipt/logout/diagnostic/account-error propagation regressions all remain passing.

No new client test or build failure occurred. Existing lint failures and large-bundle warning remain separate from this branding change. No browser was opened because normal startup polls an environment-defined health endpoint and includes an external font; the no-service-connection boundary was preserved.

## Remaining legacy references

- `public/serveflow.svg` and `serveflow.png` remain as **unreferenced legacy assets**; they were not deleted. Other existing public artwork/React/Vite assets remain untouched. Direct old asset URLs or previously cached pages are not claimed rebranded.
- Package names remain serveflow-pos-client/backend. Internal names are not visible application branding; manifests/lockfiles are expressly outside scope.
- Backend CORS still contains the legacy ServeFlow hosting origin. It is deployment/access configuration, not a cosmetic label; no origin or deployed display name was changed.
- LadyPos/ServeFlow references in historical reports, repository paths and earlier implementation-plan entries remain intact. They record provenance and findings.
- Existing Grab/Foodpanda options, debt/credit/void/expense text, inert registration/recovery affordances and other business UI remain. Altering their exposure or behavior requires separate authorization, rather than treating them as brand substitutions.

## Deferred issues and safeguards

**Product cost-price reset remains deferred and uncorrected.** Mounted ProductPage omits costPrice while ProductController defaults omitted costPrice to0 on update. No product edit, API submission, database inspection or record correction was performed. A separately approved request/default-preservation fix and regression coverage are required; this phase does not restore or infer historical costs.

All five deferred financial/inventory risks remain open: repeated stock deltas, overwritten concurrent adjustments, partial activation, payment resubmission and financial error masking. No kiosk, shared catalog/queue, new role, payment policy, stock ledger, workflow or other feature was implemented.

JWT expiry/token-version/current-account enforcement, bcrypt handling, administrator mutation guards, ObjectId self-delete protection, sanitized diagnostics and A08A-R2 commit-boundary replay protections were preserved. Their backend source and client auth/API hooks were not changed; this is preservation evidence, not a new native security verification.

Official assets are still unavailable; the treatment is provisional. The text brand replaces the old image block, so exact rendered dimensions/wrapping need future authorized visual review. No new accessibility/responsive claim is made. A08B remains blocked/unstarted, provider/database state remains unverified and no release is authorized.

**Stop for review.** No further UI, inventory-cost correction, permissions/workflow change, integration testing or deployment follows automatically.
