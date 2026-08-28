import { describe, expect, it, vi } from "vitest";
import { createPlaidSandboxGateway } from "./gateway";

describe("Plaid Sandbox gateway", () => {
  it("creates a minimal U.S. Transactions Link token with a non-PII application user identifier", async () => {
    const linkTokenCreate = vi.fn().mockResolvedValue({ data: { link_token: "link-sandbox-token" } });
    const gateway = createPlaidSandboxGateway({
      linkTokenCreate,
      itemPublicTokenExchange: vi.fn(),
      accountsGet: vi.fn(),
    }, "https://staging.example.com/api/plaid/webhook");

    await expect(gateway.createLinkToken("2d756a39-1919-4cc5-ae98-02de8ed6e3a3")).resolves.toEqual({ linkToken: "link-sandbox-token" });
    expect(linkTokenCreate).toHaveBeenCalledWith(expect.objectContaining({
      client_name: "MoneyMind",
      country_codes: ["US"],
      products: ["transactions"],
      language: "en",
      webhook: "https://staging.example.com/api/plaid/webhook",
      user: { client_user_id: "2d756a39-1919-4cc5-ae98-02de8ed6e3a3" },
      transactions: { days_requested: 90 },
    }));
  });

  it("exchanges a public token server-side and maps account balances to integer minor units", async () => {
    const itemPublicTokenExchange = vi.fn().mockResolvedValue({ data: { access_token: "access-token", item_id: "item-123" } });
    const accountsGet = vi.fn().mockResolvedValue({
      data: {
        accounts: [{
          account_id: "account-123",
          name: "Everyday Checking",
          type: "depository",
          balances: { current: 1234.56, available: 1200, iso_currency_code: "USD" },
        }],
      },
    });
    const gateway = createPlaidSandboxGateway({ linkTokenCreate: vi.fn(), itemPublicTokenExchange, accountsGet }, "https://staging.example.com/api/plaid/webhook");

    await expect(gateway.exchangePublicToken("public-token")).resolves.toEqual({ accessToken: "access-token", itemId: "item-123" });
    await expect(gateway.getAccounts("access-token")).resolves.toEqual([{
      providerAccountId: "account-123",
      displayName: "Everyday Checking",
      accountType: "depository",
      currency: "USD",
      currentBalanceMinor: 123456,
      availableBalanceMinor: 120000,
    }]);
    expect(itemPublicTokenExchange).toHaveBeenCalledWith({ public_token: "public-token" });
    expect(accountsGet).toHaveBeenCalledWith({ access_token: "access-token" });
  });
});
