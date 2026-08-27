import { neon } from "@neondatabase/serverless";
import { and, eq, gt, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { randomUUID } from "node:crypto";
import { accounts, sessions, transactions } from "../../shared/schema";
import type {
  CreateFinancialTransaction,
  FinancialTransaction,
  MoneyMindRepository,
  PersistedSession,
} from "./types";

export class PostgresMoneyMindRepository implements MoneyMindRepository {
  private readonly db;

  constructor(databaseUrl: string) {
    this.db = drizzle(neon(databaseUrl));
  }

  async createSession(session: PersistedSession): Promise<void> {
    await this.db.insert(sessions).values({
      id: session.id,
      userId: session.userId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    });
  }

  async getActiveSessionByTokenHash(tokenHash: string, now: Date): Promise<PersistedSession | null> {
    const [session] = await this.db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        tokenHash: sessions.tokenHash,
        expiresAt: sessions.expiresAt,
        revokedAt: sessions.revokedAt,
      })
      .from(sessions)
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
      .limit(1);

    return session ?? null;
  }

  async revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt })
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
  }

  async getTransactionForUser(id: string, userId: string): Promise<FinancialTransaction | null> {
    const [transaction] = await this.db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        accountId: transactions.accountId,
        providerTransactionId: transactions.providerTransactionId,
        merchant: transactions.merchant,
        amountMinor: transactions.amountMinor,
        currency: transactions.currency,
        occurredOn: transactions.occurredOn,
        category: transactions.category,
        pending: transactions.pending,
      })
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId), isNull(transactions.removedAt)))
      .limit(1);

    return transaction ?? null;
  }

  async createTransactionForUser(
    userId: string,
    transaction: CreateFinancialTransaction,
  ): Promise<FinancialTransaction | null> {
    const [account] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, transaction.accountId), eq(accounts.userId, userId)))
      .limit(1);
    if (!account) {
      return null;
    }

    const [created] = await this.db
      .insert(transactions)
      .values({
        id: randomUUID(),
        userId,
        ...transaction,
      })
      .returning({
        id: transactions.id,
        userId: transactions.userId,
        accountId: transactions.accountId,
        providerTransactionId: transactions.providerTransactionId,
        merchant: transactions.merchant,
        amountMinor: transactions.amountMinor,
        currency: transactions.currency,
        occurredOn: transactions.occurredOn,
        category: transactions.category,
        pending: transactions.pending,
      });

    return created ?? null;
  }
}
