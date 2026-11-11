# UPHSD Bookstore POS — A06 self-delete ObjectId security fix

Date: 2026-11-02, Asia/Manila. **Result: A05-F01 fixed and verified locally.** The original A05 acceptance probe now passes. This does not certify production behavior or close the other A05 verification limits.

Only the account-identity parser, two affected backend sites, new regression tests and requested documentation changed. No external service/database connection, migration, production account/session/token/credential/permission change, environment/lockfile edit, dependency installation or deployment occurred. A01 remains blocked; prior reports retain their historical findings.

## 1. Inspection and reproduction before implementation

Read [A05 verification](UPHSD_BOOKSTORE_A05_SECURITY_VERIFICATION.md), [A04 results](UPHSD_BOOKSTORE_A04_SECURITY_REMEDIATION_RESULTS.md) and the implementation plan. Traced `UserRoute` protect/authorizeRoles through `UserController.deleteUser`, `adminAccountMutation`, Mongoose ObjectId handling and existing security tests.

Confirmed two affected comparisons:

- `deleteUser` compared target/actor strings before its self-delete restriction.
- `runAdminAccountMutation` compared target/actor strings when choosing the atomic self-update path versus a different-target transaction.

These comparisons treated uppercase and lowercase spellings as different strings although the installed driver's ObjectId codec recognizes the same identity. The self profile/password routes already target the server-owned account ID; list/provisioning use no equivalent target-ID comparison. No other account-management route required a comparison refactor. Business ownership comparisons outside account administration were left untouched.

Baseline backend `npm test`: **72 passed,0 failed/TODO**. Added permanent HTTP identity tests before changing runtime code, then ran:

`node --test --test-name-pattern="self-deletion using" tests/accountIdentity.test.js`

**Before fix:1 passed,2 failed, exit1.** Canonical lowercase returned the expected400; uppercase and mixed-case returned200 instead of400. This reproduced the A05 failure against the existing implementation using synthetic accounts and mocked persistence. No actual account was deleted.

## 2. Narrow correction

### Validated canonical representation

Added `backend/utils/accountIdentity.js`, exporting `canonicalAccountId`. It accepts exactly24 hexadecimal characters or a valid instance of the installed Mongoose/native BSON ObjectId type, validates the hexadecimal representation and uses the installed driver's `toHexString` conversion to return canonical lowercase text. Invalid input returns null.

The parser does not trim whitespace, stringify arbitrary request objects, accept numeric values or interpret buffers as account identities. Short/long/nonhex strings, boxed strings, arrays, null/undefined and malformed ObjectId instances are rejected. Valid all-zero or all-digit24-character hexadecimal IDs remain syntactically valid; account existence remains a separate lookup.

### Self-delete guard

`UserController.deleteUser` validates/canonicalizes the route target before identity comparison and passes that canonical target to the guarded lookup. It compares canonical target/actor values before calling the administrative helper or either deletion function.

Lowercase, uppercase and mixed-case self-delete requests retain the existing **400 / Cannot delete your own account** response. They start no session, perform no actor revision write, perform no deletion target lookup and invoke neither `User.prototype.deleteOne` nor the collection deletion method. The authentication middleware still loads the actor to authorize the request.

### Related administrative dispatch

`adminAccountMutation` uses the same parser for the authenticated actor and any non-creation target. Its self-target choice now compares canonical identities. Uppercase self-updates therefore use the existing single-document actor/version guard instead of unnecessarily entering the different-target transaction.

The explicit null target used by account creation remains its sentinel. Malformed mutation targets fail400 before sessions or target work. Malformed actor identities fail the existing401 boundary. Current admin/confirmation/epoch checks, majority self-save and primary/snapshot/majority cross-account transaction behavior remain unchanged. No authorization redesign, new role rule or schema change was needed.

### Response and compatibility behavior

| Request | Result |
| --- | --- |
| Authorized admin deletes self, any valid letter case |400, existing self-delete message, zero deletion calls |
| Authorized admin deletes a different existing account, including uppercase ID |200, existing User deleted message, guarded transaction retained |
| Ordinary authenticated user attempts deletion |403 from existing administrator guard, zero deletion calls |
| Anonymous/unconfirmed/stale-token request |401, zero deletion calls |
| Authorized admin supplies malformed DELETE/PUT target |400 with Invalid account ID before target lookup/mutation |
| Authorized admin supplies valid but nonexistent target | Existing404 / User not found |

Malformed target400 is the deliberate validation correction; invalid input must not reach Mongoose casting as a generic server failure. The fix does not prohibit deletion of other accounts, alter last-administrator policy, change role assignments or clean up historical records.

## 3. Permanent regression coverage

New `backend/tests/accountIdentity.test.js` contains **16 passing cases**:

