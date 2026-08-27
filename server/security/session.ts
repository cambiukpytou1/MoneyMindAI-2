import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { InMemoryMoneyMindRepository } from "../persistence/memory";
import type { MoneyMindRepository } from "../persistence/types";

const sessionLifetimeMilliseconds = 1000 * 60 * 60 * 24 * 30;

export class SessionManager {
  private readonly repository: MoneyMindRepository;

  constructor(
    private readonly secret: string,
    repository?: MoneyMindRepository,
  ) {
    if (secret.length < 32) {
      throw new Error("SESSION_SECRET must have at least 32 characters");
    }
    this.repository = repository ?? new InMemoryMoneyMindRepository();
  }

  async createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + sessionLifetimeMilliseconds);

    await this.repository.createSession({
      id: randomUUID(),
      userId,
      tokenHash: this.hashToken(token),
      expiresAt,
      revokedAt: null,
    });

    return { token, expiresAt };
  }

  async getAuthenticatedUserId(token: string | undefined): Promise<string | null> {
    if (!token) {
      return null;
    }
    const session = await this.repository.getActiveSessionByTokenHash(this.hashToken(token), new Date());
    return session?.userId ?? null;
  }

  async revokeSession(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }
    await this.repository.revokeSessionByTokenHash(this.hashToken(token), new Date());
  }

  private hashToken(token: string): string {
    return createHmac("sha256", this.secret).update(token).digest("hex");
  }
}
