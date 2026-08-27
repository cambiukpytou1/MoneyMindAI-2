# Staging Runtime Validation

**Environment:** Isolated MoneyMind staging website with the staging-only Supabase project.

| Check | Result |
|---|---|
| Server configuration | Staging-only environment variables were accepted without being emitted by the application. |
| Real database health | `GET /api/health` returned `200` with `{"ok":true,"service":"moneymind","persistence":"connected"}` after the production Express entry point issued its database check. |
| Unauthenticated financial access | `GET /api/transactions/:id` returned `401` and `{"error":"Authentication required"}` without revealing transaction existence. |
| Configuration isolation | The production entry point reads `MONEYMINDAI_DATABASE_URL`, preventing use of the managed workspace’s built-in database URL. |
| Data state | The Supabase staging tables remain empty; no personal, payment, or real financial data was inserted during this validation. |
| Browser workspace | The production-built workspace rendered with its illustrative-data and unavailable-capability disclosures visible. The “Review all” control expanded the transaction list and toggled to “Show fewer.” |

The browser validations were executed against an isolated production-build test process. A managed staging deployment checkpoint is the next step; publication remains an explicit user-controlled action.
