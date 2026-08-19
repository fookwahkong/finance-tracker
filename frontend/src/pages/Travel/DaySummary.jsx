import { useMemo, useState } from "react";
import { applyClaimAdjustments } from "../../lib/claims";
import { emojiFor } from "../../lib/categories";
import { colorFor, money, signed, sgd } from "../../lib/format";
import {
  averageDailySpend, categoryRowsForDay, dailyTotals, daysOfTrip, incomeForDay,
  includedOutOfRange, runningTotalThrough, transactionsForGroup,
} from "../../lib/travel";

const dayLabel = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short",
  });

const shortDay = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC", day: "numeric", month: "short",
  });

// One day of the trip, broken down by category. Amounts are claim-adjusted,
// exactly as in Overview, so the two subtabs can never disagree on a total.
export default function DaySummary({ group, transactions, claims, claimLinks }) {
  const days = useMemo(() => daysOfTrip(group), [group]);
  const [pickedDay, setDay] = useState(days[0]);
  const [expanded, setExpanded] = useState({});

  // Resolved during render rather than snapped back in an effect: when the
  // trip or its range changes, a day that is no longer part of it simply
  // falls back to the first day.
  const day = days.includes(pickedDay) ? pickedDay : days[0];

  const tripTransactions = useMemo(() => {
    const adjusted = applyClaimAdjustments(transactions, claims, claimLinks);
    return transactionsForGroup(adjusted, group, group?.overrides);
  }, [transactions, claims, claimLinks, group]);

  const perDay = useMemo(() => dailyTotals(tripTransactions, days), [tripTransactions, days]);
  const rows = useMemo(() => categoryRowsForDay(tripTransactions, day), [tripTransactions, day]);
  const income = useMemo(() => incomeForDay(tripTransactions, day), [tripTransactions, day]);
  const preBooked = useMemo(
    () => includedOutOfRange(tripTransactions, group, group?.overrides),
    [tripTransactions, group],
  );

  const dayTotal = perDay[day] || 0;
  const average = averageDailySpend(perDay);
  const runningTotal = runningTotalThrough(perDay, days, day);
  const dayIndex = days.indexOf(day);
  const dayNo = dayIndex + 1;
  const vsAverage = average > 0 ? dayTotal - average : 0;

  if (!days.length) return <section className="card"><div className="empty">This trip has no days.</div></section>;

  return (
    <>
      {/* Day picker — the strip doubles as a shape-of-the-trip chart: each
          chip carries its own total, so the expensive days stand out before
          anything is clicked. */}
      <section className="card" style={{ padding: "16px 20px" }}>
        <div className="day-strip-head">
          <div className="card-title">Pick a day</div>
          <div className="day-strip-controls">
            <button
              type="button"
              className="btn btn-outline btn-icon"
              aria-label="Previous day"
              disabled={dayIndex <= 0}
              onClick={() => setDay(days[dayIndex - 1])}
            >‹</button>
            <input
              className="input"
              type="date"
              aria-label="Trip day"
              style={{ width: "auto" }}
              value={day}
              min={group.start_date}
              max={group.end_date}
              onChange={(e) => days.includes(e.target.value) && setDay(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline btn-icon"
              aria-label="Next day"
              disabled={dayIndex >= days.length - 1}
              onClick={() => setDay(days[dayIndex + 1])}
            >›</button>
          </div>
        </div>
        <div className="day-strip">
          {days.map((d, i) => (
            <button
              key={d}
              type="button"
              className={`day-chip${d === day ? " is-active" : ""}`}
              aria-pressed={d === day}
              onClick={() => setDay(d)}
            >
              <span className="day-chip-no">Day {i + 1}</span>
              <span className="day-chip-date">{shortDay(d)}</span>
              <span className={`day-chip-total${perDay[d] > 0 ? "" : " is-zero"}`}>
                {perDay[d] > 0 ? money(perDay[d]).replace(/\.\d+$/, "") : "—"}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Day header stats */}
      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Day {dayNo} · {dayLabel(day)}</div>
            <div className="card-sub" style={{ fontSize: 14, fontWeight: 500 }}>
              {rows.length} {rows.length === 1 ? "category" : "categories"}
            </div>
          </div>
          <span className="pill">{group.name}</span>
        </div>
        <div className="day-stats">
          <div>
            <span>Spent today</span>
            <strong>{money(dayTotal)}</strong>
          </div>
          <div>
            <span>Trip daily average</span>
            <strong>{money(average)}</strong>
            {average > 0 && dayTotal > 0 && (
              <em className={vsAverage > 0 ? "is-over" : "is-under"}>
                {vsAverage > 0 ? "+" : "−"}{money(Math.abs(vsAverage))} vs average
              </em>
            )}
          </div>
          <div>
            <span>Trip so far</span>
            <strong>{money(runningTotal)}</strong>
          </div>
        </div>
      </section>

      {/* Categories, biggest first */}
      <section className="card">
        <div className="card-head"><div className="card-title">Spending by category</div></div>
        {rows.length === 0 ? (
          // A genuinely free day should read differently from missing data.
          <div className="empty">No spending on Day {dayNo} ({shortDay(day)}).</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Category</th><th className="num">Amount</th><th className="num">Share</th></tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const open = !!expanded[row.category];
                return [
                  <tr
                    key={row.category}
                    className={`cat-row${open ? " is-active" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => setExpanded((m) => ({ ...m, [row.category]: !m[row.category] }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpanded((m) => ({ ...m, [row.category]: !m[row.category] }));
                      }
                    }}
                  >
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="legend-dot" style={{ width: 10, height: 10, background: colorFor(i) }} />
                        <span aria-hidden="true">{emojiFor(row.category)}</span>
                        <b style={{ fontWeight: 600 }}>{row.category}</b>
                        <span className="row-sub">
                          {row.items.length} {row.items.length === 1 ? "item" : "items"}
                        </span>
                      </span>
                    </td>
                    <td className="num neg" style={{ fontWeight: 700 }}>−{money(row.amount)}</td>
                    <td className="num" style={{ color: "var(--muted)" }}>{Math.round(row.share * 100)}%</td>
                  </tr>,
                  open && (
                    <tr key={`${row.category}-items`} className="cat-row-detail">
                      <td colSpan={3}>
                        {row.items.map((t) => (
                          <div className="row" key={t.id}>
                            <div className="row-ico" style={{ background: "var(--teal-soft)" }}>{emojiFor(t.category)}</div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div className="row-name">{t.item}</div>
                              {t.source && <div className="row-sub">{t.source}</div>}
                            </div>
                            <div style={{ width: 110, textAlign: "right" }}>
                              <div className="row-name">
                                {t.currency === "CNY" ? signed(t.foreign_amount, "¥") : signed(t.amount)}
                              </div>
                              {t.currency === "CNY" && (
                                <div style={{ fontSize: 11, color: "var(--muted)" }}>{sgd(t.amount)}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Income is kept out of the category rows above: a refund is not a
          category of spending, and netting it into one would hide both. */}
      {income.length > 0 && (
        <section className="card">
          <div className="card-head"><div className="card-title">Money in on this day</div></div>
          {income.map((t) => (
            <div className="row" key={t.id}>
              <div className="row-ico" style={{ background: "var(--green-soft)" }}>{emojiFor(t.category)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row-name">{t.item}</div>
                {t.category && <span className="chip">{t.category}</span>}
              </div>
              <div style={{ width: 110, textAlign: "right" }}>
                <div className="row-name" style={{ color: "var(--green)" }}>{signed(t.amount)}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Pre-trip bookings have no day of the trip to sit on, so they get
          their own section rather than being silently dropped. */}
      {preBooked.length > 0 && (
        <section className="card">
          <div className="card-head">
            <div className="card-title">Booked before the trip</div>
            <span className="pill">Added to this trip</span>
          </div>
          {preBooked.map((t) => (
            <div className="row" key={t.id}>
              <div className="row-ico" style={{ background: "var(--teal-soft)" }}>{emojiFor(t.category)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row-name">{t.item}</div>
                <div className="row-sub">{t.date}{t.category ? ` · ${t.category}` : ""}</div>
              </div>
              <div style={{ width: 110, textAlign: "right" }}>
                <div className="row-name">{signed(t.amount)}</div>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
