# Technical decisions and rationale

All decisions below are recommendations for review, not implemented changes. They derive from this project's own code and requirements inventory.

| ID | Decision | Rationale / alternative | Consequence and acceptance |
| --- | --- | --- | --- |
| D01 | Retain React/Vite/Express/MongoDB | Actual working build and existing schemas/services outweigh migration cost; unused pg does not justify PostgreSQL rewrite | Focus on defects; no framework or database replacement |
| D02 | Keep client/backend package roots and modular monolith | Existing separation fits project size; microservices add consistency/operations burden | One API transaction boundary and one SPA; no duplicate app roots |
| D03 | Domain services own money/stock/issue mutations | Current double payment comes from controller/hook split | Payment service applies once; pure schema validation; no controller request rewriting |
| D04 | Use transaction-capable MongoDB for multi-record invariants | Existing checkout already depends on sessions; nontransactional fallback would weaken correctness | Replica-set integration tests and documented retries; all effects atomic |
| D05 | Standardize PHP integer centavos and integer stock | Active POS/catalog already use centavos; expenses/legacy forms drift | Classify old units before migration; safe integer bounds and exact formatting |
| D06 | Guard inventory writes and retain movement evidence | Conditional checkout decrement is useful; absolute edits lose concurrent changes | Atomic adjustment plus same-session movement/reason; no silent clamp |
| D07 | Persistent scoped idempotency and DB uniqueness | Button disabling and check-before-create cannot serialize retries/races | Unique request/result keys and invoice/counter identities; duplicate analysis first |
| D08 | Retain two existing roles pending policy decision | No requirements establish manager/cashier/inventory role hierarchy | Capability policy documented and enforced; extra roles/membership conditional |
| D09 | Separate data owner from actor conceptually | owner currently equals user; processedBy already hints actor distinction | Keep account scoping until R01; shared Store migration requires explicit mapping, not shared passwords |
| D10 | Retain bearer mechanism during urgent repairs, enforce current account state | Changing transport before fixing privilege/password defects adds scope | Revocation/confirmation/role checks and frontend401 recovery; cookies optional with CSRF/CORS redesign |
| D11 | Stable explicit DTOs over virtual alias dependence | Invoice UI expects a nonexistent shape; populated aliases can turn IDs into objects | Receipt snapshot DTO, consistent envelope and staged adapter migration |
| D12 | Sales reports and collection reports are distinct | Mutable amountPaid grouped by sale createdAt misstates collection dates | Completion-dated sales, payment-dated collections; no unsupported accounting claims |
| D13 | Add useful tests before broad cleanup | Current project has no business safety net; syntax/build cannot prove atomicity | Prioritize meaningful invariant/access/concurrency tests; no implementation-mirroring test volume |
| D14 | Versioned dry-run migrations and restore rehearsal | Index/data changes can damage existing financial history | Protected snapshot, duplicate/unit assessment, staged rollout; no destructive audit changes |
| D15 | Remove public console transport and secret tracking through controlled implementation | Log stream emits connection URI and arbitrary errors | Redacted structured logs/durable audit, controlled credential rotation; history cleanup separately reviewed |
| D16 | Use existing React state until a caching need is demonstrated | React Query declared but unused; introducing it everywhere is unnecessary | Verify dependency usage before remove/adopt; stable callbacks and bounded server paging first |
| D17 | Choose one host configuration and explicit startup contract | Netlify fallback and Apache settings coexist; port hardcoded | Correct actual platform SPA/API/TLS/PORT/CORS checks; no hosting assumption from asset files |
| D18 | Review advisories against exact tree/reachability; no forced automatic fix | npm suggests fixes including a major nodemon downgrade in observed report | Compatible patch selection, test tree, separate production/dev exposure and advisory severities |

## Deferred decisions

Physical kiosk access, human order numbers, reservation/expiry/claiming, shared-store memberships, bookstore fields, barcode hardware, suppliers/receiving, discount/refund policy, tax-compliant receipts, cash shifts and complete accounting all depend on documented business decisions. Do not introduce these as accepted modules. A movement/payment audit trail is justified by existing stock/collection operations, not by speculative new business features.

## Authoritative references consulted on 2026-11-02

- [Mongoose9 migration guide](https://mongoosejs.com/docs/migrating_to_9.html): pre middleware no longer receives next callbacks; relevant to F05.
- [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/): single-document atomicity and multi-document transaction guarantees; relevant to checkout and payment boundaries.
- [Express production security](https://expressjs.com/en/advanced/best-practice-security/): TLS, validated input, abuse control and production security baseline.
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): salted adaptive hashing and secure password handling.

Local source and observed commands establish project findings. External documentation establishes platform behavior/guidance; it does not prove deployed configuration or exploitability. Dependency advisories and their exact observed applicability are recorded in [dependency audit](../audit/dependency-audit.md).
