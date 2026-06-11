import { useEffect, useState } from "react";
import { getMonthlyReport, getTransactions } from "../api/client";
import SpendingChart from "../components/SpendingChart";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonth(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en", { month: "long", year: "numeric" });
}

function fmt(n) {
  return Math.abs(n).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Dashboard() {
  const month = currentMonth();
  const [report, setReport] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    getMonthlyReport(month).then(setReport).catch(() => {});
    getTransactions(month).then((txs) => setRecent(txs.slice(0, 6))).catch(() => {});
  }, [month]);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{formatMonth(month)}</p>
        </div>
      </div>

      {report ? (
        <>
          <div className="stat-grid">
            <div className="stat-card income">
              <div className="stat-label">Income</div>
              <div className="stat-value positive">+{fmt(report.total_income)}</div>
            </div>
            <div className="stat-card expense">
              <div className="stat-label">Expenses</div>
              <div className="stat-value negative">−{fmt(Math.abs(report.total_expenses))}</div>
            </div>
            <div className="stat-card net">
              <div className="stat-label">Net Balance</div>
              <div className={`stat-value ${report.net >= 0 ? "positive" : "negative"}`}>
                {report.net >= 0 ? "+" : "−"}{fmt(Math.abs(report.net))}
              </div>
            </div>
          </div>

          <div className="chart-grid">
            <div className="card">
              <p className="section-title">Spending by Category</p>
              <SpendingChart breakdown={report.breakdown} />
            </div>

            <div className="card">
              <p className="section-title">Recent Transactions</p>
              {recent.length === 0 ? (
                <div className="empty-state">No transactions this month.</div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <tbody>
                      {recent.map((tx) => (
                        <tr key={tx.id}>
                          <td style={{ color: "var(--text-3)", fontSize: "0.8rem", width: "90px" }}>{tx.date}</td>
                          <td style={{ fontWeight: 500 }}>{tx.item}</td>
                          <td>{tx.category && <span className="chip">{tx.category}</span>}</td>
                          <td style={{ textAlign: "right", paddingRight: 0 }}>
                            <span className={tx.amount < 0 ? "amount-neg" : "amount-pos"}>
                              {tx.amount > 0 ? "+" : "−"}{fmt(Math.abs(tx.amount))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
          <p style={{ color: "var(--text-3)", fontSize: "0.9rem" }}>No data for {formatMonth(month)} yet.</p>
          <p style={{ color: "var(--text-3)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
            Add transactions via the Telegram bot or the Transactions page.
          </p>
        </div>
      )}
    </div>
  );
}
