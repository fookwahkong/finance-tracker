import { money } from "../../lib/format";
import { daysOfTrip, groupTotals, transactionsForGroup } from "../../lib/travel";

// Short "18–26 Aug 2026" / "28 Aug – 3 Sep 2026" range label.
export function rangeLabel(group) {
  const start = new Date(`${group.start_date}T00:00:00Z`);
  const end = new Date(`${group.end_date}T00:00:00Z`);
  const opts = { timeZone: "UTC", day: "numeric", month: "short" };
  const startText = start.toLocaleDateString("en-GB", opts);
  const endText = end.toLocaleDateString("en-GB", opts);
  const year = end.getUTCFullYear();
  if (group.start_date === group.end_date) return `${startText} ${year}`;
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  return sameMonth
    ? `${start.getUTCDate()}–${endText} ${year}`
    : `${startText} – ${endText} ${year}`;
}

export default function TripPicker({ groups, transactions, selectedId, onSelect, onNew, onEdit, onDelete }) {
  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div className="card-head">
        <div className="card-title">Trips</div>
        <button type="button" className="btn btn-primary" onClick={onNew}>+ New trip</button>
      </div>
      <div className="trip-cards">
        {groups.map((group) => {
          const matched = transactionsForGroup(transactions, group, group.overrides);
          const totals = groupTotals(matched);
          const days = daysOfTrip(group).length;
          const active = group.id === selectedId;
          return (
            <button
              key={group.id}
              type="button"
              className={`trip-card${active ? " is-active" : ""}`}
              aria-pressed={active}
              onClick={() => onSelect(group.id)}
            >
              <div className="trip-card-head">
                <span className="trip-card-name">{group.name}</span>
                {group.destination && <span className="trip-card-dest">{group.destination}</span>}
              </div>
              <div className="trip-card-range">{rangeLabel(group)} · {days} {days === 1 ? "day" : "days"}</div>
              <div className="trip-card-total">{money(totals.spend)}</div>
              <div className="trip-card-sub">
                {/* Stated because the group is a live view of the range, not a
                    saved snapshot — the count moves if a date is edited. */}
                {totals.count} {totals.count === 1 ? "transaction" : "transactions"}
                {days > 0 && ` · ${money(totals.spend / days)}/day`}
              </div>
              {active && (
                <span className="trip-card-actions">
                  <span
                    role="button"
                    tabIndex={0}
                    className="btn btn-ghost"
                    onClick={(e) => { e.stopPropagation(); onEdit(group); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onEdit(group); } }}
                  >
                    ✎ Edit
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="btn btn-ghost"
                    onClick={(e) => { e.stopPropagation(); onDelete(group); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onDelete(group); } }}
                  >
                    ✕ Delete
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
