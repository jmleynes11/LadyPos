# B02 — Independent security review

Date: 2026-11-04, Asia/Manila. UPHSD Bookstore POS.

**Verdict: PASS WITH LIMITATIONS for the owner-approved local B02 account-management scope. No demonstrated local acceptance blocker remains. Production activation is not authorized or verified.**

## Independence and scope

The implementation author performed remediation; separate read-only reviewer tasks b02_independent_review (initial findings) and b02_final_acceptance (final verdict) inspected actual code and ran independent probes. The initial reviewer session ended before a final verdict; it is not represented as acceptance. The fresh final reviewer reproduced/rechecked failures and reaffirmed PASS WITH LIMITATIONS after the final delta and final focused run. This report is compiled by the parent from their outputs; reviewers modified no files.

Authority includes Phase 15C, B02-A owner decisions/lifecycle contracts and the owner's subsequent explicit packet: fence-first ordering, scoped B02 acceptance with later criteria retained, new active/unconfirmed accounts, missing-only admin/user compatibility, manual legacy review, no self-grants, grant invalidation, last-admin protection, no self-recovery and atomic retained audit/no export. No new business policy was supplied by a reviewer.

## Files and paths inspected

- backend/services/accountManagement.js: accountCommand, strict actor fence/realm lock, last-admin validation, creation/update/delete, review/application, scope validation, grant-set/revoke/resolver/expiry.
- backend/utils/accountTransaction.js and earlier accountCommitBoundary/accountMutationOutcome helpers: callback/commit distinction and cleanup/unknown results.
- backend/models/User.js and AccountControl.js: strict noncasting account/grant security state, schemas, atomic epoch hooks, append-only audit/unique identities.
- backend/controllers/UserController.js and AccountLifecycleController.js: input/preconditions, safe responses, actor/target isolation and new route commands.
- backend/auth/accountState.js, accountRoles.js, auditText.js, accountRouteManifest.js, B01 capabilities and historical route manifest.
- backend/middleware/authMiddleware.js, roleAdmission.js and accountOperation.js: current-account admission, continued new-role operational denial and effectful-session fence.
- UserRoute plus business route wrappers and domain borrowed-session changes in Order/DebtPayment/Product/Person/Invoice/Expense controllers.
- backend/utils/seedAdmin.js: no unapproved bootstrap exception.
- New account staged adapter/tests and original compatibility/policy/inventory regressions. Historical security reports informed requirements but were not assumed proof.

## Independently found issues and remediation cycle

| Finding | Final correction / independently assessed disposition |
| --- | --- |
| Free-text review/grant/audit reason, evidence or approval can retain secrets | Audit-specific storage/read redaction now covers known secrets, labelled passwords/secrets, bcrypt, JWT/Bearer and connection material; safe DTOs |
| Missing expected target version or retained command identity | New mutation routes require explicit expectedVersion and stable operationId; security-sensitive legacy PUT requires version; private receipt conflicts reject |
| Incomplete role-assignment command acknowledged as profile change | Exact canonical role required; no-op role/lifecycle commands reject rather than fake a change |
| Owner scope confused with assigned-order authority | order.fulfill remains ungrantable until assignment contract exists; no B03 scope invented |
| Append-only model guards missed mutation forms | Document delete, replacement and bulk mutation paths blocked in addition to query/save guards |
| Invalid clock could bypass expiry comparisons | Resolver rejects nonfinite/non-Date clock; strict time inputs and exact expiry boundary deny |
| Malformed/missing revokedAt could hydrate into allow | Strict Mixed nullable new-only revocation state; only explicit null can authorize |
| Malformed accountState could become legacy missing fallback | Mixed exact state preserves invalid types; missing-only compatibility and exact confirmation checks |
| Mongo equality count could treat malformed alternate admin as usable | Enumerate candidates under serialized realm, strict role/confirmation/state/epochs; last usable Administrator retained |
| Batch conditional duties could not coexist / installed Mongoose multi-create requirement | Explicit fresh-approved set shares one epoch; ordered:true batch creation supported; no old grants silently carried |
| Generic review-application alias lacked verification stamp | Applied review authority stamp set atomically after successful target save |
| Profile audit lacked changed-field evidence | Changed names without PII values, including compound commands, are linked events |
| Human commands could collide with deterministic expiry audit IDs | Machine expiry namespace reserved |
| Queued grant could expire before mutation | Recheck inside transaction immediately before creation; replacement effects roll back |
| Offline seed created confirmed Admin outside audit/realm | Unapproved bootstrap CLI disabled; recovery needs separate owner authorization |
| Confirmed duplicate key became500 |409 only for confirmed duplicate rejection; unknown/write-concern outcomes remain indeterminate |
| Former admin could retrieve peer-account result via own operation ID | Non-admin reconciliation requires both actor and target be current self |
| Singleton role array could coerce through Object.hasOwn | Explicit string checks on create/update/review; independent400/zero-commit probe |
| Administrative mutation DTO omitted version required for the next edit | Current securityVersion returned only to administrative callers; positive sequential-edit and self-profile exclusion regression passes |

