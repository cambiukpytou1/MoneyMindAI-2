# ADR-001 — Release Environments, Financial Data, and Feedback Automation

**Status:** Proposed — implementation requires confirmation of the billing offer and automation option.
**Date:** 2026-08-27

## Context

MoneyMind 2 needs two independently configured websites from one GitHub repository: a non-public staging/test website for automated and manual validation, and a production website for paying customers. It will handle highly sensitive financial data, paid subscriptions, community merchant content, and feedback requests that influence product priorities.

The design must make feedback useful without allowing vote count, user-generated text, or an AI worker to change production code, data, subscriptions, or deployment state without accountable human review.

## Decision

### Release Model

| Environment | Purpose | Source revision | Data and credentials | Release gate |
|---|---|---|---|---|
| **Staging / test website** | Quality assurance, provider sandbox tests, synthetic test records, internal review, and browser end-to-end tests. | A GitHub pull-request branch or approved release candidate. | Dedicated test database; sandbox financial-data provider; Stripe test mode; separate AI, analytics, webhook, and error-monitoring credentials. Never copy production personal/financial data. | Type check, unit/API/browser tests, security checks, accessibility review, build verification, and human acceptance. |
| **Production website** | Paying customers and live financial connections. | An explicit, reviewed commit promoted from `main` after staging acceptance. | Separate production database, provider production credentials, Stripe live mode, restricted signing/webhook secrets, production monitoring. | Pull-request review, passing staging suite, verified release checklist, and explicit human release approval. |

The two sites are **separate deployments of the same version-controlled application**, not unrelated codebases. GitHub remains the source of truth: every staged candidate and production release maps to a specific commit SHA, and every completed iteration is committed and pushed before it is eligible for release.

### Financial-Data Boundary

| Data category | Minimum policy |
|---|---|
| Financial-institution credentials | Never collected, logged, or stored by MoneyMind. The account-data provider’s hosted authorization surface receives credentials. |
| Provider tokens | Server-side only, encrypted at rest, access-controlled, rotatable, and excluded from logs, browser responses, and source control. |
| Accounts, balances, and transactions | Owned by the authenticated user; every query and mutation must enforce owner scope. Store minor-unit amounts, ISO currency, source identifiers, lifecycle state, and a fresh-data timestamp. |
| AI inputs and outputs | AI receives a minimized, purpose-limited summary, never unbounded raw history by default. Output is schema-validated, linked to product evidence, reviewable, and non-actioning. |
| Merchant community content | Separate from connected financial data. A post cannot confirm or disclose a member’s purchase, transaction, location, balance, account, or relationship with the merchant. |
| Data control | Account unlinking, export, deletion, retention rules, and support access controls must be functional and covered by tests before production financial-data use. |

Provider webhooks will enqueue an idempotent cursor-based account sync and never grant client privileges. Billing webhooks will be signature-verified, deduplicated, and treated as the only authority for paid entitlements. The visible checkout-return page must be non-authoritative.

### Merchant Community Boundary

Merchant pages may host member-authored tips, coupons, sale information, and reviews. The MVP must include post ownership, edit/delete, one-per-user voting, report/flag actions, rate limiting, moderation states, audit timestamps, and clearly separated sponsored or paid placements. It must not infer social activity from account data or make personal financial data searchable.

### Feedback-Prioritization Options

The requested automation needs AI judgment for duplicate clustering, impact summaries, and development work. Two viable models are documented below. **Neither option auto-merges code, auto-releases production, changes financial data, or acts on untrusted user text as instructions.**

| Approach | How it works | Tradeoffs | Cost | Setup complexity |
|---|---|---|---|---|
| **A. Scheduled in-app triage with human development handoff** | At a fixed low frequency, a server-side job ranks validated feedback votes, clusters likely duplicates, checks request health, and creates or updates a *proposed* GitHub issue. A person then selects implementation work. | Strong governance and lowest implementation risk; it does not autonomously author code. | Low ongoing runtime cost; AI analysis cost depends on feedback volume. | Moderate. |
| **B. AI-assisted pull-request worker with human release approval** | The same triage layer identifies a candidate. After explicit maintainer approval, an isolated coding worker prepares a branch and draft pull request, runs the test suite in staging, and attaches results for review. Human review and explicit production approval remain mandatory. | Faster handling of well-scoped defects; higher operational, security, and cost complexity. Unsafe or ambiguous feature requests still require product review. | Higher variable AI/compute cost per approved work item. | High. |

