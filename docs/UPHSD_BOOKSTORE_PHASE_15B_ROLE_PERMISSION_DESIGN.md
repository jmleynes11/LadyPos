# Phase15B — proposed user roles and permissions

Date: 2026-11-03, Asia/Manila. **Requirements/design only. All proposed permissions and migration actions require owner approval.**

The requested design has four roles: **Administrator, Store Manager, Cashier, Customer / Student**. Store Manager includes inventory staff responsibilities; no separate Inventory Staff role is proposed. These are proposed business roles, not newly created database values or approved grants.

## 1. Evidence and current implementation

Read the [Phase14 audit](UPHSD_BOOKSTORE_PHASE_14_UI_BRANDING_AUDIT.md), [Phase15A results](UPHSD_BOOKSTORE_PHASE_15A_BRANDING_RESULTS.md), [implementation plan](UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md), token-version/security evidence and [independent R2 review](UPHSD_BOOKSTORE_A08A_R2_INDEPENDENT_REVIEW.md). Inspected User schema/controller/routes, auth middleware, administrative mutation/commit helpers, frontend guard/account controls, and route permission declarations across products, orders/transactions, payments, invoices, customers, finances/dashboard and expenses.

| Actual mechanism | Source evidence and behavior |
| --- | --- |
| Stored role | [User.js](../backend/models/User.js): one String role, enum user/admin, default user. confirmed defaults false; tokenVersion is separately validated. No manager/cashier/student role or multi-role field exists |
| Provision/update validation | [UserController.js](../backend/controllers/UserController.js) accepts only admin/user privilege values. The [UserModal](../client/src/features/auth/components/UserModal.jsx) select also offers only User/Admin. Changing a menu or schema enum alone cannot implement four-role access |
| Authentication | [authMiddleware.js](../backend/middleware/authMiddleware.js) verifies HS256 token/time/version, then loads account existence, confirmation, current role and epoch. JWT role claim alone is not authority; failures deny access |
| Coarse role authorization | authorizeRoles checks server-owned req.user.role against allowed values. ProductRoute explicitly permits admin/user; most business routes require protect but have no narrower staff-function restriction |
| Account administration | [UserRoute.js](../backend/routes/UserRoute.js): register, list, PUT/:id and DELETE/:id require admin. Profile/password are self routes; login is public. Public registration cannot grant administrator privileges |
| Sensitive writes | adminAccountFilter pins current admitted ID/admin/confirmed/epoch. Self update uses atomic predicate; cross-account operations use actor revision fence and transaction. accountCommitBoundary prevents uncertain commit replay. Account role/password/confirmation saves advance epoch atomically |
| Frontend guard | [DashboardGuard.jsx](../client/src/shared/hooks/DashboardGuard.jsx) checks isAuthenticated/loading. AuthContext caches user/role; ProfilePage displays AdminUserTable only for cached admin. Layout navigation is not per-role filtered. Backend remains authoritative |
| Object ownership | Product/order/customer/payment/invoice/report queries generally filter owner=requester ID. Administrator role does not automatically bypass those filters. Expenses differ: edit/delete permit creator or admin, while list/create use requester-linked fields |

The source default user is a **broad legacy staff-like account**, not a customer account. A Customer/Person document represents a sales customer, not necessarily an authenticated User or verified student. Names, emails and phone numbers do not establish a secure identity link. No student directory/GradeSense integration is implied.

### Current endpoint behavior inventory

| Area | Existing routes and restrictions | Gap relative to proposed model |
| --- | --- | --- |
| User administration | `/api/users/register`, GET users, PUT/DELETE users/:id: protect + admin. Self profile/password protected | No delegated manager/staff provisioning; no approved role-assignment workflow or durable account audit ledger |
| Products/stock | `/api/products` CRUD and PATCH/:id/stock: admin/user + owner scope; POST/set-active: protect | Legacy user can edit prices/absolute stock. No separate receiving/adjustment approval permissions |
| Orders/sales | `/api/orders` and `/api/transactions` guarded by protect; pay/complete/void/delete aliases use existing controllers and owner filters | Not cashier-specific; no public kiosk or centralized cross-owner processing/claim model |
| Payment collection | `/api/debt-payments` POST/GET; customer/person payment/pay-all aliases protected and owner-scoped | No distinct payment-record versus approval authority; no approved bookstore credit/refund rules |
| Receipts/invoices | Authenticated invoice list/detail/ensure/create and PATCH/:id/void; owner filters | Ensure includes GET paths that can create records. Invoice void and order void are different entry points and must not bypass future approval rules |
| Reports | `/api/dashboard` and `/api/financials` summary/revenue routes protected, owner-scoped | No management-only financial permission or cashier daily-summary boundary |
| Expenses | Protected CRUD, creator/admin checks for edit/delete | Not equivalent to a financial report or automatically part of cashier duty; explicit scope needed |
| Audit/settings | Request diagnostics, timestamps, existing theme toggle/static branding | No durable privileged-action audit review module or server-side settings management API found; no refund API found |

