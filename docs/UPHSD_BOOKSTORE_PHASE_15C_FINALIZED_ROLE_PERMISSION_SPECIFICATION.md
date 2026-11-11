# UPHSD Bookstore POS — Phase15C finalized role-permission specification

**Formal project title:** UPHSD BookstorePOS: Point-of-Sale and Inventory Management System for the University Bookstore

Date recorded: 2026-11-03, Asia/Manila. Source of approval: the owner's Phase15C specification supplied in this conversation.

**Business design: FINALIZED. Implementation: NOT STARTED. Implementation authorization: NOT GRANTED.**

## 1. Authority and scope

This records the approved business-level role structure and permissions. It supersedes conflicting **proposals** and pending decisions in [Phase15B](UPHSD_BOOKSTORE_PHASE_15B_ROLE_PERMISSION_DESIGN.md) only where expressly resolved below. Phase15B and historical security reports remain unchanged. The application still uses admin/user; no account, role value, schema, API or authorization code has been changed by this document.

This phase authorizes requirements finalization only, not implementation, migration, account modification, database/provider access, native integration testing or deployment. No test result is evidence that these future roles already exist.

## 2. Approved four-role structure

1. **Administrator** — system administration and access management.
2. **Store Manager** — daily bookstore operations and inventory, combining the former Manager and Inventory Staff responsibilities.
3. **Cashier** — customer purchases and payment processing.
4. **Customer / Student** — catalog browsing and kiosk ordering, with both guest and authenticated modes.

A separate Inventory Staff role will not be introduced under this structure. Persisted role identifiers and implementation representation are not assigned here.

## 3. Responsibilities and restrictions

### Administrator

Create, edit, activate and deactivate employee accounts; assign roles; manage permissions and system settings; manage product information and prices; view system-wide sales/inventory reports; review audit logs; monitor overall operations.

Sensitive financial/inventory actions remain auditable. Completed financial records must not be silently deleted or rewritten. All existing administrative security protections remain mandatory. Inventory work, cashier sales/payment/receipt duties and refund/void approval are **not implied** by account-administration authority; their conditional authorization is retained in the matrix.

**Product price changes belong exclusively to Administrator.** Store Manager and Cashier cannot independently change prices, including through a combined product/stock payload or alternate endpoint.

### Store Manager

Monitor daily/weekly/monthly sales, sales reports, all cashier transactions and cashier summaries; oversee orders and daily operations; monitor prices/availability, low/out-of-stock products; receive inventory; perform stock adjustments directly; review movement history; investigate discrepancies; approve and process authorized refunds and voids.

Cannot manage user accounts or system roles, create/assign Administrator accounts, alter security settings or product prices. Product-information management is not granted by default. Cannot silently alter/delete completed financial records. Sensitive adjustments/refunds/voids require reasons and audit records as specified below. System-wide security audit-log access is not granted by default; operational movement history is distinct.

**Direct Manager inventory adjustments are approved.** An extra independent adjustment-approval workflow is not imposed by this specification. **Manager refund/void approval and access to all cashier transactions are approved.** Sales/payment/receipt cashier duties remain conditional rather than automatic role inheritance.

### Cashier

Access POS, search/select available products, build transactions, use authorized product prices for totals, record approved payment methods, complete authorized sales, generate/print receipts, review personal transaction history/summaries and process assigned orders under the approved workflow.

Cannot manage accounts/roles, change product prices, directly adjust inventory, independently approve refunds/voids, edit/delete completed financial records or access another cashier's private transaction history by default. May submit a refund/void request to the Store Manager. Approved order fulfillment access does not grant unrestricted cross-cashier history.

### Customer / Student

Browse/search catalog and product details/prices/availability; build/submit kiosk orders; receive an order reference; track their own orders when that functionality exists.

Cannot access internal dashboards/reports, other customers' private orders, staff/admin functions or stock/price mutations. Both **guest ordering without an account** and **authenticated student ordering** are required. Orders must distinguish the modes and protect private student information. This does not authorize a student-directory/GradeSense integration or creation of staff accounts for guests.

## 4. Approved business permission matrix

Conditional entries are part of the owner's specification, not unconditional grants. Deny unassigned permissions by default. All enforcement must occur in the backend; frontend visibility alone is insufficient.

