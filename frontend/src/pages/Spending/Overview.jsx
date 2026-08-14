import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  createTransaction, updateTransaction, deleteTransaction, getFxRate,
} from "../../api/client";
import { createClaim, linkCredit, settleClaim, reopenClaim, deleteClaim } from "../../api/claims";
import { money, signed, sgd, currentMonth, monthLabel, colorFor, donutGradient } from "../../lib/format";
import { emojiFor } from "../../lib/categories";
import { yearsInData } from "../../lib/aggregate";
import { applyClaimAdjustments, receivedTotal, variance, allocatedByCredit, claimCreatePayload, linksForClaims, participantBalance, participantsForClaim } from "../../lib/claims";
import ClaimSplitDialog from "./ClaimSplitDialog";
import ClaimRepaymentDialog from "./ClaimRepaymentDialog";
import { dragPreviewPosition, useClaimDrag } from "../../hooks/useClaimDrag";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "paynow", label: "PayNow" },
  { value: "paylah", label: "PayLah" },
  { value: "card", label: "Card" },
  { value: "giro", label: "GIRO" },
];
const METHOD_LABELS = Object.fromEntries(METHODS.map((m) => [m.value, m.label]));
const methodLabel = (s) => METHOD_LABELS[s] || s;

const CURRENCIES = [
  { value: "SGD", label: "SGD" },
  { value: "CNY", label: "CNY (¥)" },
];

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  item: "",
  amount: "",
  category: "",
  source: "cash",
  currency: "SGD",
};

