import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { readRuntimeConfig } from "../config/runtime";
import { createMoneyMindApp } from "./app";
import { PostgresMoneyMindRepository } from "../persistence/postgres";
import { SessionManager } from "../security/session";

const canRunAgainstStaging = Boolean(
  process.env.MONEYMINDAI_DATABASE_URL && process.env.SESSION_SECRET && process.env.DATA_ENCRYPTION_KEY,
);

describe.runIf(canRunAgainstStaging)("staging health endpoint", () => {
  it("verifies the supplied isolated database configuration through the lightweight health route", async () => {
    const config = readRuntimeConfig();
    const app = createMoneyMindApp({
      repository: new PostgresMoneyMindRepository(config.databaseUrl),
      sessions: new SessionManager(config.sessionSecret),
      staticDirectory: null,
    });
    const server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP listener");

      const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        service: "moneymind",
        persistence: "connected",
      });
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
