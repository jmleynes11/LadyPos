# Phase15F — RBAC technical contract review

Date: 2026-11-03, Asia/Manila. **UPHSD Bookstore POS**.
Formal title: **UPHSD BookstorePOS: Point-of-Sale and Inventory Management System for the University Bookstore**.

**READ-ONLY REVIEW. B01 NOT IMPLEMENTED OR AUTHORIZED.**

## 1. Assessment and governing evidence

**B01 is technically ready for separate local authorization under the bounded contract in section 6.** It is an unattached policy/route-metadata/test batch, not runtime RBAC enforcement. Contract adoption and explicit implementation authorization are still required. No database/provider evidence is needed to write pure eligibility metadata using approved business-role labels; that evidence remains mandatory for later account/resource/native/rollout batches.

Read [Phase15C](UPHSD_BOOKSTORE_PHASE_15C_FINALIZED_ROLE_PERMISSION_SPECIFICATION.md), [Phase15D](UPHSD_BOOKSTORE_PHASE_15D_RBAC_TECHNICAL_IMPACT_ASSESSMENT.md), [Phase15E](UPHSD_BOOKSTORE_PHASE_15E_RBAC_IMPLEMENTATION_BLUEPRINT.md) and the [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md). Phase15C remains authoritative; all 17 exact Phase15B criteria are preserved in section 8. The prior reports and their classifications remain historical evidence, not silently revised.

Four approved roles only: Administrator, Store Manager, Cashier, Customer / Student. Store Manager includes inventory duties. Five settled decisions remain unchanged: Administrator-only pricing; direct audited Manager inventory adjustment; Manager refund/void approval; Manager all-cashier history with Cashier own-only default; both guest and authenticated student ordering. Conditional Administrator/Manager operational duties do not become unconditional hierarchy grants.

This review refines the B01 proposal technically; it does not approve Phase15E's schema recommendations, persisted role keys, account mappings, shared catalog migration, conditional grants, activation policy, audit storage or reversal effects. No new permission is granted by naming a capability.

### Source and verification boundary

Inspected:

- `backend/app.js`, `index.js` startup references and all 11 mounted route modules: UserRoute, ProductRoute, PersonRoute, CustomerRoute, OrderRoute, TransactionRoute, InvoiceRoute, DebtPaymentRoute, FinancialRoute, DashboardRoute, ExpenseRoute.
- `backend/middleware/authMiddleware.js`, `errorMiddleware.js`; User/Product/Person/Order/Invoice/DebtPayment/Financial/Expense controller entry points, aliases and ownership predicates; `models/{User,Order,Person,Expense}.js` and previously documented relationships.
- `utils/{generateToken,tokenPolicy,tokenVersion,accountIdentity,adminAccountMutation,accountCommitBoundary,accountMutationOutcome,responseHelpers,safeErrors}.js` and password handling evidence.
- Relevant existing security/token/account identity/demotion/commit regression assertions, particularly `tests/a03TokenReview.test.js`, `accountIdentity.test.js`, `a04Security.test.js`, `commitReplay.test.js`, `accountFaults.test.js`, `tests/helpers.js`; package scripts as text.
- Installed local Express5.2.1 application.use/factory and router2.2.0 route/method/HEAD behavior; CORS preflight source. No vendor file changed.

Only local reads and documentation checks occurred. No application import/start, endpoint call, server/listener, tests, build, lint, migration, seed, database/provider connection or production/session action occurred. Native database behavior and deployed state remain unverified. Environment contents/secret values were not retrieved.

## 2. Backend policy architecture review

### Existing controls versus gaps

| Layer | Verified source behavior | Implication for B01 |
| --- | --- | --- |
| Authentication | protect verifies HS256, strict temporal/version claims and Mongoose ObjectId validity for the token account ID; fetches current role/confirmed/epoch | Reuse unchanged. B01 must not issue/verify tokens or replace protect |
| Account status | Login checks confirmed (403); protect rejects unconfirmed/missing accounts (401), malformed persisted epoch or failed lookup cannot reach handler | No independent active field exists. Do not interpret this as implemented deactivation |
| Role allowlist | authorizeRoles checks current req.user.role, not JWT role claim; User admin routes and most Product routes use it | Central policy is a future layer, not reason to remove existing allowlists now |
| Protect-only business routes | A valid confirmed account/epoch reaches controller regardless of role, followed mostly by owner scope | Current authentication is not four-role authorization. Schema enum alone does not prove every stored role is valid; a hypothetical unknown persisted role is not rejected by protect itself |
| Controller ownership | Products, customers, transactions, invoices, payments and reports generally use requester owner; expenses use userId/createdBy with a creator-or-admin update/delete exception | Preserve each actual predicate in inventory; no global admin/Manager owner-filter bypass |
| Sensitive account writes | adminAccountFilter pins actor ID/admin/confirmed/epoch; self save CAS; peer target + real actor revision fence in one transaction | Keep admin-specific guard and R2 observer; B01 cannot generalize it |
| Payload-dependent effects | POST order/transaction can complete; PUT order can complete; GET invoice ensure can create | A route-to-one-role table is insufficient; metadata must describe effect/field/state guards |
| Retired handlers | addDebt/updateDebt/deleteDebt return410, no lookup/write | Inventory as protected tombstones, not working debt management or permission to revive them |
| Failure handling | Authentication lookup failure forwards safe error; account indeterminate outcomes retain retryable false; account cleanup isolation exists | Fail closed on access; preserve actual truthful outcome contract; financial paths have separate open risks |

No live malformed account or new exploit was observed. The unknown-role statement is a source-level gap for future binding, not a claim about production data. Existing account-management mutations remain protected by their reviewed specific guards.

### Recommended architecture: four cooperating controls

1. **Role-based base permissions:** exactly the four approved business roles with immutable Phase15C ceilings. One role is not automatically a superset of another.
2. **Capability-based action definitions:** central semantic action vocabulary for routes/services. Different endpoints/aliases that cause the same effect share constraints; a combined body cannot bypass price/stock/payment authority.
3. **Resource ownership and subject scope:** separate current actor, approved bookstore/store, cashier processor and guest/student subject. A permitted capability never substitutes for scoped list/detail/aggregate/receipt queries.
4. **Conditional operational permissions:** Administrator inventory/POS/payment/receipt/reversal and Manager cashier duties only where separately authorized, with approved scope. Unresolved conditions default deny; no client-selected or wildcard grant.

B01 centralizes the first two as pure metadata/eligibility and declares the last two as requirements; actual resource resolution, persistent grant/lifecycle schemas and runtime enforcement belong to later batches. Unknown roles/actions, unsupported input types, unresolved required conditions and missing metadata deny at the helper boundary. Denial in an unattached helper does not change a current endpoint.

A future runtime binding must retain: existing protect -> approved role adapter -> capability check -> mandatory scope/field/state checks -> atomic actor/effect/audit guard -> safe DTO. B01 adds none of these middleware links. Frontend visibility is outside its authority.

## 3. Complete protected route inventory

### Counting and notation

- **11 mounted business routers;60 explicit business method/path pairs:59 protected and1 public login.**
- **23 protected GET templates have implicit HEAD fallback**, giving82 protected explicit-or-derived forms; no explicit HEAD routes were found in the inspected mounted declarations.
- Root GET and /api/health GET are two additional public diagnostics, each also deriving HEAD. Together with login these give3 explicit public registrations,5 public explicit-or-HEAD forms. OPTIONS is middleware-level handling, counted separately.
- Explicit totals:62 application registrations (60 business +2 diagnostics). Derived totals excluding OPTIONS:87 method/template forms (82 protected +5 public). These are source inventory counts, not HTTP acceptance results.
- **P** = Bearer protect required; signature/lifetime/current account/confirmation/epoch checks apply. It does not mean four-role capabilities are already enforced.
- Source paths are canonical registered templates without a trailing root slash. Default Express path case/trailing-slash matching is not a separate permission; future decisions must bind to the resolved route/action, not a raw URL string.
- Role/capability and proposed-policy columns describe **future authorized enforcement**, not current behavior or new grants. OP references retain Phase15E decision IDs. “UNRESOLVED” is an explicit non-executable blocker, never an empty allow-all rule.
- Row scope describes actual controller checks and the later required context. An authenticated request rejected before the controller has no domain effects. Public diagnostic and OPTIONS handlers must never be invoked by a B01 metadata collector.

| Router file | Mount | Protected explicit pairs | Protected derived HEAD |
| --- | --- | --- | --- |
| UserRoute.js | `/api/users` | 7 | 2 |
| ProductRoute.js | `/api/products` | 7 | 2 |
| PersonRoute.js | `/api/people` | 10 | 2 |
| CustomerRoute.js | `/api/customers` | 5 | 2 |
| OrderRoute.js | `/api/orders` | 8 | 2 |
| TransactionRoute.js | `/api/transactions` | 5 | 2 |
| FinancialRoute.js | `/api/financials` | 3 | 3 |
| DashboardRoute.js | `/api/dashboard` | 2 | 2 |
| InvoiceRoute.js | `/api/invoices` | 6 | 4 |
| DebtPaymentRoute.js | `/api/debt-payments` | 2 | 1 |
| ExpenseRoute.js | `/api/expenses` | 4 | 1 |

### /api/users — 7 protected registrations

