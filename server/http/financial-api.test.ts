import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createMoneyMindApp } from "./app";
import { InMemoryMoneyMindRepository } from "../persistence/memory";
import { SessionManager } from "../security/session";

const sessionSecret = "test-session-secret-with-at-least-thirty-two-characters";

describe("financial record ownership API", () => {
  let repository: InMemoryMoneyMindRepository;
  let sessions: SessionManager;
  let app: ReturnType<typeof createMoneyMindApp>;

  beforeEach(() => {
    repository = new InMemoryMoneyMindRepository();
    repository.addUser({ id: "user-a", email: "ada@example.test" });
    repository.addUser({ id: "user-b", email: "ben@example.test" });
    repository.addAccount({ id: "11111111-1111-4111-8111-111111111111", userId: "user-a" });
    repository.addAccount({ id: "22222222-2222-4222-8222-222222222222", userId: "user-b" });
    repository.addTransaction({
      id: "txn-b-1",
      userId: "user-b",
      accountId: "account-b-1",
      providerTransactionId: "provider-b-1",
      merchant: "Private Market",
      amountMinor: -5000,
      currency: "USD",
      occurredOn: "2026-08-01",
      category: "Groceries",
      pending: false,
    });
    sessions = new SessionManager(sessionSecret);
    app = createMoneyMindApp({ repository, sessions, staticDirectory: null });
  });

  it("rejects unauthenticated financial-record requests", async () => {
    await request(app).get("/api/transactions/txn-b-1").expect(401);
  });

  it("returns a non-enumerating 404 when one user requests another user's transaction", async () => {
    const session = await sessions.createSession("user-a");

    const response = await request(app)
      .get("/api/transactions/txn-b-1")
      .set("Cookie", `moneymind_session=${session.token}`)
      .expect(404);

    expect(response.body).toEqual({ error: "Transaction not found" });
  });

  it("derives transaction ownership from the authenticated session instead of a client-supplied user id", async () => {
    const session = await sessions.createSession("user-a");

    await request(app)
      .post("/api/transactions")
      .set("Cookie", `moneymind_session=${session.token}`)
      .send({
        userId: "user-b",
        accountId: "11111111-1111-4111-8111-111111111111",
        providerTransactionId: "provider-a-1",
        merchant: "Owner Scoped Market",
        amountMinor: -1200,
        currency: "USD",
        occurredOn: "2026-08-03",
        category: "Groceries",
        pending: false,
      })
      .expect(201);

    expect(repository.listTransactionsForUser("user-a")).toHaveLength(1);
    expect(repository.listTransactionsForUser("user-b")).toHaveLength(1);
    expect(repository.listTransactionsForUser("user-a")[0]?.userId).toBe("user-a");
  });

  it("does not allow a signed-in user to create a transaction against another user's account", async () => {
    const session = await sessions.createSession("user-a");

    await request(app)
      .post("/api/transactions")
      .set("Cookie", `moneymind_session=${session.token}`)
      .send({
        accountId: "22222222-2222-4222-8222-222222222222",
        providerTransactionId: "provider-forbidden",
        merchant: "Foreign Account Market",
        amountMinor: -1800,
        currency: "USD",
        occurredOn: "2026-08-03",
        category: "Groceries",
        pending: false,
      })
      .expect(404);

    expect(repository.listTransactionsForUser("user-a")).toHaveLength(0);
  });
});
