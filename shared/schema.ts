import {
  bigint,
  boolean,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const connectionStatus = pgEnum("connection_status", ["pending", "active", "error", "revoked"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("sessions_active_lookup_idx").on(table.tokenHash, table.expiresAt)]);

export const financialConnections = pgTable("financial_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 64 }).notNull(),
  providerItemId: varchar("provider_item_id", { length: 255 }).notNull(),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  encryptionKeyVersion: varchar("encryption_key_version", { length: 32 }).notNull(),
  status: connectionStatus("status").default("pending").notNull(),
  cursor: text("cursor"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("financial_connections_owner_item_idx").on(table.userId, table.providerItemId),
  index("financial_connections_owner_idx").on(table.userId),
]);

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  connectionId: uuid("connection_id").notNull().references(() => financialConnections.id, { onDelete: "cascade" }),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  accountType: varchar("account_type", { length: 100 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  currentBalanceMinor: bigint("current_balance_minor", { mode: "number" }),
  availableBalanceMinor: bigint("available_balance_minor", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("accounts_connection_provider_idx").on(table.connectionId, table.providerAccountId),
  index("accounts_owner_idx").on(table.userId),
]);

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  providerTransactionId: varchar("provider_transaction_id", { length: 255 }).notNull(),
  merchant: varchar("merchant", { length: 255 }).notNull(),
  merchantNormalized: varchar("merchant_normalized", { length: 255 }),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  occurredOn: date("occurred_on").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  pending: boolean("pending").default(false).notNull(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("transactions_account_provider_idx").on(table.accountId, table.providerTransactionId),
  index("transactions_owner_date_idx").on(table.userId, table.occurredOn),
]);

export const budgets = pgTable("budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 100 }).notNull(),
  budgetingMonth: date("budgeting_month").notNull(),
  monthlyLimitMinor: bigint("monthly_limit_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("budgets_owner_category_month_idx").on(table.userId, table.category, table.budgetingMonth),
  index("budgets_owner_month_idx").on(table.userId, table.budgetingMonth),
]);
