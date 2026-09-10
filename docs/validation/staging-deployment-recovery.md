# Staging Deployment Recovery

**Context:** The managed staging deployment initially returned a `404` after the package-manager recovery checkpoint. The build system was selecting pnpm 12, whose parser rejected the template’s legacy `--prod=false` argument.

**Resolution:** MoneyMind pins pnpm `11.24.0`, which accepts the deployment installer argument. The final checkpoint completed deployment successfully.

| Public validation | Result |
|---|---|
| Published root | The staging domain renders the current MoneyMind onboarding interface, including explicit Sandbox-only disclosure and no placeholder financial balances. |
| Published health endpoint | `200 OK` with `{"ok":true,"service":"moneymind","persistence":"connected"}`. |
| Environment boundary | The public response contains no database URL, session secret, encryption key, Plaid credential, or account data. |

The remaining low/moderate dependency advisories are tracked separately and did not meet the enforced high-severity release threshold.
