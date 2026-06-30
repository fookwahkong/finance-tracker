import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  createTransaction, updateTransaction, deleteTransaction,
} from "../../api/client";
import { createClaim } from "../../api/claims";
import { money, signed, currentMonth, monthLabel, colorFor, donutGradient } from "../../lib/format";
import { emojiFor } from "../../lib/categories";
import { yearsInData, applyAdjustmentsToMonth } from "../../lib/aggregate";
import { claimAdjustments, remaining } from "../../lib/claims";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "paynow", label: "PayNow" },
  { value: "paylah", label: "PayLah" },
  { value: "card", label: "Card" },
  { value: "giro", label: "GIRO" },
];
const METHOD_LABELS = Object.fromEntries(METHODS.map((m) => [m.value, m.label]));
const methodLabel = (s) => METHOD_LABELS[s] || s;

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  item: "",
  amount: "",
  category: "",
  source: "cash",
};

export default function Overview({ transactions, categories, claims = [], claimLinks = [], onChanged, reloadClaims }) {
  const [year, setYear] = useState(currentMonth().slice(0, 4));
  const [monthNum, setMonthNum] = useState(currentMonth().slice(5, 7));
  const month = `${year}-${monthNum}`;

  const [catFilter, setCatFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [menuFor, setMenuFor] = useState(null);
  const [shareFor, setShareFor] = useState(null);
  const [shareForm, setShareForm] = useState({ my_share: "", counterparty: "" });
  const [shareError, setShareError] = useState("");
  const [sharing, setSharing] = useState(false);

  const years = useMemo(() => yearsInData(transactions), [transactions]);

  // Transactions for the selected month (backend returns date-desc overall).
  const monthTx = useMemo(
    () => transactions.filter((t) => String(t.date || "").slice(0, 7) === month),
    [transactions, month],
  );

  const claimByDebit = useMemo(() => {
    const map = {};
    for (const c of claims) map[c.debit_tx_id] = c;
    return map;
  }, [claims]);

  const adjustments = useMemo(
    () => claimAdjustments(transactions, claims, claimLinks),
    [transactions, claims, claimLinks],
  );

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuFor]);

  const filtered = useMemo(() => (
    catFilter === "all"
      ? monthTx
      : monthTx.filter((t) => (t.category || "Uncategorized") === catFilter)
  ), [monthTx, catFilter]);

  const rawSpend = filtered.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const rawIncome = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const monthAdj = applyAdjustmentsToMonth(month, null, adjustments);
  const totalSpend = catFilter === "all"
    ? rawSpend - monthAdj.spendingDelta
    : rawSpend - applyAdjustmentsToMonth(month, catFilter, adjustments).spendingDelta;
  const totalIncome = rawIncome - monthAdj.incomeDelta;
  const net = totalIncome - totalSpend;
  const avg = filtered.length
    ? filtered.reduce((s, t) => s + Math.abs(t.amount), 0) / filtered.length
    : 0;

  const catRows = useMemo(() => {
    const by = {};
    monthTx.filter((t) => t.amount < 0).forEach((t) => {
      const name = t.category || "Uncategorized";
      by[name] = (by[name] || 0) + (-t.amount);
    });
    for (const name of Object.keys(by)) {
      const { spendingDelta } = applyAdjustmentsToMonth(month, name, adjustments);
      by[name] = Math.max(0, by[name] - spendingDelta);
    }
    const sorted = Object.entries(by).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    return sorted.map(([name, value], i) => ({ name, value, color: colorFor(i) }));
  }, [monthTx, month, adjustments]);
  const breakdownSpend = catRows.reduce((s, c) => s + c.value, 0);

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
      onChanged();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setSubmitError(typeof detail === "string" ? detail : "Unable to save transaction. Check the API connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function openShareDialog(t) {
    setShareFor(t);
    setShareForm({ my_share: "", counterparty: "" });
    setShareError("");
  }

  async function submitShare(e) {
    e.preventDefault();
    setSharing(true);
    setShareError("");
    try {
      await createClaim({
        debit_tx_id: shareFor.id,
        my_share: Number(shareForm.my_share),
        counterparty: shareForm.counterparty || null,
      });
      setShareFor(null);
      reloadClaims?.();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setShareError(typeof detail === "string" ? detail : "Unable to mark as shared.");
    } finally {
      setSharing(false);
    }
  }
  async function handleDelete(id) {
    if (window.confirm("Delete this transaction?")) {
      await deleteTransaction(id);
      onChanged();
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
      {/* Month selector */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div className="month-btns">
          <select
            className="select"
            style={{ width: "auto", marginLeft: 8 }}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
          
          {MONTH_ABBR.map((m, i) => {
            const mm = String(i + 1).padStart(2, "0");
            return (
              <button
                key={mm}
                type="button"
                className={`month-btn${mm === monthNum ? " is-active" : ""}`}
                onClick={() => setMonthNum(mm)}
              >
                {m}
              </button>
            );
          })}
          
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
            <button type="button" className="btn btn-primary" onClick={openAdd}>+ New transaction</button>
          </div>
        </div>
      </div>

      {adding && createPortal(
        <div className="modal-backdrop" role="presentation" onMouseDown={closeTransactionModal}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div id="transaction-modal-title" className="modal-title">
                  {editingId ? "Edit transaction" : "New transaction"}
                </div>
                <div className="modal-sub">
                  {editingId ? "Update the transaction details and save your changes." : "Enter the transaction details and save it."}
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={closeTransactionModal} disabled={saving}>x</button>
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
                <button type="button" className="btn btn-outline" onClick={closeTransactionModal} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save changes" : "Save transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {shareFor && createPortal(
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !sharing && setShareFor(null)}>
          <div className="modal-panel" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title">Shared expense</div>
                <div className="modal-sub">Total paid {money(Math.abs(shareFor.amount))} - {shareFor.item}</div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={() => setShareFor(null)} disabled={sharing}>x</button>
            </div>
            <form onSubmit={submitShare}>
              {shareError && <div className="form-error" role="alert">{shareError}</div>}
              <div className="form-grid modal-form-grid">
                <div className="field">
                  <label className="field-label">My share</label>
                  <input className="input" type="number" step="0.01" min="0" required
                    placeholder="25" value={shareForm.my_share}
                    onChange={(e) => setShareForm({ ...shareForm, my_share: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">Owed back</label>
                  <input className="input" type="text" disabled
                    value={shareForm.my_share ? money(Math.abs(shareFor.amount) - Number(shareForm.my_share)) : ""} />
                </div>
                <div className="field">
                  <label className="field-label">Who owes you</label>
                  <input className="input" type="text" placeholder="Friend" value={shareForm.counterparty}
                    onChange={(e) => setShareForm({ ...shareForm, counterparty: e.target.value })} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShareFor(null)} disabled={sharing}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={sharing}>{sharing ? "Saving..." : "Mark as shared"}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {monthTx.length === 0 ? (
        <section className="card">
          <div className="empty">No transactions in this month.</div>
        </section>
      ) : (
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
                    {catRows.map((c) => {
                      const active = catFilter === c.name;
                      const toggle = () => setCatFilter(active ? "all" : c.name);
                      return (
                        <tr key={c.name} className={`cat-row${active ? " is-active" : ""}`} role="button" tabIndex={0} aria-pressed={active} onClick={toggle}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
                          <td>
                            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span className="legend-dot" style={{ width: 10, height: 10, background: c.color }} />
                              <b style={{ fontWeight: 600 }}>{c.name}</b>
                            </span>
                          </td>
                          <td className="num" style={{ fontWeight: 700 }}>{money(c.value)}</td>
                          <td className="num" style={{ color: "var(--muted)" }}>{breakdownSpend ? Math.round((c.value / breakdownSpend) * 100) : 0}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="donut" style={{ width: 200, height: 200 }}>
                    <div className="donut-ring" style={{ width: 200, height: 200, background: donutGradient(catRows) }} />
                    <div className="donut-hole" style={{ inset: 38 }}>
                      <div style={{ fontSize: 12, color: "var(--muted-2)" }}>Total spending</div>
                      <div style={{ fontSize: 26, fontWeight: 800 }}>{money(breakdownSpend).replace(/\.\d+$/, "")}</div>
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
                            {claimByDebit[t.id]?.status === "open" && (
                              <span className="chip" style={{ background: "var(--amber-soft, #fef3c7)" }}>
                                Shared {money(remaining(claimByDebit[t.id].expected, claimByDebit[t.id].links || []))} pending
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="row-name" style={{ width: 110, textAlign: "right", color: income ? "var(--green)" : "var(--ink)" }}>
                          {signed(t.amount)}
                        </div>
                        <div className="dd" style={{ flex: "none" }}>
                          <button className="btn btn-ghost btn-icon" aria-label="Transaction actions" onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === t.id ? null : t.id); }}>⋯</button>
                          {menuFor === t.id && (
                            <div className="dd-menu" style={{ top: 38, minWidth: 140 }}>
                              <div className="dd-item" onClick={(e) => { e.stopPropagation(); setMenuFor(null); startEdit(t); }}>✎ Edit</div>
                              {t.amount < 0 && !claimByDebit[t.id] && (
                                <div className="dd-item" onClick={(e) => { e.stopPropagation(); setMenuFor(null); openShareDialog(t); }}>Mark as shared</div>
                              )}
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
      )}
    </>
  );
}