Evidence: [UserRoute.js](../backend/routes/UserRoute.js), [UserController.js](../backend/controllers/UserController.js). Route-source line numbers below identify declarations; handlers/aliases are traced to controller bodies.

| ID | HTTP method | Registered path | Authentication | Current authorization / handler evidence | Required approved role or capability | Resource ownership / scope requirement | Proposed later policy (not B01 attachment) | Related criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R01 | POST | `/api/users/register` | P | admin + actor-version fence/transaction; UserController.createUser; `createUser` (route line18) | Administrator: account.create + role/confirmation assignment constraints | Application account realm; actor guard, not owner=requester; new target | B02/B04: keep admin-only guarded provisioning; reject injected privileges outside approved fields | RB01/RB02/RB03/RB04/RB13/RB14/RB17 |
| R02 | GET | `/api/users/profile` | P | protect only; getProfile excludes password; `getProfile` (route line22) | Authenticated self profile (existing compatibility; no staff authority) | Current req.user.id only | B02/B10: preserve self scope; review safe capability/profile projection later | RB02/RB03/RB06/RB15 |
| R03 | PUT | `/api/users/profile` | P | protect; self-field whitelist; saveAccountMutation; `updateProfile` (route line 23) | Authenticated self nonprivileged edit | Current req.user.id; no requested target | B02: privilege fields cannot be assigned via profile; existing controller ignores them; proposed rejection requires later contract review | RB02/RB03/RB04/RB06/RB14 |
| R04 | PUT | `/api/users/password` | P | protect; verifies current password, security save hashes/advances epoch; `updatePassword` (route line24) | Authenticated self password change | Current req.user.id; current-password verification | B02/B04: preserve atomic password+epoch, unknown outcome and audit consistency | RB02/RB03/RB04/RB13/RB14/RB17 |
| R05 | GET | `/api/users` | P | admin allowlist; lists application users without password; `getUsers` (route line27) | Administrator: account.list | Whole account realm; no owner filter; legitimacy not proven by role | B02: retain admin-only list, approved fields/pagination; no Manager access | RB02/RB04/RB06/RB07 |
| R06 | PUT | `/api/users/:id` | P | admin; canonical target helper; actor guard and epoch-checked save; `updateUser` (route line28) | Administrator: account.update; assignRole/confirm/reset as payload requires | Target account ID; self CAS or cross-target actor fence + transaction | B02/B04: preserve guard, validate each security field, advance epoch atomically; no broad Manager guard | RB01/RB02/RB03/RB04/RB13/RB14/RB17 |
| R07 | DELETE | `/api/users/:id` | P | admin; canonical self-delete400 before session/deletion; guarded peer delete; `deleteUser` (route line29) | Administrator: account.delete; canonical self prohibition | Validated target ID; no self; peer target and actor fenced together | B02: retain existing self block and hard-delete convention; no new deactivation/deletion policy selected | RB02/RB04/RB05/RB13/RB14/RB17 |

### /api/products — 7 protected registrations

Evidence: [ProductRoute.js](../backend/routes/ProductRoute.js), [ProductController.js](../backend/controllers/ProductController.js). Route-source line numbers below identify declarations; handlers/aliases are traced to controller bodies.

| ID | HTTP method | Registered path | Authentication | Current authorization / handler evidence | Required approved role or capability | Resource ownership / scope requirement | Proposed later policy (not B01 attachment) | Related criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R08 | POST | `/api/products` | P | admin/user allowlist; productPayload includes price/cost/stock; `createProduct` (route line18) | Administrator: catalog.manage + product.price.write; stock/cost effects separately gated | Server sets owner=req.user.id; later approved store membership | B05: field gates and price audit; initial stock/availability/cost OP05/OP09 unresolved | RB02/RB06/RB07/RB08/RB12/RB17 |
| R09 | GET | `/api/products` | P | admin/user allowlist; owner-scoped full model list; `getProducts` (route line18) | Cashier sale-safe read; Manager price/availability monitor; Admin management view | owner=req.user.id plus search/category/active/count filters | B03/B05: scope+DTO per capability; no guest/student access to raw staff output; safe customer contract later | RB02/RB06/RB07/RB11/RB12 |
| R10 | GET | `/api/products/:id` | P | admin/user allowlist; owner-scoped full product; `getProductById` (route line 23) | Same role/field distinctions as product list | Product ID AND owner=req.user.id | B03/B05: same object/field rules on detail; no cost/owner leakage through ID | RB02/RB06/RB07/RB11/RB12 |
| R11 | PUT | `/api/products/:id` | P | admin/user allowlist; shared price/cost/stock payload; omitted cost resets0; `updateProduct` (route line 23) | Administrator catalog/price; independent stock/cost authority required | Product ID AND owner=req.user.id | B05: reject unauthorized price/stock aliases, preserve omitted fields under separate fix approval; audit | RB02/RB06/RB07/RB08/RB12/RB17 |
| R12 | DELETE | `/api/products/:id` | P | admin/user allowlist; sets isActive=false, does not delete record; `deleteProduct` (route line 23) | Candidate Admin catalog availability; exact activation contract OP09 | Product ID AND owner=req.user.id | B05: keep historical data; Manager monitoring is not an availability-edit grant; no inferred authority | RB02/RB06/RB07/RB12/RB17 |
| R13 | PATCH | `/api/products/:id/stock` | P | admin/user allowlist; owner read-add-save with zero clamp; `adjustStock` (route line29) | Manager inventory.adjust directly; Admin only if authorized; Cashier/Customer denied | Product ID AND owner=req.user.id; future approved store scope | B07: validated atomic delta+reason/movement/effect identity; price injection forbidden; no second approver | RB02/RB06/RB07/RB08/RB10/RB12/RB17 |
| R14 | POST | `/api/products/set-active` | P | protect only (also redundantly protect on route); two updateMany writes; `setActiveProducts` (route line30) | Candidate Admin catalog availability; OP09 authority/atomicity gate | All affected records owner=req.user.id; requested IDs intersect owner | B05: explicit alias gate; no broad Manager grant; partial-activation risk remains separately scoped | RB02/RB06/RB07/RB12/RB17 |

### /api/people — 10 protected registrations

Evidence: [PersonRoute.js](../backend/routes/PersonRoute.js), [PersonController.js](../backend/controllers/PersonController.js). Route-source line numbers below identify declarations; handlers/aliases are traced to controller bodies.

| ID | HTTP method | Registered path | Authentication | Current authorization / handler evidence | Required approved role or capability | Resource ownership / scope requirement | Proposed later policy (not B01 attachment) | Related criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R15 | POST | `/api/people` | P | protect only; server-owned contact creation; `createPerson` (route line20) | Standalone contact create delegation UNRESOLVED (OP05); no staff right for Customer role | owner=req.user.id server assigned | Later deny unassigned new-role operation until approved; checkout-internal contact resolution is not standalone CRUD authority | RB01/RB02/RB04/RB06/RB07/RB11 |
| R16 | GET | `/api/people` | P | protect; owner/customer aggregate includes balances and sales; `getPeople` (route line20) | Contact/financial read must decompose to approved own/oversight scope; standalone grant OP05 | owner=req.user.id and nondeleted customer; lookup transactions also owner scoped | B03/B06: filter contact, debt, transaction and aggregate fields; not a student own-order API | RB02/RB06/RB07/RB11/RB12 |
| R17 | GET | `/api/people/:id` | P | protect; returns customer + sales/payments/invoices/debt summary; `getPersonById` (route line22) | Approved scoped history/receipt/PII subset; standalone contact grant OP05 | Customer ID+owner; linked transaction/payment/invoice queries also owner | B03/B06: per-linked-record cashier/student privacy; no blanket contact ID grants | RB02/RB06/RB07/RB11/RB12 |
| R18 | PUT | `/api/people/:id` | P | protect only; owner/nondeleted contact whitelist; `updatePerson` (route line22) | Standalone contact update UNRESOLVED (OP05) | Customer ID+owner; isDeleted != true | B03/B06: preserve contact whitelist; no role/student binding by supplied name/email | RB01/RB02/RB04/RB06/RB11 |
| R19 | DELETE | `/api/people/:id` | P | protect; soft delete unless unpaid completed balance exists; `deletePerson` (route line22) | Standalone contact deactivation UNRESOLVED (OP05); not financial delete | Customer ID+owner; unpaid-balance query owner scoped | Preserve unpaid-balance and history safeguards; no new financial/role authority | RB02/RB06/RB09/RB10 |
| R20 | POST | `/api/people/:id/debts` | P | protect; unconditional410, no database query/write; `addDebt` (route line24) | RETIRED: no new capability or grant | No object lookup/effect in this tombstone handler | Keep authenticated410; do not revive retired debt creation in B01 | RB02/RB09/RB10 |
| R21 | POST | `/api/people/:id/payments` | P | protect; delegates createDebtPayment using customer route ID; `addPayment` (route line25) | Cashier payment.record; Admin/Manager conditional; retained credit/effects OP08 | Customer params.id AND owner; optional linked transaction must match both | B07: same collection scope/field/state gates as direct payment route; no alias bypass | RB02/RB06/RB10/RB12/RB14/RB17 |
| R22 | POST | `/api/people/:id/pay-all` | P | protect; owner balance aggregate then delegates collection; `payAllDebts` (route line26) | Same payment.record conditions; OP08 settlement semantics | Owner+customer unpaid completed transactions; delegate checks customer owner | B07: no wider privilege via full-settlement alias; retained policy not invented | RB02/RB06/RB10/RB12/RB14/RB17 |
| R23 | PUT | `/api/people/:id/debts/:debtId` | P | protect; unconditional410 immutable-record message; `updateDebt` (route line28) | RETIRED: no new capability or grant | No object lookup/effect in this tombstone handler | Keep authenticated410; no editable completed-ledger policy | RB02/RB09/RB10 |
| R24 | DELETE | `/api/people/:id/debts/:debtId` | P | protect; unconditional410 immutable-record message; `deleteDebt` (route line29) | RETIRED: no new capability or grant | No object lookup/effect in this tombstone handler | Keep authenticated410; no delete financial-record capability | RB02/RB09/RB10 |

