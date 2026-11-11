# B02-A — Final owner decision record

Date: 2026-11-04, Asia/Manila. UPHSD Bookstore POS.

**Authority:** the project owner's “B02-A Final Owner Decision Record” instruction in this conversation. **Scope:** documentation and contract update only. Policy approval is not implementation, migration, account/session invalidation or deployment authorization.

Related documents: [updated role/account contract](UPHSD_BOOKSTORE_B02_A_ROLE_ACCOUNT_CONTRACT.md), [B02 assessment](UPHSD_BOOKSTORE_B02_COMPATIBILITY_ASSESSMENT.md), [approved Phase 15C specification](UPHSD_BOOKSTORE_PHASE_15C_FINALIZED_ROLE_PERMISSION_SPECIFICATION.md), [Phase 15B acceptance criteria](UPHSD_BOOKSTORE_PHASE_15B_ROLE_PERMISSION_DESIGN.md). Prior reports and plan entries remain historical evidence.

## 1. Approved Decision 1 — Conditional permission delegation

**Administrator only.** Only a current Administrator with internal role admin may grant or revoke conditional capabilities. Store Manager, Cashier and Customer / Student cannot delegate or grant permissions.

Every grant follows the existing approved conditional capability definitions, eligible recipient role and scope. Granting cannot exceed the Administrator's authorized boundaries, create a new permission, change the recipient's role or bypass pricing, history, inventory or reversal restrictions. No automatic unrestricted self-grant or Administrator financial override is approved.

Audit requirements must record grant and revocation, approved scope, reason and expiration. Execution must validate current account authority, not a cached/JWT role or request-supplied conditionalActions.

**Security rationale:** centralizing grant execution prevents lower-privileged users from elevating themselves. Restricting delegation to existing capability boundaries prevents permission management from becoming an unlimited operational override. These are security implications of the owner's decision, not new business permissions.

**Still unresolved:** self-grant approval procedure, who separately approves Administrator reversal powers, grantor-turnover handling and exact persistence/audit design. Only Administrator may execute grants/revocations even if a separate business approval is required.

## 2. Approved Decision 2 — Legacy user account handling

**Manual review and assignment.**

- Preserve all legacy user accounts.
- Do not automatically convert user to customer or any other business role.
- Review each account individually and assign a canonical role only after an authorized assignment decision.
- Preserve account data, compatible hashes, IDs and linked transaction/history records.
- Do not grant additional privileges to an unreviewed account.
- Existing admin retains its compatibility mapping; role alone does not verify live administrator legitimacy.

**Awaiting-review compatibility:** the adapter represents user as legacy-unassigned, not a fifth business role and not Customer. Authentication compatibility never supplies a new business capability. This documentation phase leaves runtime access unchanged. A future release must define the exact existing-access envelope and cutoff explicitly; neither broad new-role grants nor a silent loss of existing access follows from this record.

The contract's proposed review process requires verified target/account evidence through the separately gated A01 process, canonical exact IDs, expected role/epoch/state, verified duties, target role, authorized Administrator approval and an auditable result. Conflicting, stale or uncertain assignments stop for reconciliation. The precise operator workflow and actual account assignments remain unapproved and unexecuted.

**Security rationale:** reviewed mappings prevent accidental privilege escalation and prevent misclassifying staff-owned data as student identity. Preservation avoids destroying access evidence or transaction lineage.

## 3. Approved Decision 3 — Account suspension

**Immediate enforcement.** Upon an authorized suspension:

- Immediately block new authenticated requests.
- Immediately invalidate existing authenticated sessions/tokens through the established tokenVersion mechanism.
- Reject subsequent requests from the suspended account and prevent new login while suspended.
- Preserve account records, transactions, orders and audit records.
- Do not delete account data as part of suspension.

The future design must atomically establish suspended status and a monotonic tokenVersion advance. Every protected request must enforce current account status and epoch server-side. An old token cannot regain access after reactivation. Browser logout alone is insufficient, and token bytes need not be removed from a browser for the backend to reject them.

Existing confirmed remains confirmation, not a silently repurposed suspension flag. Independent status representation, missing-state treatment and approved defaults remain technical decisions. Reactivation retains the existing contract's Administrator authority, fresh epoch and fresh-login requirements; it cannot restore revoked/expired grants or old tokens.

**In-progress operations:** immediate rejection of subsequent requests does not establish whether an already-admitted transaction must drain, abort or finish at a previously acquired serialization boundary. That policy and implementation must be defined and tested before enabling suspension. Preserve actor-version checks, transaction atomicity, committed records, primary errors and R2 no-replay safeguards. Do not cancel by rewriting completed financial history or automatically retry/reverse an uncertain operation. No grace period, forced rollback or blanket permission for in-flight work is invented.

**Security rationale:** persisted suspension plus version invalidation closes reuse of previously issued tokens. Separate confirmation/status semantics prevent reactivation from accidentally revalidating stale sessions. Truthful outcomes and reconciliation protect financial/inventory integrity.

This is a required future behavior. No account, session or token was suspended or invalidated during this update.

## 4. Approved Decision 4 — Conditional permission duration

**Temporary permissions with explicit expiration dates.**

Each grant creation must explicitly supply its expiration date. No default duration, indefinite assignment or missing-expiration fallback is allowed. Exact duration values are supplied for each authorized grant, not invented by this record.

Server-side evaluation must reject expired grants and fail closed for missing or invalid expiration values. Administrator may revoke a grant before expiration. Revocation and expiry must affect authorization regardless of UI state or scheduled cleanup.

