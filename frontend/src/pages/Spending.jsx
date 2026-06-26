import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  getTransactions, createTransaction, updateTransaction, deleteTransaction, getCategories,
} from "../api/client";
import { money, signed, currentMonth, monthLabel, colorFor, donutGradient } from "../lib/format";
import MonthBars from "../components/MonthBars";
import { emojiFor } from "../lib/categories";
import { lastSixMonths, monthlyTotals } from "../lib/aggregate";

// Payment methods stored lowercase in the transaction `source` column.
const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "paynow", label: "PayNow" },
  { value: "paylah", label: "PayLah" },
  { value: "card", label: "Card" },
  { value: "giro", label: "GIRO" },
];
const METHOD_LABELS = Object.fromEntries(METHODS.map((m) => [m.value, m.label]));
const methodLabel = (s) => METHOD_LABELS[s] || s;

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  item: "",
  amount: "",
  category: "",
  source: "cash",
};

export default function Spending() {
  const [month, setMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [catFilter, setCatFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [menuFor, setMenuFor] = useState(null);

  function load() {
    getTransactions(month).then(setTransactions).catch(() => setTransactions([]));
  }
  useEffect(() => { load(); }, [month]);
  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);

  const [allTx, setAllTx] = useState([]);
  useEffect(() => { getTransactions().then(setAllTx).catch(() => setAllTx([])); }, []);
  const sixMonthData = useMemo(
    () => monthlyTotals(allTx, lastSixMonths()),
    [allTx],
  );

  // Close the per-row action menu on any outside click.
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuFor]);

  const filtered = useMemo(() => (
    catFilter === "all"
      ? transactions
      : transactions.filter((t) => (t.category || "Uncategorized") === catFilter)
  ), [transactions, catFilter]);

  const totalSpend = filtered.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const totalIncome = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalSpend;
  const avg = filtered.length
    ? filtered.reduce((s, t) => s + Math.abs(t.amount), 0) / filtered.length
    : 0;

  // Spending-by-category breakdown (expenses only)
  const catRows = useMemo(() => {
    const by = {};
    filtered.filter((t) => t.amount < 0).forEach((t) => {
      const name = t.category || "Uncategorized";
      by[name] = (by[name] || 0) + (-t.amount);
    });
    const sorted = Object.entries(by).sort((a, b) => b[1] - a[1]);
    return sorted.map(([name, value], i) => ({ name, value, color: colorFor(i) }));
  }, [filtered]);

  // Group transactions by date (backend returns them date-desc)
  const groups = useMemo(() => {
    const order = [];
    const map = {};
    filtered.forEach((t) => {
      if (!map[t.date]) { map[t.date] = []; order.push(t.date); }
      map[t.date].push(t);
    });
    return order.map((date) => ({ date, items: map[date] }));
  }, [filtered]);

  function resetForm() {
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setAdding(false);
    setEditingId(null);
    setSubmitError("");
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
    setSubmitError("");
    setAdding(true);
  }

  function closeTransactionModal() {
    if (saving) return;
    resetForm();
  }

  function startEdit(t) {
    setForm({
      date: String(t.date || "").slice(0, 10),
      item: t.item || "",
      amount: t.amount == null ? "" : String(t.amount),
      category: t.category || "",
      source: t.source || "cash",
    });
    setEditingId(t.id);
    setSubmitError("");
    setAdding(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSubmitError("");
    try {
      const payload = {
        date: form.date,
        item: form.item,
        amount: Number(form.amount),
        category: form.category || null,
        source: form.source || null,
      };
      if (editingId !== null) {
        await updateTransaction(editingId, payload);
      } else {
        await createTransaction(payload);
      }
      resetForm();
      load();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setSubmitError(typeof detail === "string" ? detail : "Unable to save transaction. Check the API connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (window.confirm("Delete this transaction?")) {
      await deleteTransaction(id);
      load();
    }
  }

  function downloadCsv() {
    const head = ["date", "item", "category", "amount", "source"];
    const rows = filtered.map((t) =>
      [t.date, t.item, t.category || "", t.amount, t.source || ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([[head.join(","), ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spending-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Summary */}
      <div className="grid-4">
        <div className="stat">
          <div className="stat-label">Total Spending</div>
          <div className="stat-value neg">{money(totalSpend)}</div>
          <div className="stat-note">{monthLabel(month)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total Income</div>
          <div className="stat-value pos">{money(totalIncome)}</div>
          <div className="stat-note">{monthLabel(month)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Net Cash Flow</div>
          <div className="stat-value">{signed(net)}</div>
          <div className="stat-note">Income − spending</div>
        </div>
        <div className="stat accent">
          <div className="stat-label">Transactions</div>
          <div className="stat-value">{filtered.length}</div>
          <div className="stat-note">Avg {money(avg)} each</div>
        </div>
      </div>

      {/* 6-month overview */}
      <section className="card">
        <div className="card-head">
          <div className="card-title">Last 6 Months</div>
          <span className="pill" style={{ marginLeft: "auto" }}>Spending vs Income</span>
        </div>
        <MonthBars data={sixMonthData} />
      </section>

      {/* Toolbar */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <span className="field-label">Month</span>
            <input className="input" type="month" style={{ width: "auto" }} value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <span className="field-label">Category</span>
            <select className="select" style={{ width: "auto" }} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              <option value="Uncategorized">Uncategorized</option>
            </select>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={downloadCsv}>⤓ Download CSV</button>
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              + New transaction
            </button>
          </div>
        </div>
      </div>

      {adding && createPortal(
        <div className="modal-backdrop" role="presentation" onMouseDown={closeTransactionModal}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div id="transaction-modal-title" className="modal-title">
                  {editingId ? "Edit transaction" : "New transaction"}
                </div>
                <div className="modal-sub">
                  {editingId ? "Update the transaction details and save your changes." : "Enter the transaction details and save it."}
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={closeTransactionModal} disabled={saving}>
                x
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {submitError && <div className="form-error" role="alert">{submitError}</div>}
              <div className="form-grid modal-form-grid">
                <div className="field">
                  <label className="field-label">Date</label>
                  <input className="input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">Item</label>
                  <input className="input" type="text" required placeholder="Coffee, Salary..." value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">Amount</label>
                  <input className="input" type="number" step="0.01" required placeholder="-50 or +1000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">Category</label>
                  <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">None</option>
                    {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Method</label>
                  <select className="select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                    {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeTransactionModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save changes" : "Save transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Spending by category */}
      <section className="card">
        <div className="card-head"><div className="card-title">Spending by Category</div></div>
        {catRows.length === 0 ? (
          <div className="empty">No spending for this selection.</div>
        ) : (
          <div className="grid-cols">
            <table className="tbl">
              <thead>
                <tr><th>Category</th><th className="num">Spent</th><th className="num">Share</th></tr>
              </thead>
              <tbody>
                {catRows.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="legend-dot" style={{ width: 10, height: 10, background: c.color }} />
                        <b style={{ fontWeight: 600 }}>{c.name}</b>
                      </span>
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>{money(c.value)}</td>
                    <td className="num" style={{ color: "var(--muted)" }}>{Math.round((c.value / totalSpend) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="donut" style={{ width: 200, height: 200 }}>
                <div className="donut-ring" style={{ width: 200, height: 200, background: donutGradient(catRows) }} />
                <div className="donut-hole" style={{ inset: 38 }}>
                  <div style={{ fontSize: 12, color: "var(--muted-2)" }}>Total spending</div>
                  <div style={{ fontSize: 26, fontWeight: 800 }}>{money(totalSpend).replace(/\.\d+$/, "")}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Transactions by date */}
      <section className="card">
        <div className="card-head">
          <div className="card-title">Transactions by Date</div>
          <span className="pill" style={{ marginLeft: "auto" }}>{monthLabel(month)} · {catFilter === "all" ? "All categories" : catFilter}</span>
        </div>
        {groups.length === 0 ? (
          <div className="empty">No transactions. Add one with “+ New transaction”.</div>
        ) : (
          groups.map((g) => (
            <div key={g.date}>
              <div className="date-label">{g.date}</div>
              {g.items.map((t) => {
                const income = t.amount > 0;
                return (
                  <div className="row" key={t.id}>
                    <div className="row-ico" style={{ background: income ? "var(--green-soft)" : "var(--teal-soft)" }}>
                      {emojiFor(t.category)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="row-name">{t.item}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                        {t.category && <span className="chip">{t.category}</span>}
                        {t.source && <span className="row-sub">· {methodLabel(t.source)}</span>}
                      </div>
                    </div>
                    <div className="row-name" style={{ width: 110, textAlign: "right", color: income ? "var(--green)" : "var(--ink)" }}>
                      {signed(t.amount)}
                    </div>
                    <div className="dd" style={{ flex: "none" }}>
                      <button
                        className="btn btn-ghost btn-icon"
                        aria-label="Transaction actions"
                        onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === t.id ? null : t.id); }}
                      >
                        ⋯
                      </button>
                      {menuFor === t.id && (
                        <div className="dd-menu" style={{ top: 38, minWidth: 140 }}>
                          <div className="dd-item" onClick={(e) => { e.stopPropagation(); setMenuFor(null); startEdit(t); }}>✎ Edit</div>
                          <div className="dd-item" onClick={(e) => { e.stopPropagation(); setMenuFor(null); handleDelete(t.id); }}>✕ Delete</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </section>
    </>
  );
}
