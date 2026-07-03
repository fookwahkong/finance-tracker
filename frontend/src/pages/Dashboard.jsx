import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { getMonthlyReport, getTransactions, getBudgets } from "../api/client";
import { money, signed, currentMonth, monthLabel, colorFor, donutGradient } from "../lib/format";
import { emojiFor } from "../lib/categories";
import { lastSixMonths, monthlyTotals } from "../lib/aggregate";
import UpcomingBills from "../components/UpcomingBills";
import NetWorthCard from "../components/NetWorthCard";
import { usePortfolioValue } from "./Investments/hooks/usePortfolioValue";
import { usePortfolioHistory } from "./Investments/hooks/usePortfolioHistory";

const shortMonth = (ym) => monthLabel(ym).split(" ")[0];

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
  const { valueUsd: portfolioValue, totals: portfolioTotalsData } = usePortfolioValue();
  const { series: portfolioHistory } = usePortfolioHistory(120);

  useEffect(() => {
    getMonthlyReport(month).then(setReport).catch(() => setReport(null));
    getTransactions(month).then((txs) => setRecent(txs.slice(0, 5))).catch(() => setRecent([]));
  }, [month]);

  useEffect(() => { getBudgets().then(setBudgets).catch(() => setBudgets([])); }, []);
  useEffect(() => { getTransactions().then(setAllTx).catch(() => setAllTx([])); }, []);

  const sixMonth = useMemo(() => monthlyTotals(allTx, lastSixMonths()), [allTx]);
  const cashFlowData = useMemo(
    () => sixMonth.map((d) => ({ ...d, label: shortMonth(d.month) })),
    [sixMonth]
  );
  const portfolioChartData = useMemo(
    () => portfolioHistory.map((d) => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: d.value,
    })),
    [portfolioHistory]
  );

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
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cashFlowData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => money(v).replace(/\.\d+$/, "")} width={64} />
              <Tooltip formatter={(v) => money(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="income" name="Income" stroke="var(--teal-3)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="spending" name="Spending" stroke="var(--teal)" strokeWidth={3.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
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

      {/* Investment (real) + Upcoming bills (demo) */}
      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <div className="card-title">Investment Performance</div>
          </div>
          {portfolioValue == null ? (
            <div className="empty">No holdings yet — add trades on the Investment page.</div>
          ) : (
            <>
              <Link to="/investment" style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "6px 0 14px", textDecoration: "none", color: "inherit" }}>
                <div style={{ fontSize: 30, fontWeight: 800 }}>{money(portfolioValue)}</div>
                {portfolioTotalsData?.complete && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: portfolioTotalsData.dayChange >= 0 ? "var(--green)" : "var(--red)" }}>
                    {portfolioTotalsData.dayChange >= 0 ? "↑" : "↓"} {Math.abs(portfolioTotalsData.dayChangePct).toFixed(2)}%
                    <span style={{ color: "var(--muted-2)", fontWeight: 500 }}> today</span>
                  </div>
                )}
              </Link>
              {portfolioChartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={portfolioChartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="invFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#138a86" stopOpacity="0.18" />
                        <stop offset="1" stopColor="#138a86" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={40} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }}
                      tickFormatter={(v) => money(v).replace(/\.\d+$/, "")} width={64} />
                    <Tooltip formatter={(v) => money(v)} />
                    <Area type="monotone" dataKey="value" stroke="var(--teal)" fill="url(#invFill)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty">Building portfolio history…</div>
              )}
            </>
          )}
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
