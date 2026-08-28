# MoneyMind MVP Delivery Blueprint

**Scope:** A paid, U.S./USD-first personal financial-management application. MoneyMind provides budgeting, transaction review, transparent spending observations, user-controlled connected accounts, merchant discussion, and a feedback queue. It does not move money, recommend investments, prepare taxes, or make autonomous financial decisions.

## Product Information Architecture

| Route | User outcome | Required minimum state |
|---|---|---|
| `/` | Explain MoneyMind’s value and move an owner to secure sign-in | Product purpose, pricing route, privacy summary, clear sign-in CTA |
| `/onboarding` | Complete profile, disclosures, and first financial workspace setup | Terms/privacy acceptance, display name, preferred currency, data-access consent |
| `/overview` | Understand current financial position and what needs review | Account summary, freshness, budgets, traceable observations, safe empty state |
| `/transactions` | Review, search, filter, and correct categorized transactions | Owner-scoped list, category edit, pending state, transaction detail, no data leakage |
| `/budgets` | Create and monitor category plans | CRUD, month lifecycle, calculated remaining amount, over-budget state |
| `/goals` | Track a user-defined savings target without payment movement | CRUD, contributions represented as user-entered progress, no investment claim |
| `/insights` | Review explainable observations and correct their underlying category data | Evidence links to owned transactions, freshness and confidence labels, dismiss/correct actions |
| `/connections` | Explicitly consent to and manage Plaid Sandbox account linking | Consent, provider sandbox link, connection status, account selection, disconnect |
| `/community` | Read and contribute merchant tips separate from private transactions | Merchant lookup, comments/tips, votes, reports, moderation status |
| `/feedback` | Submit, follow, and vote on product ideas or defects | Duplicate prompts, vote state, status timeline, reporting controls |
| `/settings` | Manage identity, data use, exports, security, and account deletion | Profile settings, connection permissions, active sessions, data deletion request |
| `/pricing` | Make an informed upgrade decision | $9 monthly/$90 annual comparison, entitlement limits, checkout handoff, cancellation information |

## Domain Model Additions

The existing owner-scoped financial tables remain the source of truth for financial data. The next migrations should add user onboarding metadata, reusable categories, goals, merchants, community contributions/moderation, feedback/votes, automation candidates/approval decisions, subscriptions/entitlements, and immutable sensitive-action audit entries. Every sensitive record must retain a user or moderator owner, timestamps, bounded status values, and an index supporting the intended ownership query.

Merchant community data must never be joined to a user’s private transaction history in public responses. A contribution may name a merchant, but it cannot reveal that a particular owner transacted with that merchant. Feedback vote counts are public only in aggregated form; submitter identity remains restricted to the owner and authorized moderation tooling.

## Design System

The completed interface uses a restrained high-contrast dark graphite base with the existing warm-gold accent only for primary actions, active navigation, and clearly meaningful budget attention states. It uses normal page headings, 8px controls, simple borders, semantic tables, real form labels, and short transitions. It does not use glass panels, decorative gradients, auto-playing motion, fake charts, or generic KPI grids. Financial values appear only when connected data or explicitly marked sandbox data is present.

## Delivery Sequence

1. Establish staging credential onboarding with memory-hard password hashes and opaque sessions, then owner-scoped manual account creation so authenticated user data can replace static content.
2. Add Plaid Sandbox Link and cursor-based transaction synchronization behind explicit consent.
3. Add transactions, category review, budgets, goals, and explainable calculated observations.
4. Add merchant community and feedback capabilities with moderation, voting, and owner-governed automation queues.
5. Add payment entitlements and a transparent conversion path after payment-provider setup is approved.

## Non-Negotiable Release Controls

Each route must have an authenticated, loading, empty, failure, and desktop/mobile state. New financial and identity endpoints must be owner-scoped, validated with server-side schemas, rate limited where anonymous or abuse-prone, and regression tested for cross-owner access. Sandbox and production use separate provider credentials, databases, encryption keys, and deployment environments. The owner approval policy continues to govern material automated changes.