export default function Overview({ transactions, categories, claims = [], claimLinks = [], onChanged, reloadClaims }) {
  const [year, setYear] = useState(currentMonth().slice(0, 4));
  const [monthNum, setMonthNum] = useState(currentMonth().slice(5, 7));
  const month = `${year}-${monthNum}`;

  const [catFilter, setCatFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const [cnySgdRate, setCnySgdRate] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [menuFor, setMenuFor] = useState(null);
  const [shareFor, setShareFor] = useState(null);
  const [shareError, setShareError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [expandedClaims, setExpandedClaims] = useState({});
  const [repayment, setRepayment] = useState(null);
  const [repaymentSaving, setRepaymentSaving] = useState(false);
  const [repaymentError, setRepaymentError] = useState("");
  const [dropTargetId, setDropTargetId] = useState(null);
  const [showAllOut, setShowAllOut] = useState(false);
  const [showAllIn, setShowAllIn] = useState(false);
  const { dragPreview, startDrag, moveDrag, endDrag } = useClaimDrag();

  // Live rate for the grey SGD preview under a CNY amount in the form —
  // fetched once, the first time the currency is switched to CNY.
  useEffect(() => {
    if (form.currency !== "CNY" || cnySgdRate != null) return;
    getFxRate("CNY", "SGD").then((fx) => setCnySgdRate(fx.rate)).catch(() => {});
  }, [form.currency, cnySgdRate]);

  const years = useMemo(() => yearsInData(transactions), [transactions]);

  // Transactions for the selected month (backend returns date-desc overall).
  const monthTx = useMemo(
    //slide the first 7 chars to get "2026-07"
    //keep pnly transaction whose date falls in the currently selected year/month
    () => transactions.filter((t) => String(t.date || "").slice(0, 7) === month),
    [transactions, month],
  );

  const creditAllocations = useMemo(
    () => allocatedByCredit(claimLinks),
    [claimLinks]
  )

  const availableCredits = useMemo(() => transactions
    .filter((transaction) => Number(transaction.amount) > 0)
    .map((transaction) => ({
      ...transaction,
      available: Math.round((Number(transaction.amount) - (creditAllocations[transaction.id] || 0)) * 100) / 100,
    }))
    .filter((transaction) => transaction.available > 0), [transactions, creditAllocations]);

  const claimByDebit = useMemo(() => {
    const map = {};
    for (const c of claims) map[c.debit_tx_id] = c;
    return map;
  }, [claims]);

  // The claim-adjusted transaction list is the source of truth for every
  // spend/income total on this page (and Month vs Month / Insights) — a
  // claimed debit's magnitude already reflects what's been reimbursed, and
  // a claimed credit's magnitude already reflects what's not real income.
  const adjustedTransactions = useMemo(
    () => applyClaimAdjustments(transactions, claims, claimLinks),
    [transactions, claims, claimLinks],
  );
  const adjustedMonthTx = useMemo(
    () => adjustedTransactions.filter((t) => String(t.date || "").slice(0, 7) === month),
    [adjustedTransactions, month],
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

  const catRows = useMemo(() => {
    // Money Out and Money In are computed independently per category, from
    // claim-adjusted amounts — never netted against each other. A category
    // with both spend and income shows as two separate, honest rows (e.g.
    // -15 spend and +100 +100 income in the same category shows "−$15" in
    // Money Out and "+$200" in Money In, not one masked "+$185").
    const spend = {};
    const income = {};
    adjustedMonthTx.forEach((t) => {
      const name = t.category || "Uncategorized";
      if (t.amount < 0) spend[name] = (spend[name] || 0) + (-t.amount);
      else if (t.amount > 0) income[name] = (income[name] || 0) + Number(t.amount);
    });
    const build = (map, sign) => Object.entries(map)
      .filter(([, magnitude]) => magnitude > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, magnitude], i) => ({ name, value: sign * magnitude, color: colorFor(i) }));
    return { moneyOut: build(spend, -1), moneyIn: build(income, 1) };
  }, [adjustedMonthTx]);
  // The donut/Share % read directly from the Money Out rows above — there is
  // no separate "gross spend" total to disagree with them.
  const breakdownSpend = catRows.moneyOut.reduce((s, c) => s - c.value, 0);
  const totalMoneyIn = catRows.moneyIn.reduce((s, c) => s + c.value, 0);

  const groups = useMemo(() => {
    const order = [];
    const map = {};
    const visible = filtered.filter((t) => {
      if (t.amount <= 0) return true;
      const allocated = creditAllocations[t.id] || 0;
      return t.amount - allocated > 0.005; // hide only once fully claimed
    });
    visible.forEach((t) => {
      if (!map[t.date]) { map[t.date] = []; order.push(t.date); } //for bucketing the transaction into dates
      map[t.date].push(t);
    });
    return order.map((date) => ({ date, items: map[date] }));
  }, [filtered, creditAllocations]);

  function renderCatRow(c, shareLabel) {
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
        <td className={`num ${c.value < 0 ? "neg" : "pos"}`} style={{ fontWeight: 700 }}>{signed(c.value)}</td>
        <td className="num" style={{ color: "var(--muted)" }}>{shareLabel}</td>
      </tr>
    );
  }

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
    const currency = t.currency || "SGD";
    const rawAmount = currency === "CNY" ? t.foreign_amount : t.amount;
    setForm({
      date: String(t.date || "").slice(0, 10),
      item: t.item || "",
      amount: rawAmount == null ? "" : String(rawAmount),
      category: t.category || "",
      source: t.source || "cash",
      currency,
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
        category: form.category || null,
        source: form.source || null,
        currency: form.currency,
        ...(form.currency === "CNY"
          ? { foreign_amount: Number(form.amount) }
          : { amount: Number(form.amount) }),
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
    setShareError("");
  }

  async function submitShare(split) {
    setSharing(true);
    setShareError("");
    try {
      await createClaim(claimCreatePayload(shareFor.id, split));
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

  function openRepayment(claim, participant, creditId) {
    if (!availableCredits.some((credit) => credit.id === creditId)) return;
    setRepayment({ claim, participant, creditId });
    setRepaymentError("");
  }

  function openRepaymentPicker(claim, people, debitDate) {
    if (people.length === 0) return;
    setRepayment({ claim, participant: people[0], participants: people, claimMonth: String(debitDate || "").slice(0, 7) });
    setRepaymentError("");
  }

  function dropOnParticipant(event, claim, participant) {
    event.preventDefault();
    const creditId = event.dataTransfer.getData("text/credit-id");
    setDropTargetId(null);
    endDrag();
    openRepayment(claim, participant, creditId);
  }

  async function submitRepayment(data) {
    if (!repayment) return;
    setRepaymentSaving(true);
    setRepaymentError("");
    try {
      const { participant_id, ...payload } = data;
      await linkCredit(repayment.claim.id, participant_id, payload);
      setRepayment(null);
      reloadClaims?.();
      onChanged?.();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setRepaymentError(typeof detail === "string" ? detail : "Unable to assign this repayment.");
    } finally {
      setRepaymentSaving(false);
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
                  {form.currency === "CNY" && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                      {form.amount && cnySgdRate != null
                        ? `≈ ${sgd(Number(form.amount) * cnySgdRate)}`
                        : "Fetching SGD rate…"}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label className="field-label">Currency</label>
                  <select className="select" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
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
          <ClaimSplitDialog
            transaction={shareFor}
            saving={sharing}
            serverError={shareError}
            onClose={() => setShareFor(null)}
            onSubmit={submitShare}
          />
        </div>,
        document.body
      )}
      {monthTx.length === 0 ? (
        <section className="card">
          <div className="empty">No transactions in this month.</div>
        </section>
      ) : (
        <>
          {/* Money out */}
          <section className="card">
            <div className="card-head"><div className="card-title">Money out</div></div>
            {catRows.moneyOut.length === 0 ? (
              <div className="empty">No spending for this selection.</div>
            ) : (
              <div className="grid-cols">
                <div>
                  <table className="tbl">
                    <thead>
                      <tr><th>Category</th><th className="num">Amount</th><th className="num">Share</th></tr>
                    </thead>
                    <tbody>
                      {(showAllOut ? catRows.moneyOut : catRows.moneyOut.slice(0, 4)).map((c) => renderCatRow(
                        c,
                        `${Math.round((-c.value / breakdownSpend) * 100)}%`,
                      ))}
                    </tbody>
                  </table>
                  {catRows.moneyOut.length > 4 && (
                    <button type="button" className="btn btn-ghost" onClick={() => setShowAllOut((v) => !v)}>
                      {showAllOut ? "Show less" : `Show ${catRows.moneyOut.length - 4} more`}
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="donut" style={{ width: 200, height: 200 }}>
                    <div className="donut-ring" style={{ width: 200, height: 200, background: donutGradient(catRows.moneyOut.map((c) => ({ value: -c.value, color: c.color }))) }} />
                    <div className="donut-hole" style={{ inset: 38 }}>
                      <div style={{ fontSize: 12, color: "var(--muted-2)" }}>Total spending</div>
                      <div style={{ fontSize: 26, fontWeight: 800 }}>{money(breakdownSpend).replace(/\.\d+$/, "")}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Money in */}
          <section className="card">
            <div className="card-head"><div className="card-title">Money in</div></div>
            {catRows.moneyIn.length === 0 ? (
              <div className="empty">No income for this selection.</div>
            ) : (
              <>
                <table className="tbl">
                  <thead>
                    <tr><th>Category</th><th className="num">Amount</th><th className="num">Share</th></tr>
                  </thead>
                  <tbody>
                    {(showAllIn ? catRows.moneyIn : catRows.moneyIn.slice(0, 4)).map((c) => renderCatRow(
                      c,
                      `${Math.round((c.value / totalMoneyIn) * 100)}%`,
                    ))}
                  </tbody>
                </table>
                {catRows.moneyIn.length > 4 && (
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAllIn((v) => !v)}>
                    {showAllIn ? "Show less" : `Show ${catRows.moneyIn.length - 4} more`}
                  </button>
                )}
              </>
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
                    const claim = claimByDebit[t.id];
                    const claimLinks = claim ? linksForClaims([claim]) : [];
                    const creditAllocated = income ? (creditAllocations[t.id] || 0) : 0;
                    const displayAmount = claim ? t.amount + receivedTotal(claimLinks) : t.amount - creditAllocated;
                    const v = claim ? variance(receivedTotal(claimLinks), claim.expected) : 0;
                    const settled = claim?.status === "settled";
                    return (
                      <div key={t.id}>
                        <div
                          className="row"
                          draggable={income && creditAllocated < t.amount}
                          onDragStart={income && creditAllocated < t.amount ? (event) => startDrag(event, {
                            ...t,
                            available: Math.round((t.amount - creditAllocated) * 100) / 100,
                          }) : undefined}
                          onDrag={income ? moveDrag : undefined}
                          onDragEnd={income ? () => {
                            setDropTargetId(null);
                            endDrag();
                          } : undefined}
                        >
                          <div className="row-ico" style={{ background: income ? "var(--green-soft)" : "var(--teal-soft)" }}>
                            {emojiFor(t.category)}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="row-name">{t.item}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                              {t.category && <span className="chip">{t.category}</span>}
                              {t.source && <span className="row-sub">· {methodLabel(t.source)}</span>}
                              {creditAllocated > 0 && (
                                <span className="chip" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
                                  {money(creditAllocated)} claimed
                                </span>
                              )}
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
                          <div style={{ width: 110, textAlign: "right" }}>
                            <div className="row-name" style={{ color: income ? "var(--green)" : "var(--ink)" }}>
                              {t.currency === "CNY" ? signed(t.foreign_amount, "¥") : signed(displayAmount)}
                            </div>
                            {t.currency === "CNY" && (
                              <div style={{ fontSize: 11, color: "var(--muted)" }}>{sgd(displayAmount)}</div>
                            )}
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
                          const people = participantsForClaim(claim).filter((participant) => !participant.isOwner);
                          return (
                            <div className="claim-nest" style={{ marginLeft: 52, marginBottom: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <button type="button" className="btn btn-ghost btn-icon" onClick={() => toggleClaim(claim.id)} aria-label="Toggle linked credits">
                                  {expandedClaims[claim.id] ? "v" : ">"}
                                </button>
                                {!settled && <span className="row-sub">Drag a repayment onto the person who paid you.</span>}
                                <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                                  {!settled && <button type="button" className="btn btn-outline" onClick={() => onSettle(claim.id)}>Close claim</button>}
                                  {settled && <button type="button" className="btn btn-ghost" onClick={() => onReopen(claim.id)}>Reopen</button>}
                                  {!settled && <button type="button" className="btn btn-outline" onClick={() => openRepaymentPicker(claim, people, t.date)}>Choose repayment</button>}
                                  {!settled && <button type="button" className="btn btn-outline" onClick={() => onDelete(claim.id)}>Delete</button>}
                                </span>
                              </div>
                              {expandedClaims[claim.id] && people.map((participant) => {
                                const balance = participantBalance(participant);
                                const participantTargetId = `${claim.id}:${participant.id}`;
                                return (
                                  <article
                                    className={`claim-person claim-person-in-overview${dropTargetId === participantTargetId ? " is-drag-target" : ""}`}
                                    aria-label={`${participant.name} repayment`}
                                    key={participant.id}
                                    onDragOver={!settled ? (event) => event.preventDefault() : undefined}
                                    onDragEnter={!settled ? (event) => {
                                      event.preventDefault();
                                      if (dragPreview) setDropTargetId(participantTargetId);
                                    } : undefined}
                                    onDragLeave={!settled ? (event) => {
                                      if (!event.currentTarget.contains(event.relatedTarget)) setDropTargetId(null);
                                    } : undefined}
                                    onDrop={!settled ? (event) => dropOnParticipant(event, claim, participant) : undefined}
                                  >
                                    <div className="claim-person-head">
                                      <div className="split-avatar" aria-hidden="true">{participant.name.slice(0, 1).toUpperCase()}</div>
                                      <div>
                                        <h3>{participant.name}</h3>
                                        <span>{Number(participant.sharePercent || 0).toFixed(2)}% of this expense</span>
                                      </div>
                                    </div>
                                    <div className="claim-person-progress" role="progressbar" aria-label={`${participant.name} repayment progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(balance.progress * 100)}>
                                      <span style={{ width: `${balance.progress * 100}%` }} />
                                    </div>
                                    <div className="claim-person-metrics">
                                      <div><span>Owed</span><strong>{money(balance.owed)}</strong></div>
                                      <div><span>Received</span><strong>{money(balance.received)}</strong></div>
                                      {balance.overpaid > 0
                                        ? <div className="is-overpaid"><span>Overpaid</span><strong>{money(balance.overpaid)}</strong></div>
                                        : <div><span>Remaining</span><strong>{money(balance.remaining)}</strong></div>}
                                    </div>
                                  </article>
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
          {dragPreview && createPortal(
            <div
              className="claim-drag-preview"
              data-testid="claim-drag-preview"
              aria-hidden="true"
              style={dragPreviewPosition(
                dragPreview.x,
                dragPreview.y,
                window.innerWidth,
                window.innerHeight,
              )}
            >
              <span>Repayment</span>
              <strong>{dragPreview.credit.item}</strong>
              <small>{dragPreview.credit.date || "Credit transaction"}</small>
              <b>{money(dragPreview.credit.available)}</b>
            </div>,
            document.body,
          )}
          {repayment && (
            <ClaimRepaymentDialog
              credits={availableCredits}
              initialCreditId={repayment.creditId}
              participant={repayment.participant}
              participants={repayment.participants}
              claimMonth={repayment.claimMonth}
              years={years}
              saving={repaymentSaving}
              serverError={repaymentError}
              onClose={() => !repaymentSaving && setRepayment(null)}
              onSubmit={submitRepayment}
            />
          )}
        </>
      )}
    </>
  );
}
