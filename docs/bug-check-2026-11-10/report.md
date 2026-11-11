# Bug check — 10 November 2026

The current checkout still has reproducible bugs. Six isolated reproductions confirm three functional bug groups. The existing backend and client test suites pass; they do not cover these cases.

## Findings

### 1. P1 — Reload can combine one account's identity with another account's token

Evidence: `client/src/shared/hooks/AuthContext.jsx:26`, `:64`, `:66`, `:78`.

Steps:

1. Sign in as account A with Remember me enabled.
2. Open `/login` without signing out and sign in as B with Remember me disabled.
3. Reload the page.

Observed: the provider restores B's user object with A's token. `setUser()` always writes the user to local storage; the non-remembered login writes the new token only to session storage, leaving A's token in local storage. Restoration independently prefers local storage for both values. API requests therefore use A's authority while the authentication context identifies B. The old token must still be valid for requests to succeed.

A second reproduction shows that a failed login clears the current user and local storage but leaves an earlier session-storage login intact. Reloading restores that account.

Expected: one login restores one matching user/token pair. Account replacement and failed-login cleanup must not leave conflicting credentials in the other store.

Verification: both cases execute the actual provider with synthetic React hook state and browser storage; authentication responses are substituted and no network request is made.

### 2. P1 — Clothing edits can block existing orders and saleable returns

Evidence: `backend/services/categoryService.js:45`, `backend/services/catalogService.js:64`, `backend/services/bookstoreOrders.js:43`, `:207`, `backend/services/sizeInventory.js:17`.

Three reproduced cases:

- Submit an M-size uniform, then rename Clothing to Uniforms. Quoting the pending order fails with HTTP 400, `Sizes apply only to Clothing products`.
- Complete an M-size sale, then rename Clothing to Uniforms. Recording its saleable return fails with the same error.
- Sell the final M-size unit, then remove the now-zero M size while retaining S. Recording a return of the sold M unit fails with HTTP 400, `Select an available clothing size`.

Category changes clear size data, and return stock changes require the product's current category and size list to accept the historical sale's size. The transaction rolls back, leaving no reversal recorded. The return screen asks staff to confirm repayment before dispatching this command, so an already performed refund can remain unrecorded.

Expected: authorized catalog maintenance preserves the ability to process existing orders and record assessed returns, or rejects incompatible maintenance before it commits.

Verification: the real catalog, category, order, payment and reversal services execute against the existing in-memory persistence adapter. No database connection is opened.

### 3. P2 — A lost direct-checkout response leaves an unrecoverable pending checkout in the UI

Evidence: `backend/services/bookstoreReads.js:110`, `:37`, `:53`, `client/src/features/bookstore/BookstorePage.jsx:151`.

Steps:

1. A cashier submits a direct order and the server commits it.
2. The response is lost before the client receives the order ID.
3. The cashier selects Check acknowledged outcome.

Observed: reconciliation returns only `{ outcome: "applied", operationId }`. It omits the stored result and order ID. The page clears its pending marker without restoring checkout state. The pending direct order is excluded from the cashier queue, and transaction history includes only completed orders. Submitting the same cart with a new operation ID creates another pending order.

Expected: successful reconciliation supplies the authorized result needed to resume the existing checkout before the client discards its recovery marker.

Verification: the actual backend services confirm the missing result, both empty listings, the remaining pending order, and creation of a second order on replacement submission. The client recovery handler was inspected for how it consumes reconciliation.

## Checks

| Check | Result |
| --- | --- |
| Backend `npm test` | 894 passed, 0 failed |
| Client `npm test` | 142 passed, 0 failed |
| Client `npm run build` | Passed |
| Client `npm run lint` | Failed: 15 errors, 12 warnings |
| Backend bug reproductions | 4 reproduced |
| Frontend bug reproductions | 2 reproduced |

The initial sandboxed backend run encountered localhost `EACCES` restrictions. A run with localhost access passed all 894 tests. Those sandbox failures are not counted as application bugs.

Lint failures include unused variables, React refresh export rules, hook rules, and effect/state rules. They are a failing quality check; the count is not a count of proven runtime bugs. See `client-lint.log`.

The repository already contained extensive changes. Application source and configuration were not edited. This delivery adds this report, reproduction scripts and check logs. The production build regenerated ignored build output.

No live database verification, interactive browser walkthrough, deployment, dependency advisory scan or full security audit was performed. Passing isolated tests does not establish production readiness or absence of additional bugs. Store creation and membership reconciliation were inspected and correctly use account-operation receipts; that suspected issue was ruled out.

## Reproduction commands

Run from `C:\Users\jmley\Desktop\LadyPos`:

```powershell
node --test docs/bug-check-2026-11-10/backend-reproductions.test.mjs
node --test docs/bug-check-2026-11-10/frontend-reproductions.test.mjs
```

These scripts assert the current faulty behavior. A passing reproduction means the bug was observed; it does not mean it was fixed. After remediation, replace those assertions with the required corrected behavior before adding them to the normal regression suite.
