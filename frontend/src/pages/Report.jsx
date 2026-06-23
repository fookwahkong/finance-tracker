import { useEffect, useState } from "react";
import { getMonthlyReport } from "../api/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { money, signed, currentMonth, monthLabel } from "../lib/format";

const tooltipStyle = {
  contentStyle: {
    background: "#fff",
    border: "1px solid #e6eaea",
    borderRadius: "10px",
    color: "#16302f",
    fontSize: "0.8125rem",
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  },
};

export default function Report() {
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState(null);

  useEffect(() => {
    getMonthlyReport(month).then(setReport).catch(() => setReport(null));
  }, [month]);

  const chartData = report
    ? Object.entries(report.breakdown).map(([name, value]) => ({
        name,
        Income: value > 0 ? value : 0,
        Expenses: value < 0 ? Math.abs(value) : 0,
      }))
    : [];

  const topCategory = report && chartData.length > 0
    ? chartData.reduce((a, b) => (b.Expenses > a.Expenses ? b : a)).name
    : null;

  const savingsRate = report && report.total_income > 0
    ? ((report.net / report.total_income) * 100).toFixed(1)
    : null;

  return (
    <>
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="card-title">Monthly Report</div>
            <div className="row-sub">{monthLabel(month)}</div>
          </div>
          <input
            className="input"
            type="month"
            style={{ width: "auto", marginLeft: "auto" }}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Select month"
          />
        </div>
      </div>

      {report ? (
        <>
          <div className="grid-4">
            <div className="stat">
              <div className="stat-label">Total Income</div>
              <div className="stat-value pos">{money(report.total_income)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Total Expenses</div>
              <div className="stat-value neg">{money(report.total_expenses)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Net / Savings</div>
              <div className={`stat-value ${report.net >= 0 ? "pos" : "neg"}`}>{signed(report.net)}</div>
            </div>
            <div className="stat accent">
              <div className="stat-label">Savings Rate</div>
              <div className="stat-value">{savingsRate !== null ? `${savingsRate}%` : "—"}</div>
            </div>
          </div>

          <section className="card">
            <div className="card-head"><div className="card-title">Summary</div></div>
            <p style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.7 }}>
              In {monthLabel(month)}, you earned{" "}
              <b style={{ color: "var(--green)" }}>{money(report.total_income)}</b> and spent{" "}
              <b style={{ color: "var(--red)" }}>{money(report.total_expenses)}</b>.
              {topCategory && <> Largest spending category: <span className="chip">{topCategory}</span>.</>}
              {savingsRate !== null && (
                <> Savings rate:{" "}
                  <b style={{ color: Number(savingsRate) >= 0 ? "var(--green)" : "var(--red)" }}>{savingsRate}%</b>.
                </>
              )}
            </p>
          </section>

          <section className="card">
            <div className="card-head"><div className="card-title">Breakdown by Category</div></div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f1" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#708584", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#708584", fontSize: 12 }} axisLine={false} tickLine={false} width={55} tickFormatter={(v) => `$${v}`} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`$${Number(v).toFixed(2)}`, ""]} cursor={{ fill: "rgba(19,138,134,0.06)" }} />
                <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ color: "#566664", fontSize: "0.8rem" }}>{value}</span>} />
                <Bar dataKey="Income" fill="#138a4a" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Expenses" fill="#e0533d" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="card" style={{ borderStyle: "dashed" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="row-ico" style={{ background: "var(--teal-soft)", color: "var(--teal)" }}>✦</div>
              <div>
                <div className="row-name">AI Analysis <span className="demo-tag">SOON</span></div>
                <div className="row-sub">Personalized spending insights, coming soon.</div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="card"><div className="empty">No data for {monthLabel(month)}.</div></div>
      )}
    </>
  );
}
