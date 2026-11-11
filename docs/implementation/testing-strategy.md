# Testing and quality assurance plan

Current observed results: client build passes, ESLint fails18 errors/13 warnings,38 backend JS syntax checks pass, eight isolated assertions confirm defects/constraint gaps. No existing automated business suite or npm test scripts were found. This document proposes future tests; none of the proposed suites is claimed to pass.

## Tools and isolation

Use the existing Node runtime for pure backend unit tests (`node:test` is sufficient initially). Add an HTTP integration tool only if needed for real Express request assertions. Use a dedicated MongoDB replica set or transaction-capable disposable deployment with synthetic fixtures; mocks cannot certify rollback, uniqueness or write conflicts. Select React component and browser tooling (for example React Testing Library/Vitest and Playwright) in the implementation review; they are not installed by this audit. No new dependency is required for planning.

Test startup must require an explicit test-only URI/database prefix, refuse production environment values, and never import `backend/index.js` to construct a test app. Do not load the checked-in backend.env in tests. Fixtures use synthetic customers/accounts and temporary credentials, redact outputs and clean only their named test DB. Freeze clock/timezone where relevant; use integer centavos and exact assertions, not floating tolerances.

## Risk-based suite

| Layer | Target | Required assertions |
| --- | --- | --- |
| Unit | money/cart/state/payment allocation/capability logic | Exact cents, safe integer bounds, allowed transitions, allocation sums and role/scope decisions |
| Schema | actual Mongoose validation and indexes | Required fields/enums/integers; no side-effect payment hooks; declared unique constraints installed and enforced in test DB |
| API | auth, products, orders, payments, invoices, customers, expenses, reports | DTO/status contract, current-account guard, owner denial, consistent validation and safe error bodies |
| DB integration | checkout/collection/void/stock/index/migration | Session propagation, all-or-nothing commit, write conflict/retry, uniqueness, reconciled history |
| Component | forms/cart/order/payment/receipt/auth transitions | Correct requests and conversions, validation/error/loading, accessibility and no stale state |
| Browser E2E | operator workflows and administrative denials | Actual app/API/DB chain with fixtures; receipt preview, navigation, pagination, expiry and recovery |
| Security | provisioning/password/session/permission/log/abuse | No escalation, hashes only, revocation, access denied, redaction and bounded inputs |
| Performance | catalog/queue/customer aggregation/reports/concurrent checkout | Representative dataset and documented load targets; stable latency/error distribution, no inventory drift |
| Recovery/regression | migrations, restore, app rollback, all resolved findings | Repeated deterministic release checks, no committed transaction loss beyond approved RPO |

## Mandatory scenario matrix