### /api/customers — 5 protected registrations

Evidence: [CustomerRoute.js](../backend/routes/CustomerRoute.js), [PersonController.js](../backend/controllers/PersonController.js). Route-source line numbers below identify declarations; handlers/aliases are traced to controller bodies.

| ID | HTTP method | Registered path | Authentication | Current authorization / handler evidence | Required approved role or capability | Resource ownership / scope requirement | Proposed later policy (not B01 attachment) | Related criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R25 | POST | `/api/customers` | P | protect only; server-owned contact creation; `createCustomer` (route line14) | Standalone contact create delegation UNRESOLVED (OP05); no staff right for Customer role | owner=req.user.id server assigned | Later deny unassigned new-role operation until approved; checkout-internal contact resolution is not standalone CRUD authority | RB01/RB02/RB04/RB06/RB07/RB11 |
| R26 | GET | `/api/customers` | P | protect; owner/customer aggregate includes balances and sales; `getCustomers` (route line14) | Contact/financial read must decompose to approved own/oversight scope; standalone grant OP05 | owner=req.user.id and nondeleted customer; lookup transactions also owner scoped | B03/B06: filter contact, debt, transaction and aggregate fields; not a student own-order API | RB02/RB06/RB07/RB11/RB12 |
| R27 | GET | `/api/customers/:id` | P | protect; returns customer + sales/payments/invoices/debt summary; `getCustomerById` (route line15) | Approved scoped history/receipt/PII subset; standalone contact grant OP05 | Customer ID+owner; linked transaction/payment/invoice queries also owner | B03/B06: per-linked-record cashier/student privacy; no blanket contact ID grants | RB02/RB06/RB07/RB11/RB12 |
| R28 | PUT | `/api/customers/:id` | P | protect only; owner/nondeleted contact whitelist; `updateCustomer` (route line15) | Standalone contact update UNRESOLVED (OP05) | Customer ID+owner; isDeleted != true | B03/B06: preserve contact whitelist; no role/student binding by supplied name/email | RB01/RB02/RB04/RB06/RB11 |
| R29 | DELETE | `/api/customers/:id` | P | protect; soft delete unless unpaid completed balance exists; `deleteCustomer` (route line15) | Standalone contact deactivation UNRESOLVED (OP05); not financial delete | Customer ID+owner; unpaid-balance query owner scoped | Preserve unpaid-balance and history safeguards; no new financial/role authority | RB02/RB06/RB09/RB10 |

### /api/orders — 8 protected registrations

Evidence: [OrderRoute.js](../backend/routes/OrderRoute.js), [OrderController.js](../backend/controllers/OrderController.js). Route-source line numbers below identify declarations; handlers/aliases are traced to controller bodies.

| ID | HTTP method | Registered path | Authentication | Current authorization / handler evidence | Required approved role or capability | Resource ownership / scope requirement | Proposed later policy (not B01 attachment) | Related criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R30 | POST | `/api/orders` | P | protect only; server catalog prices; may create pending OR complete with effects; `createOrder` (route line21) | Staff sale.process; payment.record/receipt.issue/effect checks if completion; Admin/Manager conditional | Owner set from current actor; products/customer constrained to owner | B05/B07: command/effect-aware gate, not order.submit public right; client state cannot authorize sale/payment | RB02/RB06/RB07/RB10/RB11/RB12/RB17 |
| R31 | GET | `/api/orders` | P | protect only; owner-scoped list, filters and related invoices; `getOrders` (route line24) | Cashier own history; Manager/Admin approved all history; assigned queue access distinct | owner=req.user.id; filters only narrow; related invoices also owner | B03/B06: approved store/processor/status scope+DTO; no unfiltered Manager query | RB02/RB06/RB07/RB11/RB12 |
| R32 | GET | `/api/orders/:id` | P | protect only; owner target + linked invoice/payment detail; `getOrderById` (route line27) | Same own/all history or narrow fulfillment role rules | Transaction ID+owner; related invoice/payment queries owner+transaction | B03/B06: identical linked object/receipt privacy; Cashier cross-history denied | RB02/RB06/RB07/RB11/RB12 |
| R33 | PUT | `/api/orders/:id` | P | protect; owner target; body may select completion path; completed editing blocked; `updateOrder` (route line30) | Approved fulfillment/sale.process; payment/receipt guards when completing; conditional Admin/Manager | Transaction ID+owner, not voided; products/customer same owner | B07: every branch needs state/effect checks, no status-based permission bypass | RB02/RB06/RB07/RB09/RB10/RB12/RB17 |
| R34 | PATCH | `/api/orders/:id/pay` | P | protect; owner transaction then explicit customer/transaction collection context; `markAsPaid` (route line32) | Cashier payment.record; Admin/Manager conditional; target/credit rules OP08/OP10 | Transaction ID+owner; delegated customer+transaction+owner validation | B07: approved balance collection target, never broaden to peer history or payment without scope | RB02/RB06/RB10/RB12/RB14/RB17 |
| R35 | PATCH | `/api/orders/:id/complete` | P | protect (global+route); injects completed then delegates updateOrder; `markAsCompleted` (route line33) | Cashier approved sale completion; Admin/Manager conditional; associated payment/receipt effects | Same scoped target and linked data as updateOrder | B07: same command/actor/state/effect boundary as PUT completion branch | RB02/RB06/RB10/RB12/RB17 |
| R36 | PATCH | `/api/orders/:id/void` | P | protect only; owner transaction; restores recorded stock and marks invoice/order void; `voidTransaction` (route line34) | Manager reversal approval/application; Cashier request-only, cannot call application; Admin conditional | Transaction ID+owner; linked product/invoice updates owner constrained | B09: unified reason/approval/audit/effect service; OP08 blocks money/stock policy implementation | RB02/RB06/RB08/RB09/RB10/RB12/RB17 |
| R37 | DELETE | `/api/orders/:id` | P | protect; alias directly invokes voidTransaction (not hard order delete); `deleteOrder` (route line37) | Same Manager reversal application gate; no Cashier delete shortcut | Same target/linked scope as voidTransaction | B09: identical gate for DELETE and PATCH aliases; preserve original history | RB02/RB06/RB09/RB10/RB12/RB17 |

### /api/transactions — 5 protected registrations

Evidence: [TransactionRoute.js](../backend/routes/TransactionRoute.js), [OrderController.js](../backend/controllers/OrderController.js). Route-source line numbers below identify declarations; handlers/aliases are traced to controller bodies.

| ID | HTTP method | Registered path | Authentication | Current authorization / handler evidence | Required approved role or capability | Resource ownership / scope requirement | Proposed later policy (not B01 attachment) | Related criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R38 | POST | `/api/transactions` | P | protect only; server catalog prices; may create pending OR complete with effects; `createTransaction` (route line14) | Staff sale.process; payment.record/receipt.issue/effect checks if completion; Admin/Manager conditional | Owner set from current actor; products/customer constrained to owner | B05/B07: command/effect-aware gate, not order.submit public right; client state cannot authorize sale/payment | RB02/RB06/RB07/RB10/RB11/RB12/RB17 |
| R39 | GET | `/api/transactions` | P | protect only; owner-scoped list, filters and related invoices; `getTransactions` (route line14) | Cashier own history; Manager/Admin approved all history; assigned queue access distinct | owner=req.user.id; filters only narrow; related invoices also owner | B03/B06: approved store/processor/status scope+DTO; no unfiltered Manager query | RB02/RB06/RB07/RB11/RB12 |
| R40 | GET | `/api/transactions/:id` | P | protect only; owner target + linked invoice/payment detail; `getTransactionById` (route line15) | Same own/all history or narrow fulfillment role rules | Transaction ID+owner; related invoice/payment queries owner+transaction | B03/B06: identical linked object/receipt privacy; Cashier cross-history denied | RB02/RB06/RB07/RB11/RB12 |
| R41 | PATCH | `/api/transactions/:id/pay` | P | protect; owner transaction then explicit customer/transaction collection context; `markAsPaid` (route line16) | Cashier payment.record; Admin/Manager conditional; target/credit rules OP08/OP10 | Transaction ID+owner; delegated customer+transaction+owner validation | B07: approved balance collection target, never broaden to peer history or payment without scope | RB02/RB06/RB10/RB12/RB14/RB17 |
| R42 | PATCH | `/api/transactions/:id/void` | P | protect only; owner transaction; restores recorded stock and marks invoice/order void; `voidTransaction` (route line17) | Manager reversal approval/application; Cashier request-only, cannot call application; Admin conditional | Transaction ID+owner; linked product/invoice updates owner constrained | B09: unified reason/approval/audit/effect service; OP08 blocks money/stock policy implementation | RB02/RB06/RB08/RB09/RB10/RB12/RB17 |

