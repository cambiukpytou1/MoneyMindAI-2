import { and, eq, gt, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { accounts, financialConnections, sessions, transactions, users } from "../../shared/schema";
import type {
  CreateFinancialAccount,
  CreateFinancialConnection,
  CreateMoneyMindUser,
  CreateFinancialTransaction,
  FinancialAccount,
  FinancialConnection,
  FinancialTransaction,
  MoneyMindUser,
  MoneyMindRepository,
  PersistedSession,
} from "./types";

export class PostgresMoneyMindRepository implements MoneyMindRepository {
  private readonly client;
  private readonly db;

  constructor(databaseUrl: string) {
    this.client = postgres(databaseUrl, {
      prepare: false,
      ssl: "require",
    });
    this.db = drizzle(this.client);
  }

  async ping(): Promise<void> {
    await this.client`select 1`;
  }

  async createUser(user: CreateMoneyMindUser): Promise<MoneyMindUser | null> {
    try {
      const [created] = await this.db
        .insert(users)
        .values(user)
        .returning({ id: users.id, email: users.email, passwordHash: users.passwordHash });
      return created ?? null;
    } catch (error) {
      if (error instanceof Error && error.message.includes("users_email_unique")) {
        return null;
      }
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<MoneyMindUser | null> {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user ?? null;
  }

  async getUserById(id: string): Promise<MoneyMindUser | null> {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user ?? null;
  }

  async createFinancialConnectionForUser(
    userId: string,
    connection: CreateFinancialConnection,
  ): Promise<FinancialConnection> {
    const [created] = await this.db
      .insert(financialConnections)
      .values({ id: randomUUID(), userId, ...connection })
      .returning({
        id: financialConnections.id,
        userId: financialConnections.userId,
        provider: financialConnections.provider,
        providerItemId: financialConnections.providerItemId,
        encryptedAccessToken: financialConnections.encryptedAccessToken,
        encryptionKeyVersion: financialConnections.encryptionKeyVersion,
        status: financialConnections.status,
        cursor: financialConnections.cursor,
      });
    if (!created) {
      throw new Error("Failed to create financial connection");
    }
    return { ...created, provider: "plaid" };
  }

  async createFinancialAccountsForConnection(
    userId: string,
    connectionId: string,
    providerAccounts: CreateFinancialAccount[],
  ): Promise<FinancialAccount[]> {
    if (providerAccounts.length === 0) {
      return [];
    }

    const [connection] = await this.db
      .select({ id: financialConnections.id })
      .from(financialConnections)
      .where(and(eq(financialConnections.id, connectionId), eq(financialConnections.userId, userId)))
      .limit(1);
    if (!connection) {
      return [];
    }

    return this.db
      .insert(accounts)
      .values(providerAccounts.map((account) => ({ id: randomUUID(), userId, connectionId, ...account })))
      .returning({
        id: accounts.id,
        userId: accounts.userId,
        connectionId: accounts.connectionId,
        providerAccountId: accounts.providerAccountId,
        displayName: accounts.displayName,
        accountType: accounts.accountType,
        currency: accounts.currency,
        currentBalanceMinor: accounts.currentBalanceMinor,
        availableBalanceMinor: accounts.availableBalanceMinor,
      });
  }

  async getAccountsForUser(userId: string): Promise<FinancialAccount[]> {
    return this.db
      .select({
        id: accounts.id,
        userId: accounts.userId,
        connectionId: accounts.connectionId,
        providerAccountId: accounts.providerAccountId,
        displayName: accounts.displayName,
        accountType: accounts.accountType,
        currency: accounts.currency,
        currentBalanceMinor: accounts.currentBalanceMinor,
        availableBalanceMinor: accounts.availableBalanceMinor,
      })
      .from(accounts)
      .where(eq(accounts.userId, userId));
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
