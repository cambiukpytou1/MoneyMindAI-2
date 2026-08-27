import { useState } from "react";
import { formatMoney } from "./lib/money";

type Transaction = {
  id: string;
  merchant: string;
  category: string;
  occurredOn: string;
  amountMinor: number;
  status: "Reviewed" | "Needs review";
};

const transactions: Transaction[] = [
  { id: "txn-1", merchant: "Northstar Market", category: "Groceries", occurredOn: "Aug 18", amountMinor: -8_642, status: "Reviewed" },
  { id: "txn-2", merchant: "Luma Coffee", category: "Dining", occurredOn: "Aug 17", amountMinor: -650, status: "Needs review" },
  { id: "txn-3", merchant: "Signal Mobile", category: "Utilities", occurredOn: "Aug 16", amountMinor: -7_200, status: "Reviewed" },
  { id: "txn-4", merchant: "Greenline Transit", category: "Transport", occurredOn: "Aug 15", amountMinor: -275, status: "Reviewed" },
];

const budgets = [
  { category: "Groceries", spentMinor: 38_640, limitMinor: 55_000 },
  { category: "Dining", spentMinor: 19_450, limitMinor: 25_000 },
  { category: "Transport", spentMinor: 8_225, limitMinor: 14_000 },
];

function BudgetRow({ category, spentMinor, limitMinor }: (typeof budgets)[number]) {
  const percentage = Math.min((spentMinor / limitMinor) * 100, 100);
  const remaining = limitMinor - spentMinor;

  return (
    <li className="budget-row">
      <div className="budget-topline">
        <span>{category}</span>
        <span className={remaining < 0 ? "amount negative" : "amount"}>{formatMoney(remaining, "USD")} left</span>
      </div>
      <div className="progress-track" aria-label={`${category}: ${formatMoney(spentMinor, "USD")} of ${formatMoney(limitMinor, "USD")} used`}>
        <span className={percentage > 85 ? "progress-fill caution" : "progress-fill"} style={{ width: `${percentage}%` }} />
      </div>
      <div className="budget-caption">
        <span>{formatMoney(spentMinor, "USD")} spent</span>
        <span>{formatMoney(limitMinor, "USD")} plan</span>
      </div>
    </li>
  );
}

function App() {
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const displayedTransactions = showAllTransactions ? transactions : transactions.slice(0, 3);

  return (
    <main className="app-shell">
      <aside className="side-panel" aria-label="MoneyMind navigation">
        <div className="brand">MoneyMind<span aria-hidden="true">.</span></div>
        <nav>
          <a className="nav-item active" href="#overview" aria-current="page">Overview</a>
          <a className="nav-item" href="#transactions">Transactions</a>
          <a className="nav-item" href="#budgets">Budgets</a>
          <a className="nav-item" href="#insights">Insights</a>
          <a className="nav-item" href="#connections">Connections</a>
        </nav>
        <div className="side-note">
          <span className="note-label">Build status</span>
          <p>Secure financial connections are not enabled in this environment.</p>
        </div>
      </aside>

      <section className="workspace" id="overview">
        <header className="page-header">
          <div>
            <p className="page-kicker">August 2026 · USD</p>
            <h1>Your financial picture</h1>
          </div>
          <div className="profile-block" aria-label="Current workspace">
            <span className="avatar" aria-hidden="true">M</span>
            <span>Sample workspace</span>
          </div>
        </header>

        <div className="environment-notice" role="status">
          <strong>Illustrative data only.</strong> This workspace is a test-ready foundation. No personal account has been connected or saved.
        </div>

        <section className="balance-panel" aria-labelledby="balance-heading">
          <div>
            <p className="page-kicker">Available across connected accounts</p>
            <h2 id="balance-heading">{formatMoney(524_680, "USD")}</h2>
          </div>
          <dl className="balance-detail">
            <div>
              <dt>Monthly outflow</dt>
              <dd>{formatMoney(178_415, "USD")}</dd>
            </div>
            <div>
              <dt>Plan remaining</dt>
              <dd>{formatMoney(62_310, "USD")}</dd>
            </div>
          </dl>
        </section>

        <div className="content-grid">
          <section className="section-panel" id="insights" aria-labelledby="insights-heading">
            <div className="section-heading">
              <div>
                <p className="page-kicker">Observations to review</p>
                <h2 id="insights-heading">What changed</h2>
              </div>
              <span className="count-label">2 items</span>
            </div>
            <article className="insight">
              <span className="insight-index">01</span>
              <div>
                <h3>Dining is approaching this month’s plan.</h3>
                <p>You have used 78% of the amount set aside. Review the remaining transactions before changing the plan.</p>
                <span className="evidence-label">Evidence: posted Dining transactions in August</span>
              </div>
            </article>
            <article className="insight subdued">
              <span className="insight-index">02</span>
              <div>
                <h3>One transaction is waiting for a category review.</h3>
                <p>The next production iteration will let you approve or correct the suggested category before it informs insights.</p>
              </div>
            </article>
          </section>

          <section className="section-panel" id="budgets" aria-labelledby="budget-heading">
            <div className="section-heading">
              <div>
                <p className="page-kicker">Monthly plan</p>
                <h2 id="budget-heading">Budgets</h2>
              </div>
              <span className="count-label">August</span>
            </div>
            <ul className="budget-list">
              {budgets.map((budget) => <BudgetRow key={budget.category} {...budget} />)}
            </ul>
          </section>
        </div>

        <section className="section-panel transactions" id="transactions" aria-labelledby="transactions-heading">
          <div className="section-heading">
            <div>
              <p className="page-kicker">Latest activity</p>
              <h2 id="transactions-heading">Transactions to understand</h2>
            </div>
            <button className="text-button" type="button" aria-expanded={showAllTransactions} onClick={() => setShowAllTransactions((current) => !current)}>
              {showAllTransactions ? "Show fewer" : "Review all"}
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">Merchant</th><th scope="col">Category</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col">Amount</th></tr>
              </thead>
              <tbody>
                {displayedTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.merchant}</td>
                    <td>{transaction.category}</td>
                    <td>{transaction.occurredOn}</td>
                    <td><span className={transaction.status === "Needs review" ? "status review" : "status"}>{transaction.status}</span></td>
                    <td className="amount negative">{formatMoney(transaction.amountMinor, "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="roadmap-note" id="connections">
          <div>
            <p className="page-kicker">Next protected capability</p>
            <h2>Connect an institution only when you are ready.</h2>
          </div>
          <p>Account linking, merchant community contributions, and AI-generated insights will remain unavailable until their consent, data-access, and test requirements are complete.</p>
        </section>
      </section>
    </main>
  );
}

export default App;
