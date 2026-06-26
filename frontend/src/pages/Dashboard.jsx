import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getMonthlyReport, getTransactions, getBudgets } from "../api/client";
import { money, signed, currentMonth, monthLabel, colorFor, donutGradient } from "../lib/format";
import { emojiFor } from "../lib/categories";
import { lastSixMonths, monthlyTotals } from "../lib/aggregate";
import UpcomingBills from "../components/UpcomingBills";
import NetWorthCard from "../components/NetWorthCard";

// Static sample data for widgets that have no backend yet.
const DEMO_GOALS = [
  { name: "Emergency Fund", icon: "🛟", saved: "$8,400", target: "$12,000", pct: 70 },
  { name: "Vacation 2026", icon: "✈️", saved: "$2,100", target: "$5,000", pct: 42 },
  { name: "New Car", icon: "🚗", saved: "$11,500", target: "$30,000", pct: 38 },
];

function Demo() {
  return <span className="demo-tag" title="Sample data — not yet wired to a backend">DEMO</span>;
}

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState([]);
  const [allTx, setAllTx] = useState([]);
  const [report, setReport] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    getMonthlyReport(month).then(setReport).catch(() => setReport(null));
    getTransactions(month).then((txs) => setRecent(txs.slice(0, 5))).catch(() => setRecent([]));
  }, [month]);

  useEffect(() => { getBudgets().then(setBudgets).catch(() => setBudgets([])); }, []);
  useEffect(() => { getTransactions().then(setAllTx).catch(() => setAllTx([])); }, []);

  const sixMonth = useMemo(() => monthlyTotals(allTx, lastSixMonths()), [allTx]);

  // Real budget status for the selected month.
  const spendByCatMonth = useMemo(() => {
    const acc = {};
    Object.entries(report?.breakdown || {}).forEach(([cat, v]) => {
      if (v < 0) acc[cat] = -v;
    });
    return acc;
  }, [report]);
  const budgetRows = budgets
    .map((b) => ({ category: b.category, amount: b.amount, spent: spendByCatMonth[b.category] || 0 }))
    .sort((a, b) => b.spent - a.spent);
  const totalBudget = budgetRows.reduce((s, b) => s + b.amount, 0);
  const totalBudgetSpent = budgetRows.reduce((s, b) => s + b.spent, 0);
  const budgetPct = totalBudget ? Math.round((totalBudgetSpent / totalBudget) * 100) : 0;

  const spendByCat = Object.entries(report?.breakdown || {})
    .filter(([, v]) => v < 0)
    .map(([name, v]) => ({ name, value: Math.abs(v) }))
    .sort((a, b) => b.value - a.value);
  const totalSpent = spendByCat.reduce((s, x) => s + x.value, 0);
  const segments = spendByCat.map((s, i) => ({ value: s.value, color: colorFor(i) }));

  return (
    <>
      {/* Net worth (real) + Net spending (real) */}
      <div className="grid-2">
        <NetWorthCard transactions={allTx} />

        <section className="card">
          <div className="card-head">
            <div className="card-sub">Net Spending</div>
            <input
              className="input"
              type="month"
              style={{ width: "auto", marginLeft: "auto" }}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          {totalSpent === 0 ? (
            <div className="empty">No spending recorded this month.</div>
          ) : (
            <div className="donut-wrap">
              <div className="donut" style={{ width: 138, height: 138 }}>
                <div className="donut-ring" style={{ width: 138, height: 138, background: donutGradient(segments) }} />
                <div className="donut-hole" style={{ inset: 24 }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{money(totalSpent).replace(/\.\d+$/, "")}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-2)" }}>spent</div>
                </div>
              </div>
              <div className="legend">
                {spendByCat.slice(0, 5).map((s, i) => (
                  <div className="legend-row" key={s.name}>
                    <span className="legend-dot" style={{ background: colorFor(i) }} />
                    {s.name} <b>{Math.round((s.value / totalSpent) * 100)}%</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Cash flow + Budget */}
      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <div className="card-title">Cash Flow Overview</div>
            <span className="pill" style={{ marginLeft: "auto" }}>Last 6 months</span>
          </div>
          {(() => {
            const max = Math.max(1, ...sixMonth.map((d) => Math.max(d.spending, d.income)));
            const pts = (key) => sixMonth.map((d, i) => {
              const x = 20 + (i * 580) / 5;
              const y = 180 - (d[key] / max) * 150;
              return `${x.toFixed(0)},${y.toFixed(0)}`;
            }).join(" ");
            return (
              <svg viewBox="0 0 620 200" style={{ width: "100%", height: 200 }}>
                <polyline points={pts("income")} fill="none" stroke="var(--teal-3)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={pts("spending")} fill="none" stroke="var(--teal)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            );
          })()}
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
            <span><span className="legend-dot" style={{ background: "var(--teal)" }} /> Spending</span>
            <span><span className="legend-dot" style={{ background: "var(--teal-3)" }} /> Income</span>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-title">Budget Status</div>
            <span className="pill" style={{ marginLeft: "auto" }}>{monthLabel(month)}</span>
          </div>
          {budgetRows.length === 0 ? (
            <div className="empty">No budgets set. Add them on the Budget page.</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "8px 0 12px" }}>
                <div style={{ fontSize: 34, fontWeight: 800 }}>{budgetPct}%</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>of {money(totalBudget)} budget used</div>
              </div>
              <div className="progress" style={{ marginBottom: 18 }}>
                <span style={{ width: `${Math.min(100, budgetPct)}%`, background: budgetPct > 100 ? "var(--red)" : "var(--teal)" }} />
              </div>
              {budgetRows.slice(0, 3).map((b) => {
                const pct = b.amount ? Math.min(100, Math.round((b.spent / b.amount) * 100)) : 0;
                const over = b.amount > 0 && b.spent > b.amount;
                return (
                  <div key={b.category} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", fontSize: 13, marginBottom: 6 }}>
                      <span>{emojiFor(b.category)} {b.category}</span>
                      <b style={{ marginLeft: "auto" }}>{pct}%</b>
                    </div>
                    <div className="progress sm"><span style={{ width: `${pct}%`, background: over ? "var(--red)" : "var(--teal-2)" }} /></div>
                  </div>
                );
              })}
            </>
          )}
        </section>
      </div>

      {/* Investment (demo) + Upcoming bills (demo) */}
      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <div className="card-title">Investment Performance <Demo /></div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "6px 0 14px" }}>
            <div style={{ fontSize: 30, fontWeight: 800 }}>$2,450</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>↑ 12% <span style={{ color: "var(--muted-2)", fontWeight: 500 }}>vs last week</span></div>
          </div>
          <svg viewBox="0 0 620 150" style={{ width: "100%", height: 150 }}>
            <defs><linearGradient id="invFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#138a86" stopOpacity="0.18" /><stop offset="1" stopColor="#138a86" stopOpacity="0" /></linearGradient></defs>
            <polygon points="24,110 100,95 176,100 252,70 328,84 404,76 480,58 556,66 596,40 596,130 24,130" fill="url(#invFill)" />
            <polyline points="24,110 100,95 176,100 252,70 328,84 404,76 480,58 556,66 596,40" fill="none" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </section>

        <UpcomingBills />
      </div>

      {/* Savings goals (demo) + Recent transactions (real) */}
      <div className="grid-2b">
        <section className="card">
          <div className="card-head">
            <div className="card-title">Savings Goals <Demo /></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {DEMO_GOALS.map((g) => (
              <div key={g.name}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                  <span>{g.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{g.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }}>{g.saved} / {g.target}</span>
                </div>
                <div className="progress"><span style={{ width: g.pct + "%" }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-title">Recent Transactions</div>
            <Link to="/spending" style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, textDecoration: "none", color: "var(--teal)" }}>View all →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="empty">No transactions this month.</div>
          ) : (
            recent.map((t, i) => {
              const income = t.amount > 0;
              return (
                <div className="row" key={t.id}>
                  <div className="row-ico" style={{ background: income ? "var(--green-soft)" : "var(--teal-soft)", color: "var(--ink)" }}>
                    {emojiFor(t.category)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="row-name">{t.item}</div>
                    <div className="row-sub">{t.category || "Uncategorized"}</div>
                  </div>
                  <div className="row-sub" style={{ marginLeft: "auto" }}>{t.date}</div>
                  <div className="row-name" style={{ width: 110, textAlign: "right", color: income ? "var(--green)" : "var(--ink)" }}>
                    {signed(t.amount)}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </>
  );
}
