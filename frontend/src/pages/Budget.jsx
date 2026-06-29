import { useEffect, useMemo, useState } from "react";
import { getBudgets, upsertBudget, getTransactions } from "../api/client";
import { CATEGORIES, emojiFor } from "../lib/categories";
import { money } from "../lib/format";
import { yearsInData, categoryYearStats, budgetStatus } from "../lib/aggregate";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATUS_META = {
  on: { label: "On track", cls: "status-on" },
  watch: { label: "Watch", cls: "status-watch" },
  over: { label: "Over", cls: "status-over" },
};

export default function Budget() {
  const [budgets, setBudgets] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingCat, setSavingCat] = useState(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    getBudgets()
      .then((rows) => setBudgets(Object.fromEntries(rows.map((b) => [b.category, b.amount]))))
      .catch(() => setBudgets({}));
  }, []);
  useEffect(() => {
    getTransactions().then(setTransactions).catch(() => setTransactions([]));
  }, []);

  const years = useMemo(() => yearsInData(transactions), [transactions]);

  const rows = useMemo(() => CATEGORIES.map((cat) => {
    const { months, average } = categoryYearStats(transactions, Number(year), cat);
    const budget = budgets[cat] || 0;
    return { cat, months, average, budget, status: budgetStatus(average, budget) };
  }), [transactions, year, budgets]);

  const counts = useMemo(
    () => rows.reduce((acc, r) => { acc[r.status] += 1; return acc; }, { on: 0, watch: 0, over: 0 }),
    [rows],
  );

  async function save(category) {
    const raw = drafts[category];
    const amount = Number(raw);
    if (raw === undefined || Number.isNaN(amount) || amount < 0) return;
    setSavingCat(category);
    try {
      await upsertBudget(category, amount);
      setBudgets((b) => ({ ...b, [category]: amount }));
      setDrafts((d) => { const next = { ...d }; delete next[category]; return next; });
    } finally {
      setSavingCat(null);
    }
  }

  return (
    <>
      <div className="grid-3">
        <div className="stat">
          <div className="stat-label">On track</div>
          <div className="stat-value pos">{counts.on}</div>
          <div className="stat-note">avg under 80% of budget</div>
        </div>
        <div className="stat">
          <div className="stat-label">Watch</div>
          <div className="stat-value" style={{ color: "var(--amber)" }}>{counts.watch}</div>
          <div className="stat-note">avg 80–100% of budget</div>
        </div>
        <div className="stat">
          <div className="stat-label">Over</div>
          <div className="stat-value neg">{counts.over}</div>
          <div className="stat-note">avg above budget</div>
        </div>
      </div>

      <div className="card" style={{ padding: "12px 20px", display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <span className="status-badge status-on">On track</span><span className="row-sub">avg &lt; 80% of budget</span>
        <span className="status-badge status-watch">Watch</span><span className="row-sub">avg 80–100% of budget</span>
        <span className="status-badge status-over">Over</span><span className="row-sub">avg &gt; budget</span>
      </div>

      <section className="card" >
        <div className="card-head">
          <div className="card-title">Budget by Category — {year}</div>
          <select
            className="select"
            style={{ width: "auto", marginLeft: 8 }}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </div>
        <div className="table-scroll">
          <table className="budget-tbl">
            <thead>
              <tr>
                <th>Category</th>
                {MONTH_ABBR.map((m) => <th key={m}>{m}</th>)}
                <th>Average</th>
                <th>Budget /mo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const draft = drafts[r.cat];
                const value = draft !== undefined ? draft : (r.budget ? String(r.budget) : "");
                const meta = STATUS_META[r.status];
                return (
                  <tr key={r.cat}>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{emojiFor(r.cat)} <b style={{ fontWeight: 600 }}>{r.cat}</b></span></td>
                    {r.months.map((amt, i) => (
                      <td key={i} className={r.budget > 0 && amt > r.budget ? "over-cell" : undefined}>
                        {amt ? money(amt).replace(/\.\d+$/, "") : "—"}
                      </td>
                    ))}
                    <td style={{ fontWeight: 700 }}>{r.average ? money(r.average).replace(/\.\d+$/, "") : "—"}</td>
                    <td>
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <input
                          className="input"
                          type="number"
                          step="1"
                          min="0"
                          placeholder="0"
                          style={{ width: 90 }}
                          value={value}
                          onChange={(e) => setDrafts((d) => ({ ...d, [r.cat]: e.target.value }))}
                        />
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => save(r.cat)} disabled={savingCat === r.cat || draft === undefined}>
                          {savingCat === r.cat ? "…" : "Save"}
                        </button>
                      </span>
                    </td>
                    <td><span className={`status-badge ${meta.cls}`}>{meta.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
