# Supabase Staging Validation

**Project:** `MoneyMindAI-2` (`qgkgjmeidxkpluqzvhuf`)

**Environment classification:** Staging only. The project is empty and must never receive production financial, payment, or personal data.

| Verification | Result |
|---|---|
| Managed database platform | Supabase PostgreSQL, West US (Oregon) |
| Persisted migration | `secure_financial_persistence` (`20260827111740`) |
| Expected tables | `users`, `sessions`, `financial_connections`, `accounts`, `transactions`, and `budgets` |
| Record count at validation | Zero rows in all six MoneyMind tables |
| Ownership design | User foreign keys on sessions, connections, accounts, transactions, and budgets; account-to-connection and transaction-to-account foreign keys |
| Browser database exposure | RLS enabled on each MoneyMind table and privileges revoked from `anon` and `authenticated`; no browser-to-database code path is implemented |
| Security-advisor result | The warning for the public `rls_auto_enable()` security-definer function was remediated by migration `revoke_public_rls_helper_execution`; the six remaining informational “RLS enabled, no policy” notices are expected because browser roles receive no table privileges and no policies exist to allow them |

## Remaining Gate

The application will continue to fail closed until deployment environment management supplies a staging-only pooled `DATABASE_URL`, a distinct high-entropy `SESSION_SECRET`, and a base64-encoded 32-byte `DATA_ENCRYPTION_KEY`. These values must never be committed, entered in source files, or reused by production.
