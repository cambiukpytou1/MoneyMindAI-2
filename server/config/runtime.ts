type RuntimeEnvironment = Record<string, string | undefined>;

export type RuntimeConfig = {
  databaseUrl: string;
  sessionSecret: string;
  dataEncryptionKey: string;
};

function requiredValue(environment: RuntimeEnvironment, key: string): string {
  const value = environment[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required for financial persistence`);
  }
  return value;
}

export function readRuntimeConfig(environment: RuntimeEnvironment = process.env): RuntimeConfig {
  const databaseUrl = requiredValue(environment, "DATABASE_URL");
  if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string");
  }

  const sessionSecret = requiredValue(environment, "SESSION_SECRET");
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }

  const dataEncryptionKey = requiredValue(environment, "DATA_ENCRYPTION_KEY");
  if (Buffer.from(dataEncryptionKey, "base64").length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }

  return { databaseUrl, sessionSecret, dataEncryptionKey };
}
