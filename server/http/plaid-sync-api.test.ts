import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createMoneyMindApp, type PlaidIntegration } from "./app";
import { InMemoryMoneyMindRepository } from "../persistence/memory";
import { ProviderTokenCipher } from "../security/encryption";
import { SessionManager } from "../security/session";

const sessionSecret = "staging-session-secret-that-is-long-enough-for-testing";
const encryptionKey = Buffer.alloc(32, 7).toString("base64");

function createPlaidIntegration() {
  const syncTransactions = vi.fn().mockResolvedValue({
    added: [{
      providerTransactionId: "sandbox-transaction-1",
      providerAccountId: "account-sandbox-1",
      merchant: "Sandbox Coffee",
      amountMinor: 550,
      currency: "USD",
      occurredOn: "2026-09-10",
      category: "Food and Drink",
      pending: false,
    }],
    modified: [],
    removedProviderTransactionIds: [],
    nextCursor: "sandbox-cursor-1",
    hasMore: false,
  });

  const integration: PlaidIntegration & { gateway: PlaidIntegration["gateway"] & { syncTransactions: typeof syncTransactions } } = {
    cipher: new ProviderTokenCipher(encryptionKey, "v1"),
    gateway: {
      createLinkToken: async (userId) => ({ linkToken: `link-sandbox-${userId}` }),
      exchangePublicToken: async () => ({ accessToken: "access-sandbox-token", itemId: "item-sandbox-1" }),
      getAccounts: async () => [{
        providerAccountId: "account-sandbox-1",
        displayName: "Plaid Checking",
        accountType: "depository",
        currency: "USD",
        currentBalanceMinor: 123_456,
        availableBalanceMinor: 120_000,
      }],
      syncTransactions,
    },
  };
  return { integration, syncTransactions };
}

async function registerOwner(app: ReturnType<typeof createMoneyMindApp>) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email: `owner-${randomUUID()}@example.com`, password: "safe-password-123", acceptsDataConsent: true })
    .expect(201);
  return response.headers["set-cookie"]?.[0]!;
}

async function createConnectedSandboxAccount(
  app: ReturnType<typeof createMoneyMindApp>,
  cookie: string,
) {
  const exchange = await request(app)
    .post("/api/plaid/exchange")
    .set("Cookie", cookie)
    .send({ publicToken: "public-sandbox-token", acceptsConnectionConsent: true })
    .expect(201);
  return exchange.body.connection.id as string;
}

describe("Plaid Sandbox transaction synchronization API", () => {
  it("decrypts an owner connection server-side, stores a cursor, and persists only that owner's normalized transactions", async () => {
    const repository = new InMemoryMoneyMindRepository();
    const { integration, syncTransactions } = createPlaidIntegration();
    const app = createMoneyMindApp({
      repository,
      sessions: new SessionManager(sessionSecret, repository),
      staticDirectory: null,
      plaid: integration,
    });
    const cookie = await registerOwner(app);
    const connectionId = await createConnectedSandboxAccount(app, cookie);

    const response = await request(app)
      .post(`/api/plaid/connections/${connectionId}/sync`)
      .set("Cookie", cookie)
      .expect(200);

    expect(response.body).toEqual({
      connection: { id: connectionId, status: "active" },
      synchronized: { added: 1, modified: 0, removed: 0, hasMore: false },
    });
    expect(syncTransactions).toHaveBeenCalledWith("access-sandbox-token", null);
    expect(repository.getOnlyConnection()).toMatchObject({ cursor: "sandbox-cursor-1", status: "active" });
    expect(repository.listTransactionsForUser(repository.getOnlyConnection().userId)).toEqual([
      expect.objectContaining({ merchant: "Sandbox Coffee", amountMinor: 550, providerTransactionId: "sandbox-transaction-1" }),
    ]);
  });

  it("does not reveal or synchronize another owner's connection", async () => {
    const repository = new InMemoryMoneyMindRepository();
    const { integration, syncTransactions } = createPlaidIntegration();
    const app = createMoneyMindApp({
      repository,
      sessions: new SessionManager(sessionSecret, repository),
      staticDirectory: null,
      plaid: integration,
    });
    const ownerCookie = await registerOwner(app);
    const otherOwnerCookie = await registerOwner(app);
    const connectionId = await createConnectedSandboxAccount(app, ownerCookie);

    await request(app)
      .post(`/api/plaid/connections/${connectionId}/sync`)
      .set("Cookie", otherOwnerCookie)
      .expect(404, { error: "Connection not found" });

    expect(syncTransactions).not.toHaveBeenCalled();
  });
});
