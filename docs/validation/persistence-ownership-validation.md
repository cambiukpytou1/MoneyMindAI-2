# Persistence and Ownership Validation

**Date:** 2026-08-27

| Validation area | Result | Evidence |
|---|---|---|
| Unauthenticated financial-record access | Passed | `GET /api/transactions/:id` returns `401` before any record lookup when no valid session is supplied. |
| Cross-owner record lookup | Passed | A valid session for user A receives the same `404` result for user B’s transaction as for an absent transaction. |
| Client-supplied ownership tampering | Passed | The transaction creation endpoint ignores a `userId` field in the request body and derives ownership only from the verified session. |
| Foreign-account mutation | Passed | A signed-in user cannot create a transaction using another user’s account identifier. |
| Opaque session storage | Passed | Session persistence stores an HMAC-SHA-256 hash instead of the bearer token; revoked sessions are rejected. |
| Provider-token protection | Passed | AES-256-GCM ciphertext does not retain plaintext, decrypts only with the active key version, and rejects altered ciphertext. |
| Production no-secret behavior | Passed | A production-build health request reports `persistence: "unavailable"` and a financial endpoint returns `{"error":"Financial persistence is unavailable"}` when database/session configuration is absent. |
| Automated checks | Passed | `npm test` completed with 14 passing tests across 6 test files; `npm run check` and `npm run build` completed successfully. |

## Remaining Gate

The schema is committed as `migrations/0000_secure_financial_persistence.sql` and has passed static build validation. It has **not** been applied to an external database because staging credentials have not been provisioned in this repository’s deployment environment. Migration execution, live database connectivity, and provider credentials remain deliberately blocked until staging-only secrets are configured.
