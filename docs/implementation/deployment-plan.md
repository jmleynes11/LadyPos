# Deployment and production-readiness plan

No deployment or production-setting change was performed. Hosting/account state, deployed configuration, actual DB topology and backups were not accessed. This plan retains the current two-package system.

## Current commands and evidence

| Context | Command | Current state |
| --- | --- | --- |
| `backend/` | `npm start` -> node index.js | Defined; not run because startup consumes configured URI and logs it |
| `backend/` | `npm run dev` -> nodemon index.js | Defined; not run |
| `client/` | `npm run dev` -> vite | Defined; no proxy configured; default dev origin matches backend localhost5173 allowlist |
| `client/` | `npm run build` -> vite build | Executed with external temporary outDir; pass on Node24.14.0/npm11.9.0, Vite8.0.3 |
| `client/` | `npm run lint` | Executed; fail18 errors/13 warnings |
| `client/` | `npm run preview` | Defined for preview, not a production API process |
| Both | `npm ci` | Proposed clean install check; not executed during audit to avoid replacing existing dependencies/user lock changes |
| Both | npm test | No script; proposed QA must be added |

There is no backend transpilation/build step. Existing dependencies were used; package installations, automatic audit fixes and lock updates were not performed. Pin a tested supported Node runtime and record engine policy in implementation; observed Node24 is not a substitute for deployment compatibility tests.

## Environment manifest — names only

| Name | Current consumer | Required/proposed behavior |
| --- | --- | --- |
| `MONGO_URI` | backend connect and seed | Server secret; validate present at boot; transaction-capable nonproduction/production URI by environment; never log |
| `JWT_SECRET` | sign/verify | Server secret with controlled rotation; reject missing/weak configuration; no public example value |
| `MONGO_PASS` | present in backend.env; no direct source read found | Assess/remove redundancy only in reviewed config change; no value reproduced |
| `VITE_API_URL` | client authApi/apiClient/health fetch | Public build-time API base including `/api`; e.g. `http://localhost:5000/api` in local example; never embed server secrets |
| `PORT` | **proposed**; index currently fixed5000 | Honor hosting runtime port with validated local default |
| `NODE_ENV` | **proposed explicit deployment setting** | Select safe production logs/errors and avoid development runtime |
| `CORS_ALLOWED_ORIGINS` | **proposed**; currently hardcoded array | Validated exact frontend origins, no automatic wildcard credential access |
| test-only DB/config names | **proposed** | Explicit isolated target; refuse accidental production fixture/migration runs |

Client.env exists locally and is ignored. Backend.env is tracked. Values were not printed or copied. Add package-local `.env.example` files with dummy nonsecret values later; root env would resolve inconsistently with current scripts. Vite environment changes require rebuilding static assets. Actual public API base/path correctness was not exercised over HTTP.

## Target deployment

1. Select a static host for `client/dist` after a normal validated build. `public/_redirects` supports Netlify SPA fallback; `.htaccess` supports Apache only. These are alternatives, not evidence of dual production hosting. Verify direct deep links and cache policy on the selected host; `.htaccess` does not configure Netlify.
2. Run persistent Express behind HTTPS on the selected API host/reverse proxy, with validated PORT/config, safe proxy settings and graceful shutdown. A static frontend host does not execute this API automatically. Do not deploy a public log server.
3. Use MongoDB replica-set/managed equivalent supporting the app's multi-document transactions. Require secure DB transport, restricted networking and a least-privilege runtime account; migrations/backups use separate controlled credentials. Confirm topology/version compatibility before release.
4. Configure frontend API URL and exact CORS origin consistently. Current allowlist is localhost5173 and a ServeFlow Netlify origin; target settings must be explicit. Test preflight, denied origins, auth errors and readiness. CORS never substitutes for bearer authorization.

## Readiness gap matrix

| Control | Present now | Outstanding gate |
| --- | --- | --- |
| Static build | Yes, observed pass | Correct deployment env; lint and browser acceptance; bundle budget |
| SPA fallback | Netlify and Apache files | Verify actual selected host/deep links/caching |
| API runtime | start script, hardcoded port | Config validation, PORT, startup readiness, supervision, drain/shutdown |
| DB readiness | `/api/health` connection state and ping | Bounded ping, liveness separation, usable failure UI, deployment probe config |
| TLS/domain | No repo deployment evidence | Actual host/edge certs and secure transport verification |
| Authentication/security | Bearer/JWT plumbing | Resolve P0/P1 auth/password/log/capability issues and throttling/security-header review |
| Transactions | Checkout/payment/void sessions in code | Correct services, replica-set tests, idempotency/retry and uniqueness |
| Migrations/index control | Model declarations only | Versioned dry-run scripts, duplicate/unit assessment, staged unique index rollout |
| Backups/recovery | No repo implementation/evidence | Encrypted backup schedule, retention, restore/reconciliation drill and agreed RPO/RTO |
| Logging/monitoring | Console interception, public SSE and health | Remove exposure; redacted structured logs, durable audit, request IDs and alerts |
| CI/test pipeline | None found | Repeatable install/test/lint/build/advisory/release gates |
| Rollback | No runbook | Matched app/schema versions; preserve new committed transactions; rehearsal |

## Safe release sequence

Before staging, resolve critical security/payment defects, complete current-account authorization and required P1 integrity work. Produce clean-install and test evidence without overwriting existing developer state. Review advisories from a working network; do not auto-upgrade all dependencies. Remove tracked secrets/dependencies through a focused reviewed change and rotate exposed credentials through controlled operations.

Take and test a backup before schema/index changes. Restore a copy into staging, classify mixed currency/credentials/duplicates/orphans and run dry-run migrations. Use expand/backfill/validate/switch; build unique indexes only after analysis and appropriate write controls. Run staging checkout, lost-response retry, debt settlement, receipt, report and concurrent last-stock scenarios. Verify no secret values in app/server/build/host logs.

Set named owners and thresholds for request failure/latency, readiness, transaction abort/write conflict, reconciliation discrepancy and backup freshness. Alert only on actionable failures. Test startup on configured port, DB failure, missing env and termination/drain. Have an operator runbook for credential incident, failed migration, restore and rollback. Production release requires a later explicit action; this audit does not publish anything.

## Backup and rollback

Choose frequency/retention/PITR based on approved RPO/RTO and business loss tolerance; no numbers are invented here. Encrypt backups, restrict access, store separately and monitor success. Restore to an isolated DB and compare document counts, money totals, customer balances, allocations, invoice uniqueness and opening+movement stock. A successful backup job without a restore test is insufficient.

Application rollback points to a known matching artifact/config and compatible expanded schema. Financial writes committed after release cannot be discarded by restoring an old snapshot without reconciliation. Prefer forward repair/compatible rollback where safe; stop affected writes if integrity is uncertain, preserve logs/evidence, and recover through a reviewed operation. Never run destructive down-migrations or production restores as part of this audit.
