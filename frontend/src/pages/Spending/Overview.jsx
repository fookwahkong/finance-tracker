import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  createTransaction, updateTransaction, deleteTransaction,
} from "../../api/client";
import { createClaim, linkCredit, settleClaim, reopenClaim, deleteClaim, unlinkCredit } from "../../api/claims";
import { money, signed, currentMonth, monthLabel, colorFor, donutGradient } from "../../lib/format";
import { emojiFor } from "../../lib/categories";
import { yearsInData, applyAdjustmentsToMonth } from "../../lib/aggregate";
import { claimAdjustments, receivedTotal, remaining, variance } from "../../lib/claims";

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
  const [expandedClaims, setExpandedClaims] = useState({});

  const years = useMemo(() => yearsInData(transactions), [transactions]);

  // Transactions for the selected month (backend returns date-desc overall).
  const monthTx = useMemo(
    //slide the first 7 chars to get "2026-07"
    //keep pnly transaction whose date falls in the currently selected year/month
    () => transactions.filter((t) => String(t.date || "").slice(0, 7) === month),
    [transactions, month],
  );

  const linkedCreditIds = useMemo(
    // for each link object, pull out just its credit_tx_id
    () => new Set(claimLinks.map((l) => l.credit_tx_id)),
    [claimLinks]
  )

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
    const visible = filtered.filter((t) => !linkedCreditIds.has(t.id));  //filter the transaction that are nested
    visible.forEach((t) => {
      if (!map[t.date]) { map[t.date] = []; order.push(t.date); } //for bucketing the transaction into dates
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
  function toggleClaim(id) {
    setExpandedClaims((m) => ({ ...m, [id]: !m[id] }));
  }

  async function onSettle(claimId) {
    if (!window.confirm("Mark this claim as all accounted for?")) return;
    await settleClaim(claimId);
    reloadClaims?.();
  }

  async function onReopen(claimId) {
    await reopenClaim(claimId);
    reloadClaims?.();
  }

  async function onDelete(claimId) {
    if (!window.confirm("Mark this transaction as not shared? This deletes any linked credits to the claim.")) return;
    await deleteClaim(claimId);
    reloadClaims?.();
  }

  async function onUnlink(claimId, linkId) {
    await unlinkCredit(claimId, linkId);
    reloadClaims?.();
  }
  async function onDropCredit(e, claim) {
    const creditId = e.dataTransfer.getData("text/credit-id");
    if (!creditId) return;
    const credit = transactions.find((t) => t.id === creditId);
    if (!credit || credit.amount <= 0) return;
    const links = claim.links || [];
    const rem = remaining(claim.expected, links);
    const full = Math.abs(credit.amount);
    let allocated = full;
    if (full > rem) {
      const input = window.prompt(`This credit is ${money(full)} but only ${money(rem)} is still owed. Allocate how much?`, String(rem));
      if (input == null) return;
      allocated = Number(input);
      if (!(allocated > 0)) return;
    }
    try {
      await linkCredit(claim.id, { credit_tx_id: creditId, allocated_amount: allocated });
      reloadClaims?.();
    } catch (err) {
      window.alert(err?.response?.data?.detail || "Unable to link credit.");
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
          <section
            className="card"
            onDragOver={(e) => { if (e.dataTransfer.types.includes("text/link-id")) e.preventDefault(); }}
            onDrop={(e) => {
              if (!e.dataTransfer.types.includes("text/link-id")) return;
              if (e.target.closest(".claim-nest")) return;
              e.preventDefault();
              const linkId = e.dataTransfer.getData("text/link-id");
              const claimId = e.dataTransfer.getData("text/claim-id");
              if (!linkId || !claimId) return;
              if (!window.confirm("Unlink this credit from the claim?")) return;
              onUnlink(claimId, linkId);
            }}
          >
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
                    const claim = claimByDebit[t.id];
                    const displayAmount = claim ? t.amount + receivedTotal(claim.links || []) : t.amount;
                    const v = claim ? variance(receivedTotal(claim.links || []), claim.expected) : 0;
                    const settled = claim?.status === "settled";
                    return (
                      <div key={t.id}>
                        <div
                          className="row"
                          draggable={t.amount > 0}
                          onDragStart={t.amount > 0 ? (e) => { e.dataTransfer.setData("text/credit-id", t.id); } : undefined}
                        >
                          <div className="row-ico" style={{ background: income ? "var(--green-soft)" : "var(--teal-soft)" }}>
                            {emojiFor(t.category)}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="row-name">{t.item}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                              {t.category && <span className="chip">{t.category}</span>}
                              {t.source && <span className="row-sub">· {methodLabel(t.source)}</span>}
                              {v !== 0 && (
                                <span
                                  className="chip"
                                  style={
                                    settled
                                      ? { background: v > 0 ? "var(--green-soft)" : "var(--red-soft)", color: v > 0 ? "var(--green)" : "var(--red)" }
                                      : { background: "var(--amber-soft)", color: "var(--amber)" }
                                  }
                                >
                                  {settled ? (v > 0 ? "Gift" : "Shortfall") : (v > 0 ? "Over so far" : "Short so far")} {signed(v)}
                                </span>
                              )}
                              {v === 0 && claim && (
                                <span
                                  className="chip"
                                  style={
                                    settled
                                      ? { background: "var(--ink)", color: "#fff" }
                                      : { background: "var(--green)", color: "#fff" }
                                  }
                                >
                                  {settled ? "Closed" : "All accounted for"}
                                </span>
                              )}

                            </div>
                          </div>
                          <div className="row-name" style={{ width: 110, textAlign: "right", color: income ? "var(--green)" : "var(--ink)" }}>
                            {signed(displayAmount)}
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
                        {claimByDebit[t.id] && (() => {
                          const claim = claimByDebit[t.id];
                          const links = claim.links || [];
                          const txById = Object.fromEntries(transactions.map((x) => [x.id, x]));
                          return (
                            <div
                              className="claim-nest"
                              style={{ marginLeft: 52, marginBottom: 8 }}
                              onDragOver={!settled ? (e) => e.preventDefault() : undefined}
                              onDrop={!settled ? (e) => { e.preventDefault(); onDropCredit(e, claim); } : undefined}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <button type="button" className="btn btn-ghost btn-icon" onClick={() => toggleClaim(claim.id)} aria-label="Toggle linked credits">
                                  {expandedClaims[claim.id] ? "v" : ">"}
                                </button>
                                <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                                  {!settled && <button type="button" className="btn btn-outline" onClick={() => onSettle(claim.id)}>Close claim</button>}
                                  {settled && <button type="button" className="btn btn-ghost" onClick={() => onReopen(claim.id)}>Reopen</button>}
                                  {!settled && <button type="button" className="btn btn-outline" onClick={() => onDelete(claim.id)}>Delete</button>}
                                </span>
                              </div>
                              {expandedClaims[claim.id] && links.map((l) => {
                                const credit = txById[l.credit_tx_id];
                                return (
                                  <div
                                    className="row"
                                    key={l.id}
                                    style={{ paddingLeft: 12 }}
                                    draggable={!settled}
                                    onDragStart={!settled ? (e) => {
                                      e.dataTransfer.setData("text/link-id", l.id);
                                      e.dataTransfer.setData("text/claim-id", claim.id);
                                    } : undefined}
                                  >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div className="row-name">{credit ? credit.item : "Linked credit"}</div>
                                      <div className="row-sub">{credit ? credit.date : ""} - allocated {money(l.allocated_amount)}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
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
