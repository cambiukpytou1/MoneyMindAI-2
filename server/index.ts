import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMoneyMindApp, createPersistenceUnavailableApp } from "./http/app";
import { PostgresMoneyMindRepository } from "./persistence/postgres";
import { SessionManager } from "./security/session";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, "public");
const databaseUrl = process.env.DATABASE_URL;
const sessionSecret = process.env.SESSION_SECRET;
const app = databaseUrl && sessionSecret
  ? createMoneyMindApp({
      repository: new PostgresMoneyMindRepository(databaseUrl),
      sessions: new SessionManager(sessionSecret),
      staticDirectory: publicDirectory,
    })
  : createPersistenceUnavailableApp(publicDirectory);

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be provided by the deployment environment");
}

app.listen(port, () => {
  console.info("MoneyMind server started");
});
