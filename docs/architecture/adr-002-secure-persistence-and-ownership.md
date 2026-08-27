# ADR-002 — Secure Persistence and Ownership Enforcement

**Status:** Accepted for the initial financial-data vertical slice.
**Date:** 2026-08-27

## Decision

MoneyMind persists identity, authentication-session, financial-connection, account, transaction, and budget records in PostgreSQL. Every financial-data row carries an immutable `user_id` ownership key. API code never accepts an owner identifier from request data; it resolves the authenticated user from a server-verified, secure, HTTP-only session cookie and scopes every data-access operation by that user identifier.

| Data type | Ownership and access rule |
|---|---|
| User identity | A unique, normalized email identifies the account. Passwords are stored only as salted, memory-hard derived hashes. |
| Auth session | The browser receives an opaque, random session token in a secure, HTTP-only, same-site cookie. PostgreSQL stores only its SHA-256 hash, user ID, expiration, and lifecycle timestamps. |
| Financial connection | A connection belongs to one user. The provider access token is encrypted before database storage and is never returned by API responses, logs, client code, merchant content, or AI prompts. |
| Account | An account belongs to its connection and stores a denormalized owner key for direct, indexed owner-scoped access. |
| Transaction | A transaction belongs to its account and owner. Its provider identifier is unique only within the account, allowing idempotent add/modify/remove reconciliation without cross-user leakage. |
| Budget | A budget belongs to its owner and is unique per category and budgeting month. Amounts use signed minor units with an ISO currency code. |

## Enforcement Rules

The protected API middleware returns `401` when a session is absent, malformed, expired, revoked, or otherwise unverifiable. Record lookups use an owner-scoped query and return `404` for resources outside the caller’s ownership scope; this prevents identifier enumeration. Mutation handlers derive `user_id` exclusively from server authentication context and never trust a body, query, route, provider webhook, or client-side state value as proof of ownership.

PostgreSQL foreign keys and unique indexes preserve relationships and sync idempotency, but they do not replace application-layer ownership filtering. The same owner predicate is required for every query, update, and deletion. Provider-webhook processing is internal-only, validates the provider signature before use, and resolves the owner from the stored connection—not from webhook payload fields.

## Secrets and Operational Boundaries

| Environment variable | Purpose | Handling requirement |
|---|---|---|
| `DATABASE_URL` | TLS-enabled PostgreSQL connection string | Separate staging and production values; never commit or expose to the browser. |
| `SESSION_SECRET` | Cookie/session signing or key-derivation material | High-entropy secret; separate by environment; rotate through a planned session-invalidation procedure. |
| `DATA_ENCRYPTION_KEY` | Base64-encoded, 32-byte application encryption key for provider tokens | Server-side only; rotate using an explicit key-version migration; never log raw, derived, or decrypted values. |

The production server must fail closed for protected APIs when persistence secrets are unavailable. It may serve only static, clearly labeled non-financial content in that condition, and its health response must report `persistence: "unavailable"` rather than imply readiness.

## Required Regression Coverage

The test suite must prove unauthenticated access is rejected, an owner can read/update only their own records, a cross-owner identifier returns a non-enumerating `404`, a session token is stored only as a hash, provider-token encryption is reversible only with the valid current key, and retrying a transaction update does not duplicate records. Database schema/migration validation is run against a staging database before any production deployment.