### /api/financials — 3 protected registrations

Evidence: [FinancialRoute.js](../backend/routes/FinancialRoute.js), [FinancialController.js](../backend/controllers/FinancialController.js). Route-source line numbers below identify declarations; handlers/aliases are traced to controller bodies.

| ID | HTTP method | Registered path | Authentication | Current authorization / handler evidence | Required approved role or capability | Resource ownership / scope requirement | Proposed later policy (not B01 attachment) | Related criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R43 | GET | `/api/financials/summary` | P | protect; delegates owner aggregate summary; `getFinanceSummary` (route line7) | Manager/Admin salesReport.all; Cashier own summary only through approved bounded DTO | Aggregate match owner=req.user.id, completed/nonvoided; recent/customer data same owner | B06: same scope in totals/recent/counts; current full summary not automatically Cashier-safe | RB02/RB06/RB07/RB12 |
| R44 | GET | `/api/financials/dashboard-summary` | P | protect; owner totals and recent transactions/customers; `getSummary` (route line8) | Same management report / separate personal-summary distinction | owner=req.user.id in aggregates and detail/count queries | B06: role+scope+projection; alias cannot leak all cashier data or cost/PII | RB02/RB06/RB07/RB12 |
| R45 | GET | `/api/financials/revenue` | P | protect; owner completed/nonvoided amountPaid grouping by createdAt; `getRevenueByRange` (route line9) | Manager/Admin reports; Cashier personal summary only after approved projection | Owner AND validated permitted range/cashier/store filters later | B06: scope full aggregate, not first page; no profit claim or unapproved calculation change | RB02/RB06/RB07/RB12 |

### /api/dashboard — 2 protected registrations

Evidence: [DashboardRoute.js](../backend/routes/DashboardRoute.js), [FinancialController.js](../backend/controllers/FinancialController.js). Route-source line numbers below identify declarations; handlers/aliases are traced to controller bodies.

| ID | HTTP method | Registered path | Authentication | Current authorization / handler evidence | Required approved role or capability | Resource ownership / scope requirement | Proposed later policy (not B01 attachment) | Related criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R46 | GET | `/api/dashboard/summary` | P | protect; owner totals and recent transactions/customers; `getSummary` (route line8) | Same management report / separate personal-summary distinction | owner=req.user.id in aggregates and detail/count queries | B06: role+scope+projection; alias cannot leak all cashier data or cost/PII | RB02/RB06/RB07/RB12 |
| R47 | GET | `/api/dashboard/revenue` | P | protect; owner completed/nonvoided amountPaid grouping by createdAt; `getRevenueByRange` (route line9) | Manager/Admin reports; Cashier personal summary only after approved projection | Owner AND validated permitted range/cashier/store filters later | B06: scope full aggregate, not first page; no profit claim or unapproved calculation change | RB02/RB06/RB07/RB12 |

### /api/invoices — 6 protected registrations

Evidence: [InvoiceRoute.js](../backend/routes/InvoiceRoute.js), [InvoiceController.js](../backend/controllers/InvoiceController.js). Route-source line numbers below identify declarations; handlers/aliases are traced to controller bodies.

| ID | HTTP method | Registered path | Authentication | Current authorization / handler evidence | Required approved role or capability | Resource ownership / scope requirement | Proposed later policy (not B01 attachment) | Related criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R48 | POST | `/api/invoices/create/:orderId` | P | protect; delegates getOrCreateInvoice; can issue invoice/counter write; `createInvoiceFromOrder` (route line14) | Cashier receipt.issue in allowed scope; Admin/Manager conditional | Transaction ID+owner before invoice creation; counter/invoice same owner | B06: issuance is not mere history read; eligibility/issue contract OP09 | RB02/RB06/RB09/RB10/RB12/RB17 |
| R49 | GET | `/api/invoices` | P | protect; owner invoice list with populated customer/transaction; `getInvoices` (route line15) | Scoped existing receipt/history read (Cashier own; Manager/Admin approved oversight) | Invoice owner; related population needs explicit future subject/field review | B06: receipt read distinct from issue, private linked fields filtered | RB02/RB06/RB07/RB11/RB12 |
| R50 | GET | `/api/invoices/order/:orderId/ensure` | P | protect; GET can increment counter/create invoice if absent; `getOrCreateInvoice` (route line16) | receipt.issue when effect possible; Cashier scoped, Admin/Manager conditional | Valid transaction ID+owner; invoice/counter owner from transaction | B06: GET and inherited HEAD are effectful; all-history read does not grant issue; OP09 read/write split | RB02/RB06/RB07/RB09/RB10/RB12/RB17 |
| R51 | GET | `/api/invoices/transaction/:transactionId/ensure` | P | protect; GET can increment counter/create invoice if absent; `getOrCreateInvoice` (route line17) | receipt.issue when effect possible; Cashier scoped, Admin/Manager conditional | Valid transaction ID+owner; invoice/counter owner from transaction | B06: GET and inherited HEAD are effectful; all-history read does not grant issue; OP09 read/write split | RB02/RB06/RB07/RB09/RB10/RB12/RB17 |
| R52 | GET | `/api/invoices/:id` | P | protect; owner invoice detail/populated receipt DTO; `getInvoiceById` (route line18) | Same scoped receipt/history read; not Customer staff API | Invoice ID+owner; populated contact/transaction data | B06: no cross-cashier/student ID access; minimal DTO | RB02/RB06/RB07/RB11/RB12 |
| R53 | PATCH | `/api/invoices/:id/void` | P | protect; independent owner invoice status update, no Manager approval; `markVoid` (route line19) | Manager reversal approval/application; Cashier request-only; Admin conditional | Invoice ID+owner; existing handler does not coordinate original sale reversal | B09: cannot remain independent invoice-only bypass; money/stock effects OP08 unresolved | RB02/RB06/RB09/RB10/RB12/RB17 |

### /api/debt-payments — 2 protected registrations

Evidence: [DebtPaymentRoute.js](../backend/routes/DebtPaymentRoute.js), [DebtPaymentController.js](../backend/controllers/DebtPaymentController.js). Route-source line numbers below identify declarations; handlers/aliases are traced to controller bodies.

| ID | HTTP method | Registered path | Authentication | Current authorization / handler evidence | Required approved role or capability | Resource ownership / scope requirement | Proposed later policy (not B01 attachment) | Related criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R54 | POST | `/api/debt-payments` | P | protect; transactional collection; no role capability check; `createDebtPayment` (route line8) | Cashier payment.record; Admin/Manager conditional; OP08 methods/effects | Customer ID+owner; optional transaction same owner/customer and eligible balance | B07: common payment capability and current actor/state/effect checks; no unsafe resubmission | RB02/RB06/RB10/RB12/RB14/RB17 |
| R55 | GET | `/api/debt-payments` | P | protect; owner payment list with customer/transaction fields; `getDebtPayments` (route line8) | Payment/history read at approved Cashier personal vs Manager/Admin oversight scope | owner=req.user.id; optional customer/transaction filters narrow it | B06: inherited contact/payment detail access must match transaction scope | RB02/RB06/RB07/RB11/RB12 |

### /api/expenses — 4 protected registrations

Evidence: [ExpenseRoute.js](../backend/routes/ExpenseRoute.js), [ExpenseController.js](../backend/controllers/ExpenseController.js). Route-source line numbers below identify declarations; handlers/aliases are traced to controller bodies.

| ID | HTTP method | Registered path | Authentication | Current authorization / handler evidence | Required approved role or capability | Resource ownership / scope requirement | Proposed later policy (not B01 attachment) | Related criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R56 | POST | `/api/expenses` | P | protect only; sets userId and createdBy current actor; `createExpense` (route line12) | Expense authority UNRESOLVED OP05, including no default Manager grant | Server userId/createdBy=req.user.id | Preserve module; no new-role expense grant until approved; B01 manifest marks unresolved | RB02/RB04/RB06/RB07 |
| R57 | GET | `/api/expenses` | P | protect only; list userId=current actor; `getExpenses` (route line13) | Expense/report authority UNRESOLVED OP05 | userId=req.user.id AND date filter | Later reviewed role/scope only; reporting right does not imply expense CRUD | RB02/RB06/RB07 |
| R58 | PUT | `/api/expenses/:id` | P | protect; creator OR admin (after target load); `updateExpense` (route line14) | Expense update authority UNRESOLVED OP05; no default Manager grant | createdBy=current actor OR persisted admin role; unlike owner-only resources | Explicitly record current admin override; future approved scope must replace neither blindly nor globally | RB02/RB06/RB07/RB12 |
| R59 | DELETE | `/api/expenses/:id` | P | protect; creator OR admin (after target load); `deleteExpense` (route line15) | Expense delete authority UNRESOLVED OP05; no financial-history delete grant inferred | createdBy=current actor OR persisted admin role | Keep distinct from order void; no new-role expense/delete policy guessed | RB02/RB06/RB07/RB09 |

### Derived protected HEAD forms — 23

The installed router2.2.0 implements HEAD-to-GET fallback when no explicit HEAD is registered (`backend/node_modules/router/lib/route.js`, _handlesMethod/dispatch/_methods). The listed controls inherit the referenced GET row completely, including scope/field/conditional requirements; this is not a second weaker policy. Express suppresses the response body, not controller execution. These semantics were inspected in local source, not exercised with requests.