Backend route files: ProductRoute, OrderRoute, TransactionRoute, DebtPaymentRoute, PersonRoute, CustomerRoute, InvoiceRoute, FinancialRoute, DashboardRoute and ExpenseRoute. Controller ownership checks remain necessary in addition to future role checks. Comments/buttons do not establish broader authority.

## 2. Final proposed matrix for owner review — NOT APPROVED

Legend: **A** = recommend allow if this design is approved; **D** = recommend deny; **P** = explicit owner decision required, no proposed grant until resolved. **Own** = scoped to the authenticated person's approved resources; **Store** = only an explicitly approved store scope, which is not implemented by today's owner=requester queries. These are capability recommendations, not role inheritance. Administrator/Manager do not silently inherit every cashier action.

Each row's Existing column is current behavior. All four remaining columns describe **proposed** behavior, including restrictions that do not yet exist.

| Capability | Existing behavior / implementation | Administrator | Store Manager | Cashier | Customer / Student |
| --- | --- | --- | --- | --- | --- |
| Read/edit own nonprivileged profile; change own password | Self routes; existing password/epoch validation | A Own | A Own | A Own | P if login accounts are approved |
| Create staff accounts, assign roles, confirm accounts, reset other passwords | Admin-only guarded API | A | D | D | D |
| List staff accounts/permission details | Admin-only list, no fine-grained visibility | A | D | D | D |
| Delete/deactivate staff or change security state | Admin guarded edits/delete; no general deactivation field; self-delete blocked | A subject to approved account/last-admin policy | D | D | D |
| Browse saleable catalog/availability | Authenticated owner-scoped products, may contain staff fields | A Store | A Store | A sale-safe fields | P public-safe subset, login/guest decision |
| Create/edit descriptive product/category data | Admin/user owner-scoped CRUD; categories free text | A Store | A Store | D | D |
| Edit selling prices | Both legacy roles can via product update | A Store | **P — D02** | D | D |
| Read/edit cost information | Product has costPrice; no dedicated field permission; mounted editor omission/reset defect | A Store | P cost confidentiality/edit scope | D | D |
| Deactivate/re-activate products or bulk availability | Protected current catalog writes | A Store | A Store | D | D |
| Record incoming stock/receiving | No dedicated receiving ledger/module; stock field/adjust endpoint is not a receiving audit trail | A Store | A Store | D | D |
| Request manual stock adjustment | Current direct stock edits; no request/approval state | A Store | A Store | D (report discrepancy through approved process) | D |
| Approve/apply manual adjustments | No independent approval model; current user writes directly | P — D03 | **P — D03** | D | D |
| Perform cashier checkout/payment recording | Authenticated POS/order flow; no cashier role | P operational cashier duties | P operational cashier duties | A Store, approved methods only | D |
| Place kiosk order/cart | Missing public kiosk path | P staff-assisted use | P staff-assisted use | P staff-assisted use | **P — D01/D08**, only own submission |
| Read/process staff order queue | Authenticated owner-only orders; pending/completed/void | A approved oversight scope | A Store operations | A assigned/permitted queue subset | D staff queue; P own order status only |
| Change order processing status | Generic protected order controllers; no new processing/pickup states | A existing approved transitions | A existing approved transitions | A cashier transitions only | D staff transitions; cancellation P — D08 |
| Record payments/settle approved balances | Legacy payment/debt APIs, no approved bookstore policy | P cashier duties | P cashier duties | A only after method/settlement rules approved | D staff payment mutation |
| Discount, credit/debt sale, override payment terms | Legacy credit/debt exists; no new discount policy | P policy | P policy | P policy | D staff overrides |
| Request void/refund | Void exists; refund workflow/API missing | P — D04 | P — D04 | P — D04 | P customer request process, no ledger authority |
| Approve/execute void, invoice void or refund | Current authenticated owner void paths; no second approval. Refund missing | **P — D04**, no implicit exception | **P — D04** | D approval; execution P after approved workflow | D |
| Generate/reprint receipt | Existing owner invoice ensure/print; tested DTO rendering | A approved scope | A Store | A authorized transactions | P own receipt with verified order binding |
| Read own processed sales/history and daily summary | Authenticated owner scope, broader dashboard currently accessible | A approved scope | A Store | A own cashier activity | D staff history; P own purchases |
| Read other cashiers' completed history | Not shared by current owner filters | A approved oversight | A Store operational scope | **P — D05**, recommend own-only default | D |
| Sales aggregates/payment summaries/exports | Existing owner aggregates; no complete export/report suite | A approved oversight | A Store | P bounded own-shift/daily totals only | D |
| Inventory levels/low-stock/movement/receiving reports | Catalog stock visible; full movement/receiving reports missing; threshold styling hardcoded | A Store | A Store | A sale availability only; D full cost/movement report | P public availability only |
| Expenses/financial administration | Legacy expenses CRUD; no four-role boundary | A approved scope | P — D06 | D | D |
| Review privileged/security audit records | No durable review module; request logs are not account audit evidence | A redacted scope | P operational stock/sales audit subset; D privileged security details | D | D |
| Edit/delete audit history | No approved audit ledger | D normal UI | D | D | D |
| Manage application-wide settings | Static configuration/branding; no settings API | A approved nonsecret settings only | P operational settings, if defined | D | D |
| Local theme preference | Existing browser theme toggle | A | A | A | P kiosk-managed preference |
| Credentials/deployment/security-policy configuration | Outside user-facing application permission model | D through normal UI; separate operations authorization | D | D | D |

