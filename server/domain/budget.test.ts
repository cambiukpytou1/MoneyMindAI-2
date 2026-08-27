import { describe, expect, it } from "vitest";
import { calculateBudgetSummary } from "./budget";

describe("calculateBudgetSummary", () => {
  it("uses only posted expense transactions in the selected month and category", () => {
    const summary = calculateBudgetSummary(
      { category: "Dining", monthlyLimitMinor: 25_000, currency: "USD" },
      [
        { id: "txn-1", occurredOn: "2026-08-03", category: "Dining", amountMinor: 7_500, direction: "expense", pending: false },
        { id: "txn-2", occurredOn: "2026-08-08", category: "Dining", amountMinor: 3_000, direction: "expense", pending: true },
        { id: "txn-3", occurredOn: "2026-07-31", category: "Dining", amountMinor: 4_000, direction: "expense", pending: false },
        { id: "txn-4", occurredOn: "2026-08-12", category: "Groceries", amountMinor: 6_000, direction: "expense", pending: false },
        { id: "txn-5", occurredOn: "2026-08-14", category: "Dining", amountMinor: 8_000, direction: "income", pending: false },
      ],
      "2026-08",
    );

    expect(summary).toEqual({
      category: "Dining",
      monthlyLimitMinor: 25_000,
      spentMinor: 7_500,
      remainingMinor: 17_500,
      status: "on_track",
      currency: "USD",
    });
  });

  it("reports an over-budget status when posted spending exceeds the monthly limit", () => {
    const summary = calculateBudgetSummary(
      { category: "Transport", monthlyLimitMinor: 10_000, currency: "USD" },
      [
        { id: "txn-1", occurredOn: "2026-08-01", category: "Transport", amountMinor: 11_250, direction: "expense", pending: false },
      ],
      "2026-08",
    );

    expect(summary.remainingMinor).toBe(-1_250);
    expect(summary.status).toBe("over_budget");
  });
});