These were local code/standalone helper defects or contract gaps, not claims of production exploitation. The account-policy foundation was remediated and independently rechecked. All previous no-replay, password, JWT/version and ObjectId protections remain required.

## Fresh independent checks and exact results

Final reviewer executed focused accountManagement, b02Compatibility, rbacPolicy and rbacRouteManifest suites: **99 passed, 0 failed**, including simultaneous Administrator self-demotions (one success, one409, exactly one usable Administrator).

Fresh stdin-only probes independently checked:
- Malformed lifecycle values and exact legacy missing-state compatibility.
- Invalid dates/clocks, malformed/missing revocation/expiry state, exact expiry instant and one-event expiry materialization.
- Labelled credential/hash/JWT/Bearer/URI exclusion from persisted review/audit metadata; benign text retained.
- Last-admin overcount before correction and strict rejection afterward.
- Singleton role arrays reject400 for create/update/review, with zero commits and unchanged accounts.

No probe files, source or tests were changed by reviewers. The initial sandbox run had localhost EACCES failures; rerunning with localhost permission passed. No database/provider/external network was used.

Parent's separately executed final verification: backend228/228, client16/16, production build pass, 42-file syntax pass, 40-file targeted lint pass with two pre-existing exceptions, full client lint16 errors/13 warnings. These are parent results, not falsely attributed to the reviewer.

## All 17 criteria and compatibility assessment

Phase 15B's canonical RB01–RB17 remain intact. The owner expressly scoped B02 to account portions; later operational portions remain mandatory. The full mapping is in [completion report section7](UPHSD_BOOKSTORE_B02_COMPLETION_REPORT.md#7-all-17-criteria--preserved-scope-mapping).

Locally accepted account slices: exact roles/legacy compatibility, admin-only guarded writes, manual review, strict role/state/version and JWT enforcement, canonical identity protections, conditional grant lifecycle/ceilings/expiry, immutable redacted applied-event audit, reconciliation privacy and actor/realm race behavior. New roles still cannot inherit operational permissions.

Not represented as completed: shared catalog/store/private operational scope, inventory ledgers, financial idempotency/refund policy, guest/student kiosk, Manager all-cashier operational reports, final frontend role navigation, actual migration/production/native evidence.

## Limitations and release gates

- Native MongoDB rollback, durability, write conflicts, index availability, provider permissions and backup/recovery are unverified.
- Global realm serialization has throughput/contention implications; native concurrent/load verification is required.
- Actual Administrator legitimacy/account inventory is unknown; different IDs alone are not independent-human verification.
- Production requires a finite legacy cutover plan and expiry maintenance invocation/monitoring.
- Failed attempts are best-effort redacted logs, not a durable applied-event ledger.
- Free-text secret detection is bounded to recognizable formats/known secrets; users must not submit credentials in reasons/evidence.
- Self-profile/password legacy APIs can generate operation IDs; lost-response reconciliation requires caller-retained stable identity. No automatic replay was added.
- No production migration/activation, B03 or A08B was executed.

**Recommendation: accept the local B02 account scope with these limitations; require separate evidence/authorization before production activation.**

