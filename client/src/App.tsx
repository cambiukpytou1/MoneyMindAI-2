import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { formatMoney } from "./lib/money";

type User = { id: string; email: string };
type Account = {
  id: string;
  displayName: string;
  accountType: string;
  currency: string;
  currentBalanceMinor: number | null;
  availableBalanceMinor: number | null;
};

type AppPage = "overview" | "transactions" | "budgets" | "goals" | "insights" | "connections" | "community" | "feedback" | "settings" | "pricing";
type ApiError = { error?: string };

const navigation: Array<{ page: AppPage; label: string }> = [
  { page: "overview", label: "Overview" },
  { page: "transactions", label: "Transactions" },
  { page: "budgets", label: "Budgets" },
  { page: "goals", label: "Goals" },
  { page: "insights", label: "Insights" },
  { page: "connections", label: "Connections" },
  { page: "community", label: "Community" },
  { page: "feedback", label: "Feedback" },
  { page: "settings", label: "Settings" },
];

const pageFromPath = (): AppPage => {
  const candidate = window.location.pathname.slice(1) as AppPage;
  return navigation.some(({ page }) => page === candidate) || candidate === "pricing" ? candidate : "overview";
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers ?? {}) },
    credentials: "same-origin",
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({})) as ApiError;
    throw new Error(detail.error ?? "Something went wrong. Please try again.");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

