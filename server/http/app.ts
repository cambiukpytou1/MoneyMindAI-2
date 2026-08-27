import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { z } from "zod";
import type { FinancialTransaction, MoneyMindRepository } from "../persistence/types";
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

type AppDependencies = {
  repository: MoneyMindRepository;
  sessions: SessionManager;
  staticDirectory: string | null;
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

export function createMoneyMindApp({ repository, sessions, staticDirectory }: AppDependencies) {
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
