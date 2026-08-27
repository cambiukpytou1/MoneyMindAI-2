import { describe, expect, it } from "vitest";
import { readRuntimeConfig } from "./runtime";

const validEnvironment = {
  MONEYMINDAI_DATABASE_URL: "postgres://user:password@aws-us-west-2.pooler.supabase.com:6543/postgres",
  SESSION_SECRET: "s".repeat(32),
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
};

describe("readRuntimeConfig", () => {
  it("accepts the complete staging server configuration without exposing values", () => {
    expect(readRuntimeConfig(validEnvironment)).toEqual({
      databaseUrl: validEnvironment.MONEYMINDAI_DATABASE_URL,
      sessionSecret: validEnvironment.SESSION_SECRET,
      dataEncryptionKey: validEnvironment.DATA_ENCRYPTION_KEY,
    });
  });

  it("fails closed when a required financial-data secret is absent or invalid", () => {
    expect(() => readRuntimeConfig({ ...validEnvironment, MONEYMINDAI_DATABASE_URL: undefined })).toThrow("MONEYMINDAI_DATABASE_URL");
    expect(() => readRuntimeConfig({ ...validEnvironment, SESSION_SECRET: "too-short" })).toThrow("SESSION_SECRET");
    expect(() => readRuntimeConfig({ ...validEnvironment, DATA_ENCRYPTION_KEY: "not-a-32-byte-key" })).toThrow("DATA_ENCRYPTION_KEY");
  });

  it("uses the MoneyMind-specific database URL rather than any ambient platform database", () => {
    expect(readRuntimeConfig({
      ...validEnvironment,
      DATABASE_URL: "postgres://built-in-platform-database.example.test:5432/postgres",
    }).databaseUrl).toBe(validEnvironment.MONEYMINDAI_DATABASE_URL);
  });
});