An A in this matrix does not create a missing feature. Receiving reports, audit records, public-safe catalog, receipt ownership for students, exports, approval workflows and settings require separately reviewed implementation/data design. No role may edit historical ledger data or add a refund policy merely because the role name sounds senior.

### Proposed page/data exposure

- **Administrator:** account management, approved oversight reports and permitted configuration. Store data access must be defined independently from account authority; do not make admin an unrestricted owner-filter bypass.
- **Store Manager:** catalog, inventory/receiving/movements and approved store queue/reports. Combines inventory staff responsibilities. Checkout, costs, price editing and adjustment approval require the explicit decisions above.
- **Cashier:** POS, relevant pending orders, authorized receipts, own sales and bounded daily summaries. No role/account controls, stock mutation forms or cost fields. Cross-cashier queue access must not automatically expose all completed sales/customer histories.
- **Customer / Student:** future safe catalog/cart and own order acknowledgement/status/receipt only if approved. No current staff endpoint should be exposed unchanged; current User role user is not a customer authorization shortcut.

Server permissions must cover list queries, individual object IDs, aggregate reports, response fields and all aliases, not just buttons/routes. An otherwise permitted cashier must still be denied another store's transaction or an unauthorized record. Read visibility, write authority, approval authority and private fields are distinct decisions.

## 3. Owner decisions and required approvals

| ID | Decision required | Recommendation/options for approval; no current grant |
| --- | --- | --- |
| D01 | Must customers log in, or may they submit guest kiosk orders? | Decide identified accounts versus guest sessions. Guest does not mean unrestricted public writes: require a dedicated safe catalog/submission/status design and privacy/reset controls. Do not grant legacy user tokens, infer identity from a name, or assume student verification |
| D02 | May Store Managers edit selling prices? Who sees/edits cost? | Recommend explicit manager price permission if operationally needed, with attributable change history; otherwise admin-only. Cost visibility and edit authority need separate approval. No price limits/thresholds invented |
| D03 | May Managers approve inventory adjustments? May they approve their own requests? | Decide admin approval, independent manager approval or another approved process. Recommend separating requester and approver for manual adjustments; combined Manager role alone cannot prove independence. No value threshold or stock-loss policy selected |
| D04 | Do refunds and voids require separate approval, and from whom? | Approve distinctions between pending cancellation, completed-sale void, invoice status and refund/stock restoration. Recommend explicit approval/execution capabilities with reasons and immutable history. Refund process is missing; no accounting, tax or reversal rule is inferred |
| D05 | May cashiers see other cashiers' transaction history? | Recommend own completed history by default; allow only minimal queue data needed to process a shared store order. Broader history/reprints/PII require an approved store scope and rationale |
| D06 | Which reports, costs, expenses, credit/partial/debt methods and settings belong to Manager/Cashier? | Approve visible fields, periods, aggregates and operational duties. Historical features remain until approved transition; collected amount is not profit |
| D07 | Single role or multiple roles; which existing accounts map to which duties? | Recommend retaining one primary role with an explicit capability policy initially, matching current architecture. Confirm manager/admin checkout duties without assuming hierarchy. Multiple role assignment requires separate schema/design review |
| D08 | Shared store ownership, kiosk statuses, payment location, reservations, pickup and cancellation | Approve resource model/record scope and allowed transitions. Current owner-linked data cannot simply become a centralized store queue. Account-role migration is not catalog/order migration |
| D09 | Account lifecycle, last-admin protection, audit retention and access | Establish legitimate administrators, provisioning approvals, recovery/deactivation and retention rules. Current role alone does not prove legitimacy. No retention period, new disable flag or self-demotion rule selected |

