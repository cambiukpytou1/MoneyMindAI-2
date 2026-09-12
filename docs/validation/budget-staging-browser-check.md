# Budget Workspace — Staging Browser Validation

**Date:** 2026-09-12  
**Environment:** Isolated MoneyMind staging server with Supabase staging persistence and Plaid Sandbox-only data  
**Owner:** Synthetic staging account only

## Scope

This validation covered the first functional owner-scoped budgeting workflow. It did not use a real bank connection, a real person’s financial information, or a production database.

| Check | Result | Evidence |
|---|---|---|
| Authenticated budget route | Passed | The signed-in synthetic owner opened `/budgets` and received the private workspace rather than a placeholder page. |
| Empty state | Passed | The workspace showed “No plans for this month” before a plan was created. |
| Budget creation | Passed | A synthetic September 2026 `Shopping` plan with a `$500.00` limit was saved through the authenticated API. |
| Owner-scoped display | Passed | The saved plan rendered only within the signed-in synthetic owner’s workspace. |
| Actuals calculation | Passed | The summary displayed `$0.00 posted of $500.00` and `$500.00 left`; no synthetic transaction in the owner’s September Sandbox data matched the `Shopping` category. |
| Pending exclusion policy | Covered by automated test | The API contract verifies that pending transactions are excluded from monthly actuals. |
| Cross-owner isolation | Covered by automated test | The API contract seeds another owner’s same-category transaction and verifies it is excluded. |
| Responsive visual structure | Passed at desktop | The creation form, policy explanation, status message, and summary card remained readable and keyboard-addressable. |

## Release-Quality Results

The owner-scoped budget API contract began as a failing test and passed after implementation. The complete automated release gate passed with **18 test files and 39 tests**, static type checking, and the production build. The high-and-critical dependency gate passed; the package audit retains **one low** and **three moderate** advisories for a separately tracked remediation review.

## Boundaries Confirmed

The budget API uses the authenticated server session rather than any body-supplied owner identity. Monthly actuals include only the signed-in owner’s non-pending, non-removed transactions within the selected month and matching category. The staging account contains only synthetic Plaid Sandbox data.