| ID | Method | Path | Authentication | Current/proposed policy and ownership inheritance | Effect caveat | Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| H02 | HEAD | `/api/users/profile` | P; same guard as R02 | R02: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB03/RB06/RB15 |
| H05 | HEAD | `/api/users` | P; same guard as R05 | R05: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB04/RB06/RB07 |
| H09 | HEAD | `/api/products` | P; same guard as R09 | R09: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB11/RB12 |
| H10 | HEAD | `/api/products/:id` | P; same guard as R10 | R10: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB11/RB12 |
| H16 | HEAD | `/api/people` | P; same guard as R16 | R16: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB11/RB12 |
| H17 | HEAD | `/api/people/:id` | P; same guard as R17 | R17: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB11/RB12 |
| H26 | HEAD | `/api/customers` | P; same guard as R26 | R26: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB11/RB12 |
| H27 | HEAD | `/api/customers/:id` | P; same guard as R27 | R27: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB11/RB12 |
| H31 | HEAD | `/api/orders` | P; same guard as R31 | R31: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB11/RB12 |
| H32 | HEAD | `/api/orders/:id` | P; same guard as R32 | R32: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB11/RB12 |
| H39 | HEAD | `/api/transactions` | P; same guard as R39 | R39: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB11/RB12 |
| H40 | HEAD | `/api/transactions/:id` | P; same guard as R40 | R40: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB11/RB12 |
| H43 | HEAD | `/api/financials/summary` | P; same guard as R43 | R43: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB12 |
| H44 | HEAD | `/api/financials/dashboard-summary` | P; same guard as R44 | R44: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB12 |
| H45 | HEAD | `/api/financials/revenue` | P; same guard as R45 | R45: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB12 |
| H46 | HEAD | `/api/dashboard/summary` | P; same guard as R46 | R46: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB12 |
| H47 | HEAD | `/api/dashboard/revenue` | P; same guard as R47 | R47: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB12 |
| H49 | HEAD | `/api/invoices` | P; same guard as R49 | R49: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB11/RB12 |
| H50 | HEAD | `/api/invoices/order/:orderId/ensure` | P; same guard as R50 | R50: same handler, role/capability, owner/scope and proposed policy; response has no body | May issue invoice/counter exactly as GET; source-derived, runtime not tested | RB02/RB06/RB07/RB09/RB10/RB12/RB17 |
| H51 | HEAD | `/api/invoices/transaction/:transactionId/ensure` | P; same guard as R51 | R51: same handler, role/capability, owner/scope and proposed policy; response has no body | May issue invoice/counter exactly as GET; source-derived, runtime not tested | RB02/RB06/RB07/RB09/RB10/RB12/RB17 |
| H52 | HEAD | `/api/invoices/:id` | P; same guard as R52 | R52: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB11/RB12 |
| H55 | HEAD | `/api/debt-payments` | P; same guard as R55 | R55: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07/RB11/RB12 |
| H57 | HEAD | `/api/expenses` | P; same guard as R57 | R57: same handler, role/capability, owner/scope and proposed policy; response has no body | Same GET effects; no assumption of a no-op | RB02/RB06/RB07 |

### Public and middleware-level surfaces — exclusions with explicit reasons

| Method | Path | Current handling | Inventory/permission treatment |
| --- | --- | --- | --- |
| POST | /api/users/login | Public login; bcrypt/confirmation; issues seven-day versioned JWT | The only public business registration; no role-assignment authority |
| GET / derived HEAD | / | Sanitized running-service response | Public diagnostic, no account data |
| GET / derived HEAD | /api/health | Public readiness; handler can ping configured DB when connected | Do not call during B01 inventory collection; metadata only |
| OPTIONS | Middleware-level paths admitted by CORS | Installed CORS defaults preflightContinue=false and returns204 before business routers for admitted origins; disallowed origin uses safe error path | Not an authorization bypass into a domain handler and not a protected CRUD pair; no valid credential implied |
| Other unregistered methods/paths | No explicit domain route in inspected app | No additional domain handler declared; framework fallback behavior not probed | No hypothetical allow-all route; unsupported registration shapes/new methods must make inventory tests fail for review |

CORS controls browser origin handling, not role or object access. A successful preflight is not permission to execute its advertised method. There is no explicit mounted HEAD/OPTIONS/all business declaration in the reviewed routers. No method-override middleware was identified in the mounted app flow.

**New precision relative to earlier high-level inventories:** three debt aliases are410 tombstones; two invoice ensure GETs and their inherited HEAD forms can issue records. These are current source observations, not repairs or silent revisions of Phase15D/15E. No route, response or handler was invoked to prove native execution.

## 4. Permission architecture contract for the first batch

### 4.1 Storage-independent business vocabulary

**Technical recommendation for approval with B01:** `roles.js` defines exactly the four approved **business labels** and a strict membership predicate. It does not map `User.role`, change its enum/default, trim/case-normalize unknown values into authority or turn legacy user into Customer/Cashier/Manager.

This deliberately separates Phase15E's suggested persisted keys (admin/store_manager/cashier/customer, not approved for persistence) from a pure policy vocabulary. “admin” and “user” remain current source observations in route metadata; they are not automatically valid inputs to a business-role evaluator. An explicit persisted-role-to-business-role adapter belongs to B02 after OP01. Guest is a subject/access mode, not a fifth recognized role.

All future runtime callers must receive the business role through a trusted server-owned adapter after protect, never from a submitted label/JWT role claim/browser store. The B01 module cannot establish who a caller is.

### 4.2 Exact pure-module responsibilities

| Proposed module | Input/output responsibility | Must not do |
| --- | --- | --- |
| backend/auth/roles.js | Frozen four-role labels; strict known-role check | Read User/documents/JWT/request/environment; persist mappings/defaults |
| backend/auth/capabilities.js | Explicit semantic action registry, immutable role ceilings, declared conditional prerequisites and evidence/status metadata | Wildcard actions, admin universal bypass, inferred cost/expense/contact grants or enum/schema changes |
| backend/auth/policy.js | Pure `evaluateRolePolicy(businessRole, action, conditions)` -> deny or eligible **constraint plan**, safe reason code, required scope/field/state/actor/audit conditions | Produce an executable HTTP permit, query database, load grants or validate JWT/session/account status |
| backend/auth/fieldPolicy.js | Frozen field-profile/alias definitions and pure field-eligibility result; mark unapproved fields unresolved/denied | Mutate a request, serialize a live model, fix cost reset or change actual product validation |
| backend/auth/routeManifest.js | Data-only current/proposed inventory: registered method/path/mount/controller, current authentication/role/ownership evidence, required action/constraints/criteria, effect and unresolved flags; public/tombstone/HEAD/OPTIONS distinctions | Import app/controllers/routers/models, register middleware, grant runtime authority or treat missing mapping as allow |

The eligibility result is intentionally **not** an `allowed=true` server authorization decision. It tells later code which approved role could perform an action **only after every declared condition is enforced**. This tightens Phase15E's proposed allowed/denied helper interface for an unattached B01, while preserving its permission semantics; Phase15E remains unchanged historical design evidence. A later binding may not discard the scope/actor/field/state requirements and use eligibility alone.

Required behavior:

- Missing/unknown business role or action, malformed condition object, unsupported grant form, wildcard or unresolved required condition -> **deny**, with no coercion.
- Base policy reflects Phase15C exactly: Manager price edit/account administration/system-wide audit denied; Cashier direct stock/price/independent reversal approval/cross-history denied; Manager direct stock/reversal authority/all-cashier history eligible with declared scope/audit/effect requirements.
- Conditional Administrator/Manager operational eligibility defaults deny. Unit tests may supply explicit **synthetic** condition facts solely to test the policy; they do not create a grant schema, an account grant or an API input.
- Unapproved standalone expense/contact CRUD, cost-field authority, exports and settings details remain explicit unresolved declarations. No unknown route or blocked metadata record can acquire a capability through a default branch.
- Role eligibility for catalog/customer/order operations is not a public kiosk implementation. Both guest/student requirements remain mapped to B08/RB11. B01 must deny guest access to staff actions and must not synthesize a user-role token or a guest staff account.
- Inputs are unchanged after evaluation; no function logs, reads process.env, uses Date-dependent business rules, performs I/O or mutates a singleton permission table.
- Required field profiles exclude credentials/hash/token/security internals and unauthorized cost/PII. Product price/sellingPrice, stock/quantity and active/isActive alias relationships are metadata, not actual new payload-validation behavior. Legitimate login token output is a distinct existing contract, not deleted by a generic secret-field profile.

Exact target-resource predicates, student/guest proof, report fields, store membership and audit/effect consistency stay declared requirements, not invented policy values. If the B01 implementation cannot represent an unresolved condition without silently permitting it, stop that implementation slice for review.

### 4.3 Manifest completeness and test-only collection

**Technical recommendation:** compare the data-only manifest against the actual locally constructed route graph, not against another manually duplicated list alone. Existing `a03TokenReview.test.js` already enumerates app/router stacks and checks early protect. Extend coverage in a **new** test/helper; do not modify that existing test.

Proposed collection approach, confined to a new isolated test adapter:

