import { randomUUID } from "node:crypto";
import type {
  CreateFinancialAccount,
  CreateFinancialConnection,
  CreateFinancialTransaction,
  FinancialAccount,
  FinancialConnection,
  FinancialTransaction,
  MoneyMindRepository,
  MoneyMindUser,
  PersistedSession,
} from "./types";

export class InMemoryMoneyMindRepository implements MoneyMindRepository {
  private readonly users = new Map<string, MoneyMindUser>();
  private readonly sessions = new Map<string, PersistedSession>();
  private readonly connections = new Map<string, FinancialConnection>();
  private readonly accounts = new Map<string, FinancialAccount>();
  private readonly transactions = new Map<string, FinancialTransaction>();

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

  listTransactionsForUser(userId: string): FinancialTransaction[] {
    return Array.from(this.transactions.values()).filter((transaction) => transaction.userId === userId);
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
