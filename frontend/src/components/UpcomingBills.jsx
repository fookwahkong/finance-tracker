import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  getSubscriptions, createSubscription, updateSubscription, deleteSubscription,
} from "../api/client";
import { CATEGORIES, emojiFor } from "../lib/categories";
import { money } from "../lib/format";

const SOURCES = [
  { value: "card", label: "Card" },
  { value: "giro", label: "GIRO" },
];

const EMPTY = { type: "bill", item: "", amount: "", day_of_month: "1", source: "card", category: "" };

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default function UpcomingBills() {
  const [subs, setSubs] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [menuFor, setMenuFor] = useState(null);

  function load() {
    getSubscriptions().then(setSubs).catch(() => setSubs([]));
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuFor]);

  const netMonthly = useMemo(() => subs.reduce(
    (s, x) => s + (x.type === "income" ? x.amount : -x.amount), 0,
  ), [subs]);

  function openNew() {
    setForm(EMPTY); setEditingId(null); setOpen(true);
  }
  function openEdit(s) {
    setForm({
      type: s.type, item: s.item, amount: String(s.amount),
      day_of_month: String(s.day_of_month), source: s.source, category: s.category,
    });
    setEditingId(s.id); setOpen(true);
  }
  function close() { if (!saving) { setOpen(false); setEditingId(null); } }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        item: form.item,
        amount: Number(form.amount),
        category: form.category,
        source: form.source,
        day_of_month: Number(form.day_of_month),
      };
      if (editingId) await updateSubscription(editingId, payload);
      else await createSubscription(payload);
      setOpen(false); setEditingId(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (window.confirm("Delete this subscription?")) {
      await deleteSubscription(id);
      load();
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Upcoming Bills</div>
          <div style={{ fontSize: 12, color: netMonthly >= 0 ? "var(--green)" : "var(--red)", marginTop: 2 }}>
            Net monthly {netMonthly >= 0 ? "+" : "−"}{money(netMonthly)}
          </div>
        </div>
        <button type="button" className="btn btn-outline btn-sm" style={{ marginLeft: "auto" }} onClick={openNew}>
          + New subscription
        </button>
      </div>

      {subs.length === 0 ? (
        <div className="empty">No subscriptions yet. Add one with “+ New subscription”.</div>
      ) : (
        subs.map((s) => {
          const isIncome = s.type === "income";
          return (
            <div className="row" key={s.id}>
              <div className="row-ico" style={{ background: isIncome ? "var(--green-soft)" : "var(--teal-soft)" }}>
                {emojiFor(s.category)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row-name">{s.item}</div>
                <div className="row-sub">Reloads on the {ordinal(s.day_of_month)} · {s.source.toUpperCase()}</div>
              </div>
              <div className="row-name" style={{ width: 100, textAlign: "right", color: isIncome ? "var(--green)" : "var(--ink)" }}>
                {isIncome ? "+" : "−"}{money(s.amount)}
              </div>
              <div className="dd" style={{ flex: "none" }}>
                <button
                  className="btn btn-ghost btn-icon"
                  aria-label="Subscription actions"
                  onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === s.id ? null : s.id); }}
                >
                  ⋯
                </button>
                {menuFor === s.id && (
                  <div className="dd-menu" style={{ top: 38, minWidth: 140 }}>
                    <div className="dd-item" onClick={(e) => { e.stopPropagation(); setMenuFor(null); openEdit(s); }}>✎ Edit</div>
                    <div className="dd-item" onClick={(e) => { e.stopPropagation(); setMenuFor(null); remove(s.id); }}>✕ Delete</div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {open && createPortal(
        <div className="modal-backdrop" role="presentation" onMouseDown={close}>
          <div className="modal-panel" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{editingId ? "Edit subscription" : "New subscription"}</div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={close} disabled={saving}>x</button>
            </div>
            <form onSubmit={submit}>
              <div className="form-grid modal-form-grid">
                <div className="field">
                  <label className="field-label">Type</label>
                  <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="bill">Bill</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Item</label>
                  <input className="input" required value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">Amount</label>
                  <input className="input" type="number" step="0.01" min="0" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">Day of month</label>
                  <input className="input" type="number" min="1" max="31" required value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">Source</label>
                  <select className="select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                    {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Category</label>
                  <select className="select" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="" disabled>Choose…</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={close} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editingId ? "Save changes" : "Add subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
