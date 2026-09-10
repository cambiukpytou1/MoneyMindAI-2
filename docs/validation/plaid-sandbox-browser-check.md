# Plaid Sandbox Browser Check

**Environment:** Isolated staging server with Supabase staging persistence and Plaid Sandbox credentials.

| Journey step | Result |
|---|---|
| Synthetic owner registration | Passed. The consent-required staging form created a synthetic owner record and server-issued session; no personal identity was used. |
| Owner-scoped empty state | Passed. The signed-in owner saw no connected accounts and a clear Sandbox-only connection path. |
| Explicit connection consent | Passed. The connection flow remained blocked until the user selected the Sandbox data-consent acknowledgement. |
| Server-generated Link token | Passed. The live `/api/plaid/link-token` endpoint returned a token and Plaid Link opened successfully. |
| Sandbox institution selection | Passed. The Plaid-hosted UI displayed Sandbox mode and institution selection. |
| Institution handoff | Pending. The selected test institution opens an external provider-hosted Sandbox handoff that requires a user-assisted browser action to continue. |

No real financial institution credentials or live account data were entered. The public token exchange and account persistence remain pending until the provider-hosted Sandbox handoff completes.

## Follow-up Validation

The completed provider handoff created an encrypted access-token record and fourteen owner-scoped Sandbox accounts in the staging database. The first exchange was completed on the pre-lifecycle-fix server and was corrected to `active` only after verifying encrypted-token presence and account creation. A subsequent staging build adds the tested active-state transition and cursor-based sync endpoint. Reusing the prior synthetic owner on the new isolated test hostname could not proceed because its staging password is intentionally unavailable to the test runner; no password was recovered, displayed, or logged.

## Second Synthetic Owner

With explicit user approval, a second `@moneymind.invalid` owner was registered on the updated staging build, accepted the connection consent notice, received a server-generated short-lived Link token, and selected the Plaid Sandbox Chase institution. The provider-hosted handoff is now at the `Return to institution` stage; the completion must occur only with Plaid’s published Sandbox values and must return to MoneyMind before exchange and cursor synchronization are verified.
