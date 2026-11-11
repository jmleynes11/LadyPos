# Requirements and scope inventory

This independent POS audit uses the current code as evidence of intended behavior, not as a substitute for business approval. No POS-specific specification was found; `client/README.md` is generic Vite text. Status **supported** means present in implementation intent, not operationally verified.

| Area | Evidence and supported scope | Uncertainty / disposition |
| --- | --- | --- |
| Product catalog | Product model and `ProductPage.jsx`: name, SKU, category string, price, stock, active state | Bookstore identity, ISBN validation, barcode device, variants and unique SKU policy unconfirmed |
| Inventory | Current stock; active/out-of-stock UI; stock adjustment API; completion deduction and void restoration | Opening balance, receiving, suppliers, low-stock threshold and physical-count rules undefined; movement ledger justified for existing adjustment traceability |
| POS cart | `PosPage.jsx`: product/customer lookup, line add/remove/quantity, subtotal, pending submission | Mandatory customer in active UI conflicts with backend walk-in support; direct versus pending checkout decision required |
| Order processing | `OrdersPage.jsx`, Transaction model: pending/completed/void, completion and debt settlement | Queue is authenticated and owner-scoped; no kiosk/device boundary, claim ownership, expiration or human queue number |
| Payments | Enum cash/gcash/bank/credit and payment reference | Manual recording only; no payment-provider SDK, webhook, verification or reconciliation; clarify meaning of credit as collection method |
| Customer credit | Partial/debt transactions; customer balances; collection and full settlement APIs | Eligibility/limits/approval, walk-in debt, allocation details, backdated payments and reversals undefined |
| Invoices/receipts | Invoice model/counter, invoice list, printable component | Counter format exists; seven-day due date is hardcoded; receipt content, store identity, tax and legal issuance requirements not specified |
| Cancellation | Void transaction restores stock if ledger recorded and marks invoice void | Voiding paid sales has no refund ledger; distinguish pending cancellation from completed-sale reversal |
| Discounts | No model, route or working UI found | Not implemented; exclude until rules and authorization are defined |
| Returns/refunds | No dedicated return/refund/payment reversal records | Not implemented; exclude feature design beyond documenting the gap and avoiding refund claims |
| Reports | Collected amount, outstanding balances, counts, daily/weekly/monthly groups; Expense CRUD | Cash collections versus earned revenue, business timezone, cost of sales, financial statements and reconciliation undefined |
| User roles | User model supports only `admin` and `user`; admin account table; login text says admin-created accounts | Do not invent manager/cashier/inventory roles as approved requirements; record proposed capabilities separately |
| Concurrency | Individual users, conditional stock update, sessions, processedBy | Per-user ownership prevents separate accounts from sharing one stock pool; shared-store deployment unconfirmed |
| External channels | `grab` and `foodpanda` customer type strings | No actual integrations identified; do not describe as online ordering or delivery integration |
| Operational needs | Static SPA plus persistent Express/MongoDB | Target host, LAN/offline use, terminals, printer hardware, expected load, support and recovery objectives undefined |

## Current and proposed authorization

Current: admin manages accounts; both declared roles may mutate their own products. Any authenticated account may access its own customers, orders, debt payments, invoices and reports; expense edit/delete permits creator or admin. This does not establish least privilege for a cashier business.

Proposed baseline justified by existing UI: admin provisions and confirms accounts; users update their own profile; account state is checked on protected requests; all business access is scoped to an authorized data owner. Capability boundaries such as `catalog.write`, `inventory.adjust`, `sale.complete`, `sale.void`, `payment.record`, `report.read` should be enforced by backend policies. Map these to the two existing roles only after the owner/operator policy is recorded. Additional role names and a permissions collection are not required by the evidence.

## Decision register

| ID | Decision needed | Implementation consequence |
| --- | --- | --- |
| R01 | Single independent owner per account or shared store with individual operators | Retain owner=account, or add Store/membership and migrate ownership; no silent sharing |
| R02 | Actual business type and product identifiers | Decide ISBN, category entities, barcode and catalog validation scope |
| R03 | Whether unauthenticated physical kiosk ordering is required | Device-limited catalog/order interface, rate limits and queue numbering only if confirmed; not an online store assumption |
| R04 | Pending-order workflow and stock reservation timing | Existing behavior deducts on completion only; define abandonment/cancellation and stock contention messages |
| R05 | Walk-in and customer-credit eligibility | Decide mandatory named customer for debt/partial, limits and approval |
| R06 | Money units and existing data units | Proposed PHP centavos; existing expense and legacy data require classification before migration |
| R07 | Supported payment methods and evidence of collection | Define tender/change, reference uniqueness scope, credit semantics and payment reversals |
| R08 | Void versus refund/return, discounts and tax | Define authorization, financial reversal and required receipt snapshots before adding these features |
| R09 | Sales/collections reporting or complete accounting | Define event dates, timezone, cost/expense basis and accepted statement formulas; current dashboard is not an income statement |
| R10 | Account status/session policy | Confirm admin provisioning, deactivation versus deletion, token lifetime/revocation and password recovery |
| R11 | Deployment and service targets | Choose host, TLS/domain, DB topology, backup retention, RPO/RTO and measured concurrency target |
| R12 | Invoice numbering, due date and print requirements | Decide uniqueness scope, historical identity snapshots, format and printer acceptance |

Unresolved decisions are blockers for their dependent features, not permission to fabricate requirements. Immediate correction of public admin escalation, plaintext handling, exposed secrets and double payment application does not depend on expanding feature scope.
