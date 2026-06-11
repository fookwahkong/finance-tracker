import { useEffect, useState } from "react";
import { getMonthlyReport } from "../api/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

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

const tooltipStyle = {
  contentStyle: {
    background: "#0D1428",
    border: "1px solid rgba(148,163,184,0.12)",
    borderRadius: "8px",
    color: "#F1F5F9",
    fontSize: "0.8125rem",
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
        Income:   value > 0 ? value : 0,
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
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Monthly Report</h1>
          <p className="page-subtitle">{formatMonth(month)}</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="form-input"
          style={{ width: "auto", marginLeft: "auto" }}
          aria-label="Select month"
        />
      </div>

      {report ? (
        <>
          <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
            <div className="stat-card income">
              <div className="stat-label">Total Income</div>
              <div className="stat-value positive">+{fmt(report.total_income)}</div>
            </div>
            <div className="stat-card expense">
              <div className="stat-label">Total Expenses</div>
              <div className="stat-value negative">−{fmt(Math.abs(report.total_expenses))}</div>
            </div>
            <div className="stat-card net">
              <div className="stat-label">Net / Savings</div>
              <div className={`stat-value ${report.net >= 0 ? "positive" : "negative"}`}>
                {report.net >= 0 ? "+" : "−"}{fmt(Math.abs(report.net))}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <p className="section-title">Summary</p>
            <p style={{ color: "var(--text-2)", fontSize: "0.9rem", lineHeight: 1.7 }}>
              In {formatMonth(month)}, you earned{" "}
              <span style={{ color: "var(--green)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                +{fmt(report.total_income)}
              </span>{" "}
              and spent{" "}
              <span style={{ color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                {fmt(Math.abs(report.total_expenses))}
              </span>.
              {topCategory && (
                <>
                  {" "}Largest spending category:{" "}
                  <span className="chip">{topCategory}</span>.
                </>
              )}
              {savingsRate !== null && (
                <>
                  {" "}Savings rate:{" "}
                  <span style={{ color: Number(savingsRate) >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                    {savingsRate}%
                  </span>.
                </>
              )}
            </p>
          </div>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <p className="section-title">Breakdown by Category</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--text-3)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text-3)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, ""]}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>{value}</span>
                  )}
                />
                <Bar dataKey="Income" fill="var(--green)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Expenses" fill="var(--red)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ borderStyle: "dashed" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
              <div>
                <p style={{ color: "var(--text-2)", fontSize: "0.875rem", fontWeight: 500 }}>AI Analysis</p>
                <p style={{ color: "var(--text-3)", fontSize: "0.8rem", marginTop: "0.125rem" }}>
                  Coming soon — personalized spending insights powered by GPT-4o.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
          <p style={{ color: "var(--text-3)", fontSize: "0.9rem" }}>No data for {formatMonth(month)}.</p>
        </div>
      )}
    </div>
  );
}
