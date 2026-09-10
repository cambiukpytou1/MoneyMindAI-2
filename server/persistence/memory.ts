import { randomUUID } from "node:crypto";
import type {
  CreateFinancialAccount,
  CreateFinancialBudget,
  CreateFinancialConnection,
  CreateFinancialTransaction,
  FinancialTransactionSyncPage,
  FinancialAccount,
  FinancialBudget,
  FinancialBudgetSummary,
  FinancialConnection,
  FinancialTransaction,
  MoneyMindRepository,
  MoneyMindUser,
  PersistedSession,
} from "./types";
import { calculateBudgetSummary } from "../domain/budget";

export class InMemoryMoneyMindRepository implements MoneyMindRepository {
  private readonly users = new Map<string, MoneyMindUser>();
  private readonly sessions = new Map<string, PersistedSession>();
  private readonly connections = new Map<string, FinancialConnection>();
  private readonly accounts = new Map<string, FinancialAccount>();
  private readonly transactions = new Map<string, FinancialTransaction>();
  private readonly budgets = new Map<string, FinancialBudget>();

  addUser(user: MoneyMindUser): void {
    this.users.set(user.id, user);
  }

  addAccount(account: FinancialAccount): void {
    this.accounts.set(account.id, account);
  }

  ping(): void {
    // The in-memory adapter is intentionally always available for deterministic unit tests.
  }

  createUser(user: MoneyMindUser): MoneyMindUser | null {
    if (Array.from(this.users.values()).some((storedUser) => storedUser.email === user.email)) {
      return null;
    }
    this.users.set(user.id, user);
    return user;
  }

  getUserByEmail(email: string): MoneyMindUser | null {
    return Array.from(this.users.values()).find((user) => user.email === email) ?? null;
  }

  getUserById(id: string): MoneyMindUser | null {
    return this.users.get(id) ?? null;
  }

  createSession(session: PersistedSession): void {
    this.sessions.set(session.tokenHash, session);
  }

  getActiveSessionByTokenHash(tokenHash: string, now: Date): PersistedSession | null {
    const session = this.sessions.get(tokenHash);
    if (!session || session.revokedAt || session.expiresAt <= now) {
      return null;
    }
    return session;
  }

  revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): void {
    const session = this.sessions.get(tokenHash);
    if (session) {
      this.sessions.set(tokenHash, { ...session, revokedAt });
    }
  }

  createFinancialConnectionForUser(userId: string, connection: CreateFinancialConnection): FinancialConnection {
    const created: FinancialConnection = { id: randomUUID(), userId, ...connection };
    this.connections.set(created.id, created);
    return created;
  }

  setFinancialConnectionStatusForUser(
    userId: string,
    connectionId: string,
    status: FinancialConnection["status"],
  ): FinancialConnection | null {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.userId !== userId) {
      return null;
    }
    const updated = { ...connection, status };
    this.connections.set(connectionId, updated);
    return updated;
  }

  getFinancialConnectionForUser(userId: string, connectionId: string): FinancialConnection | null {
    const connection = this.connections.get(connectionId);
    return connection?.userId === userId ? connection : null;
  }

  synchronizeFinancialTransactionsForConnection(
    userId: string,
    connectionId: string,
    page: FinancialTransactionSyncPage,
  ) {
    const connection = this.getFinancialConnectionForUser(userId, connectionId);
    if (!connection) {
      return null;
    }
    const accountsByProviderId = new Map(
      Array.from(this.accounts.values())
        .filter((account) => account.userId === userId && account.connectionId === connectionId)
        .map((account) => [account.providerAccountId, account]),
    );
    let added = 0;
    let modified = 0;
    let removed = 0;
    for (const sync of page.added) {
      const account = accountsByProviderId.get(sync.providerAccountId);
      if (!account) continue;
      const existing = Array.from(this.transactions.values()).find((transaction) =>
        transaction.userId === userId
        && transaction.accountId === account.id
        && transaction.providerTransactionId === sync.providerTransactionId,
      );
      const record: FinancialTransaction = {
        id: existing?.id ?? randomUUID(),
        userId,
        accountId: account.id,
        providerTransactionId: sync.providerTransactionId,
        merchant: sync.merchant,
        amountMinor: sync.amountMinor,
        currency: sync.currency,
        occurredOn: sync.occurredOn,
        category: sync.category,
        pending: sync.pending,
      };
      this.transactions.set(record.id, record);
      if (existing) modified += 1;
      else added += 1;
    }
    for (const sync of page.modified) {
      const account = accountsByProviderId.get(sync.providerAccountId);
      if (!account) continue;
      const existing = Array.from(this.transactions.values()).find((transaction) =>
        transaction.userId === userId
        && transaction.accountId === account.id
        && transaction.providerTransactionId === sync.providerTransactionId,
      );
      const record: FinancialTransaction = {
        id: existing?.id ?? randomUUID(),
        userId,
        accountId: account.id,
        providerTransactionId: sync.providerTransactionId,
        merchant: sync.merchant,
        amountMinor: sync.amountMinor,
        currency: sync.currency,
        occurredOn: sync.occurredOn,
        category: sync.category,
        pending: sync.pending,
      };
      this.transactions.set(record.id, record);
      if (existing) modified += 1;
      else added += 1;
    }
    for (const transaction of Array.from(this.transactions.values())) {
      if (transaction.userId === userId && page.removedProviderTransactionIds.includes(transaction.providerTransactionId)) {
        this.transactions.delete(transaction.id);
        removed += 1;
      }
    }
    return { added, modified, removed };
  }

  setFinancialConnectionCursorForUser(
    userId: string,
    connectionId: string,
    cursor: string,
  ): FinancialConnection | null {
    const connection = this.getFinancialConnectionForUser(userId, connectionId);
    if (!connection) {
      return null;
    }
    const updated = { ...connection, cursor };
    this.connections.set(connectionId, updated);
    return updated;
  }

  createFinancialAccountsForConnection(
    userId: string,
    connectionId: string,
    accounts: CreateFinancialAccount[],
  ): FinancialAccount[] {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.userId !== userId) {
      return [];
    }
    return accounts.map((account) => {
      const created: FinancialAccount = { id: randomUUID(), userId, connectionId, ...account };
      this.accounts.set(created.id, created);
      return created;
    });
  }

  getAccountsForUser(userId: string): FinancialAccount[] {
    return Array.from(this.accounts.values()).filter((account) => account.userId === userId);
  }

  addTransaction(transaction: FinancialTransaction): void {
    this.transactions.set(transaction.id, transaction);
  }

  getTransactionForUser(id: string, userId: string): FinancialTransaction | null {
    const transaction = this.transactions.get(id);
    return transaction?.userId === userId ? transaction : null;
  }

  createTransactionForUser(userId: string, transaction: CreateFinancialTransaction): FinancialTransaction | null {
    if (this.accounts.get(transaction.accountId)?.userId !== userId) {
      return null;
    }
    const created = { ...transaction, id: randomUUID(), userId };
    this.transactions.set(created.id, created);
    return created;
  }

  listTransactionsForUser(userId: string, limit = 50): FinancialTransaction[] {
    return Array.from(this.transactions.values())
      .filter((transaction) => transaction.userId === userId)
      .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.id.localeCompare(left.id))
      .slice(0, limit);
  }

  upsertBudgetForUser(userId: string, budget: CreateFinancialBudget): FinancialBudget {
    const existing = Array.from(this.budgets.values()).find((stored) =>
      stored.userId === userId
      && stored.category === budget.category
      && stored.budgetingMonth === budget.budgetingMonth,
    );
    const stored: FinancialBudget = { id: existing?.id ?? randomUUID(), userId, ...budget };
    this.budgets.set(stored.id, stored);
    return stored;
  }

  getBudgetSummariesForUser(userId: string, month: string): FinancialBudgetSummary[] {
    const transactions = Array.from(this.transactions.values())
      .filter((transaction) => transaction.userId === userId)
      .map((transaction) => ({
        ...transaction,
        direction: transaction.amountMinor >= 0 ? "expense" as const : "income" as const,
      }));
    return Array.from(this.budgets.values())
      .filter((budget) => budget.userId === userId && budget.budgetingMonth === `${month}-01`)
      .sort((left, right) => left.category.localeCompare(right.category))
      .map((budget) => ({
        ...budget,
        ...calculateBudgetSummary(budget, transactions, month),
      }));
  }

  getOnlySession(): PersistedSession {
    const sessions = Array.from(this.sessions.values());
    if (sessions.length !== 1) {
      throw new Error("Expected exactly one stored session");
    }
    return sessions[0]!;
  }

  getOnlyConnection(): FinancialConnection {
    const connections = Array.from(this.connections.values());
    if (connections.length !== 1) {
      throw new Error("Expected exactly one stored connection");
    }
    return connections[0]!;
  }
}
