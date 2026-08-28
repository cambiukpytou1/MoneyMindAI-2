# Plaid Sandbox Integration Notes

MoneyMind’s staging connection uses only Plaid Sandbox. Sandbox supports full API and Link testing with test institutions and no financial data from MoneyMind users. It can create unlimited test Items, but it does not represent all production institution behavior. Automated test suites should bypass the changing Link interface by using the Sandbox-only public-token creation endpoint; manual browser acceptance checks may use Link. [1]

| Integration step | Required behavior |
|---|---|
| Link initialization | The authenticated server creates a short-lived Link token with a non-PII application user identifier, country `US`, the minimum `transactions` product, and a staging webhook URL. The browser receives only the Link token. [2] |
| Token exchange | The server exchanges the resulting public token, encrypts the access token, and never returns either token to the browser. [2] |
| Transaction ingestion | Start with no cursor, consume every `has_more` page, preserve the prior cursor during pagination, restart from that cursor if mutation-during-pagination occurs, then persist only the final next cursor. Sync applies adds, modifications, and removals idempotently. [3] |
| Initial data | A first sync can return no transactions while Plaid completes initial data collection. The client must show a clear in-progress/freshness state rather than claim a completed connection. [3] |
| Webhooks | Verify the `Plaid-Verification` JWT with Plaid’s JWK endpoint, require `alg: ES256`, enforce a five-minute maximum age, and constant-time compare the SHA-256 body hash before acting. [4] |

## References

1. [Plaid — Sandbox overview](https://plaid.com/docs/sandbox/)
2. [Plaid — Link API reference](https://plaid.com/docs/api/link/)
3. [Plaid — Introduction to Transactions](https://plaid.com/docs/transactions/)
4. [Plaid — Verify webhooks](https://plaid.com/docs/api/webhooks/webhook-verification/)