1. Inspect imports, then import `backend/app.js` factory and known router objects, never `index.js`, config, dotenv or seed/start scripts. app.js declares health's DB call inside a handler; collecting metadata must not execute it.
2. While constructing a fresh app, use a temporary test-only recorder around the installed Express application.use to capture the actual mount arguments/router identity. Delegate original registration and restore the recorder in finally/test cleanup. No request or production middleware is replaced/executed.
3. Traverse the known router metadata in registration order, collecting each method/path/handler and global/direct early protect identity. Current local Express5.2.1/router2.2.0 shapes were inspected; stack internals are **version-dependent test infrastructure**, not a public production integration guarantee.
4. Reject unsupported nested/array/regexp/dynamic mount/path/method shapes rather than silently omit them. Detect extra/missing/duplicate registrations, changed mount prefixes, public additions and changed guard ordering. Do not merely assert the total59.
5. Derive HEAD from GET using the installed router contract; retain the original GET's scope/role/effect flags. Maintain explicit public diagnostics/login and OPTIONS handling outside protected totals.
6. Compare exact method/template multisets and mount/handler associations, not only a deduplicated set; retain User profile/password-before-/:id precedence. A GET/read label must not override a recorded write effect.
7. Build synthetic graph variations or cloned metadata for negative tests: added/missing/duplicate method, changed prefix, protect moved after handler, tombstone promoted, effect flag lost or unsupported route shape must fail validation. Do not modify actual routes for these tests.
8. Trap database connection attempts, collection read/write I/O, startSession and unintended network/listener/health execution (allow disconnected model/collection-wrapper registration) in new metadata tests. Restore temporary recorders; keep tests isolated/nonconcurrent while instrumenting registration. A collector failure fails the test; no fallback to the expected manifest as “observed” data.

Framework metadata can establish handler identity/order; it cannot inspect an authorizeRoles closure's captured role array, prove controller ownership or prove native transaction effects. Those columns require source evidence and unchanged existing guard tests. B01 contains no live-route modifications; file preservation/diff review provides the additional containment evidence. Full role-by-method HTTP authorization remains RB02/later batches, not falsely proven by metadata.

No collector or probe is implemented or executed in Phase15F. If the eventual adapter requires changes to app.js, tests/helpers.js, dependencies or production middleware, that exceeds the whitelist and must stop for authorization.

## 5. Security compatibility findings

| Control | Current source finding | Required B01 containment / later gate |
| --- | --- | --- |
| JWT expiration/signature | Sole inspected issuer uses HS256 and 604,800-second max; verifier requires safe-integer iat/exp, nonfuture issuance, valid exp and signature | No issuer/verifier edits, expiry grace, fallback algorithm or new claim handling |
| Token version | Current stored version compared with claim; missing stored version only zero; malformed/claim-less/stale tokens reject | No legacy claim fallback or epoch rewrite; new policy does not read/issue tokens |
| Account existence/confirmation | Persisted account authoritative; missing/unconfirmed or failed lookup never reaches protected target | Keep protect and safe error behavior. Independent activation remains later OP06; no claim it exists |
| Current roles | authorizeRoles uses freshly loaded persisted role; protect-only business routes have no role ceiling | B01 documents gap and prepares unattached policy; no runtime gap is claimed fixed |
| Security-state changes | User save CAS combines password/role/confirmed with epoch advance; raw account changes bypassing it would be unsafe | B01 cannot add fields/writers; activation/grant/membership integration belongs to B02 |
| Existing sessions | Seven-day versioned JWT remains valid while current state/version matches; frontend logout is local storage clearing | No mass logout, token invalidation or production session assumption. Policy-only rollout session impact later reviewed |
| Administrator mutation | Current actor guard + self CAS/cross-account transaction fence protects sensitive writes, with safe retry rechecks | No Manager widening; no read-then-write replacement; admitted request serialization preserved |
| ObjectId/self-delete | Canonical account target comparison recognizes case variants; malformed account targets reject; blocked self-delete before target/session/fence | Do not change parser, delete flow or guards. Business endpoints have varying ID/error conventions, not a universal canonicalization claim |
| R2 commit safety | Compound unknown labels/no-replay observer, legitimate driver retry and cleanup/primary error preservation | B01 cannot edit helpers, financial retries or response envelopes. Native MongoDB unverified |
| Error/log redaction | Sanitized errors/diagnostics and private primary causes retained | New pure modules/metadata tests do not log tokens/account objects; no secret or personal values in fixtures/results |
| Ownership/read privacy | Owner-scoped business records; expense exception; population/summary can expose linked financial/PII fields | Record exact constraints; shared scope/DTOs belong to B03/B05/B06, not a helper rewrite |
| Audit/data integrity | Durable sensitive-action audit missing; five financial/inventory risks and cost-reset defect unresolved | Policy metadata must not claim these implemented. No fixes, data writes or invented rules in B01 |

No source/security control needs to be relaxed to create the bounded pure B01. Role field migration, grant/account status representation and actual account legitimacy remain unverified/unapproved later work.

## 6. Exact B01 implementation contract — proposed for separate authorization

### 6.1 Allowed future change set

**No listed file is created or edited in Phase15F.** If B01 is separately authorized under this contract, its code whitelist is exactly these 8 new files:

| New file | Allowed responsibility |
| --- | --- |
| backend/auth/roles.js | Four business labels and strict validation; no persisted-role adapter |
| backend/auth/capabilities.js | Immutable approved action/role/conditional requirement metadata |
| backend/auth/policy.js | Pure eligibility/deny constraint plan; no runtime authorization |
| backend/auth/fieldPolicy.js | Pure field/alias constraint profiles; unresolved fields default deny |
| backend/auth/routeManifest.js | Data-only protected/public/retired/derived method inventory and source-backed constraints |
| backend/tests/rbacPolicy.test.js | Meaningful pure policy/field/conditional/unknown-role tests |
| backend/tests/rbacRouteManifest.test.js | Observed-versus-declared inventory, guard ordering, derived methods/effects and negative coverage cases |
| backend/tests/routeInventoryAdapter.js | Test-only app registration/graph collector; no listener, handler invocation or DB I/O |

Proposed B01 documentation outputs: a new `docs/UPHSD_BOOKSTORE_B01_POLICY_FOUNDATION_RESULTS.md` and an additive implementation-plan entry. No historical report rewrite. Fixture data stays synthetic and inline in the new tests; no additional fixture/migration files are silently included. New folder creation in a later authorized B01 would be organizational only, not a codebase restructure.

The new production-located auth modules remain **unimported by every existing runtime entry/middleware/controller/router**. Only the new tests/modules may import them. Their mere location under backend/auth does not grant authority. No new middleware wrapper, `requireCapability` route attachment, endpoint, capability projection or runtime feature flag is allowed in B01.

### 6.2 Prohibited change set

All existing application files, all existing tests/helpers, all frontend files and all model/schema files are immutable in B01. Specifically:

- `backend/app.js`, `index.js`, `config/`, `routes/`, `controllers/`, `middleware/`, `models/` and existing `utils/`.
- User/auth/JWT/epoch/password/ObjectId/admin guard/account commit/outcome/error/redaction behavior and the associated existing regression tests.
- `backend/tests/helpers.js`; no new hooks in old test fixtures to accommodate the collector.
- Any env/config/dependency manifest/lockfile/installed dependency modification, installation, secret read, startup/seed/migration script or deployment.
- Persisted role keys/enum/default/active/membership/grant schema; real account role/confirmation/session state; production/provider/database access.
- Shared catalog/stock/ownership/history, customer enrollment, kiosk/order/queue, payment/refund/void, receipt/report, audit persistence or settings implementation (B02-B12 scope).
- Product omitted-cost or stock/activation integrity fixes, client lint repair and any account/credential remediation. Their risks remain open.

If tests/collection require a change outside the whitelist, stop that proposed change for separate authorization. A failing existing test is not permission to weaken it.

### 6.3 Required tests for B01

These are **future required tests**, not Phase15F results.

| Test group | Required observable assertions |
| --- | --- |
| Four-role base eligibility | Every registered approved action evaluated against all four labels, with exact eligible/deny plus declared scope/field/state constraints; no role hierarchy implied |
| Default-deny inputs | Missing/unknown/legacy/case/whitespace/object/array role/action, unsupported condition types and wildcard produce deny or a documented safe validation rejection; no coercion into privileged identity |
| Five approved owner decisions | Administrator price eligibility; Manager/Cashier price denied; Manager direct stock with movement/reason constraint; Manager reversal authority/Cashier request-only; Manager all-history/Cashier own-only; guest/student requirements retained without staff exposure |
| Conditional ceilings | Admin/Manager operational eligibility denied without explicit synthetic condition; only approved conditional actions can become eligible; a grant cannot override Cashier/Manager immutable prohibitions; no unknown grant fallback |
| Field/alias metadata | Price/sellingPrice versus stock/quantity and active/isActive cannot cross a role ceiling; cost/secret/PII exclusions; unresolved field rights deny; input objects unchanged |
| Manifest exactness | Observed11 mounts/60 business registrations plus2 diagnostics, with59 protected explicit; exact method/path/mount/handler multiset comparison, not counts alone |
| Guard and precedence | Early global/direct protect found before protected handlers; public login unique; profile/password routes precede parameterized User route; no allowance inferred from endpoint naming |
| Derived methods | 23 protected HEAD mappings inherit corresponding GET controls/effect flags; both invoice HEAD/GET ensure records flagged as potential writes; public diagnostic HEAD and CORS OPTIONS distinguished |
| No revival / effect laundering | Three410 debt tombstones stay retired; DELETE order alias maps reversal; invoice markVoid maps reversal; POST/PUT completion branches require combined effects; GET does not imply read-only |
| Negative coverage validator | Added/missing/duplicate route, changed prefix/handler/auth ordering, unclassified public path, lost write-effect flag, unsupported shape or unresolved-as-allow causes validation failure on synthetic graph/data copies |
| Isolation/preservation | No new-module runtime import; no process.env/console/network/model dependency in pure modules; no app handlers/listener/DB I/O in metadata collection; test recorder restores even on collection failure |
| Existing security regressions | Unchanged security/token/version/a03/a04/accountIdentity/accountFaults/commitReplay suites retain existing assertions, including both R1 probes, self-delete call counts and fail-closed unsupported transactions |
| Existing financial/client regressions | Unchanged payment/invoice and client logout/diagnostic/invoice/retry tests; client build and full lint result reported separately from new backend checks; no unrelated fix |
| Syntax/targeted lint | All new files pass syntax and available installed-tool lint under an explicitly reviewed local config; backend has no lint script; no dependency install or blanket lint suppression |

