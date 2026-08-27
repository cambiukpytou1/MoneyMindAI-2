# MoneyMind 2 — MVP Product Brief

**Version:** 0.1, 2026-08-27
**Status:** Product foundation approved; implementation details marked as assumptions require confirmation before external integrations or production launch.

## Product Position

MoneyMind 2 is a paid personal-finance workspace that helps people understand connected account activity, maintain budgets, and receive **explainable AI-assisted observations** about spending patterns. It is not a bank, broker, bill-payment service, tax advisor, legal advisor, or investment adviser. Its core difference is a user-correctable transaction-insight experience paired with an opt-in community knowledge layer for merchants: members can share independently authored tips, deals, and experiences without revealing anyone’s private transaction history.

The intended pricing is **$90 per year or $9 per month**, pending final confirmation of currency, trial duration, refund policy, and entitlement boundaries. This positioning sits near Copilot Money’s current annual offer of `$95` / `$7.92` per month while avoiding a free tier that could pressure the product to monetize private financial data. [Copilot Money pricing](https://www.copilot.money/)

## Market-Informed MVP Focus

| Comparable pattern | Verified observation | MoneyMind 2 decision |
|---|---|---|
| Automatic account and transaction organization | Copilot describes automatically tracking accounts and transactions, with AI-assisted transaction tagging. [Source](https://www.copilot.money/) | Start with read-only connected-account syncing, normalized transaction history, reviewable categorization, and fresh-data timestamps. |
| Budgeting and cash-flow visibility | Rocket Money describes recurring-spend separation and suggested budgets; Copilot describes rollovers and cash-flow summaries. [Rocket source](https://www.rocketmoney.com/compare/copilot) [Copilot source](https://www.copilot.money/) | Deliver category budgets, recurring-spend detection, monthly cash-flow summaries, and deterministic variance calculations before sophisticated financial automation. |
| Explainable guidance | Rocket Money emphasizes safe-to-spend guidance; Copilot emphasizes personalized recommendations. [Rocket source](https://www.rocketmoney.com/compare/copilot) [Copilot source](https://www.copilot.money/) | AI insights must state the observations and transaction/budget evidence they rely on, present uncertainty, allow dismissal/correction, and avoid prescriptive financial, tax, legal, or investment advice. |
| Private connected-data treatment | Both vendors state that the finance app does not store bank-login credentials; Copilot also states it does not use connected financial information for advertising. [Rocket source](https://www.rocketmoney.com/security) [Copilot source](https://www.copilot.money/privacy-and-security) | Use provider-hosted authorization, minimize stored data, prohibit financial-data advertising and community disclosure, and build tested data export, unlink, and deletion controls. |
| Subscription billing | Stripe describes a hosted subscription checkout with access provisioned only after verified subscription status. [Source](https://docs.stripe.com/billing/quickstart) | Use provider-hosted checkout and a verified server-side entitlement model. A success-page redirect is never proof of payment. |

## Launch Scope

| Capability | Minimum user outcome | Non-negotiable implementation control |
|---|---|---|
| Identity and access | A signed-in member can see only their own profile and financial records. | Every server query/mutation is authenticated and owner-scoped; cross-user access has regression coverage. |
| Connected accounts | A member can authorize a read-only account connection and see its sync state. | Authorization occurs in the provider’s hosted flow. Tokens stay server-side, are encrypted at rest, and are never logged or returned to the browser. |
| Transactions | A member can review normalized transactions and correct a category. | Cursor-based, idempotent sync processes added, modified, and removed transactions; visible freshness is based on provider data, not client time. |
| Budgets | A member can set a category budget and see actual-to-budget variance. | Amounts are stored in minor units with an ISO currency code; calculations are deterministic and unit-tested. |
| AI insights | A member can review a concise spending observation that links to its underlying data. | AI receives a minimized, scoped data summary; output is schema-validated, provenance-aware, non-actioning, and reviewable. |
| Merchant community | A member can create, edit, report, and vote on a merchant-specific tip, deal, or review. | Posts never disclose transaction evidence, account balances, other members’ identities, or exact purchase history. Moderation and rate limits apply. |
| Feedback board | A member can submit, upvote, and follow a feature request or bug report. | Votes are idempotent and one-per-user-per-request; requests have spam/report paths and transparent status. |
| Subscription entitlement | A member can choose an approved plan and manage it through the billing provider. | Webhook signature verification and idempotent event handling determine access; payment data never touches MoneyMind servers. |

## Explicitly Deferred

The initial launch excludes money movement, investment execution or recommendations, tax calculations or filing, credit decisions, debt settlement, bill negotiation, automated savings transfers, personalized insurance or lending offers, and any use of connected financial data for advertising. It also excludes unmoderated merchant content, anonymous harassment, and automated fixes or production deployments initiated solely by user votes.

## Privacy, Community, and AI Boundary

> **A person’s financial records are private. Merchant community content is a separately created public or audience-limited contribution—not evidence that any member purchased from, visited, or endorses that merchant.**

Financial records belong to the authenticated account owner and are never viewable through merchant pages, search results, community activity, advertising, analytics exports, or another user’s profile. Merchant content should use a display identity chosen by the contributor and be subject to reports, moderation, and removal. MoneyMind may show aggregated community counts only when they cannot expose individual financial activity.

AI will assist with descriptions of observable spending patterns, budget variance, recurring-charge candidates, and missed review items. AI will not transfer money, cancel services, change budgets, hide transactions, publish community content, or make individual investment, legal, tax, insurance, or credit recommendations. Every insight must be traceable to application-held evidence and provide a correction/dismissal control.

## Acceptance Criteria for the First Vertical Slice

| Journey | Passing condition |
|---|---|
| Secure sign-in and profile | Unauthenticated access is rejected; a user cannot access another user’s records by modifying an identifier or request payload. |
| Transaction import | A provider update can be processed more than once without duplicates; modified and removed transactions reconcile correctly. |
| Budget math | Ingested and manually categorized transactions yield correct actual, remaining, and variance values across month boundaries. |
| Insight generation | Only scoped, minimized data reaches the AI call; output conforms to a strict schema; each insight shows source evidence and no regulated-advice claim. |
| Community post | A member can create/edit/delete their own merchant contribution, cannot edit another member’s contribution, and can report abuse. |
| Subscription state | Access is granted, changed, and revoked only by verified asynchronous billing events; the checkout return page has no privileged effect. |
| Feedback triage | Each account can vote once; duplicate requests are detected; scheduled ranking proposes work without committing, merging, deploying, or changing production data autonomously. |
| Browser experience | Each journey is verified at desktop and mobile widths with keyboard navigation, semantic labels, visible focus, legible contrast, clear empty/error/loading states, and no inert interactive controls. |

## Open Product Decisions That Affect Architecture

| Decision | Working assumption | Why it matters |
|---|---|---|
| Launch geography and currency | United States and USD only for the MVP | Determines account aggregation, data format, support language, compliance review, and pricing setup. |
| Account-aggregation provider | Plaid Sandbox for test/staging; production provider only after credentials, terms, and webhook verification are complete | Determines token storage, webhook validation, transaction semantics, and test harness design. |
| Subscription offer | $90/year and $9/month, trial and refund policy pending | Determines Stripe price objects, eligibility checks, entitlement lifecycle, and legal copy. |
| Merchant-content visibility | Public merchant pages with a contributor-controlled display identity, subject to moderation | Determines content disclosure, reports, abuse response, and indexing policy. |
| Feedback automation | See the two safe implementation options in the architecture decision record | Determines whether ranking runs in an in-app scheduled worker or an external AI-assisted review workflow. |

## Sources

1. [Rocket Money vs. Copilot](https://www.rocketmoney.com/compare/copilot)
2. [Copilot Money — Product and Pricing](https://www.copilot.money/)
3. [Rocket Money — Security](https://www.rocketmoney.com/security)
4. [Copilot Money — Privacy and Security](https://www.copilot.money/privacy-and-security)
5. [Plaid Transactions documentation](https://plaid.com/docs/transactions/)
6. [Stripe — Subscription Checkout quickstart](https://docs.stripe.com/billing/quickstart)
7. [GitHub — About webhooks](https://docs.github.com/en/webhooks/about-webhooks)
