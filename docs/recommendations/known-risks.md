# Known risks, uncertainties and audit limits

## Requirement decisions not supplied by repository

| Risk / decision | Evidence and consequence | Required disposition / dependent work |
| --- | --- | --- |
| Business identity/catalog scope | ServeFlow UI and food-delivery labels exist; no bookstore specification | Record actual business/product identifier needs; no automatic ISBN/supplier features |
| Shared store versus independent owners | Core owner=authenticated account; separate users have separate stock/queue | R01 before multi-cashier scope/migration; never solve with shared credentials |
| Kiosk workflow | No kiosk auth/interface/device or human queue number | R03/R04 before kiosk development; physical kiosk not assumed online commerce |
| Pending order/payment/reservation | POS creates pending and stores amount preview; stock only deducted on completion | Define accepted funds timing, reservation/cancellation/expiry and queue conflicts |
| Walk-in/customer credit | Active POS requires a customer, backend can create Walk-in, creation skips intended credit check | R05 eligibility and required customer policy before stable contracts |
| Currency/history | Main active POS uses centavos; expenses raw currency; older shapes remain | Classify datasets/fields on restored copy; no blind x100 conversion |
| Financial basis | Dashboard aggregates mutable collected amount by sale creation date | R09 sales/collection/timezone/cost/refund basis before financial statement claims |
| Paid void/refund/return | Void restores stock/hides sale but no refund event | Define safe allowed corrections; paid refunds not claimed or silently implemented |
| Invoice policy | Seven-day due date and year-based counter are hardcoded | R12 number scope/content/credit term/print acceptance; no legal-compliance claim |
| Account/session lifecycle | UI says admin provisioning, public API disagrees; JWT7d cannot revoke | Enforce admin baseline; decide deactivation, recovery, revocation and retention |
| Deployment/service targets | No actual host config or load specification | R11 TLS/host/DB support, operator ownership, concurrency budget and RPO/RTO |

## Verification limits

The live database was never connected. Collection contents, actual installed indexes, MongoDB version/topology, credential strength/privileges, backups and deployed state are unknown. Source-declared indexes do not prove runtime indexes. Isolated payment tests used mocked DB/session adapters and actual model pre-save pipeline; they prove duplicated application logic, not durable DB commit/rollback. No actual financial damage or external compromise is asserted.

The backend was not started because index consumes configured environment and logs its connection URI. No public deployment was visited or attacked. No seed, migration, app deployment, data mutation or dependency installation was performed. No browser visual/hardware printer/accessibility audit, network-loss E2E, concurrent cashier DB test, load test or backup restore was run. Remaining UI files received import/contract/lint/build coverage, not exhaustive manual interaction or pixel review. Generated docs are plans, not evidence those future controls exist.

Advisory access was intermittent: initial scans failed, but retries returned backend8 affected entries (one critical/three high/four moderate) and client22 (twelve high/nine moderate/one low). These are scanner results; deployment reachability and actual exploitation are unverified. Later retry failures do not negate an earlier complete report; never interpret a network failure as a clean scan. Details are in the dependency/verification reports.

## Data and change risks

Existing plaintext or mixed-format passwords may require resets rather than automatic rehashing. Invoice/counter duplicates may prevent unique index installation. Historical stock and payment allocations cannot be reconstructed reliably from current balances alone; represent unproven history explicitly. Account hard deletion can orphan owner/actor references. Secret untracking does not invalidate exposed credentials or remove history. Restoring an old DB after valid new transactions can itself cause data loss.

Three lockfile paths were already modified before the audit. Do not overwrite/revert them or attribute them to this task. Backend/node_modules is tracked and no root/backend ignore exists; cleanup requires a focused reviewed change. This delivery creates populated documentation only, preserves source/config/lockfiles and contains no secret values.

## Required evidence before readiness changes

P0 fixes and controlled credential remediation; current-account/capability allow/deny tests; exact payment/stock/invoice invariants in actual transactions; supported UI receipt/settlement flows; approved currency/report definitions and migration rehearsal; clean lint/build and reviewed dependency advisories; configured staging TLS/PORT/CORS/readiness, restore and rollback evidence. Without these, readiness remains **partially implemented**, regardless of successful compilation.
