# Competitor Entity Cards

**Research date:** 2026-08-27

| Field | Rocket Money | Copilot Money |
|---|---|---|
| Common name | Rocket Money | Copilot Money |
| Legal / operating entity | To be verified from an authoritative source | To be verified from an authoritative source |
| Listing status | Private / not publicly listed, to be verified | Private / not publicly listed, to be verified |
| Ticker and exchange | Not applicable unless authoritative research identifies a public listing | Not applicable unless authoritative research identifies a public listing |
| Fiscal year end | Not publicly disclosed / not applicable to feature comparison | Not publicly disclosed / not applicable to feature comparison |
| Reporting currency | Not applicable to feature comparison | Not applicable to feature comparison |
| Industry | Consumer personal-finance software | Consumer personal-finance software |
| Research purpose | Establish feature, experience, pricing-presentation, data-handling, and feedback-design benchmarks for MoneyMind 2 | Establish feature, experience, pricing-presentation, data-handling, and feedback-design benchmarks for MoneyMind 2 |

The product comparison will rely on official product and support material where available. Any third-party commentary will be labeled as secondary context and will not be used to make unsupported claims about product functionality or policy.

## Official Product Findings

| Product | Verified product claims relevant to MoneyMind 2 | Product implication | Source |
|---|---|---|---|
| Rocket Money | The vendor describes subscription tracking and cancellation support, bill negotiation, suggested budgets, recurring-bill separation, transaction rules, safe-to-spend guidance, savings automation, credit monitoring, net-worth tracking, and watchlists. Its comparison page states a free tier and premium pricing of `$7–$14/month`, with a 7-day trial. | MoneyMind needs a coherent first release rather than feature parity. The MVP should first make connected transactions, recurring spend, budgeting, explanations, and action recommendations trustworthy before considering transfers, bill negotiation, savings automation, or credit products. | [Rocket Money comparison](https://www.rocketmoney.com/compare/copilot) |
| Copilot Money | The vendor describes automatic account, spending, and investment tracking; AI-assisted transaction tagging; budgets with rollovers; cash-flow summaries; subscription spotting; net-worth and allocation views; personalized recommendations; a free test experience before account connection; and pricing displayed as `$95` billed yearly / `$7.92` per month. | MoneyMind can differentiate through explainable, reviewable AI spending insights and merchant-community knowledge. Transaction classifications and recommendations must expose evidence and allow user correction rather than acting as opaque automation. | [Copilot Money home](https://www.copilot.money/) |

The vendor-to-vendor statements on Rocket Money’s comparison page are treated as **product positioning**, not as independent evidence about Copilot. All feature decisions will instead be validated against each product’s own official material and MoneyMind’s intended user needs.

## Privacy and Security Patterns to Preserve

| Pattern | Evidence from official competitor material | MoneyMind 2 requirement |
|---|---|---|
| Bank-credential isolation | Rocket Money and Copilot both state that bank login credentials are handled by their data-connection partners and are not stored by the personal-finance app. | Use the financial-data provider’s hosted authorization flow. Never collect, log, or store a bank username or password. |
| Protection of connected data | Both vendors describe encryption in transit and at rest. | Encrypt data in transit and at rest, limit staff access, protect secrets outside source control, and avoid logging raw financial records. |
| User control | Rocket Money describes account unlinking and deletion. Copilot describes transaction-data export, user-requested account deletion, and removal of connected financial data subject to stated exceptions. | Provide account unlinking, data export, deletion, and a clear retention policy. Implement them as tested product capabilities—not only policy text. |
| No behavioral advertising from financial data | Copilot says it does not use account, transaction, budget, goal, balance, holding, or investment information for advertising. | Do not sell, share, or target advertising based on individual financial data. The merchant community must never reveal a person’s purchases, balances, identity, or account relationships. |
| Distinguish vendor capability from product certification | Copilot identifies cloud-provider compliance programs while noting that the product itself is not certified. | Do not claim bank-grade security, compliance certification, data accuracy, savings guarantees, or automated financial outcomes without documented, independently supportable evidence. |

**Sources:** [Rocket Money security](https://www.rocketmoney.com/security); [Copilot Money privacy and security](https://www.copilot.money/privacy-and-security).

## Account-Aggregation Implementation Baseline

Plaid’s Transactions guidance describes a cursor-based synchronization model: initialize without a cursor, persist the returned cursor, process paginated added/modified/removed transactions, and restart pagination when its documented mutation error requires it. The integration must accept asynchronous updates because posted transactions may change; Plaid describes transaction-update checks as typically occurring one to four times daily, varying by institution. A user-visible `last refreshed` timestamp and a manual review state are therefore essential product controls rather than visual details. [Plaid Transactions documentation](https://plaid.com/docs/transactions/)

MoneyMind will treat provider webhooks as prompts to run an idempotent, owner-scoped sync. The first financial-data release must not present data as real-time, final, guaranteed accurate, or investment, tax, legal, or savings advice.

## Feedback-Automation Integration Baseline

GitHub documents that repository webhooks deliver an HTTP request to a configured endpoint when subscribed events occur, including push and pull-request events. Webhooks are suited to near-real-time repository updates; the REST API is appropriate for one-time or intermittent retrieval. This supports a reviewable workflow in which MoneyMind stores and ranks in-app feedback, proposes a corresponding issue or pull request, and then listens for review and merge state. It does **not** justify autonomous production changes. [GitHub webhooks documentation](https://docs.github.com/en/webhooks/about-webhooks)

## Paid-Plan Implementation Baseline

Stripe’s subscription quickstart uses a Stripe-hosted Checkout page to collect payment details, creates a Checkout Session in `subscription` mode, and makes an application webhook responsible for confirming subscription activity and provisioning access. MoneyMind should use a similarly authoritative, webhook-verified entitlement state and a provider-hosted billing portal; browser redirects or client state must not be treated as payment confirmation. [Stripe subscription quickstart](https://docs.stripe.com/billing/quickstart)
