# UPHSD Bookstore POS — security and integrity review

Date: 2026-11-02. Baseline `2e9942e` plus pre-existing local dependency lock changes. **No remediation, credential rotation, production request, data change, seed or deployment was performed.** Findings describe code and isolated behavior, not an assertion of observed external exploitation or live data loss.

## Release assessment

The application is not ready to release as a bookstore POS on present evidence. Critical registration/password/secret-log defects and linked-payment corruption must be addressed in an explicitly authorized implementation phase. Branding alone cannot make the application safe for kiosk or multi-cashier use.

The independent POS architecture must remain separate from GradeSense AI. No GradeSense imports/integration were found in application search. Do not reuse its authentication, credentials, data or deployment by assumption.

## Findings and evidence

IDs S01–S16 belong to this bookstore review. Prior audit F identifiers remain unchanged in [existing technical findings](audit/technical-findings.md). A01–A07 are checks executed for this request, detailed in [test plan](UPHSD_BOOKSTORE_TEST_PLAN.md).

| ID / severity | Evidence and current behavior | Required future correction / acceptance |
| --- | --- | --- |
| S01 Critical — public privilege grant | UserRoute.js public POST /register; UserController.js:26–28 accepts raw password, role and confirmed, then emits token. A01 obtained an admin token accepted by actual protect/admin guards using synthetic adapters | Protect staff provisioning; public registration must never set admin/confirmation or receive operator access; no privileged kiosk token. Test every registration path including aliases and admin UI |
| S02 Critical — plaintext password path | User model has no pre-save hash hook or matchPassword method; createUser passes raw password. Login uses bcrypt.compare; admin password reset/seed explicitly hash. A01 confirms raw payload/missing method; live credential formats unknown | One tested hash-on-write path for create/reset/change, validated input, compare correctly; approved reset for insecure/unknown old accounts. Never bulk guess formats, log passwords or silently overwrite credentials |
| S03 Critical — tracked credentials and public logs | git ls-files confirms backend/.env tracked; index.js:211 prints MONGO_URI; unauthenticated /logs-stream replays console output, registered before CORS. Public log HTML inserts message using innerHTML | Stop secret logging; remove/protect public diagnostics; controlled credential rotation and history handling require authorized work; safe structured/redacted logs and text rendering. No environment values reproduced here |
| S04 High — identity/profile and self-protection failures | protect produces req.user.id; UserController reads req.user._id for profile/password/self-delete. A02 lookup undefined; password comparison method absent. Frontend useProfile sends functional setter to incompatible wrapper | Canonical identity contract; tests for self-profile/password/self-delete/last-admin policy; update React context safely |
| S05 Critical — duplicated payment effect | DebtPaymentController.js:62 updates sale, then model DebtPayment.js:69 applies it again; error path calls missing next. A05 100 payment changes paid by 200; A06 full payment returns400 | One payment service owns mutation; pure validation in models; event/allocations and balance committed once; duplicate/failure/concurrency tests on real disposable DB |
| S06 High — wrong order settlement customer | markAsPaid delegates with order req.params.id; debt controller gives route ID priority over body customer. A07 confirms wrong ID and400 | Pass explicit typed customer/transaction command into service; no controller-to-controller req mutation; test partial/full/general/linked paths |
| S07 High — stale identity/role/confirmation | protect verifies JWT only; does not reload account, confirmation, existence, current role or membership. Tokens last7days; logout clears browser storage only | Approved session/revocation policy and current-account/membership checks; deactivated/deleted/demoted accounts must lose access; validate issuer/audience/lifetime strategy if introduced |
| S08 High — bookstore permissions absent | ProductRoute grants admin and user equivalent CRUD/stock; order/invoice/payment/expense/dashboard routes largely protect-only. Most owner queries isolate each cashier rather than sharing catalog; expense update/delete also permits global admin | Approve scope/role matrix, then backend capability + membership enforcement and sensitive-field projection; cross-store tests. No cost/sales/account data in kiosk or unauthorized staff responses |
| S09 High — incomplete settlement validation | completionPayload forces amountPaid=total when client requests paid; accepted methods are code enum, not verified funds. Pending UI submits uppercase display status while backend completion rules use lowercase. No persisted tender/change, gateway confirmation or idempotent creation | Validate approved method/amount/evidence and derive status; reject unsupported states, fractional/nonfinite/overflow values; paid state cannot prove tender. Confirm manual electronic verification/credit policy |
| S10 High — inventory races/missing audit | Conditional decrement and DB sessions are useful. Product full update writes absolute stock/defaults; adjustStock is read/add/save and clamps; set-active performs two updates. Completion does not recheck active flag for saved pending lines | Keep Product.stock canonical; atomic conditional delta, same-session movement+actor/reason, no stock metadata overwrite, revalidate approved active/price policy; final-stock and adjustment races |
| S11 High — duplicate effects/numbering | No persistent order/payment submission key; ledgerRecorded short-circuits sequential completion but not an all-path proof. Invoice/counter compound indexes are nonunique (A04); GET ensure writes outside session | Unique scoped numbering and replay identity, conditional state transitions, retry/ambiguous commit resolution; idempotent issue/void/stock commands; constraints after approved data review |
| S12 High — financial/receipt divergence | Invoice-only void changes no sale/payment/stock; sale void restores stock but no refund event. Invoice ensure allows pending sale. Receipt expects items/total fields absent from ensure response | Approved cancellation/refund boundaries; completed sale/payment/inventory/receipt consistency; immutable receipt DTO and history; no new refund policy invented |
| S13 Medium — validation/error exposure | Raw regex search and largely unbounded limits/date/cart input; parseInt silently truncates quantity; model Number allows fractions (A03). User handlers set response status then throw, global middleware uses only err.statusCode or500. Raw messages/stacks can reach logs | Typed allowlists/finite safe bounds/literal bounded search, structured safe error mapping, rate/request limits; test401/403/409/validation and malformed IDs/dates. Do not expose connection strings, PII or stack traces |
| S14 High — misleading report basis | FinancialController sums mutable amountPaid grouped by sale createdAt; no timezone; later payment restates original date. No reliable historical cost/dated initial payment events | Separate completed sales from payment-date collections, timezone/boundary tests, role filtering; never claim profit from revenue or incomplete cost |
| S15 High — fixed privileged seed credential | seedAdmin.js contains fixed admin password and DB-writing startup; not called by normal index.js and not executed here. Existing account state unknown | Explicit one-time controlled provisioning, protected operator-supplied credential/reset; preserve users; no fixed password or secret printed; seed regression checks |
| S16 Medium — missing operational controls | No first-party tests, CI, migration/restore runbooks; tracked backend dependencies; hardcoded port/start-before-DB; readiness gate retries indefinitely; no in-app rate limiter/security headers/durable audit found | Controlled dependency/repository hygiene, validated config/liveness/readiness/shutdown, tested backups and app recovery, deployment hardening; edge/TLS/rate controls may exist externally but are unverified |

