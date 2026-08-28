import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import type { CreateFinancialAccount } from "../../persistence/types";
import type { PlaidGateway } from "../../http/app";

type PlaidSdkClient = {
  linkTokenCreate(input: {
    client_name: string;
    country_codes: ["US"];
    products: ["transactions"];
    language: "en";
    webhook: string;
    user: { client_user_id: string };
    transactions: { days_requested: number };
  }): Promise<{ data: { link_token: string } }>;
  itemPublicTokenExchange(input: { public_token: string }): Promise<{ data: { access_token: string; item_id: string } }>;
  accountsGet(input: { access_token: string }): Promise<{
    data: {
      accounts: Array<{
        account_id: string;
        name: string;
        type: string;
        balances: { current: number | null; available: number | null; iso_currency_code: string | null };
      }>;
    };
  }>;
};

function toMinorUnits(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100);
}

export function createPlaidSandboxGateway(client: PlaidSdkClient, webhookUrl: string): PlaidGateway {
  return {
    async createLinkToken(userId) {
      const response = await client.linkTokenCreate({
        client_name: "MoneyMind",
        country_codes: ["US"],
        products: ["transactions"],
        language: "en",
        webhook: webhookUrl,
        user: { client_user_id: userId },
        transactions: { days_requested: 90 },
      });
      return { linkToken: response.data.link_token };
    },

    async exchangePublicToken(publicToken) {
      const response = await client.itemPublicTokenExchange({ public_token: publicToken });
      return { accessToken: response.data.access_token, itemId: response.data.item_id };
    },

    async getAccounts(accessToken) {
      const response = await client.accountsGet({ access_token: accessToken });
      return response.data.accounts.map((account): CreateFinancialAccount => ({
        providerAccountId: account.account_id,
        displayName: account.name,
        accountType: account.type,
        currency: account.balances.iso_currency_code ?? "USD",
        currentBalanceMinor: toMinorUnits(account.balances.current),
        availableBalanceMinor: toMinorUnits(account.balances.available),
      }));
    },
  };
}

export function createConfiguredPlaidSandboxGateway(
  clientId: string,
  secret: string,
  webhookUrl: string,
): PlaidGateway {
  const configuration = new Configuration({
    basePath: PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });
  return createPlaidSandboxGateway(new PlaidApi(configuration) as unknown as PlaidSdkClient, webhookUrl);
}
