import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { emojiFor } from "../../lib/categories";
import { money, signed } from "../../lib/format";
import { isWithinRange, overrideMap } from "../../lib/travel";

// How far before departure to look for bookings by default. Flights and
// hotels cluster in the couple of months before a trip; anything older is
// noise the user can still reach with the search box.
const LOOKBACK_DAYS = 60;

function shiftDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Pulls a transaction into a trip that the date range alone would miss, and
// clears overrides already in place. Both directions live in one dialog
// because they are the same question: what is really part of this trip?
export default function TransactionPicker({ group, transactions, saving, serverError, onClose, onInclude, onClear }) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const modes = useMemo(() => overrideMap(group.overrides), [group]);
  const lookbackStart = shiftDays(group.start_date, -LOOKBACK_DAYS);

  const candidates = useMemo(() => {
    const text = query.trim().toLowerCase();
    return transactions
      .filter((t) => {
        const date = String(t.date || "").slice(0, 10);
        if (isWithinRange(date, group)) return false; // already in by date
        if (modes[t.id] === "include") return false; // already pulled in
        if (!showAll && !text && date < lookbackStart) return false;
        if (text && !String(t.item || "").toLowerCase().includes(text)) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 50);
  }, [transactions, group, modes, query, showAll, lookbackStart]);

  const adjustments = useMemo(() => {
    const byId = Object.fromEntries(transactions.map((t) => [t.id, t]));
    return (group.overrides || [])
      .map((o) => ({ ...o, transaction: byId[o.transaction_id] }))
      .filter((o) => o.transaction);
  }, [group, transactions]);

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && onClose()}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="picker-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div id="picker-title" className="modal-title">Add to {group.name}</div>
            <div className="modal-sub">
              Flights and hotels paid before you left fall outside the trip's dates. Add them here.
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={onClose} disabled={saving}>x</button>
        </div>

        {serverError && <div className="form-error" role="alert">{serverError}</div>}

        <div className="field">
          <label className="field-label" htmlFor="picker-search">Search transactions</label>
          <input
            id="picker-search"
            className="input"
            type="search"
            placeholder="ANA flights, hotel..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="picker-hint">
          {query.trim()
            ? `Matching transactions outside ${group.start_date} – ${group.end_date}`
            : showAll
              ? "All transactions outside the trip's dates"
              : `Showing the ${LOOKBACK_DAYS} days before the trip`}
          {!query.trim() && (
            <button type="button" className="btn btn-ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show recent only" : "Show all"}
            </button>
          )}
        </div>

        <div className="picker-list">
          {candidates.length === 0 ? (
            <div className="empty">No transactions to add.</div>
          ) : candidates.map((t) => (
            <div className="row" key={t.id}>
              <div className="row-ico" style={{ background: "var(--teal-soft)" }}>{emojiFor(t.category)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row-name">{t.item}</div>
                <div className="row-sub">{String(t.date).slice(0, 10)}{t.category ? ` · ${t.category}` : ""}</div>
              </div>
              <div style={{ width: 100, textAlign: "right" }}>{signed(t.amount)}</div>
              <button type="button" className="btn btn-outline" disabled={saving} onClick={() => onInclude(t)}>
                Add
              </button>
            </div>
          ))}
        </div>

        {adjustments.length > 0 && (
          <>
            <div className="card-head" style={{ marginTop: 20, marginBottom: 8 }}>
              <div className="card-title" style={{ fontSize: 15 }}>Adjusted for this trip</div>
            </div>
            <div className="picker-list">
              {adjustments.map((o) => (
                <div className="row" key={o.transaction_id}>
                  <div className="row-ico" style={{ background: o.mode === "include" ? "var(--teal-soft)" : "var(--amber-soft)" }}>
                    {o.mode === "include" ? "+" : "⊘"}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row-name">{o.transaction.item}</div>
                    <div className="row-sub">
                      {String(o.transaction.date).slice(0, 10)} · {o.mode === "include" ? "Added to this trip" : "Removed from this trip"}
                    </div>
                  </div>
                  <div style={{ width: 100, textAlign: "right" }}>{money(o.transaction.amount)}</div>
                  <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => onClear(o.transaction_id)}>
                    Undo
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Done</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
