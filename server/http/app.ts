import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { z } from "zod";
import type { CreateFinancialAccount, FinancialTransaction, MoneyMindRepository, MoneyMindUser } from "../persistence/types";
import { ProviderTokenCipher } from "../security/encryption";
import { hashPassword, verifyPassword } from "../security/password";
import { SessionManager } from "../security/session";

const transactionSchema = z.object({
  accountId: z.string().uuid(),
  providerTransactionId: z.string().min(1).max(255),
  merchant: z.string().min(1).max(255),
  amountMinor: z.number().int(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  occurredOn: z.string().date(),
  category: z.string().min(1).max(100),
  pending: z.boolean(),
});

const credentialSchema = z.object({
  email: z.string().email().max(320).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(12).max(128),
});

const registrationSchema = credentialSchema.extend({
  acceptsDataConsent: z.literal(true),
});

const plaidExchangeSchema = z.object({
  publicToken: z.string().min(1).max(1024),
  acceptsConnectionConsent: z.literal(true),
});

type AppDependencies = {
  repository: MoneyMindRepository;
  sessions: SessionManager;
  staticDirectory: string | null;
  plaid?: PlaidIntegration;
};

export type PlaidGateway = {
  createLinkToken(userId: string): Promise<{ linkToken: string }>;
  exchangePublicToken(publicToken: string): Promise<{ accessToken: string; itemId: string }>;
  getAccounts(accessToken: string): Promise<CreateFinancialAccount[]>;
};

export type PlaidIntegration = {
  cipher: ProviderTokenCipher;
  gateway: PlaidGateway;
};

type AuthenticatedRequest = Request & { userId?: string };

function getCookie(request: Request, name: string): string | undefined {
  const cookies = request.headers.cookie?.split(";") ?? [];
  const entry = cookies.map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry?.slice(name.length + 1);
}

function presentTransaction(transaction: FinancialTransaction | null) {
  if (!transaction) {
    return null;
  }
  const { userId: _userId, providerTransactionId: _providerTransactionId, ...safeTransaction } = transaction;
  return safeTransaction;
}

function presentUser(user: MoneyMindUser) {
  return { id: user.id, email: user.email };
}

function setSessionCookie(response: Response, token: string, expiresAt: Date) {
  response.cookie("moneymind_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function createMoneyMindApp({ repository, sessions, staticDirectory, plaid }: AppDependencies) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "10kb" }));

  const requireUser = async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    const userId = await sessions.getAuthenticatedUserId(getCookie(request, "moneymind_session"));
    if (!userId) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    request.userId = userId;
    next();
  };

  app.get("/api/health", async (_request, response) => {
    try {
      await repository.ping();
      response.json({ ok: true, service: "moneymind", persistence: "connected" });
    } catch {
      response.status(503).json({ ok: false, service: "moneymind", persistence: "unavailable" });
    }
  });

  app.post("/api/auth/register", async (request, response) => {
    const parsed = registrationSchema.safeParse(request.body);
    if (!parsed.success) {
      const missingConsent = request.body?.acceptsDataConsent !== true;
      response.status(400).json({ error: missingConsent ? "Financial data consent is required" : "Invalid registration details" });
      return;
    }

    const user = await repository.createUser({
      id: randomUUID(),
      email: parsed.data.email,
      passwordHash: hashPassword(parsed.data.password),
    });
    if (!user) {
      response.status(409).json({ error: "Unable to create account" });
      return;
    }

    const session = await sessions.createSession(user.id);
    setSessionCookie(response, session.token, session.expiresAt);
    response.status(201).json({ user: presentUser(user) });
  });

  app.post("/api/auth/login", async (request, response) => {
    const parsed = credentialSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = await repository.getUserByEmail(parsed.data.email);
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      response.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const session = await sessions.createSession(user.id);
    setSessionCookie(response, session.token, session.expiresAt);
    response.json({ user: presentUser(user) });
  });

  app.get("/api/auth/me", requireUser, async (request: AuthenticatedRequest, response) => {
    const user = await repository.getUserById(request.userId!);
    if (!user) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    response.json({ user: presentUser(user) });
  });

  app.post("/api/auth/logout", requireUser, async (request: AuthenticatedRequest, response) => {
    await sessions.revokeSession(getCookie(request, "moneymind_session"));
    response.clearCookie("moneymind_session", { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    response.status(204).end();
  });

  app.get("/api/accounts", requireUser, async (request: AuthenticatedRequest, response) => {
    const accounts = await repository.getAccountsForUser(request.userId!);
    response.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        displayName: account.displayName,
        accountType: account.accountType,
        currency: account.currency,
        currentBalanceMinor: account.currentBalanceMinor,
        availableBalanceMinor: account.availableBalanceMinor,
      })),
    });
  });

  app.post("/api/plaid/link-token", requireUser, async (request: AuthenticatedRequest, response) => {
    if (!plaid) {
      response.status(503).json({ error: "Plaid Sandbox is unavailable" });
      return;
    }
    try {
      const { linkToken } = await plaid.gateway.createLinkToken(request.userId!);
      response.json({ linkToken });
    } catch {
      response.status(502).json({ error: "Unable to start a financial connection" });
    }
  });

  app.post("/api/plaid/exchange", requireUser, async (request: AuthenticatedRequest, response) => {
    if (!plaid) {
      response.status(503).json({ error: "Plaid Sandbox is unavailable" });
      return;
    }
    const parsed = plaidExchangeSchema.safeParse(request.body);
    if (!parsed.success) {
      const missingConsent = request.body?.acceptsConnectionConsent !== true;
      response.status(400).json({ error: missingConsent ? "Connection consent is required" : "Invalid connection payload" });
      return;
    }

    try {
      const exchanged = await plaid.gateway.exchangePublicToken(parsed.data.publicToken);
      const encrypted = plaid.cipher.encrypt(exchanged.accessToken);
      const connection = await repository.createFinancialConnectionForUser(request.userId!, {
        provider: "plaid",
        providerItemId: exchanged.itemId,
        encryptedAccessToken: JSON.stringify(encrypted),
        encryptionKeyVersion: encrypted.keyVersion,
        status: "pending",
        cursor: null,
      });
      const providerAccounts = await plaid.gateway.getAccounts(exchanged.accessToken);
      const accounts = await repository.createFinancialAccountsForConnection(request.userId!, connection.id, providerAccounts);
      response.status(201).json({
        connection: { id: connection.id, provider: connection.provider, status: connection.status },
        accounts,
      });
    } catch {
      response.status(502).json({ error: "Unable to complete financial connection" });
    }
  });

  app.get("/api/transactions/:transactionId", requireUser, async (request: AuthenticatedRequest, response) => {
    const transaction = await repository.getTransactionForUser(request.params.transactionId, request.userId!);
    if (!transaction) {
      response.status(404).json({ error: "Transaction not found" });
      return;
    }
    response.json({ transaction: presentTransaction(transaction) });
  });

  app.post("/api/transactions", requireUser, async (request: AuthenticatedRequest, response) => {
    const parsed = transactionSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid transaction payload" });
      return;
    }
    const transaction = await repository.createTransactionForUser(request.userId!, parsed.data);
    if (!transaction) {
      response.status(404).json({ error: "Account not found" });
      return;
    }
    response.status(201).json({ transaction: presentTransaction(transaction) });
  });

  if (staticDirectory) {
    app.use(express.static(staticDirectory));
    app.get("*", (_request, response) => response.sendFile(path.join(staticDirectory, "index.html")));
  }

  return app;
}

export function createPersistenceUnavailableApp(staticDirectory: string) {
  const app = express();
  app.disable("x-powered-by");
  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, service: "moneymind", persistence: "unavailable" });
  });
  app.use("/api", (_request, response) => {
    response.status(503).json({ error: "Financial persistence is unavailable" });
  });
  app.use(express.static(staticDirectory));
  app.get("*", (_request, response) => response.sendFile(path.join(staticDirectory, "index.html")));
  return app;
}
