import { randomUUID } from "node:crypto";
import type {
  CreateFinancialTransaction,
  FinancialAccount,
  FinancialTransaction,
  MoneyMindRepository,
  MoneyMindUser,
  PersistedSession,
} from "./types";

export class InMemoryMoneyMindRepository implements MoneyMindRepository {
  private readonly users = new Map<string, MoneyMindUser>();
  private readonly sessions = new Map<string, PersistedSession>();
  private readonly accounts = new Map<string, FinancialAccount>();
  private readonly transactions = new Map<string, FinancialTransaction>();

  addUser(user: MoneyMindUser): void {
    this.users.set(user.id, user);
  }

  addAccount(account: FinancialAccount): void {
    this.accounts.set(account.id, account);
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
}
