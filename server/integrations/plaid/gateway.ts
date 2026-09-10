import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import type { CreateFinancialAccount, FinancialTransactionSyncPage } from "../../persistence/types";
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
  transactionsSync(input: { access_token: string; cursor?: string }): Promise<{
    data: {
      added: PlaidTransaction[];
      modified: PlaidTransaction[];
      removed: Array<{ transaction_id: string }>;
      next_cursor: string;
      has_more: boolean;
    };
  }>;
};

type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  merchant_name: string | null;
  name: string;
  amount: number;
  iso_currency_code: string | null;
  date: string;
  personal_finance_category: { primary: string } | null;
  pending: boolean;
};

function toMinorUnits(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100);
}

function normalizeTransaction(transaction: PlaidTransaction) {
  return {
    providerTransactionId: transaction.transaction_id,
    providerAccountId: transaction.account_id,
    merchant: transaction.merchant_name ?? transaction.name,
    amountMinor: Math.round(transaction.amount * 100),
    currency: transaction.iso_currency_code ?? "USD",
    occurredOn: transaction.date,
    category: transaction.personal_finance_category?.primary ?? "Uncategorized",
    pending: transaction.pending,
  };
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

    async syncTransactions(accessToken, cursor): Promise<FinancialTransactionSyncPage> {
      const response = await client.transactionsSync({
        access_token: accessToken,
        ...(cursor ? { cursor } : {}),
      });
      return {
        added: response.data.added.map(normalizeTransaction),
        modified: response.data.modified.map(normalizeTransaction),
        removedProviderTransactionIds: response.data.removed.map((transaction) => transaction.transaction_id),
        nextCursor: response.data.next_cursor,
        hasMore: response.data.has_more,
      };
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
