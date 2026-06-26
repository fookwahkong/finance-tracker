import { useEffect, useMemo, useState } from "react";
import { getBudgets, upsertBudget, getTransactions } from "../api/client";
import { CATEGORIES, emojiFor } from "../lib/categories";
import { money, currentMonth, monthLabel } from "../lib/format";

export default function Budget() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState({});      // { category: amount }
  const [transactions, setTransactions] = useState([]);
  const [drafts, setDrafts] = useState({});        // unsaved edits { category: string }
  const [savingCat, setSavingCat] = useState(null);

  useEffect(() => {
    getBudgets()
      .then((rows) => setBudgets(Object.fromEntries(rows.map((b) => [b.category, b.amount]))))
      .catch(() => setBudgets({}));
  }, []);

  useEffect(() => {
    getTransactions(month).then(setTransactions).catch(() => setTransactions([]));
  }, [month]);

  // Actual spend per category for the selected month (expenses only, positive).
  const spentByCat = useMemo(() => {
    const acc = {};
    transactions.filter((t) => t.amount < 0).forEach((t) => {
      const c = t.category || "Others";
      acc[c] = (acc[c] || 0) + -t.amount;
    });
    return acc;
  }, [transactions]);

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

  const totalBudget = CATEGORIES.reduce((s, c) => s + (budgets[c] || 0), 0);
  const totalSpent = CATEGORIES.reduce((s, c) => s + (spentByCat[c] || 0), 0);

  return (
    <>
      <div className="grid-4">
        <div className="stat">
          <div className="stat-label">Total Budget</div>
          <div className="stat-value">{money(totalBudget)}</div>
          <div className="stat-note">All categories</div>
        </div>
        <div className="stat">
          <div className="stat-label">Spent</div>
          <div className="stat-value neg">{money(totalSpent)}</div>
          <div className="stat-note">{monthLabel(month)}</div>
        </div>
        <div className="stat accent">
          <div className="stat-label">Remaining</div>
          <div className="stat-value">{money(Math.max(0, totalBudget - totalSpent))}</div>
          <div className="stat-note">Budget − spent</div>
        </div>
        <div className="stat">
          <div className="stat-label">Used</div>
          <div className="stat-value">{totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0}%</div>
          <div className="stat-note">of total budget</div>
        </div>
      </div>

      <div className="card" style={{ padding: "16px 20px" }}>
        <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <span className="field-label">Month</span>
          <input className="input" type="month" style={{ width: "auto" }} value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      <section className="card">
        <div className="card-head"><div className="card-title">Budget by Category</div></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {CATEGORIES.map((cat) => {
            const budget = budgets[cat] || 0;
            const spent = spentByCat[cat] || 0;
            const pct = budget ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            const over = budget > 0 && spent > budget;
            const draft = drafts[cat];
            const value = draft !== undefined ? draft : (budget ? String(budget) : "");
            return (
              <div key={cat}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span>{emojiFor(cat)}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{cat}</span>
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                      {money(spent)} / {money(budget)}
                    </span>
                    <input
                      className="input"
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      style={{ width: 100 }}
                      value={value}
                      onChange={(e) => setDrafts((d) => ({ ...d, [cat]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => save(cat)}
                      disabled={savingCat === cat || draft === undefined}
                    >
                      {savingCat === cat ? "…" : "Save"}
                    </button>
                  </span>
                </div>
                <div className="progress">
                  <span style={{ width: `${pct}%`, background: over ? "var(--red)" : "var(--teal)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
