import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createMoneyMindApp } from "./app";
import { InMemoryMoneyMindRepository } from "../persistence/memory";
import { SessionManager } from "../security/session";

const sessionSecret = "staging-session-secret-that-is-long-enough-for-testing";

async function registerOwner(app: ReturnType<typeof createMoneyMindApp>, prefix: string) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email: `${prefix}-${randomUUID()}@example.com`, password: "safe-password-123", acceptsDataConsent: true })
    .expect(201);
  return { id: response.body.user.id as string, cookie: response.headers["set-cookie"]?.[0]! };
}

function createOwnedAccount(repository: InMemoryMoneyMindRepository, userId: string, suffix: string) {
  const connection = repository.createFinancialConnectionForUser(userId, {
    provider: "plaid",
    providerItemId: `item-${suffix}`,
    encryptedAccessToken: "test-only-ciphertext",
    encryptionKeyVersion: "v1",
    status: "active",
    cursor: null,
  });
  return repository.createFinancialAccountsForConnection(userId, connection.id, [{
    providerAccountId: `account-${suffix}`,
    displayName: `${suffix} checking`,
    accountType: "depository",
    currency: "USD",
    currentBalanceMinor: 0,
    availableBalanceMinor: 0,
  }])[0]!;
}

describe("owner-scoped transaction listing", () => {
  it("returns only the signed-in owner's non-removed transactions in newest-first order", async () => {
    const repository = new InMemoryMoneyMindRepository();
    const app = createMoneyMindApp({
      repository,
      sessions: new SessionManager(sessionSecret, repository),
      staticDirectory: null,
    });
    const owner = await registerOwner(app, "owner");
    const otherOwner = await registerOwner(app, "other");
    const ownerAccount = createOwnedAccount(repository, owner.id, "owner");
    const otherAccount = createOwnedAccount(repository, otherOwner.id, "other");

    await repository.createTransactionForUser(owner.id, {
      accountId: ownerAccount.id,
      providerTransactionId: "owner-newer",
      merchant: "Current owner newer",
      amountMinor: 1_500,
      currency: "USD",
      occurredOn: "2026-09-10",
      category: "Food and Drink",
      pending: false,
    });
    await repository.createTransactionForUser(owner.id, {
      accountId: ownerAccount.id,
      providerTransactionId: "owner-older",
      merchant: "Current owner older",
      amountMinor: 900,
      currency: "USD",
      occurredOn: "2026-09-01",
      category: "Travel",
      pending: true,
    });
    await repository.createTransactionForUser(otherOwner.id, {
      accountId: otherAccount.id,
      providerTransactionId: "other-owner",
      merchant: "Another owner record",
      amountMinor: 42_000,
      currency: "USD",
      occurredOn: "2026-09-11",
      category: "Income",
      pending: false,
    });

    const response = await request(app).get("/api/transactions?limit=20").set("Cookie", owner.cookie).expect(200);

    expect(response.body.transactions).toEqual([
      expect.objectContaining({ merchant: "Current owner newer", amountMinor: 1_500, pending: false }),
      expect.objectContaining({ merchant: "Current owner older", amountMinor: 900, pending: true }),
    ]);
    expect(response.body.transactions).not.toContainEqual(expect.objectContaining({ merchant: "Another owner record" }));
  });

  it("rejects unauthenticated transaction-list requests", async () => {
    const repository = new InMemoryMoneyMindRepository();
    const app = createMoneyMindApp({ repository, sessions: new SessionManager(sessionSecret, repository), staticDirectory: null });

    await request(app).get("/api/transactions").expect(401, { error: "Authentication required" });
  });
});
