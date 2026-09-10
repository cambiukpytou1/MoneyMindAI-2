import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createMoneyMindApp } from "./app";
import { InMemoryMoneyMindRepository } from "../persistence/memory";
import { SessionManager } from "../security/session";

const sessionSecret = "staging-session-secret-that-is-long-enough-for-testing";

async function register(app: ReturnType<typeof createMoneyMindApp>, email: string) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "safe-password-123", acceptsDataConsent: true })
    .expect(201);
  return { userId: response.body.user.id as string, cookie: response.headers["set-cookie"]?.[0] as string };
}

async function seedAccount(repository: InMemoryMoneyMindRepository, userId: string, label: string) {
  const connection = await repository.createFinancialConnectionForUser(userId, {
    provider: "plaid",
    providerItemId: `item-${randomUUID()}`,
    encryptedAccessToken: "ciphertext",
    encryptionKeyVersion: "v1",
    status: "active",
    cursor: null,
  });
  return (await repository.createFinancialAccountsForConnection(userId, connection.id, [{
    providerAccountId: `account-${randomUUID()}`,
    displayName: label,
    accountType: "depository",
    currency: "USD",
    currentBalanceMinor: 100_000,
    availableBalanceMinor: 100_000,
  }]))[0]!;
}

describe("budget API", () => {
  it("creates and lists a budget with actual spending from only the signed-in owner's posted transactions", async () => {
    const repository = new InMemoryMoneyMindRepository();
    const app = createMoneyMindApp({ repository, sessions: new SessionManager(sessionSecret, repository), staticDirectory: null });
    const owner = await register(app, "budget-owner@example.com");
    const other = await register(app, "budget-other@example.com");
    const ownerAccount = await seedAccount(repository, owner.userId, "Owner checking");
    const otherAccount = await seedAccount(repository, other.userId, "Other checking");

    await repository.createTransactionForUser(owner.userId, {
      accountId: ownerAccount.id,
      providerTransactionId: "owner-grocery",
      merchant: "Market",
      amountMinor: 4_250,
      currency: "USD",
      occurredOn: "2026-09-04",
      category: "Groceries",
      pending: false,
    });
    await repository.createTransactionForUser(owner.userId, {
      accountId: ownerAccount.id,
      providerTransactionId: "owner-pending",
      merchant: "Market",
      amountMinor: 1_000,
      currency: "USD",
      occurredOn: "2026-09-05",
      category: "Groceries",
      pending: true,
    });
    await repository.createTransactionForUser(other.userId, {
      accountId: otherAccount.id,
      providerTransactionId: "other-grocery",
      merchant: "Other market",
      amountMinor: 9_900,
      currency: "USD",
      occurredOn: "2026-09-03",
      category: "Groceries",
      pending: false,
    });

    await request(app)
      .post("/api/budgets")
      .set("Cookie", owner.cookie)
      .send({ category: "Groceries", budgetingMonth: "2026-09-01", monthlyLimitMinor: 50_000, currency: "usd" })
      .expect(201);

    const response = await request(app).get("/api/budgets?month=2026-09").set("Cookie", owner.cookie).expect(200);

    expect(response.body.budgets).toEqual([expect.objectContaining({
      category: "Groceries",
      currency: "USD",
      monthlyLimitMinor: 50_000,
      spentMinor: 4_250,
      remainingMinor: 45_750,
      status: "on_track",
    })]);
    expect(JSON.stringify(response.body)).not.toContain("Other market");
  });

  it("rejects unauthenticated and malformed budget requests", async () => {
    const repository = new InMemoryMoneyMindRepository();
    const app = createMoneyMindApp({ repository, sessions: new SessionManager(sessionSecret, repository), staticDirectory: null });

    await request(app).get("/api/budgets?month=2026-09").expect(401, { error: "Authentication required" });
    const owner = await register(app, "budget-validation@example.com");
    await request(app)
      .post("/api/budgets")
      .set("Cookie", owner.cookie)
      .send({ category: "", budgetingMonth: "September", monthlyLimitMinor: -1, currency: "US" })
      .expect(400, { error: "Invalid budget payload" });
  });
});
