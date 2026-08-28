import { describe, expect, it } from "vitest";
import { readPlaidSandboxConfig } from "./plaid-runtime";

const requiredEnvironment = {
  PLAID_CLIENT_ID: "sandbox-client-id",
  PLAID_SECRET: "sandbox-secret",
  PLAID_ENVIRONMENT: "sandbox",
  MONEYMINDAI_STAGING_ORIGIN: "https://moneymindai-fxpu7b9m.manus.space",
};

describe("Plaid Sandbox runtime configuration", () => {
  it("accepts only the explicitly configured staging Sandbox environment", () => {
    expect(readPlaidSandboxConfig(requiredEnvironment)).toEqual({
      clientId: "sandbox-client-id",
      secret: "sandbox-secret",
      webhookUrl: "https://moneymindai-fxpu7b9m.manus.space/api/plaid/webhook",
    });
  });

  it("fails closed when the mode, provider credentials, or HTTPS staging origin are absent or invalid", () => {
    expect(() => readPlaidSandboxConfig({ ...requiredEnvironment, PLAID_ENVIRONMENT: "production" })).toThrow("PLAID_ENVIRONMENT must be sandbox");
    expect(() => readPlaidSandboxConfig({ ...requiredEnvironment, PLAID_SECRET: "" })).toThrow("PLAID_SECRET is required");
    expect(() => readPlaidSandboxConfig({ ...requiredEnvironment, MONEYMINDAI_STAGING_ORIGIN: "http://localhost:5173" })).toThrow("MONEYMINDAI_STAGING_ORIGIN must be an HTTPS URL");
  });
});
