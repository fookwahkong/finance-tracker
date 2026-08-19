import { useMemo, useState } from "react";
import SpendingOverview from "../Spending/Overview";
import { rangeLabel } from "./TripPicker";
import { clearTravelOverride, setTravelOverride } from "../../api/travel";
import TransactionPicker from "./TransactionPicker";
import { money } from "../../lib/format";
import {
  belongsToGroup, daysOfTrip, defaultDateForGroup, groupTotals, overrideMap,
  periodForGroup, transactionsForGroup,
} from "../../lib/travel";

// The trip's Overview is the Spending Overview with a different period: same
// donut, same category tables, same transaction list and claim handling. The
// only things that differ are how the period is chosen and the fact that
// membership can be overridden per transaction.
export default function TravelOverview({
  group, transactions, categories, claims, claimLinks, onChanged, reloadClaims, reloadGroups,
}) {
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const period = useMemo(() => periodForGroup(group), [group]);
  const modes = useMemo(() => overrideMap(group?.overrides), [group]);
  const isInPeriod = useMemo(
    () => (t) => belongsToGroup(t, group, modes),
    [group, modes],
  );

  const totals = useMemo(
    () => groupTotals(transactionsForGroup(transactions, group, group?.overrides)),
    [transactions, group],
  );
  const days = useMemo(() => daysOfTrip(group).length, [group]);

  async function excludeFromTrip(transaction) {
    setError("");
    try {
      await setTravelOverride(group.id, transaction.id, "exclude");
      reloadGroups();
    } catch {
      setError("Unable to remove that transaction from this trip.");
    }
  }

  async function includeInTrip(transaction) {
    setSaving(true);
    setError("");
    try {
      await setTravelOverride(group.id, transaction.id, "include");
      reloadGroups();
    } catch {
      setError("Unable to add that transaction to this trip.");
    } finally {
      setSaving(false);
    }
  }

  async function clearOverride(transactionId) {
    setSaving(true);
    setError("");
    try {
      await clearTravelOverride(group.id, transactionId);
      reloadGroups();
    } catch {
      setError("Unable to undo that change.");
    } finally {
      setSaving(false);
    }
  }

  const selector = (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div className="trip-hero">
        <div>
          <div className="trip-hero-name">{group.name}</div>
          <div className="trip-hero-range">
            {rangeLabel(group)} · {days} {days === 1 ? "day" : "days"}
            {group.destination && ` · ${group.destination}`}
          </div>
        </div>
        <div className="trip-hero-stats">
          <div>
            <span>Total spent</span>
            <strong>{money(totals.spend)}</strong>
          </div>
          <div>
            <span>Per day</span>
            <strong>{days > 0 ? money(totals.spend / days) : money(0)}</strong>
          </div>
          {totals.income > 0 && (
            <div>
              <span>Money in</span>
              <strong>{money(totals.income)}</strong>
            </div>
          )}
        </div>
      </div>
      <div className="trip-hero-actions">
        <button type="button" className="btn btn-outline" onClick={() => setPicking(true)}>
          + Add existing transaction
        </button>
        <span className="row-sub">
          Bought your flights before you left? Add them so the trip total is real.
        </span>
      </div>
      {error && <div className="form-error" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}
    </div>
  );

  return (
    <>
      {picking && (
        <TransactionPicker
          group={group}
          transactions={transactions}
          saving={saving}
          serverError={error}
          onClose={() => !saving && setPicking(false)}
          onInclude={includeInTrip}
          onClear={clearOverride}
        />
      )}
        <SpendingOverview
        transactions={transactions}
        categories={categories}
        claims={claims}
        claimLinks={claimLinks}
        onChanged={onChanged}
        reloadClaims={reloadClaims}
        period={period}
        isInPeriod={isInPeriod}
        periodSelector={selector}
        defaultDate={defaultDateForGroup(group)}
        emptyMessage="Nothing spent on this trip yet."
        extraRowActions={() => [{ label: "⊘ Remove from trip", onClick: excludeFromTrip }]}
      />
    </>
  );
}
