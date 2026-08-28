# ADR-003: Staging Identity and Session Design

**Status:** Accepted for staging implementation only

## Context

The existing MoneyMind schema already contains a unique email and `password_hash` on the owner record. The application also has a tested server-issued opaque session mechanism that stores only HMAC-hashed session tokens. Introducing a separate identity provider in the same initial slice would add configuration, token verification, and account-linking complexity before MoneyMind has a functioning owned-data workspace.

## Decision

The staging onboarding and sign-in flow will use the existing owner table with a memory-hard Node.js `scrypt` password hash and the existing opaque session manager. The server alone validates credentials and sets an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie. The browser receives neither a password hash nor a user identifier it can use to choose an account owner.

## Controls

Passwords are bounded in length and never logged, stored, or returned. Sign-up refuses duplicate email addresses without revealing account details. Sign-in uses a generic failure response. Every financial endpoint derives the owner exclusively from the verified session. The initial UI clearly identifies staging and Sandbox data.

## Consequences

This decision enables a small, testable onboarding slice without an external identity dependency. It does **not** satisfy production launch requirements by itself. Email verification, password reset, authentication rate limiting, CAPTCHA/abuse controls, session inventory, multi-factor evaluation, and formal identity-provider selection are separate required backlog items before production identity is enabled.