Audit requirements include grant, expiration and revocation events. Exact event schema and how expiry events are recorded remain unresolved; delayed/failed event recording cannot extend permission beyond its expiration.

**Security rationale:** bounded grants limit lingering authority. Request-time server checks prevent stale UI/JWT claims or a delayed expiry job from retaining permission.

## 5. Unchanged identifiers and security architecture

| Business role | Exact internal identifier |
| --- | --- |
| Administrator | admin |
| Store Manager | store_manager |
| Cashier | cashier |
| Customer / Student | customer |

One authoritative stored business role remains User.role, with a strict explicit compatibility adapter to B01 business labels. No second persisted role field, role array or fifth role. Unknown/malformed roles fail closed; no coercion/default privileges.

Authentication and authorization remain separate. Registration/profile/account updates cannot escalate privileges. Preserve bcrypt handling, HS256 and the established seven-day JWT contract, current-account/tokenVersion validation, Administrator mutation guards, canonical ObjectId self-delete protection, redacted diagnostics and A08A-R2 commit-boundary protections.

The original 13 conditional capability names / 19 eligible role-capability pairs are unchanged; this record approves their delegation/duration rules, not runtime attachment or actual grants.

## 6. Unchanged Phase 15C business permissions

1. Both guest and authenticated student kiosk ordering.
2. Only Administrator may change product prices.
3. Store Manager may directly adjust inventory.
4. Store Manager approves refunds and voids.
5. Store Manager may view all cashier transaction histories; Cashier may view only their own by default.

No separate Inventory Staff role, new financial policy, automatic admin operational override or guest staff-API access is added.

All 17 mandatory Phase 15B criteria RB01–RB17 remain incorporated in full and interpreted through Phase 15C. The canonical criteria and historical reports are not edited. New owner decisions strengthen lifecycle/grant acceptance requirements; they do not replace any criterion or claim its implementation.

The contract retains all 59 protected-route rows and 23 inherited HEAD forms, including effectful receipt-ensure paths and all existing conditional/resource/field constraints. No route permission is expanded by these decisions.

## 7. Remaining implementation details and approval boundaries

| Detail | What is settled | What remains |
| --- | --- | --- |
| Grant creation | Administrator only, approved capability/scope and explicit expiry | Actual per-grant duration/date; exact timestamp format/precision, validation, storage and safe DTOs; no default duration |
| Grant approval | No non-admin delegation or boundary expansion | Self-grant/Administrator reversal approval procedure, grantor turnover and required approval evidence |
| Audit | Record grants, expirations, revocations, scope, reason and expiry; preserve existing sensitive-action audit requirements | Event fields, identifiers, retention/access, expiry-event delivery, transaction/outbox and failure/reconciliation consistency |
| Suspension | Immediate denial and token-version invalidation; preserve records | Status field/schema and missing legacy state; exact atomic writer/read admission and error semantics |
| In-progress operations | No financial/inventory corruption or unsafe replay; preserve committed/uncertain outcomes truthfully | Serialization and handling of already-admitted/fenced operations; concurrent suspension races, acknowledgement and recovery policy |
| Legacy review | Individual authorized assignment; no automatic conversion or new privileges | Exact workflow, reviewer evidence, actual ID mappings, compatibility endpoint envelope/cutoff and notifications |
| Reactivation/recovery | No old-token revival or deleted history | Last-admin/self-suspension rules, emergency recovery authorization and implementation procedure |
| Migration/rollback | Preserve identities/history/security; no blind epoch restoration or generic user fallback | Concrete tooling, dry-run/backup/recovery evidence, target/operator, execution and reconciliation steps |
| Later dependencies | Phase 15C boundaries and existing activation firewall remain | Shared scope, student/guest identity, unassigned operations, refund effects and complete backend perimeter through separately authorized batches |

No settled owner policy is reopened by these remaining details. Exact grant dates must be supplied when creating grants; their absence now does not make temporary-expiration policy unresolved.

A01 live identity/account verification and A08B native integration evidence remain separately gated. This record does not start them. Existing deferred inventory/financial risks and omitted cost-price reset remain open.

## 8. Documentation changes and validation

- Created this owner decision record.
- Updated the affected clauses of the B02-A contract, retaining its original inspection/verification history as historical evidence.
- Appended a dated owner-decision entry to the implementation plan; no earlier entry replaced.

Completed preservation checks:

- All four approved decision sections are present; the contract's D01–D04 status distinguishes each approved policy from its remaining mechanics.
- The contract's role table/adapter section, all 59 route rows, HEAD coverage section (23 forms) and conditional capability inventory are unchanged from the pre-update snapshot.
- The canonical Phase 15B criteria file and approved Phase 15C specification match their original hashes. All 17 criteria and the five approved business permissions remain intact.
- All 70,147 original implementation-plan bytes remain an exact prefix of the updated plan.
- Before/after project file hashes show only the authorized contract and plan changed, this decision record added, and no files removed. All other reports, application code, tests, configuration, environment files and lockfiles in the snapshot, including the existing backend dependency-directory lockfile, remain unchanged. No account/schema/session operations occurred.
- git diff --check passed; existing LF/CRLF notices are informational. No runtime test, build or lint suite was executed or claimed.

No runtime tests, builds or lint suite are needed to validate a documentation-only policy record. No runtime behavior is claimed verified here.

**Stop boundary:** documentation complete only. B02-B, B03, A08B, role activation, migration, account/session changes, external connections and deployment remain unstarted and unauthorized by this record.

