import { describe, expect, it } from "vitest";
import { reconcileTransactions } from "./transaction-sync";

describe("reconcileTransactions", () => {
  const existing = [
    { id: "txn-1", merchant: "Market", amountMinor: -4_200, category: "Groceries", occurredOn: "2026-08-01" },
    { id: "txn-2", merchant: "Coffee", amountMinor: -550, category: "Dining", occurredOn: "2026-08-02" },
  ];

  it("adds and modifies records without duplicating a retry", () => {
    const update = {
      added: [{ id: "txn-3", merchant: "Transit", amountMinor: -300, category: "Transport", occurredOn: "2026-08-03" }],
      modified: [{ id: "txn-2", merchant: "Coffee House", amountMinor: -550, category: "Dining", occurredOn: "2026-08-02" }],
      removed: [],
    };

    const firstResult = reconcileTransactions(existing, update);
    const retryResult = reconcileTransactions(firstResult, update);

    expect(firstResult).toEqual([
      { id: "txn-1", merchant: "Market", amountMinor: -4_200, category: "Groceries", occurredOn: "2026-08-01" },
      { id: "txn-2", merchant: "Coffee House", amountMinor: -550, category: "Dining", occurredOn: "2026-08-02" },
      { id: "txn-3", merchant: "Transit", amountMinor: -300, category: "Transport", occurredOn: "2026-08-03" },
    ]);
    expect(retryResult).toEqual(firstResult);
  });

  it("removes records by their provider identifier without altering other records", () => {
    const result = reconcileTransactions(existing, {
      added: [],
      modified: [],
      removed: ["txn-1"],
    });

    expect(result).toEqual([
      { id: "txn-2", merchant: "Coffee", amountMinor: -550, category: "Dining", occurredOn: "2026-08-02" },
    ]);
  });
});
