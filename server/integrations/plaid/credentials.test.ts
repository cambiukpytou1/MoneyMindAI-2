import { describe, expect, it } from "vitest";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidSecret = process.env.PLAID_SECRET;
const hasSandboxCredentials = Boolean(plaidClientId && plaidSecret);

describe("Plaid Sandbox credentials", () => {
  const testWithCredentials = hasSandboxCredentials ? it : it.skip;

  testWithCredentials("authenticate a minimal server-side institution request", async () => {
    const response = await fetch("https://sandbox.plaid.com/institutions/get", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        client_id: plaidClientId,
        secret: plaidSecret,
        country_codes: ["US"],
        count: 1,
        offset: 0,
      }),
    });

    expect(response.ok).toBe(true);

    const payload = await response.json() as { institutions?: unknown[] };
    expect(payload.institutions).toHaveLength(1);
  }, 15_000);
});
