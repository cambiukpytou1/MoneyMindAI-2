import { and, desc, eq, gte, gt, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { accounts, budgets, financialConnections, sessions, transactions, users } from "../../shared/schema";
import type {
  CreateFinancialAccount,
  CreateFinancialBudget,
  CreateFinancialConnection,
  CreateMoneyMindUser,
  CreateFinancialTransaction,
  FinancialAccount,
  FinancialBudget,
  FinancialBudgetSummary,
  FinancialConnection,
  FinancialTransaction,
  MoneyMindUser,
  MoneyMindRepository,
  PersistedSession,
} from "./types";
import { calculateBudgetSummary } from "../domain/budget";

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

  async setFinancialConnectionStatusForUser(
    userId: string,
    connectionId: string,
    status: FinancialConnection["status"],
  ): Promise<FinancialConnection | null> {
    const [updated] = await this.db
      .update(financialConnections)
      .set({ status })
      .where(and(eq(financialConnections.id, connectionId), eq(financialConnections.userId, userId)))
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
    return updated ? { ...updated, provider: "plaid" } : null;
  }

  async getFinancialConnectionForUser(userId: string, connectionId: string): Promise<FinancialConnection | null> {
    const [connection] = await this.db
      .select({
        id: financialConnections.id,
        userId: financialConnections.userId,
        provider: financialConnections.provider,
        providerItemId: financialConnections.providerItemId,
        encryptedAccessToken: financialConnections.encryptedAccessToken,
        encryptionKeyVersion: financialConnections.encryptionKeyVersion,
        status: financialConnections.status,
        cursor: financialConnections.cursor,
      })
      .from(financialConnections)
      .where(and(eq(financialConnections.id, connectionId), eq(financialConnections.userId, userId)))
      .limit(1);
    return connection ? { ...connection, provider: "plaid" } : null;
  }

  async synchronizeFinancialTransactionsForConnection(
    userId: string,
    connectionId: string,
    page: import("./types").FinancialTransactionSyncPage,
  ): Promise<import("./types").TransactionSynchronizationResult | null> {
    const ownedAccounts = await this.db
      .select({ id: accounts.id, providerAccountId: accounts.providerAccountId })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.connectionId, connectionId)));
    if (ownedAccounts.length === 0) {
      return null;
    }
    const accountIdsByProviderId = new Map(ownedAccounts.map((account) => [account.providerAccountId, account.id]));
    const synchronize = async (records: import("./types").SyncedFinancialTransaction[]) => {
      let count = 0;
      for (const record of records) {
        const accountId = accountIdsByProviderId.get(record.providerAccountId);
        if (!accountId) continue;
        await this.db
          .insert(transactions)
          .values({
            id: randomUUID(),
            userId,
            accountId,
            providerTransactionId: record.providerTransactionId,
            merchant: record.merchant,
            amountMinor: record.amountMinor,
            currency: record.currency,
            occurredOn: record.occurredOn,
            category: record.category,
            pending: record.pending,
            removedAt: null,
          })
          .onConflictDoUpdate({
            target: [transactions.accountId, transactions.providerTransactionId],
            set: {
              merchant: record.merchant,
              amountMinor: record.amountMinor,
              currency: record.currency,
              occurredOn: record.occurredOn,
              category: record.category,
              pending: record.pending,
              removedAt: null,
              updatedAt: new Date(),
            },
          });
        count += 1;
      }
      return count;
    };
    const added = await synchronize(page.added);
    const modified = await synchronize(page.modified);
    let removed = 0;
    if (page.removedProviderTransactionIds.length > 0) {
      const affected = await this.db
        .update(transactions)
        .set({ removedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(transactions.userId, userId),
          inArray(transactions.accountId, ownedAccounts.map((account) => account.id)),
          inArray(transactions.providerTransactionId, page.removedProviderTransactionIds),
          isNull(transactions.removedAt),
        ))
        .returning({ id: transactions.id });
      removed = affected.length;
    }
    return { added, modified, removed };
  }

  async setFinancialConnectionCursorForUser(
    userId: string,
    connectionId: string,
    cursor: string,
  ): Promise<FinancialConnection | null> {
    const [updated] = await this.db
      .update(financialConnections)
      .set({ cursor, lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(financialConnections.id, connectionId), eq(financialConnections.userId, userId)))
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
    return updated ? { ...updated, provider: "plaid" } : null;
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

  async listTransactionsForUser(userId: string, limit: number): Promise<FinancialTransaction[]> {
    return this.db
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
      .where(and(eq(transactions.userId, userId), isNull(transactions.removedAt)))
      .orderBy(desc(transactions.occurredOn), desc(transactions.id))
      .limit(limit);
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

  async upsertBudgetForUser(userId: string, budget: CreateFinancialBudget): Promise<FinancialBudget> {
    const [stored] = await this.db
      .insert(budgets)
      .values({ id: randomUUID(), userId, ...budget })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.category, budgets.budgetingMonth],
        set: { monthlyLimitMinor: budget.monthlyLimitMinor, currency: budget.currency, updatedAt: new Date() },
      })
      .returning({
        id: budgets.id,
        userId: budgets.userId,
        category: budgets.category,
        budgetingMonth: budgets.budgetingMonth,
        monthlyLimitMinor: budgets.monthlyLimitMinor,
        currency: budgets.currency,
      });
    if (!stored) throw new Error("Unable to save budget");
    return stored;
  }

  async getBudgetSummariesForUser(userId: string, month: string): Promise<FinancialBudgetSummary[]> {
    const start = `${month}-01`;
    const [year, calendarMonth] = month.split("-").map(Number);
    const end = `${year}-${String((calendarMonth ?? 12) === 12 ? 1 : (calendarMonth ?? 0) + 1).padStart(2, "0")}-01`;
    const endYear = calendarMonth === 12 ? (year ?? 0) + 1 : year;
    const monthEnd = `${endYear}-${end.slice(5)}`;
    const [budgetRows, transactionRows] = await Promise.all([
      this.db.select({
        id: budgets.id,
        userId: budgets.userId,
        category: budgets.category,
        budgetingMonth: budgets.budgetingMonth,
        monthlyLimitMinor: budgets.monthlyLimitMinor,
        currency: budgets.currency,
      }).from(budgets).where(and(eq(budgets.userId, userId), eq(budgets.budgetingMonth, start))),
      this.db.select({
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
      }).from(transactions).where(and(
        eq(transactions.userId, userId),
        isNull(transactions.removedAt),
        gte(transactions.occurredOn, start),
        lt(transactions.occurredOn, monthEnd),
      )),
    ]);
    return budgetRows
      .sort((left, right) => left.category.localeCompare(right.category))
      .map((budget) => ({
        ...budget,
        ...calculateBudgetSummary(
          budget,
          transactionRows.map((transaction) => ({
            ...transaction,
            direction: transaction.amountMinor >= 0 ? "expense" as const : "income" as const,
          })),
          month,
        ),
      }));
  }
}
