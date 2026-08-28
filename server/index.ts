import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPlaidSandboxConfig } from "./config/plaid-runtime";
import { readRuntimeConfig } from "./config/runtime";
import { createMoneyMindApp, createPersistenceUnavailableApp } from "./http/app";
import { createConfiguredPlaidSandboxGateway } from "./integrations/plaid/gateway";
import { PostgresMoneyMindRepository } from "./persistence/postgres";
import { ProviderTokenCipher } from "./security/encryption";
import { SessionManager } from "./security/session";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, "public");

let app = createPersistenceUnavailableApp(publicDirectory);
try {
  const runtimeConfig = readRuntimeConfig();
  const plaidConfig = readPlaidSandboxConfig();
  const repository = new PostgresMoneyMindRepository(runtimeConfig.databaseUrl);
  app = createMoneyMindApp({
    repository,
    sessions: new SessionManager(runtimeConfig.sessionSecret, repository),
    staticDirectory: publicDirectory,
    plaid: {
      cipher: new ProviderTokenCipher(runtimeConfig.dataEncryptionKey, "v1"),
      gateway: createConfiguredPlaidSandboxGateway(plaidConfig.clientId, plaidConfig.secret, plaidConfig.webhookUrl),
    },
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