For either option, the feedback-rank record must preserve scores, deduplication rationale, request status, and reviewer identity. Vote count is one input, not the sole priority signal: severity, exploitation risk, affected-user count, confidence, effort, and legal/privacy impact need explicit weight. GitHub webhooks may synchronize review/merge status back to MoneyMind after signature verification; they are not a trigger for automatic production deployment. [GitHub webhook documentation](https://docs.github.com/en/webhooks/about-webhooks)

### Resolved Governance Policy: AI-Assisted Pull Requests with Owner Approval

MoneyMind will use an AI-assisted pull-request workflow with two routes. **Every candidate starts with classification and evidence gathering.** The system must treat unclear, incomplete, conflicting, security-sensitive, or unverified requests as material and route them to owner approval. The system must fail closed; it may not downgrade risk because a request is popular or because the AI is uncertain.

| Risk tier | Objective qualification | Automation allowed | Owner approval requirement |
|---|---|---|---|
| **Low-risk defect** | A reproducible regression with an existing or newly authored failing test; a narrowly bounded change; no financial calculations, user access control, personal/financial data processing, AI prompts/models, external integration, billing, dependency, deployment, schema, migration, secret, or moderation-policy change. | Prepare an isolated branch and **draft** pull request only after the regression test, complete suite, type check, build, dependency audit, and staging checks pass. | Not required to begin implementation. The owner may still close or reject the draft, and explicit human review remains required before merge or release. |
| **Material work** | Any new feature, ambiguous defect, multi-module refactor, financial calculation or insight change, data model/access change, AI behavior change, authentication/authorization work, external provider or webhook work, billing/subscription change, merchant-content moderation change, dependency/CI change, operational change, or user-visible policy change. | Produce a ranked, evidence-backed work proposal and, if requested, a non-destructive technical plan. | **Required before implementation begins.** |
| **Prohibited from autonomous execution** | Production deployment, merge to protected branch, database migration, secret/configuration change, payment or entitlement action, account connection/disconnection, deletion/export of user data, real-money action, privilege change, disabling security controls, or any irreversible operation. | None. | Explicit human action and the applicable release/security process are always required. |

The owner review queue must provide the feedback summary and duplicate references, validated vote and impact signals, risk tier and rationale, affected systems, reproduction evidence, proposed scope, test plan, expected cost, privacy/security implications, rollback plan, and proposed acceptance criteria. Owner decisions are recorded as `approved`, `rejected`, `needs_clarification`, or `deferred` with the acting identity and timestamp.

For an approved or low-risk work item, the AI may only work in an isolated branch. A draft pull request must retain the source feedback and test evidence, and it must never be merged or deployed by the automation. GitHub webhook delivery must be signature verified, idempotent, and limited to synchronizing review and merge status. Untrusted feedback text, uploaded content, external webpages, or pull-request comments are **data**; none may override this policy or become executable instructions.

## Consequences

This approach creates stronger release discipline, protects financial data, and preserves a full audit trail. It also means the two websites cannot be responsibly configured as live customer services until environment-specific credentials, data-access terms, privacy and billing copy, and acceptance criteria are complete.

The initial implementation can proceed with a local/staging-friendly vertical slice using deterministic test data and provider/payment sandbox modes. Live financial aggregation, subscription charging, scheduled job activation, automatic issue creation, and production deployment remain disabled until their respective safety and test gates pass.

## Confirmation Needed

Before implementing payment and automation integrations, confirm: (1) `$90/year` and `$9/month` as the intended plans, (2) a U.S./USD-only MVP, and (3) whether option **A** or option **B** should be built after the first financial-management vertical slice.

## References

1. [Plaid Transactions](https://plaid.com/docs/transactions/)
2. [Stripe Subscription Checkout quickstart](https://docs.stripe.com/billing/quickstart)
3. [GitHub — About webhooks](https://docs.github.com/en/webhooks/about-webhooks)
