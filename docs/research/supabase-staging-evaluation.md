# Supabase Staging Evaluation

**Decision:** Use **Supabase PostgreSQL** for MoneyMind’s dedicated staging database. It provides a managed PostgreSQL deployment, a shared connection pooler appropriate for transient server workloads, and optional database-level Row Level Security (RLS) protections. It does not replace MoneyMind’s server-side session validation, owner-scoped queries, or application-layer provider-token encryption.

## Compatibility Correction

MoneyMind’s first PostgreSQL adapter uses the Neon HTTP driver. That driver is specific to Neon’s serverless connection model and should **not** be used for Supabase. Supabase’s current Drizzle guide instead uses the standard `postgres` (Postgres.js) driver, Drizzle’s `postgres-js` adapter, a pooled `DATABASE_URL`, and `prepare: false` for transaction-pooling mode. The next configuration commit will make this compatibility change before any Supabase connection is attempted. [1]

## Environment Recommendation

| Use | Supabase connection choice | MoneyMind control |
|---|---|---|
| Schema migration and controlled administrative work | Direct connection, when network reachability permits | Run only from a controlled operator environment; use the staging project’s direct connection string. [2] |
| Staging application runtime in an autoscaling environment | Shared Pooler, transaction mode, port `6543` | Use the server-side `DATABASE_URL` only; set `prepare: false` as Supabase documents. [1] [2] |
| Browser application | No direct database connection | The client must use MoneyMind’s own server API. It receives neither a database URL nor a Supabase service-role key. |

## Database Security Model

All money-management tables remain server-only. When creating the Supabase project, disable the Data API if it is not required for the staging application. If the Data API remains enabled, enable RLS on every exposed table, revoke default `anon` and `authenticated` grants, and provide no permissive public policy for financial tables. RLS is defense in depth; it does not replace server-side ownership filtering because the application uses a privileged server-side database connection. [1] [3]

The staging project must remain separate from production. It will contain only synthetic test data, sandbox provider data, and test payment events. Do not copy personal or financial production data into staging.

## References

1. [Supabase — Drizzle](https://supabase.com/docs/guides/database/drizzle)
2. [Supabase — Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres)
3. [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
