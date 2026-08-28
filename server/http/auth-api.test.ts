import request from "supertest";
import { describe, expect, it } from "vitest";
import { createMoneyMindApp } from "./app";
import { InMemoryMoneyMindRepository } from "../persistence/memory";
import { SessionManager } from "../security/session";

const sessionSecret = "staging-session-secret-that-is-long-enough-for-testing";

function createTestApp() {
  const repository = new InMemoryMoneyMindRepository();
  const sessions = new SessionManager(sessionSecret, repository);
  return { app: createMoneyMindApp({ repository, sessions, staticDirectory: null }), repository };
}

describe("staging credential onboarding", () => {
  it("creates an owner only after the user accepts financial data access and establishes an opaque session", async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "owner@example.com", password: "safe-password-123", acceptsDataConsent: true })
      .expect(201);

    expect(response.body.user).toMatchObject({ email: "owner@example.com" });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.headers["set-cookie"]?.[0]).toContain("moneymind_session=");
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]?.[0]).toContain("Secure");
    expect(response.headers["set-cookie"]?.[0]).toContain("SameSite=Lax");
  });

  it("rejects registration when consent is not explicitly accepted", async () => {
    const { app } = createTestApp();

    await request(app)
      .post("/api/auth/register")
      .send({ email: "owner@example.com", password: "safe-password-123", acceptsDataConsent: false })
      .expect(400, { error: "Financial data consent is required" });
  });

  it("does not disclose whether an email exists during sign-in", async () => {
    const { app } = createTestApp();

    await request(app)
      .post("/api/auth/login")
      .send({ email: "unknown@example.com", password: "safe-password-123" })
      .expect(401, { error: "Invalid email or password" });
  });

  it("returns only the authenticated owner record and clears the opaque session on logout", async () => {
    const { app } = createTestApp();
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ email: "owner@example.com", password: "safe-password-123", acceptsDataConsent: true })
      .expect(201);
    const cookie = registered.headers["set-cookie"]?.[0];

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie!).expect(200);
    expect(me.body.user).toMatchObject({ email: "owner@example.com" });
    expect(me.body.user.passwordHash).toBeUndefined();

    await request(app).post("/api/auth/logout").set("Cookie", cookie!).expect(204);
    await request(app).get("/api/auth/me").set("Cookie", cookie!).expect(401, { error: "Authentication required" });
  });
});