The existing backend suite uses synthetic/mock persistence and some loopback HTTP listeners; these are not native tests. Before future execution recheck scripts/imports for connections. New B01 metadata tests need no listener or HTTP request. Existing regression listeners are local loopback only, not external service access. No test may connect a configured database.

Historical latest reviewed baseline is 129 backend passes, 16 client passes, successful client build, and client lint 16 errors/13 warnings; targeted Layout had 2 existing errors. Do not hardcode a future total or label historical values as fresh. Report exact new results and pre-existing lint failures independently. Keep native/browser tests NOT RUN unless separately authorized.

### 6.4 B01 acceptance, rollback and completion evidence

| B01 acceptance gate | Evidence required before calling B01 complete |
| --- | --- |
| Scope containment | Diff contains only the 8 approved new code/test files and approved new results/plan append; all original files hash-match the start snapshot |
| No runtime attachment | Existing entry/import graph unchanged; no production caller of new modules; actual API responses/permissions intentionally unchanged |
| Policy fidelity | Exact business roles/ceilings; five owner decisions represented; unknown/unresolved data deny; conditional facts synthetic only |
| Inventory completeness |59 protected explicit rows,23 HEAD derivatives, public/OPTIONS/tombstones/effect classifications; exact observed manifest comparison and negative coverage tests |
| Security preservation | All applicable unchanged security regressions run and results recorded, both R1 no-replay probes retained; no new role/database/session operation |
| Honest completion |17 criteria remain mandatory; metadata/pure tests are not signoff for four-role APIs, shared data, audits, migrations or native MongoDB |
| Reviewable delivery | File reasons, commands/counts, lint distinction, unresolved decisions, rollback and explicit next-batch authorization gate |

**Rollback:** because B01 has no runtime imports, schema, data or session action, stop at the branch/diff and remove/revert only its newly authorized files if rollback is approved. Preserve pre-existing untracked/dirty files, previous reports and current guards/tests. No database restoration, epoch change, legacy role remapping, credential/session action or production deployment is necessary or implied.

B01 must stop after its results. It cannot attach the helper “for convenience,” fix route gaps, implement shared scope/audit, or proceed to B02 automatically.

## 7. Unresolved decisions — separated from settled business policy

The five Phase15C owner decisions are not approval questions. The remaining items below retain their earlier gates while making their effect on **pure B01** precise.

| Item | Decision required and why | Recommended options | Security/operational consequence | Blocks B01 or later? |
| --- | --- | --- | --- | --- |
| F01: B01 technical contract | Adopt section 4 pure interfaces and section 6 exact scope as the basis for an implementation authorization | Recommended: storage-independent role labels + eligibility constraints + data-only manifest; alternative persisted-role/runtime middleware work requires a separately expanded batch | Prevents an apparently harmless helper becoming unreviewed permission changes | **Blocks execution of B01 until separately authorized**; no missing technical evidence prevents review of this contract |
| OP01: stored keys / legacy | Select persisted identifiers, provisioning defaults, legacy access envelope/cutoff and exact mapping | Retain admin and explicitly review suggested new keys; keep user only as approved compatibility, no auto-map. B01 uses business labels and no adapter | Wrong mapping can escalate privileges or lock out legitimate users; broad legacy fallback cannot be indefinite | **Later B02/B12**, not pure B01. B01 vocabulary adoption is included in F01; no account default/cutoff chosen here |
| OP02: conditional duties | Approve actual Admin/Manager operational grants and representation | One role plus narrow scoped grants is Phase15E recommendation; explicit role-only configuration is alternative only if it expresses all conditional limits | No automatic Admin POS/refund or Manager cashier authority; no grant can defeat immutable ceilings | **Later B02 and operational binding**; B01 conditional facts are synthetic |
| OP03: shared record scope | Approve store/membership/resource mapping and historical cashier attribution | Additive store identity preserving owner versus an approved owner-compatible transition; never globally drop owner | Pooling catalogs/histories can leak records, alter totals or falsely assign sales | **Later B03/B06/B12**; B01 only requires scope descriptors |
| OP04: student/guest proof | Enrollment, User binding, guest possession/session/reference/status privacy | Separate authenticated subject and guest access verifier/session; exact transport/recovery/rate/lifetime owner approved | Names/contact records/order number do not prove private ownership | **Later B08**; no kiosk/API construction in B01 |
| OP05: unassigned fields/modules | Cost rights, standalone contact CRUD/PII, expenses and exports | Deny unassigned new-role capabilities; enumerate narrow approved actions/fields before binding | Adjacent report/order rights can expose debt, contacts or cost fields unintentionally | **Later B05/B06/B10**; explicit unresolved non-executable metadata allowed in B01 |
| OP06: lifecycle/session | Active-state representation/defaults/legacy handling, optional last-admin rule, role/policy session cutover | Separate activation is a recommendation; evaluate alternate state model without conflating confirmed; no guessed default | New defaults or policy-only expansion can lock out users or preserve/elevate old sessions | **Later B02/B12**; B01 changes no account checks |
| OP07: audit consistency | Storage/retention/access, attempt logging and mutation/audit failure policy | Same-transaction event or approved atomic embedded outbox; retain self-CAS/actor guards and no-replay semantics | Independent post-save logging can leave partial outcomes; audit retry may duplicate effects | **Later B04 and sensitive writer enablement**; B01 declares required audit only |
| OP08: money/stock effects | Approved methods/credit retention, refund/void/cancel effects, idempotency and reconciliation | Define traceable request/approval/application and effect table; no financial policy selected here | Manager approval alone cannot determine restocking, repayment or ledger treatment | **Later B07/B09/payment workflows**, not B01 |
| OP09: API/field compatibility | Exact DTOs, capability projection, receipt read/issue split, availability/initial-stock authority and cost-reset fix scope | Preserve contracts until approved; explicitly split effects and forbid combined payload bypasses | Existing ensure GET/HEAD writes and combined product payload need safe later gating | **Later B05/B06/B10**; B01 flags current effects without fixing them |
| OP10: fulfillment/privacy | Assigned-order access, statuses, kiosk reset/payment location/reservation/pickup details | Minimal approved fulfillment scope distinct from completed-history grants; both guest/student modes already settled | Cross-history/PII leaks and unintended stock/payment timing otherwise | **Later B08/operational workflow** |
| EV01/EV02: accounts/backups | Verified target/account collection/admin legitimacy/mappings, backup/recovery evidence | Approved A01 scoped verification and exact-ID review; no inferred database/user legitimacy | Prevent wrong-target changes, unintended promotions and revived epochs after restore | **Later real mapping/migration/recovery**, not B01 |
| EV03: native isolation | Disposable target, effective permissions, transaction topology, fail-closed runner and approved native faults/cleanup | Resolve A08B preflight and separately authorize execution | Mocks do not prove server ordering, durability or safe cleanup | **A08B/later native gates only**; no prerequisite to pure B01 tests |
| EV04: deployment | Revision/compatible readers/release order/session impact and release approval | Reviewed secure-reader rollout and monotonic recovery | Old reader or old epoch restoration may revive access | **Production rollout only**; B01 is local unattached work |

These are recommendations and future evidence requirements, not adopted schemas or new account policies. A01, credential rotation, account remediation, A08B and production operations retain separate authorization gates.


## 8. All 17 acceptance criteria retained

Exact quotations from Phase15B follow. Phase15D classifications are retained, not promoted by this review. Phase15C specializes RB08 to direct Manager adjustment, RB11 to both ordering modes and RB17 to mandatory sensitive-action audit. These notes limit B01 scope; they do not reduce the acceptance requirement.

### RB01 — Not Implemented

> Approved role values persist/round-trip correctly; malformed/unknown values cannot grant authority. Legacy accounts follow the approved mapping/compatibility rule; User/Person identities are not conflated

**B01 contribution and remaining gate:** Metadata/pure role vocabulary only. Persisted keys, round-trip schema/controller and legacy account mapping remain B02/B12; not completed by B01.

### RB02 — Partially Implemented

> Every protected endpoint/method has positive and negative tests for all four roles, anonymous/unconfirmed/deleted accounts, expired/wrong-signature/malformed/stale tokens. Test direct API calls independently of hidden menus

