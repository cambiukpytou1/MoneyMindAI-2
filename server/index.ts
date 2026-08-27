import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRuntimeConfig } from "./config/runtime";
import { createMoneyMindApp, createPersistenceUnavailableApp } from "./http/app";
import { PostgresMoneyMindRepository } from "./persistence/postgres";
import { SessionManager } from "./security/session";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, "public");

let app = createPersistenceUnavailableApp(publicDirectory);
try {
  const runtimeConfig = readRuntimeConfig();
  app = createMoneyMindApp({
    repository: new PostgresMoneyMindRepository(runtimeConfig.databaseUrl),
    sessions: new SessionManager(runtimeConfig.sessionSecret),
    staticDirectory: publicDirectory,
  });
} catch (error) {
  console.warn("[Runtime] Financial persistence disabled:", error instanceof Error ? error.message : error);
}

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be provided by the deployment environment");
}

app.listen(port, () => {
  console.info("MoneyMind server started");
});