The owner must approve the matrix/version and each P decision before implementation. Security/data maintainers must review resulting schema/API/migration plans; operational staff should validate duties. No named account, provider permission or actual account inventory is known from this local phase.

## 4. Recommended migration strategy — DO NOT EXECUTE

### Design boundary

Possible future stored identifiers are existing admin plus proposed store_manager/cashier/customer, but **these identifiers are suggestions only**, not values added to the schema. Preserve user as an explicitly handled legacy value during any approved transition. Never reinterpret unknown or legacy values as privileged roles, automatically treat user as Customer, or add public provisioning with a client-selected privileged role.

Required design changes would span User enum/default/validation, provisioning/update allowlists, authorization policy, response field filtering, admin UI role choices, route navigation and object scope. The hardcoded admin-only account mutation guard should remain admin-only; adding Manager to product/report permissions is not authority to broaden that guard. Update every alias consistently. A schema-only or UI-only change is insufficient.

### Staged plan and approval gates

1. **Approve requirements and inventory method.** Resolve D01–D09 and confirm a versioned policy. A01 live target/account inventory remains blocked; any future account review requires its separately approved read-only method. No database query is part of Phase15B.
2. **Prepare owner-reviewed mapping.** Identify immutable account IDs and actual duties using minimal/redacted administrative evidence. Keep confirmed legitimate admins as Administrator only after legitimacy review; flag uncertain cases for owner decision without automatically disabling/demoting them. Review each legacy user individually: recommend Cashier only when the approved job requires checkout; Store Manager only for approved catalog/stock duties. Customer mapping requires a verified identity/use-case decision. Do not infer role from username, existing broad access, creator/customer records or usage volume.
3. **Resolve data access separately.** Document owner-linked products/orders/receipts/reports each account currently needs. A role change may restrict access without changing record ownership. Obtain a separate resource/compatibility plan; do not merge catalogs, reassign orders or rewrite transaction history as a side effect.
4. **Prepare backup, dry-run and recovery artifacts.** Before authorized persistent changes, define affected fields (role/tokenVersion and only explicitly approved lifecycle fields), exact ID-based mapping, expected counts, compatibility, backup ownership, verification and rollback. An additive role-enum expansion in application code is not authority to modify stored data. A future dry-run must be non-writing and approved, returning only necessary mappings/counts.
5. **Implement/review locally first.** Use synthetic role/record fixtures and deny-by-default policy tests; retain existing legacy role behavior only through an explicitly approved temporary compatibility policy. Do not silently retain broad user access forever or remove all existing user access without a planned cutover. Exact deployment ordering and compatibility artifacts require later review.
6. **Authorize controlled cutover separately.** Approve the exact account mappings, access impact, deployment/data steps and login interruptions. Use security-aware account update paths that atomically advance tokenVersion with role changes. Do not bulk-update role fields through an unguarded query/migration or reset epochs. Existing bcrypt hashes, account IDs and confirmation states stay intact unless explicitly authorized otherwise. Unconfirmed users must not be activated by role mapping.
7. **Validate and reconcile.** Verify expected mappings and permissions, denied paths, preserved histories and only authorized session revocation in an approved environment. Log attributable results without passwords/hashes/tokens. A failed/indeterminate response must be reconciled before resubmission; no unsafe automatic retry.

### Recovery and compatibility

Rollback must retain expiry/version checks, guarded writes and R2 replay protection. Restoring an earlier role requires a new approved security change and monotonic epoch advance, not restoration of an old tokenVersion. Backups may contain old roles/passwords/epochs; restoring them can revive prior access and requires a separate recovery/session strategy. Never use a pre-security application or reset epochs to zero as a compatibility workaround.

Permission policy changes without stored role changes also need an explicit authorization/revocation assessment. They are not automatically covered by a role-field save hook. Require fresh authentication/epoch changes when the approved security transition requires them; do not silently invalidate all accounts in this design phase. No production migration, deployment, account-wide logout or credential action is approved.

## 5. Future RBAC acceptance criteria

The following are required **future** tests/acceptance targets, not tests added or results claimed here. Exact P outcomes must be resolved first.