## Current controls worth preserving

- JWT signature verification and backend admin guards exist; correct their provisioning and stale-account context rather than replacing the entire auth stack.
- Most product/customer/order/payment/invoice queries include authenticated owner; keep cross-scope protections while deliberately designing shared membership.
- Product price is read from MongoDB during cart building; client totals/prices are not used by that create path. Preserve and extend server authority to state, tender and availability.
- Duplicate product lines are merged; sufficient-stock conditional `$inc` and multi-document session boundaries exist for checkout/void. Preserve these strengths and prove conflict/retry behavior.
- Products/customers soft-delete and model enums/minima provide partial validation; do not mistake these for complete validation, integer safety or access control.

## Session/browser review

AuthContext stores user/JWT in localStorage or sessionStorage; setUser always writes the user to localStorage, and old local JWT can take precedence over newer session JWT. isAuthenticated is based on user object presence. DashboardGuard is authentication-only. apiClient warns on401 but does not revoke/redirect. Client storage logout does not invalidate a stolen token and clears unrelated storage keys.

Select the session design during approved auth work: coherent storage/lifetime/revocation, current account enforcement and safe expiration/error UX. A cookie switch would require CSRF/CORS/SameSite design; do not introduce it silently. Current bearer storage still requires XSS prevention and minimized third-party script exposure. The unauthenticated log innerHTML sink should be removed or safely rendered; exploitability was not tested.

## Input and transaction invariants to enforce

1. Actor and permitted scope come from verified current authentication/membership, never request owner/cashier/role/paymentStatus fields.
2. Positive finite safe integer quantities; nonnegative bounded safe integer amounts; validated dates, enums, IDs, lengths, request size and page limits. Reject fractions/NaN/Infinity, negative/zero quantities, invalid method/reference and overflow.
3. Server computes retail price, line subtotal and order total. Complete only under approved pricing/payment policy and allowed transition. Validate all referenced customer/product records in scope.
4. Product.stock never below zero; no silent clamp or absolute overwrite during unrelated metadata edits. Receiving, sale and reversal effects have traceable authenticated actor and source.
5. Each order/payment/invoice/adjustment effect executes once, despite repeated clicks, client retries, simultaneous cashiers or uncertain network results. Keys and effects persist atomically.
6. Failed multi-item checkout rolls back every change. Printer failure does not roll back/repeat a valid payment. Transaction conflict/commit-uncertainty handling must resolve safely.
7. Paid history is immutable except a separately approved, audited reversal. Pending cancellation must not increment stock that was never deducted. Records/issued numbers are preserved.
8. Financial reports derive from consistent events and correct business dates. Unauthorized responses omit financial/cost/PII fields, rather than merely hiding UI.

## Environment and dependency boundaries

Observed configuration names only: backend MONGO_URI, MONGO_PASS, JWT_SECRET; client VITE_API_URL. MONGO_PASS has no direct application reference found. VITE variables are browser-visible build inputs and must never contain DB/password/token secrets. No values were printed in the audit documents. No configured external endpoint was contacted.

The prior [dependency audit](audit/dependency-audit.md) records earlier npm advisory results. They were **not rerun for this request**; do not present those counts as a fresh scan or proven application exploitability. A future approved security phase should review reachability and compatible fixes, preserve pre-existing lock changes, and run clean-install/regression checks. No dependency installation, upgrade, audit fix or untracking occurred here.

## Authorized next work boundary

Current authorization covers read-only audit/non-destructive checks and these documents. Corrections require explicit implementation-phase approval. Prioritize S01–S03/S05 and safe provisioning before any kiosk/public rollout or feature release. Approval to rebrand alone must not be interpreted as permission to migrate users, merge owner datasets, rotate secrets, remove features or deploy.

See [implementation gates](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md), [database safeguards](UPHSD_BOOKSTORE_DATABASE_REVIEW.md) and [decisions awaiting confirmation](UPHSD_BOOKSTORE_REQUIREMENTS_CONFIRMATION.md).
