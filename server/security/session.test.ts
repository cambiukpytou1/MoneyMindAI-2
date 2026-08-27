import { describe, expect, it } from "vitest";
import { InMemoryMoneyMindRepository } from "../persistence/memory";
import { SessionManager } from "./session";

describe("SessionManager", () => {
  it("persists only a non-reversible hash of an opaque session token", async () => {
    const repository = new InMemoryMoneyMindRepository();
    const sessions = new SessionManager("test-session-secret-with-at-least-thirty-two-characters", repository);

    const { token } = await sessions.createSession("user-a");
    const storedSession = repository.getOnlySession();

    expect(storedSession.tokenHash).not.toContain(token);
    expect(storedSession.tokenHash).toHaveLength(64);
    await expect(sessions.getAuthenticatedUserId(token)).resolves.toBe("user-a");
  });

  it("rejects revoked sessions", async () => {
    const repository = new InMemoryMoneyMindRepository();
    const sessions = new SessionManager("test-session-secret-with-at-least-thirty-two-characters", repository);
    const { token } = await sessions.createSession("user-a");

    await sessions.revokeSession(token);

    await expect(sessions.getAuthenticatedUserId(token)).resolves.toBeNull();
  });
});
