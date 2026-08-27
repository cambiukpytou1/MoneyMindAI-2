export type SyncedTransaction = {
  id: string;
  merchant: string;
  amountMinor: number;
  category: string;
  occurredOn: string;
};

export type TransactionSyncUpdate = {
  added: readonly SyncedTransaction[];
  modified: readonly SyncedTransaction[];
  removed: readonly string[];
};

export function reconcileTransactions(
  existing: readonly SyncedTransaction[],
  update: TransactionSyncUpdate,
): SyncedTransaction[] {
  const removedIds = new Set(update.removed);
  const transactionsById = new Map(
    existing
      .filter((transaction) => !removedIds.has(transaction.id))
      .map((transaction) => [transaction.id, transaction]),
  );

  for (const transaction of [...update.added, ...update.modified]) {
    if (!removedIds.has(transaction.id)) {
      transactionsById.set(transaction.id, transaction);
    }
  }

  return Array.from(transactionsById.values()).sort((left, right) => {
    if (left.occurredOn !== right.occurredOn) {
      return left.occurredOn.localeCompare(right.occurredOn);
    }
    return left.id.localeCompare(right.id);
  });
}
