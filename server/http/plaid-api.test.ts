import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createMoneyMindApp, type PlaidIntegration } from "./app";
import { InMemoryMoneyMindRepository } from "../persistence/memory";
import { ProviderTokenCipher } from "../security/encryption";
import { SessionManager } from "../security/session";

const sessionSecret = "staging-session-secret-that-is-long-enough-for-testing";
const encryptionKey = Buffer.alloc(32, 7).toString("base64");

function createPlaidIntegration(): PlaidIntegration {
  return {
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
    },
  };
}

async function registerOwner(app: ReturnType<typeof createMoneyMindApp>) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email: `owner-${randomUUID()}@example.com`, password: "safe-password-123", acceptsDataConsent: true })
    .expect(201);
  return response.headers["set-cookie"]?.[0]!;
}

describe("Plaid Sandbox connection API", () => {
  it("creates a Link token only for an authenticated owner and does not disclose provider credentials", async () => {
    const repository = new InMemoryMoneyMindRepository();
    const app = createMoneyMindApp({
      repository,
      sessions: new SessionManager(sessionSecret, repository),
      staticDirectory: null,
      plaid: createPlaidIntegration(),
    });
    const cookie = await registerOwner(app);

    const response = await request(app).post("/api/plaid/link-token").set("Cookie", cookie).expect(200);

    expect(response.body).toEqual({ linkToken: expect.stringContaining("link-sandbox-") });
    expect(JSON.stringify(response.body)).not.toContain("access-sandbox-token");
  });

  it("requires consent and persists exchanged Sandbox tokens only as ciphertext with owner-scoped accounts", async () => {
    const repository = new InMemoryMoneyMindRepository();
    const app = createMoneyMindApp({
      repository,
      sessions: new SessionManager(sessionSecret, repository),
      staticDirectory: null,
      plaid: createPlaidIntegration(),
    });
    const cookie = await registerOwner(app);

    await request(app)
      .post("/api/plaid/exchange")
      .set("Cookie", cookie)
      .send({ publicToken: "public-sandbox-token", acceptsConnectionConsent: false })
      .expect(400, { error: "Connection consent is required" });

    const exchange = await request(app)
      .post("/api/plaid/exchange")
      .set("Cookie", cookie)
      .send({ publicToken: "public-sandbox-token", acceptsConnectionConsent: true })
      .expect(201);

    expect(exchange.body.connection).toMatchObject({ provider: "plaid", status: "pending" });
    expect(exchange.body.connection.encryptedAccessToken).toBeUndefined();
    expect(exchange.body.accounts).toEqual([expect.objectContaining({ displayName: "Plaid Checking", currency: "USD" })]);

    const storedConnection = repository.getOnlyConnection();
    expect(storedConnection.encryptedAccessToken).not.toContain("access-sandbox-token");
    expect(storedConnection.encryptionKeyVersion).toBe("v1");
    expect(repository.getAccountsForUser(storedConnection.userId)).toHaveLength(1);
  });

  it("does not create a Link token or exchange a public token for an unauthenticated request", async () => {
    const repository = new InMemoryMoneyMindRepository();
    const app = createMoneyMindApp({
      repository,
      sessions: new SessionManager(sessionSecret, repository),
      staticDirectory: null,
      plaid: createPlaidIntegration(),
    });

    await request(app).post("/api/plaid/link-token").expect(401, { error: "Authentication required" });
    await request(app)
      .post("/api/plaid/exchange")
      .send({ publicToken: "public-sandbox-token", acceptsConnectionConsent: true })
      .expect(401, { error: "Authentication required" });
  });
});
