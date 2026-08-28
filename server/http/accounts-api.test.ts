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

describe("account listing", () => {
  it("returns only accounts owned by the authenticated user", async () => {
    const repository = new InMemoryMoneyMindRepository();
    const app = createMoneyMindApp({ repository, sessions: new SessionManager(sessionSecret, repository), staticDirectory: null });
    const owner = await register(app, "owner@example.com");
    const other = await register(app, "other@example.com");
    const ownerConnection = await repository.createFinancialConnectionForUser(owner.userId, {
      provider: "plaid",
      providerItemId: `item-${randomUUID()}`,
      encryptedAccessToken: "ciphertext",
      encryptionKeyVersion: "v1",
      status: "active",
      cursor: null,
    });
    const otherConnection = await repository.createFinancialConnectionForUser(other.userId, {
      provider: "plaid",
      providerItemId: `item-${randomUUID()}`,
      encryptedAccessToken: "ciphertext",
      encryptionKeyVersion: "v1",
      status: "active",
      cursor: null,
    });
    await repository.createFinancialAccountsForConnection(owner.userId, ownerConnection.id, [{
      providerAccountId: "owner-account",
      displayName: "Owner checking",
      accountType: "depository",
      currency: "USD",
      currentBalanceMinor: 125_000,
      availableBalanceMinor: 120_000,
    }]);
    await repository.createFinancialAccountsForConnection(other.userId, otherConnection.id, [{
      providerAccountId: "other-account",
      displayName: "Other checking",
      accountType: "depository",
      currency: "USD",
      currentBalanceMinor: 900_000,
      availableBalanceMinor: 900_000,
    }]);

    const response = await request(app).get("/api/accounts").set("Cookie", owner.cookie).expect(200);

    expect(response.body.accounts).toEqual([expect.objectContaining({ displayName: "Owner checking", currentBalanceMinor: 125_000 })]);
    expect(JSON.stringify(response.body)).not.toContain("Other checking");
  });

  it("requires authentication before listing accounts", async () => {
    const repository = new InMemoryMoneyMindRepository();
    const app = createMoneyMindApp({ repository, sessions: new SessionManager(sessionSecret, repository), staticDirectory: null });
    await request(app).get("/api/accounts").expect(401, { error: "Authentication required" });
  });
});