| Capability | Administrator | Store Manager | Cashier | Customer / Student |
| --- | --- | --- | --- | --- |
| Manage user accounts | Yes | No | No | No |
| Assign roles | Yes | No | No | No |
| Configure system settings | Yes | No | No | No |
| View system-wide audit logs | Yes | No by default | No | No |
| View all sales reports | Yes | Yes | No | No |
| View all cashier transactions | Yes | Yes | No | No |
| View own transactions | If applicable | If applicable | Yes | Own orders only |
| Manage product information | Yes | No by default | No | No |
| Change product prices | Yes | No | No | No |
| Receive and adjust inventory | If authorized | Yes | No | No |
| View inventory movement history | Yes | Yes | No by default | No |
| Approve refunds and voids | If separately authorized | Yes | No | No |
| Request refunds or voids | If applicable | Yes | Yes | No |
| Process sales | If authorized | If authorized | Yes | No |
| Record payments | If authorized | If authorized | Yes | No |
| Generate receipts | If authorized | If authorized | Yes | No |
| Browse products | Optional | Optional | Yes | Yes |
| Submit kiosk orders | No special need | No special need | No | Yes |
| View private order status | If operationally necessary | If operationally necessary | If needed for fulfillment | Own orders only |

The stated Manager responsibility to view product prices is retained; optional catalog browsing does not confer edit rights. Conditional administrative/operational access must have an explicit implementation authorization rule, not an unrestricted admin override. Unassigned cost-field, export, expense or other capabilities must not be silently inferred from adjacent permissions.

## 5. Approved business rules

### Pricing

Only Administrators change product prices. Checkout uses currently authorized prices validated by the server. Store Managers may view prices but cannot edit them. Historical sales preserve the price recorded at sale time. No role can bypass price authority through catalog, checkout, adjustment, import or alternate route inputs.

### Inventory

Store Managers receive and adjust stock directly. Adjustments record actor, timestamp, affected product, quantity change and reason; movement history is retained. Concurrent stock changes must not silently overwrite each other. Repeated transaction requests must not duplicate stock deductions. An authorized role alone does not satisfy concurrency/idempotency requirements.

### Refunds and voids

Store Managers approve and process authorized refunds/voids. Cashiers may request but cannot approve them independently. Each action requires a reason and audit record; completed financial history remains traceable. No silent deletion/rewriting is allowed.

**Inventory and payment effects of refund/void must be defined before building these workflows.** Approval authority does not by itself define repayment method, partial refunds, reversal accounting, restocking conditions, cancellation states or other financial policy. Administrator approval remains separately authorized where the matrix requires it.

### Cashier history

Managers may review all cashier transactions; cashiers review their own. Other-cashier transaction details are denied unless separately authorized. Administrative access is recorded where appropriate. Fulfillment access is scoped to what the approved workflow needs, not treated as a blanket history grant.

### Guest and authenticated ordering

Support both modes, distinguishing guest orders from authenticated student orders. Guests receive an order reference. Students may access only their own private order information. A reference must not become an unreviewed means to enumerate private orders. Submission alone is **not payment receipt or sale completion**.

## 6. Security invariants

Preserve JWT expiration, token-version validation, current-account authorization, administrator mutation guards, canonical ObjectId self-delete protection, password hashing/authentication safeguards, redacted diagnostics and A08A-R2 commit-boundary replay protections.

Every protected operation requires backend authorization, deny-by-default unassigned capabilities, privilege-escalation protection, proper record/transaction ownership checks and sensitive-action audit logging for accounts, inventory, pricing, refunds and voids. No silent completed-record modification/deletion is permitted. No UI role selector or hidden button replaces server checks.

## 7. Existing account migration requirements — not authorized for execution

Future planning must identify existing accounts through an approved method; preserve the existing Administrator account and its **verified** privileges; individually review existing user accounts; avoid automatic Manager/Cashier grants; require an authorized administrator's approval of account-role mappings; preserve compatible password hashes/security controls; provide appropriate reauthentication/token invalidation when role changes affect sessions; and define recovery for migration failures.

This approval does not establish the identity or legitimacy of any live administrator. The roster/effective privileges must be verified under the approved access process. No existing account was inspected, assigned, disabled, renamed, reset or migrated. Role transitions must retain atomic security-version changes and monotonic revocation history; do not restore old epochs or a pre-security implementation as rollback.