| Scenario | Preconditions | Actions | Expected result | Failure condition |
| --- | --- | --- | --- | --- |
| Anonymous provisioning (F01) | API initialized, no session | POST admin/confirmed body to register |401; no User/token | Any privileged account/token or write |
| Ordinary-user escalation (F01/F22) | Confirmed ordinary user, approved capability map | Create admin/change role/price/stock/void/report without capability |403, no mutation/disclosure | UI hidden but API accepts action |
| Password lifecycle (F02) | New synthetic account and test DB | Provision/login/change/reset password; inspect stored field without printing | Salted hash verifies, no plaintext, old password/session invalidated per policy | Raw password, double hash or missing method |
| Approval and revocation (F13) | Valid session token | Unconfirm/demote/deactivate/delete account then repeat request; expire/logout/reset | Denied according to current policy; clean client auth recovery | Claims remain authoritative after state change |
| Self/last-admin protection (F04) | Sole admin and additional ordinary user | Delete/deactivate self or last admin | Approved policy enforced server-side | Safeguard compares undefined or UI alone prevents action |
| Profile identity/persistence (F04) | Authenticated named account | GET/update profile and identifier, reload browser | Actual account read/updated; serialized resulting user retained | Undefined query ID or invalid/missing stored user JSON |
| Cross-owner references | Two owners with separate catalog/customer/order | Submit other owner's product/customer/payment/invoice IDs |404/403; no populated data leak or write | Foreign owned reference accepted |
| Product numeric validation (F08) | Product API/schema | Negative/fractional/NaN/unsafe stock or centavos, malformed quantity |422 consistent; no coercion into unintended values | parseInt truncates, zero price silently substituted |
| Money roundtrip (F08) | Approved integer-centavo contract | Enter PHP12.34 in product/payment/expense, save/read/display | Stored1234; rendered12.34 everywhere |100x error, amount truncation or mixed report units |
| Last-unit sale race | One active product stock1, two independent authorized operators sharing approved scope | Release two checkout requests simultaneously using separate sessions/keys | Exactly one completed sale; stock0; one invoice/payment/movement set | Two sales, negative stock, orphaned financial effect |
| Adjustment/sale race (F09) | Product stock10 | Race sale1 with adjustment+5 | Final14, traced movements -1/+5 | Final15, lost deduction, clamp or absent movement |
| Metadata/stale form (F09) | Product with cost/sku/stock and stale open edit | Sell stock, then edit name without stock/cost fields | Metadata changed; latest stock/cost/sku preserved | Old stock or defaults overwrite newer values |
| Transaction rollback | Multi-item sale with sufficient initial stock | Inject error after first deduction/before invoice and at each service write | No stock/sale/payment/invoice/key success committed | Partial commit or missing-session effect |
| Duplicate create / lost response (F11) | Same request key and payload | Parallel POST then replay after suppressing response | Same transaction/result; one deduction/invoice | Duplicate sale/effect; retry cannot resolve committed result |
| Idempotency payload conflict | Existing committed key | Reuse with changed cart/amount |409; original result intact | Key silently reused for another operation |
| Pending order semantics | Pending order, no stock reservation | View queue; complete later; submit bad/changed payload | No financial collection until completion; explicit state/payment policy | Pending payment counted as collected or stale edits silently discarded |
| Product deactivated pending (F10) | Pending sale then deactivate product | Complete pending |409; no stock/payment/invoice write | Saved items bypass active eligibility |
| Queue state conflict | Two cashiers allowed same scope, pending order | Complete/complete and complete/cancel races | One terminal transition, deterministic replay/conflict | Duplicate deduction, resurrection or double restoration |
| Linked partial payment (F05) | Completed total1000, paid0, balance1000 | Record100 once and replay | paid100/balance900, one payment/allocation; replay unchanged | paid200, duplicate payment or no allocation |
| Full linked settlement (F05/F06) | Customer ID differs from transaction ID, balance1000 | Settle order through actual pay route | Looks up real customer; paid1000/balance0, no next callback error | Customer lookup by order ID, HTTP400 or duplicate application |
| Customer-wide allocation | Two debts400/600, total1000 | Collect500 oldest-first if policy approved | Allocations400+100, remaining0/500, collection500 | Amount not traceable per sale or totals differ |
| Excess/parallel collection | Outstanding1000, separate sessions | Pay1001; then race800+800 | Excess rejected; at most eligible aggregate committed, consistent invoices | Negative balance, amount clamped or overcollection |
| Payment method/reference | Cash/gcash/bank/credit policies defined | Record missing reference, invalid enum, partial, tender above total | Canonical validation; amountPaid<=total; change separate | Unsupported uppercase state changes semantics; reference dropped |
| Invoice uniqueness (F07) | Eligible sale, counter not yet present | Parallel issue/ensure through supported POST | One invoice/sale and one counter scope; unique number | Duplicate invoice/counter/number or GET creates |
| Invoice lifecycle | Pending and void sales, completed invoice | Attempt issue for invalid state and invoice-only void | Invalid state rejected; sale/invoice policy coherent | Invoice masks live sale or bills pending/void improperly |
| Receipt contract (F12) | Completed sale with issued receipt snapshots | List, filter, view, print/reprint then edit current catalog/account | Correct IDs/items/totals; same historical receipt; read-only reprint | Undefined.map, blank total, object ID request, toast-only print or changing history |
| Void stock/payment semantics | Pending, completed unpaid and completed paid fixtures | Cancel/void/retry each per approved policy | Pending no stock add; once-only restoration; paid refund unsupported or properly linked | Double stock return, disappearing collections, false refund claim |
| Customer deletion | Customer with debt or pending sale | Delete while another request creates credit | Enforced approved invariant; history preserved | Orphan/hidden debt through check/mutate race |
| Expense validation/history | Owned expense amount1000 | Update to negative/fractional, cross-owner edit/delete, legitimate change | Same validation as create; forbidden denied; traceable change | Negative amount accepted, global scope bypass or silent financial loss |
| Reporting dates (F17) | Day1 sale1000, day2 collection400, expense200 | Query sales/collections/outstanding for each day and boundaries | Sales on completion date; collection on paidAt; expenses separate; balance reconciles | Later payment rewrites sale-period collections or unsupported profit total |
| Pagination/search (F16) | >200 products/orders, >50 customers, >20 invoices | Search/page to later records, invalid large/NaN/regex limits | All authorized records accessible; bounded literal queries | Silent missing records or unbounded query |
| Error statuses (F18) | Auth/unique/stock/validation failures | Hit each real HTTP route |401/403/404/409/422 and safe500, stable envelope | Expected auth failure500, stack/secret disclosure |
| Outage/config/shutdown (F21) | Test process, unusable DB or missing env | Boot without config, lose DB, terminate during checkout | Fail fast without values; readiness503; recoverable UI; drain/rollback | Indefinite spinner only, readiness false positive or partial financial effect |
| Backup/migration/rollback | Protected synthetic snapshot, old/new app versions | Dry-run migration, apply in staging, restore, rehearse rollback | Counts/checksums/money/stock/invoice uniqueness reconcile; RPO/RTO met | Unknown unit conversion, data deletion or incompatible rollback |

## Execution order and release gates

First reproduce F01/F02/F03/F05; then fix and run negative/positive regressions. Add actual HTTP tests around identity/error handling and real DB tests around payment/stock/invoice. Complete browser workflows only after stable DTOs. Perform concurrency with genuinely independent sessions, controlled barriers and repeated contention; assert database state, not just response codes.

Each release runs unit/API/integration, critical browser scenarios, lint and production build with deterministic installs. Advisory scan failures are incomplete, never clean. Run migration/restore and performance scenarios when relevant code/data/config changes or before first release. Record command, runtime, fixture version, scope, result, error and limitations; do not infer passing from an unexecuted test definition.
