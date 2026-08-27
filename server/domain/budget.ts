export type BudgetDefinition = {
  category: string;
  monthlyLimitMinor: number;
  currency: string;
};

export type BudgetTransaction = {
  id: string;
  occurredOn: string;
  category: string;
  amountMinor: number;
  direction: "expense" | "income";
  pending: boolean;
};

export type BudgetStatus = "on_track" | "over_budget";

export type BudgetSummary = BudgetDefinition & {
  spentMinor: number;
  remainingMinor: number;
  status: BudgetStatus;
};

function isInMonth(occurredOn: string, month: string): boolean {
  return occurredOn.startsWith(`${month}-`);
}

export function calculateBudgetSummary(
  budget: BudgetDefinition,
  transactions: readonly BudgetTransaction[],
  month: string,
): BudgetSummary {
  const spentMinor = transactions.reduce((total, transaction) => {
    const isMatchingExpense =
      transaction.category === budget.category &&
      transaction.direction === "expense" &&
      !transaction.pending &&
      isInMonth(transaction.occurredOn, month);

    return isMatchingExpense ? total + transaction.amountMinor : total;
  }, 0);

  const remainingMinor = budget.monthlyLimitMinor - spentMinor;

  return {
    ...budget,
    spentMinor,
    remainingMinor,
    status: remainingMinor < 0 ? "over_budget" : "on_track",
  };
}
