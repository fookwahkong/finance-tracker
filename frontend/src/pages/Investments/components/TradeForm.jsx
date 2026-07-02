import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  createInvestTransaction, updateInvestTransaction, deleteInvestTransaction,
} from "../../../api/investments";

const EMPTY = { ticker: "", type: "BUY", quantity: "", price_per_share: "", purchase_date: "" };

export default function TradeForm({ open, editing, onClose, onSaved }) {
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(editing ? {
      ticker: editing.ticker,
      type: editing.type,
      quantity: String(editing.quantity),
      price_per_share: String(editing.price_per_share),
      purchase_date: editing.purchase_date,
    } : EMPTY);
  }, [open, editing]);

  if (!open) return null;

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    const payload = {
      ticker: draft.ticker.trim().toUpperCase(),
      type: draft.type,
      quantity: Number(draft.quantity),
      price_per_share: Number(draft.price_per_share),
      purchase_date: draft.purchase_date,
    };
    if (!payload.ticker || !(payload.quantity > 0) || !(payload.price_per_share > 0) || !payload.purchase_date) return;
    setSaving(true);
    try {
      if (editing) await updateInvestTransaction(editing.id, payload);
      else await createInvestTransaction(payload);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await deleteInvestTransaction(editing.id);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && onClose()}>
      <div className="modal-panel" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{editing ? "Edit trade" : "Add trade"}</div>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={onClose} disabled={saving}>x</button>
        </div>
        <form onSubmit={save}>
          <div className="modal-form-grid">
            <div className="field">
              <label className="field-label">Ticker</label>
              <input className="input" required autoFocus value={draft.ticker}
                onChange={(e) => setDraft((d) => ({ ...d, ticker: e.target.value.toUpperCase() }))} />
            </div>
            <div className="field">
              <label className="field-label">Type</label>
              <select className="input" value={draft.type} onChange={set("type")}>
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label">Quantity</label>
              <input className="input" type="number" step="any" min="0" required value={draft.quantity} onChange={set("quantity")} />
            </div>
            <div className="field">
              <label className="field-label">Price per share (USD)</label>
              <input className="input" type="number" step="0.01" min="0" required value={draft.price_per_share} onChange={set("price_per_share")} />
            </div>
            <div className="field">
              <label className="field-label">Date</label>
              <input className="input" type="date" required value={draft.purchase_date} onChange={set("purchase_date")} />
            </div>
          </div>
          <div className="modal-actions">
            {editing && (
              <button type="button" className="btn btn-ghost" style={{ marginRight: "auto", color: "var(--red)" }} onClick={remove} disabled={saving}>
                Delete
              </button>
            )}
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
