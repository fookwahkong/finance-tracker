import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { money } from "../../lib/format";
import { transactionsForGroup, groupTotals, daysOfTrip } from "../../lib/travel";

const EMPTY = { name: "", destination: "", start_date: "", end_date: "" };

// Create or edit a trip. The live preview under the date fields is the point:
// membership is derived from the range, so the user can see exactly what the
// dates will sweep in before committing to them.
export default function TripDialog({ group, transactions = [], saving, serverError, onClose, onSubmit }) {
  // Seeded once per mount. Travel keys this component on the trip being
  // edited, so switching trips remounts it rather than syncing in an effect.
  const [form, setForm] = useState(() => (group
    ? {
      name: group.name || "",
      destination: group.destination || "",
      start_date: group.start_date || "",
      end_date: group.end_date || "",
    }
    : EMPTY));

  const rangeReady = form.start_date && form.end_date && form.end_date >= form.start_date;

  const preview = useMemo(() => {
    if (!rangeReady) return null;
    const candidate = { start_date: form.start_date, end_date: form.end_date };
    // Preview the dates alone; overrides are managed from inside the trip.
    const matched = transactionsForGroup(transactions, candidate);
    return { ...groupTotals(matched), days: daysOfTrip(candidate).length };
  }, [rangeReady, form.start_date, form.end_date, transactions]);

  const invalidRange = form.start_date && form.end_date && form.end_date < form.start_date;

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      name: form.name.trim(),
      destination: form.destination.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date,
    });
  }

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && onClose()}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="trip-dialog-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div id="trip-dialog-title" className="modal-title">{group ? "Edit trip" : "New trip"}</div>
            <div className="modal-sub">
              Everything you spent between these dates lands in this trip automatically.
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={onClose} disabled={saving}>x</button>
        </div>

        <form onSubmit={handleSubmit}>
          {serverError && <div className="form-error" role="alert">{serverError}</div>}
          <div className="form-grid modal-form-grid">
            <div className="field">
              <label className="field-label" htmlFor="trip-name">Trip name</label>
              <input id="trip-name" className="input" type="text" required placeholder="Japan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="trip-destination">Destination</label>
              <input id="trip-destination" className="input" type="text" placeholder="Tokyo (optional)" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="trip-start">Start date</label>
              <input id="trip-start" className="input" type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="trip-end">End date</label>
              <input id="trip-end" className="input" type="date" required min={form.start_date || undefined} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>

          {invalidRange && (
            <div className="form-error" role="alert">The end date cannot be before the start date.</div>
          )}

          {preview && (
            <div className="trip-preview" role="status">
              <strong>{preview.count}</strong> {preview.count === 1 ? "transaction" : "transactions"} in this range
              {" · "}<strong>{money(preview.spend)}</strong> spent
              {" · "}{preview.days} {preview.days === 1 ? "day" : "days"}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || invalidRange}>
              {saving ? "Saving..." : group ? "Save changes" : "Create trip"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
