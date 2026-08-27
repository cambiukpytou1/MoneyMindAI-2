export type MoneyMindUser = {
  id: string;
  email: string;
};

export type PersistedSession = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type FinancialTransaction = {
  id: string;
  userId: string;
  accountId: string;
  providerTransactionId: string;
  merchant: string;
  amountMinor: number;
  currency: string;
  occurredOn: string;
  category: string;
  pending: boolean;
};

export type FinancialAccount = {
  id: string;
  userId: string;
};

export type CreateFinancialTransaction = Omit<FinancialTransaction, "id" | "userId">;

type MaybePromise<Value> = Value | Promise<Value>;

export interface MoneyMindRepository {
  ping(): MaybePromise<void>;
  createSession(session: PersistedSession): MaybePromise<void>;
  getActiveSessionByTokenHash(tokenHash: string, now: Date): MaybePromise<PersistedSession | null>;
  revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): MaybePromise<void>;
  getTransactionForUser(id: string, userId: string): MaybePromise<FinancialTransaction | null>;
  createTransactionForUser(userId: string, transaction: CreateFinancialTransaction): MaybePromise<FinancialTransaction | null>;
}