| ID | Acceptance criterion |
| --- | --- |
| RB01 | Approved role values persist/round-trip correctly; malformed/unknown values cannot grant authority. Legacy accounts follow the approved mapping/compatibility rule; User/Person identities are not conflated |
| RB02 | Every protected endpoint/method has positive and negative tests for all four roles, anonymous/unconfirmed/deleted accounts, expired/wrong-signature/malformed/stale tokens. Test direct API calls independently of hidden menus |
| RB03 | Current persisted role overrides a forged/cached admin claim. Password/reset/role/confirmation changes advance epochs atomically; old tokens remain rejected after demotion/restoration. Preserve the established seven-day lifetime and strict legacy-token policy |
| RB04 | Only Administrator can provision/list/edit staff privileges, confirm/reset/delete accounts. Body field injection cannot escalate rights through signup/profile/product/order endpoints. Managers cannot assign themselves or another user Administrator |
| RB05 | Canonical/uppercase/mixed-case self-delete rejects before either deletion function/session/fence; malformed IDs safely reject. Authorized peer administration still works |
| RB06 | Every allowed operation enforces approved store/record scope: list/detail/search/aggregation/export/receipt paths cannot leak another store or unauthorized cashier's/customer's data by changing an ID/filter |
| RB07 | Cashier cannot edit price/cost/stock or access full management reports. Approved Manager/catalog rights do not expose account administration. Response filtering excludes costs, secrets, hashes, tokens and unauthorized personal data |
| RB08 | Receiving/adjustment tests cover request versus approval versus application, unauthorized transitions, maker/approver identity if approved, recorded responsible users and reasons. No stock ledger acceptance based solely on a quantity input |
| RB09 | Approved void/refund/cancellation authority is enforced on every entry point, including DELETE order alias, transaction void and invoice markVoid. Denied actions produce zero financial/stock effects. No refund test invents unapproved settlement/accounting rules |
| RB10 | Order and payment transitions are server-validated; no arbitrary status/price/payment-state assignment from the client. Concurrent cashiers and duplicate submissions require explicit integrity tests under approved semantics |
| RB11 | Guest/customer kiosk cannot call staff APIs or enumerate another person's order/receipt. If login is chosen, secure User/order ownership binding is tested; if guest is chosen, approved session/reference/privacy/rate controls are tested. No current user-role shortcut |
| RB12 | Cashier cross-history, Manager price edits/adjustment approval and financial visibility match the signed D decisions exactly, including denial cases and aliases |
| RB13 | Administrator requests admitted before revocation cannot regain privilege at mutation time. Keep actor-version guard, same-transaction fence and safe retry rechecks; do not broaden adminAccountFilter for convenience |
| RB14 | Both R1 commit replay probes continue to pass: uncertain commit cannot repeat target/fence effects; legitimate confirmed-abort/ack retries remain; cleanup preserves acknowledged success and primary error; unknown outcomes retain retryable false |
| RB15 | Frontend navigation/pages/actions match approved permissions, stale UI state does not bypass the backend, and account errors remain sanitized. Customer surfaces do not render staff routes through cached storage manipulation |
| RB16 | Migration dry-run/commit/recovery verifies exact authorized account IDs/counts, unchanged bcrypt/confirmation/history/ownership, expected epoch increases, protected last-admin rules if approved, and no automatic treatment of uncertain accounts |
| RB17 | Durable audit entries, if approved/implemented, identify actor/target/action/time/result without credentials; unprivileged roles cannot alter them. Missing audit functionality cannot be called verified based on request logs |

Use mocked unit/HTTP tests for policy and denial effects first. Native transaction/concurrency, effective database privileges and recovery guarantees require separately authorized isolated integration; **A08B has not started**. Later browser tests must verify actual route/focus/error behavior rather than claim success from SSR or role-select markup.

## 6. Current verification, deferred risks and stop

No tests, builds, migrations, seeders, provider calls or database operations were run in this analysis-only phase. Latest Phase15A reports client16 passes/build pass, existing targeted Layout2 errors and full client16 errors/13 warnings; earlier R2 independent evidence reports backend129 passes. These are historical local results, not new Phase15B RBAC tests or native proof.

The product cost-price omission/reset defect and five financial/inventory risks remain open and unchanged. A permission restriction does not itself fix repeated/lost stock updates, partial activation, duplicate payment requests or financial error masking. No new credit/refund/discount/tax policy, shared catalog migration, audit retention rule or server settings capability was introduced.

Only this new design document and a dated additive implementation-plan entry are delivered. Application/tests, schemas/APIs, environment files/manifests/lockfiles, accounts, prior reports and existing branding/security changes are preserved. **Stop for owner approval of the matrix and unresolved decisions. Do not implement roles or begin A08B.**