**B01 contribution and remaining gate:** Exact method/guard/alias inventory and pure policy tests only. Full four-role direct HTTP/object/effect coverage remains later; no runtime enforcement claimed.

### RB03 — Already Implemented

> Current persisted role overrides a forged/cached admin claim. Password/reset/role/confirmation changes advance epochs atomically; old tokens remain rejected after demotion/restoration. Preserve the established seven-day lifetime and strict legacy-token policy

**B01 contribution and remaining gate:** Preserve existing token/current-account regressions unchanged; no issuer/verifier/epoch edits.

### RB04 — Partially Implemented

> Only Administrator can provision/list/edit staff privileges, confirm/reset/delete accounts. Body field injection cannot escalate rights through signup/profile/product/order endpoints. Managers cannot assign themselves or another user Administrator

**B01 contribution and remaining gate:** Encode Administrator-only account eligibility and denial cases; existing guarded account API unchanged.

### RB05 — Already Implemented

> Canonical/uppercase/mixed-case self-delete rejects before either deletion function/session/fence; malformed IDs safely reject. Authorized peer administration still works

**B01 contribution and remaining gate:** Existing canonical self-delete tests unchanged; metadata must not introduce an audit/session side effect.

### RB06 — Partially Implemented

> Every allowed operation enforces approved store/record scope: list/detail/search/aggregation/export/receipt paths cannot leak another store or unauthorized cashier's/customer's data by changing an ID/filter

**B01 contribution and remaining gate:** Declare mandatory scope profiles only; no owner-filter changes or shared resource resolver.

### RB07 — Not Implemented

> Cashier cannot edit price/cost/stock or access full management reports. Approved Manager/catalog rights do not expose account administration. Response filtering excludes costs, secrets, hashes, tokens and unauthorized personal data

**B01 contribution and remaining gate:** Pure role ceiling/field metadata, including unauthorized price/cost/stock denials; actual payload/DTO/API fixes remain B05/B06.

### RB08 — Not Implemented

> Receiving/adjustment tests cover request versus approval versus application, unauthorized transitions, maker/approver identity if approved, recorded responsible users and reasons. No stock ledger acceptance based solely on a quantity input

**B01 contribution and remaining gate:** Manager direct stock eligibility with actor/reason/movement requirements; no second approver; ledger/native integrity later.

### RB09 — Not Implemented

> Approved void/refund/cancellation authority is enforced on every entry point, including DELETE order alias, transaction void and invoice markVoid. Denied actions produce zero financial/stock effects. No refund test invents unapproved settlement/accounting rules

**B01 contribution and remaining gate:** Manager reversal authority/Cashier request-only constraints; every alias mapped; financial/stock effects remain OP08/B09.

### RB10 — Partially Implemented

> Order and payment transitions are server-validated; no arbitrary status/price/payment-state assignment from the client. Concurrent cashiers and duplicate submissions require explicit integrity tests under approved semantics

**B01 contribution and remaining gate:** Record branch-sensitive order/payment effects; no transaction-state, settlement or idempotency implementation.

### RB11 — Not Implemented

> Guest/customer kiosk cannot call staff APIs or enumerate another person's order/receipt. If login is chosen, secure User/order ownership binding is tested; if guest is chosen, approved session/reference/privacy/rate controls are tested. No current user-role shortcut

**B01 contribution and remaining gate:** Guest is not a fifth role; staff API eligibility denied for absent/guest role; both kiosk modes preserved as later identity work.

### RB12 — Not Implemented

> Cashier cross-history, Manager price edits/adjustment approval and financial visibility match the signed D decisions exactly, including denial cases and aliases

**B01 contribution and remaining gate:** Executable pure-policy checks reflect all five settled decisions; unresolved conditional duties default deny.

### RB13 — Already Implemented

> Administrator requests admitted before revocation cannot regain privilege at mutation time. Keep actor-version guard, same-transaction fence and safe retry rechecks; do not broaden adminAccountFilter for convenience

**B01 contribution and remaining gate:** Guard/helper files and existing demotion/concurrency regressions unchanged; no account mutation wiring.

### RB14 — Already Implemented

> Both R1 commit replay probes continue to pass: uncertain commit cannot repeat target/fence effects; legitimate confirmed-abort/ack retries remain; cleanup preserves acknowledged success and primary error; unknown outcomes retain retryable false

**B01 contribution and remaining gate:** Both R1 probes and cleanup/unknown-outcome regressions retained; pure modules cannot alter commit behavior.

### RB15 — Partially Implemented

> Frontend navigation/pages/actions match approved permissions, stale UI state does not bypass the backend, and account errors remain sanitized. Customer surfaces do not render staff routes through cached storage manipulation

**B01 contribution and remaining gate:** No frontend or client behavior change; later UI visibility cannot substitute for backend checks.

### RB16 — Cannot Verify

> Migration dry-run/commit/recovery verifies exact authorized account IDs/counts, unchanged bcrypt/confirmation/history/ownership, expected epoch increases, protected last-admin rules if approved, and no automatic treatment of uncertain accounts

**B01 contribution and remaining gate:** Pending real mapping evidence; no migration schema/tooling/account assignment or inventory query in B01.

### RB17 — Not Implemented

> Durable audit entries, if approved/implemented, identify actor/target/action/time/result without credentials; unprivileged roles cannot alter them. Missing audit functionality cannot be called verified based on request logs

**B01 contribution and remaining gate:** Declare required audit constraint/status; request logger is not durable action history; no Audit model/API built.

## 9. Verification, remaining risks and final readiness

### Actual Phase15F verification

| Check | Actual result |
| --- | --- |
| Required documents / authority | Phase15C/D/E and plan present and inspected; Phase15C still controls permissions; no missing business policy was silently filled |
| Explicit source inventory | 11 business mounts,60 business registrations,59 protected;3 protected410 tombstones;2 effectful invoice ensure GETs |
| Derived method inventory | 23 protected HEAD forms traced from installed router source; public login/diagnostics/HEAD and middleware OPTIONS separated |
| Controller checks | Requester owner filters, expense creator/admin exception, account guard and payload-dependent completion/issuance paths traced |
| Criterion preservation | All 17 exact requirements and Phase15D classifications retained; B01 contributions explicitly separated from future acceptance |
| Tests/build/lint | **NOT RUN**; no new passing test claim. Historical 129 backend/16 client/build evidence; historical client lint 16 errors/13 warnings |
| Native database/browser/deployment behavior | **UNVERIFIED**; no connection, app/handler execution or live state inspection |
| Documentation preservation/links | 185 baseline files compared: only the implementation plan changed; this report was added; none were removed. All other baseline files hash-match. The plan's original 58,279 bytes remain an exact prefix |

Documentation checks found 59 unique protected explicit method/path rows, 23 derived HEAD rows, all 17 exact criteria and all 17 unchanged Phase15D classifications. All 26 relative source/document links resolve; whitespace checks pass. A heuristic scan found no connection-string/JWT-shaped values in the new report; this is not a comprehensive secret audit. Git diff checking emitted only pre-existing line-ending notices for three untouched tracked files. The eight proposed B01 code/test paths are currently absent; no implementation file was created.

The source inventory is an inspection result, not execution of the proposed collector. The current static extraction used the reviewed declaration shapes and was checked against full mounted route files; it is not a general JavaScript parser or proof of runtime route matching.

### Open risks not resolved by this contract

- Current broad legacy admin/user business access and protect-only methods remain unchanged until later runtime binding. Unknown/unmapped persisted role/account inventory is not verified.
- Requester ownership does not satisfy shared catalog, Manager all-cashier history or student/guest privacy by itself. No store, account or historical attribution is guessed.
- Five integrity risks remain deferred: repeated stock adjustments, lost concurrent adjustments, partial activation, payment resubmission and financial error masking. The omitted cost-price reset defect remains open. B01 may describe but cannot repair them.
- Durable sensitive-action audit, lifecycle/recovery/last-admin decisions, refund/payment/stock effects and guest privacy are later gated work.
- Native transaction ordering/durability, production identity/admin legitimacy/credential lifecycle and backup/release state remain unknown. A01/A08B and production gates are not bypassed.
- The test-only route collector depends on installed framework internals; it must fail visibly on unsupported changes and must not be represented as automatic proof of allowlist closures or controller authorization.
- Existing lint debt and frontend cached-role/route visibility are outside B01 remediation; no unrelated client change is authorized.

### Final recommendation

**TECHNICALLY READY FOR SEPARATE LOCAL B01 AUTHORIZATION — NOT AUTHORIZED OR IMPLEMENTED.**

Adoption of this proposed bounded contract can accompany an explicit B01 authorization. Storage-independent business labels, deny-by-default eligibility constraints, non-executable unresolved metadata and an unattached route inventory allow that batch without resolving or executing B02-B12 account/data/workflow decisions. If authorization instead requires persisted mapping, runtime permission changes, schema/audit/resource enforcement or a wider collector change, that is a different scope and must stop for review.

This readiness assessment is not full RBAC acceptance or production readiness. Only the new report and a dated implementation-plan append are permitted in Phase15F. Existing source/tests/configuration/environment/lockfiles/reports/accounts/security protections are preserved. No B01, other batch, A08B, migration, deployment, credential/session operation or Phase16 workflow follows automatically.

