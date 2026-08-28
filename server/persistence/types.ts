export type MoneyMindUser = {
  id: string;
  email: string;
  passwordHash: string;
};

export type PersistedSession = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type FinancialConnection = {
  id: string;
  userId: string;
  provider: "plaid";
  providerItemId: string;
  encryptedAccessToken: string;
  encryptionKeyVersion: string;
  status: "pending" | "active" | "error" | "revoked";
  cursor: string | null;
};

export type CreateFinancialConnection = Omit<FinancialConnection, "id" | "userId">;

export type FinancialAccount = {
  id: string;
  userId: string;
  connectionId?: string;
  providerAccountId?: string;
  displayName?: string;
  accountType?: string;
  currency?: string;
  currentBalanceMinor?: number | null;
  availableBalanceMinor?: number | null;
};

export type CreateFinancialAccount = Required<Omit<FinancialAccount, "id" | "userId" | "connectionId">>;

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

export type CreateFinancialTransaction = Omit<FinancialTransaction, "id" | "userId">;
export type CreateMoneyMindUser = MoneyMindUser;

type MaybePromise<Value> = Value | Promise<Value>;

export interface MoneyMindRepository {
  ping(): MaybePromise<void>;
  createUser(user: CreateMoneyMindUser): MaybePromise<MoneyMindUser | null>;
  getUserByEmail(email: string): MaybePromise<MoneyMindUser | null>;
  getUserById(id: string): MaybePromise<MoneyMindUser | null>;
  createSession(session: PersistedSession): MaybePromise<void>;
  getActiveSessionByTokenHash(tokenHash: string, now: Date): MaybePromise<PersistedSession | null>;
  revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): MaybePromise<void>;
  createFinancialConnectionForUser(userId: string, connection: CreateFinancialConnection): MaybePromise<FinancialConnection>;
  createFinancialAccountsForConnection(
    userId: string,
    connectionId: string,
    accounts: CreateFinancialAccount[],
  ): MaybePromise<FinancialAccount[]>;
  getAccountsForUser(userId: string): MaybePromise<FinancialAccount[]>;
  getTransactionForUser(id: string, userId: string): MaybePromise<FinancialTransaction | null>;
  createTransactionForUser(userId: string, transaction: CreateFinancialTransaction): MaybePromise<FinancialTransaction | null>;
}
