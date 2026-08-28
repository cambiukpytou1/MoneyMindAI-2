import { describe, expect, it } from "vitest";
import { readPlaidSandboxConfig } from "../../config/plaid-runtime";
import { createConfiguredPlaidSandboxGateway } from "./gateway";

describe("Plaid staging configuration", () => {
  const requiredEnvironment = [
    "PLAID_CLIENT_ID",
    "PLAID_SECRET",
    "PLAID_ENVIRONMENT",
    "MONEYMINDAI_STAGING_ORIGIN",
  ];
  const canRunLiveCheck = requiredEnvironment.every((key) => Boolean(process.env[key]));
  const testWithConfiguration = canRunLiveCheck ? it : it.skip;

  testWithConfiguration("uses the configured Sandbox mode and staging webhook origin to create a server-side Link token", async () => {
    const config = readPlaidSandboxConfig();
    const gateway = createConfiguredPlaidSandboxGateway(config.clientId, config.secret, config.webhookUrl);

    await expect(gateway.createLinkToken("00000000-0000-4000-8000-000000000001")).resolves.toEqual({
      linkToken: expect.any(String),
    });
    expect(config.webhookUrl).toBe("https://moneymindai-fxpu7b9m.manus.space/api/plaid/webhook");
  }, 15_000);
});