function navigate(page: AppPage) {
  window.history.pushState({}, "", `/${page === "overview" ? "" : page}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function Authentication({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"sign-in" | "create">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const path = mode === "create" ? "/api/auth/register" : "/api/auth/login";
      const body = mode === "create" ? { email, password, acceptsDataConsent: consent } : { email, password };
      const response = await api<{ user: User }>(path, { method: "POST", body: JSON.stringify(body) });
      onAuthenticated(response.user);
      navigate("overview");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-introduction" aria-labelledby="money-mind-title">
        <a className="wordmark" href="/">MoneyMind<span>.</span></a>
        <div>
          <h1 id="money-mind-title">See where your money is going, then decide what to do next.</h1>
          <p>MoneyMind is a personal financial workspace for reviewing transactions, setting plans, and understanding spending patterns. Staging supports Plaid Sandbox connections only.</p>
        </div>
        <dl className="trust-list">
          <div><dt>Private by design</dt><dd>Financial records are scoped to your signed-in account.</dd></div>
          <div><dt>Reviewable context</dt><dd>Insights will always show the transactions behind an observation.</dd></div>
          <div><dt>Your control</dt><dd>You choose when to connect, refresh, or remove an institution.</dd></div>
        </dl>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-switch" role="tablist" aria-label="Authentication choice">
          <button type="button" role="tab" aria-selected={mode === "create"} onClick={() => setMode("create")}>Create account</button>
          <button type="button" role="tab" aria-selected={mode === "sign-in"} onClick={() => setMode("sign-in")}>Sign in</button>
        </div>
        <h2 id="auth-title">{mode === "create" ? "Start with a private workspace" : "Welcome back"}</h2>
        <p className="form-intro">{mode === "create" ? "Use a staging email and a password with at least 12 characters." : "Sign in to your MoneyMind staging workspace."}</p>
        <form onSubmit={submit} noValidate>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "create" ? "new-password" : "current-password"} minLength={12} required /></label>
          {mode === "create" && (
            <label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
              <span>I understand that MoneyMind may process the financial data I explicitly choose to connect in this staging environment.</span>
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary" type="submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "create" ? "Create staging account" : "Sign in"}</button>
        </form>
        <p className="environment-copy">Sandbox only. Do not enter a real institution password in this environment.</p>
      </section>
    </main>
  );
}

function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="empty-state"><h2>{title}</h2><div>{children}</div></section>;
}

function Connections({ onConnectionComplete }: { onConnectionComplete: () => Promise<void> }) {
  const [consent, setConsent] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSuccess = useCallback(async (publicToken: string) => {
    setIsSubmitting(true);
    setError("");
    try {
      const result = await api<{ accounts: Account[] }>("/api/plaid/exchange", {
        method: "POST",
        body: JSON.stringify({ publicToken, acceptsConnectionConsent: true }),
      });
      await onConnectionComplete();
      setStatus(`${result.accounts.length} Sandbox account${result.accounts.length === 1 ? "" : "s"} added. Initial transaction retrieval may take a few moments.`);
      setLinkToken(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Sandbox connection could not be completed.");
    } finally {
      setIsSubmitting(false);
    }
  }, [onConnectionComplete]);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess, onExit: (plaidError) => {
    if (plaidError) setError("The Sandbox connection was closed before completion. You can try again when ready.");
  } });

  async function prepareLink() {
    setError("");
    setStatus("");
    if (!consent) {
      setError("Please confirm connection consent before continuing.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api<{ linkToken: string }>("/api/plaid/link-token", { method: "POST" });
      setLinkToken(response.linkToken);
      setStatus("Sandbox Link is ready. Continue when you are ready to use a Plaid test institution.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to prepare the Sandbox connection.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="connection-layout" aria-labelledby="connections-title">
      <div>
        <h1 id="connections-title">Connections</h1>
        <p className="page-summary">Add a Plaid Sandbox institution only when you are ready to test the account-linking journey. Sandbox uses test credentials and test data.</p>
      </div>
      <section className="connection-card">
        <h2>Connect a Sandbox institution</h2>
        <p>MoneyMind will request transaction data only for the accounts you select. The browser receives a short-lived Link token; access tokens are exchanged and encrypted on the server.</p>
        <label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>I consent to connect a **Plaid Sandbox** institution and import test transactions into this staging workspace.</span>
        </label>
        <div className="button-row">
          {!linkToken ? (
            <button className="button primary" type="button" onClick={prepareLink} disabled={isSubmitting}>{isSubmitting ? "Preparing…" : "Prepare Sandbox Link"}</button>
          ) : (
            <button className="button primary" type="button" onClick={() => open()} disabled={!ready || isSubmitting}>{isSubmitting ? "Connecting…" : ready ? "Open Plaid Sandbox" : "Loading Sandbox Link…"}</button>
          )}
          {linkToken && <button className="button secondary" type="button" onClick={() => { setLinkToken(null); setStatus(""); }}>Cancel</button>}
        </div>
        {status && <p className="form-success" role="status">{status}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
      <aside className="connection-safety">
        <h2>Before you continue</h2>
        <ul>
          <li>Use only Plaid’s sandbox test institution and credentials.</li>
          <li>Do not enter a real bank username or password.</li>
          <li>You can remove a connection before production is considered.</li>
        </ul>
      </aside>
    </section>
  );
}

function Overview({ accounts, loading }: { accounts: Account[]; loading: boolean }) {
  const total = useMemo(() => accounts.reduce((sum, account) => sum + (account.currentBalanceMinor ?? 0), 0), [accounts]);
  return (
    <section className="page-layout" aria-labelledby="overview-title">
      <header className="page-heading"><div><h1 id="overview-title">Overview</h1><p>Review connected accounts and the next action in your workspace.</p></div><button className="button secondary" type="button" onClick={() => navigate("connections")}>Manage connections</button></header>
      {loading ? <EmptyState title="Loading accounts"><p>Loading your owner-scoped account summary.</p></EmptyState> : accounts.length === 0 ? (
        <EmptyState title="No accounts connected"><p>Start with a Plaid Sandbox institution to verify your connection flow. No real financial data is permitted in this environment.</p><button className="button primary" type="button" onClick={() => navigate("connections")}>Connect Sandbox institution</button></EmptyState>
      ) : (
        <>
          <section className="balance-summary" aria-label="Connected account total"><p>Current balance across connected accounts</p><strong>{formatMoney(total, accounts[0]?.currency ?? "USD")}</strong><span>Sandbox data. Amounts may not match transaction history.</span></section>
          <section className="data-panel"><div className="section-heading"><h2>Connected accounts</h2><span>{accounts.length} account{accounts.length === 1 ? "" : "s"}</span></div><div className="account-list">{accounts.map((account) => <article key={account.id} className="account-row"><div><h3>{account.displayName}</h3><p>{account.accountType}</p></div><strong>{account.currentBalanceMinor === null ? "Balance unavailable" : formatMoney(account.currentBalanceMinor, account.currency ?? "USD")}</strong></article>)}</div></section>
        </>
      )}
    </section>
  );
}

function PlannedPage({ page }: { page: Exclude<AppPage, "overview" | "connections" | "pricing"> }) {
  const content: Record<typeof page, { title: string; copy: string; action: string; actionPage?: AppPage }> = {
    transactions: { title: "Transactions", copy: "Transactions will appear here only after a connected account has completed its initial Sandbox sync. The list will support search, category review, and clear freshness details.", action: "Connect Sandbox institution", actionPage: "connections" },
    budgets: { title: "Budgets", copy: "Create category plans once transaction categories are ready. Plans will remain private to your MoneyMind account.", action: "Go to overview", actionPage: "overview" },
    goals: { title: "Goals", copy: "Goals will track user-defined progress without moving, investing, or transferring money. This workspace will be enabled after budget foundations are complete.", action: "Go to overview", actionPage: "overview" },
    insights: { title: "Insights", copy: "Future observations will cite the transactions and category changes behind them. They will not provide investment, tax, or legal advice.", action: "Review connections", actionPage: "connections" },
    community: { title: "Merchant community", copy: "Merchant-specific tips and savings notes will be separated from private transaction history and moderated before public contribution is enabled.", action: "Go to feedback", actionPage: "feedback" },
    feedback: { title: "Feedback", copy: "The feedback board will accept feature requests and defects, detect duplicates, collect votes, and present material work for owner approval before implementation.", action: "Go to overview", actionPage: "overview" },
    settings: { title: "Settings", copy: "Identity, connection permissions, active sessions, data export, and deletion controls will be completed before production identity is enabled.", action: "Manage connections", actionPage: "connections" },
  };
  const item = content[page];
  return <section className="page-layout"><header className="page-heading"><div><h1>{item.title}</h1><p>{item.copy}</p></div></header><EmptyState title="This workspace is being built"><p>The navigation is available now so you can inspect the product structure without being sent to a dead end.</p>{item.actionPage && <button className="button secondary" type="button" onClick={() => navigate(item.actionPage!)}>{item.action}</button>}</EmptyState></section>;
}

function Pricing() {
  return <main className="pricing-page"><header className="public-header"><a className="wordmark" href="/">MoneyMind<span>.</span></a><button className="button secondary" type="button" onClick={() => navigate("overview")}>Return to workspace</button></header><section className="pricing-content"><h1>Simple pricing, clear limits.</h1><p>MoneyMind’s paid plan is designed for people who want a private place to review spending patterns, budgets, and connected financial data.</p><div className="pricing-grid"><article><h2>Monthly</h2><p className="price">$9 <span>per month</span></p><p>Flexible access while you evaluate MoneyMind.</p><button className="button secondary" type="button" disabled>Billing is not configured</button></article><article className="featured-plan"><h2>Annual</h2><p className="price">$90 <span>per year</span></p><p>Two months free compared with monthly billing.</p><button className="button primary" type="button" disabled>Billing is not configured</button></article></div><p className="environment-copy">Pricing is a product decision preview. No checkout, payment data, or subscription is active in staging.</p></section></main>;
}

function Workspace({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const [page, setPage] = useState<AppPage>(pageFromPath);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountError, setAccountError] = useState("");

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountError("");
    try {
      const response = await api<{ accounts: Account[] }>("/api/accounts");
      setAccounts(response.accounts);
    } catch (caught) {
      setAccountError(caught instanceof Error ? caught.message : "Unable to load accounts.");
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);
  useEffect(() => {
    const syncPage = () => setPage(pageFromPath());
    window.addEventListener("popstate", syncPage);
    return () => window.removeEventListener("popstate", syncPage);
  }, []);

  const changePage = (target: AppPage) => { navigate(target); setPage(target); };

  return (
    <main className="application-shell">
      <aside className="navigation-panel" aria-label="MoneyMind navigation"><a className="wordmark" href="/overview" onClick={(event) => { event.preventDefault(); changePage("overview"); }}>MoneyMind<span>.</span></a><nav>{navigation.map((item) => <button key={item.page} className={page === item.page ? "nav-link active" : "nav-link"} type="button" aria-current={page === item.page ? "page" : undefined} onClick={() => changePage(item.page)}>{item.label}</button>)}</nav><div className="navigation-footer"><button className="nav-link" type="button" onClick={() => changePage("pricing")}>Pricing</button><button className="quiet-button" type="button" onClick={() => void onLogout()}>Sign out</button></div></aside>
      <section className="workspace"><header className="workspace-header"><p>Signed in as <strong>{user.email}</strong></p><span>Staging · Plaid Sandbox only</span></header>{accountError && <p className="form-error page-error" role="alert">{accountError}</p>}{page === "overview" && <Overview accounts={accounts} loading={accountsLoading} />}{page === "connections" && <Connections onConnectionComplete={loadAccounts} />}{page === "pricing" && <Pricing />}{page !== "overview" && page !== "connections" && page !== "pricing" && <PlannedPage page={page} />}</section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User }>("/api/auth/me").then((response) => setUser(response.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await api<void>("/api/auth/logout", { method: "POST" });
    setUser(null);
    navigate("overview");
  }, []);

  if (loading) return <main className="loading-page">Loading MoneyMind…</main>;
  return user ? <Workspace user={user} onLogout={logout} /> : <Authentication onAuthenticated={setUser} />;
}

export default App;