1. Canonical lowercase self-deletion is rejected.
2. Uppercase self-deletion is rejected.
3. Mixed-case self-deletion is rejected.
4. Authorized administrator deletion of a different case-variant account succeeds.
5. Anonymous deletion is denied.
6. Ordinary-user deletion is denied.
7. Unconfirmed administrator deletion is denied.
8. Stale administrator-token deletion is denied.
9. DELETE rejects malformed target IDs before target/session/mutation work.
10. PUT rejects the same malformed target cases before target/session/mutation work.
11. A valid absent ObjectId preserves404.
12. Uppercase self-update uses the atomic self guard, advances the epoch on self-demotion and rejects the old token afterward.
13. Canonical identity matches across lowercase/uppercase/mixed strings and installed Mongoose/native driver ObjectIds.
14. Invalid values and ObjectId-like/coercible/forged objects do not become identities.
15. The administrative helper recognizes equivalent self identities without starting a transaction.
16. Invalid actor/target identities are denied before helper work or sessions.

The three self-delete cases each assert zero calls at **both** the document deletion method and native collection boundary, zero sessions/fences, only the middleware actor lookup and preservation of the synthetic account. Unauthorized cases also assert both deletion counters stay zero. No existing test was weakened, deleted or skipped.

The HTTP tests execute actual routes, protect/authorizeRoles, controller/helper and Mongoose query/save/delete code with synthetic records and mocked collections/sessions. Their simple adapter supports identity/control-flow assertions; it is not a database isolation engine and is not evidence of real rollback, concurrency or durability.

## 4. Verification results

| Check | Actual result |
| --- | --- |
| Original baseline backend suite |72 passed,0 failures/TODO |
| New targeted self-delete regressions before runtime change |1 passed,2 failed: uppercase/mixed-case200 instead of400 |
| Initial new HTTP file after fix |12 passed,0 failures;4 parser/helper cases subsequently added |
| Final backend `npm test` |**88 passed,0 failed/cancelled/skipped/TODO** |
| Client `npm test` |**8 passed,0 failed/TODO** |
| Client build to `<tool-temp>/uphsd-bookstore-a06-build` |PASS exit0; Vite8.0.3,671 modules; existing753.13kB JS/large-chunk warning remains |
| Client-wide installed ESLint JSON run |FAIL exit1: **existing16 errors/13 warnings**, unchanged; no client source modified |
| Targeted installed ESLint recommended JS + Node globals |PASS:4 changed/new backend JS files,0 errors/warnings; no lint configuration/dependency addition |
| Backend `node --check` |PASS:55 JS files,0 failures |
| Whitespace/diff review |PASS; pre-existing LF/CRLF notices remain |

**Original A05 probe replay: PASS exit0.** The stdin-only probe used the same synthetic account ID and actual app/authorization/delete flow as A05: canonical400, uppercase400,0 mocked collection deletion calls,0 sessions started,0 database connections. The assertion that failed in A05 now succeeds; the permanent tests add mixed-case and both deletion-boundary checks.

All previous JWT lifetime, version revocation, current-role/confirmation, administrator-race, password compatibility, payment and receipt regressions still pass. Client tests/build used existing installed dependencies; build output was outside the repository. No configured app/seed/production command was started.

## 5. Changed files

| File | Reason |
| --- | --- |
| `backend/utils/accountIdentity.js` — new | Shared strict driver-backed canonical identity parser |
| `backend/controllers/UserController.js` | Validate/canonicalize delete target and actor comparison; reuse canonical target for lookup |
| `backend/utils/adminAccountMutation.js` | Validate actor/target IDs consistently and choose self-target guard by canonical identity |
| `backend/tests/accountIdentity.test.js` — new | Permanent positive/negative case, authorization, malformed-ID, zero-delete and helper regressions |
| This report — new | Findings, reproduction, correction, evidence and remaining limits |
| `docs/UPHSD_BOOKSTORE_IMPLEMENTATION_PLAN.md` | Append dated A06 outcome only |

No model/schema, route, token policy, client/UI, branding, inventory/payment logic, environment file, manifest or lockfile was changed. Previous reports and all existing tests are preserved.

Final preservation review compared164 baseline files: only the two named runtime files and plan changed; three listed files were added; none were removed. All prior reports/tests, client/schema files, both environment files and all three pre-existing lockfiles hash-match the baseline. The plan's original32,811 bytes remain an exact prefix. Eighteen relative documentation links resolve; private configured-secret comparisons across the six delivered files found zero matches and printed no secret values. Final syntax, targeted lint and whitespace checks pass.

## 6. Remaining limits and stop condition

A05-F01 is fixed in this local source. A05's historical FAIL assessment is preserved; this phase does not retroactively convert it into a blanket production security approval.

Real MongoDB transaction locking/snapshots/commit ambiguity and data-type compatibility remain unverified. A05's cleanup-error/result ambiguity, adapter/barrier limitations and missing native concurrency matrix were not included in this narrow fix. Cross-account administration still requires transaction support and fails closed without it. No provider/database target, account inventory, legitimate administrator roster or credential rotation has been verified under A01.

Existing client lint/build warnings and separately scoped recovery/audit/storage/last-admin risks remain. No new last-admin or account-deletion policy is inferred. No account/session/credential remediation, migration or rollout follows from these test results.

Stop for user review of the local correction. Independent local re-verification and any isolated native-database integration require their own approved scope; production rollout and A01 access remain unstarted.