## 8. Phase15B acceptance criteria carried forward

**All17 criteria RB01–RB17 in [Phase15B section5](UPHSD_BOOKSTORE_PHASE_15B_ROLE_PERMISSION_DESIGN.md) are incorporated in full and remain mandatory.** The canonical text has not been edited or weakened. This specification specializes their pending business decisions as follows:

| Criteria | Approved interpretation/additional check |
| --- | --- |
| RB01–RB06 | Four-role storage/mapping, backend enforcement, current-account security, admin-only account administration, self-delete protection and approved object scope remain required |
| RB07 | Administrator-only product pricing; Manager and Cashier denied price edits through every route/payload. Manager product-information management remains denied by default |
| RB08 | Manager direct receiving/adjustment is allowed with required movement/audit fields. Test denial for unauthorized roles. Do not add a second-approver requirement from an earlier proposal; approval identity checks apply where the final workflow actually requires approval |
| RB09 | Manager approval/processing, cashier request-only authority and reason/audit requirements enforced across every void/refund alias. Financial/stock effects must be specified before implementation |
| RB10 | Authorized server prices, stock concurrency and duplicate-effect protection; order submission is not payment/sale completion |
| RB11 | Both guest and authenticated student ordering are required, not mutually exclusive alternatives. Test safe identity separation, own-order privacy and denial of staff APIs in both modes |
| RB12 | Manager cannot edit product prices, may directly adjust stock, approves refunds/voids and views all cashier transactions. Cashier completed history stays own-only unless separately authorized |
| RB13–RB16 | Existing actor/version/commit guards, frontend/backend consistency and exact approved migration/security recovery criteria remain unchanged |
| RB17 | Sensitive account/inventory/pricing/refund/void audit logging is now a business requirement. Existing request diagnostics alone do not satisfy durable action traceability |

The table is an interpretation index, **not a replacement or reduction** of the17 full criteria. The complete future suite must include positive/negative authorization checks for each role, plus explicit checks of Administrator-only price changes, direct audited Manager stock adjustments, Manager refund/void approval, Manager all-cashier history, Cashier own-only history and both kiosk modes. No such new implementation/test result is claimed here.

## 9. Approved decisions versus remaining implementation details

The five owner decisions are settled: Administrator-only pricing; direct Store Manager inventory adjustments; Store Manager refund/void approval; Store Manager all-cashier history with Cashier own-only default; and both guest/authenticated kiosk ordering. Do not reopen them as unapproved proposals in the next plan.

The next separately authorized implementation-planning step must still specify:

- Exact persisted identifiers, legacy compatibility and representation of conditional/multiple operational permissions; actual account mapping and verified administrator roster.
- Shared-store/resource scope versus existing owner-linked data, guest/student order binding, privacy protections, approved reference/status/fulfillment access and kiosk session cleanup.
- Allowed payment methods and financial/inventory effects of refunds/voids before those workflows are built; any reservation/pickup/cancellation rules not settled here.
- Audit event structure, retention/access and failure handling; activation/deactivation representation; approved nonsecret system settings and any last-admin protection. Existing code does not establish these features.
- Cost information visibility/edit scope, expenses, exports and other unassigned capabilities; remain deny-by-default rather than inventing permission grants.
- Backup, recovery, deployment ordering, approved session cutover and native verification scope.

These are required implementation details, not authority to change the finalized role responsibilities. No schema or API plan, provider connection or production rollout is approved by this document.

## 10. Deferred risks and boundaries

Open: repeated stock adjustments; lost concurrent adjustments; partial activation; payment resubmission; financial error masking; omitted cost-price reset on product edit; and unverified native MongoDB transaction behavior. Role design fixes none of them.

A08B remains blocked pending disposable target/isolation, effective permissions, fail-closed runner, approved test/cleanup scope and explicit authorization. No account migration, implementation, schema/API/workflow change, external/database connection, test/build, deployment, session invalidation or credential change was performed in Phase15C. Earlier reports/tests remain historical evidence. The POS remains independent of GradeSense AI.

**Final status: FINALIZED DESIGN — PENDING IMPLEMENTATION AUTHORIZATION. Implementation status: NOT STARTED.**
