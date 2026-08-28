type RuntimeEnvironment = Record<string, string | undefined>;

export type PlaidSandboxConfig = {
  clientId: string;
  secret: string;
  webhookUrl: string;
};

function requiredValue(environment: RuntimeEnvironment, key: string): string {
  const value = environment[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export function readPlaidSandboxConfig(environment: RuntimeEnvironment = process.env): PlaidSandboxConfig {
  if (requiredValue(environment, "PLAID_ENVIRONMENT") !== "sandbox") {
    throw new Error("PLAID_ENVIRONMENT must be sandbox");
  }

  const origin = requiredValue(environment, "MONEYMINDAI_STAGING_ORIGIN");
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error("MONEYMINDAI_STAGING_ORIGIN must be an HTTPS URL");
  }
  if (parsedOrigin.protocol !== "https:") {
    throw new Error("MONEYMINDAI_STAGING_ORIGIN must be an HTTPS URL");
  }

  return {
    clientId: requiredValue(environment, "PLAID_CLIENT_ID"),
    secret: requiredValue(environment, "PLAID_SECRET"),
    webhookUrl: new URL("/api/plaid/webhook", parsedOrigin).toString(),
  };
}
