// Travel-group membership and day aggregation.
//
// A travel group stores only a date range; which transactions belong to it is
// derived here, at read time. That is what keeps the Travel and Spending tabs
// in sync without a sync step: both read the same transaction list, so
// re-dating a transaction in Spending moves it between trips by itself.
//
// This is the ONLY implementation of the membership rule. `core/travel.py`
// deliberately does not mirror it — no backend caller needs it, and one rule
// written twice in two languages is two rules waiting to disagree.

// ISO "YYYY-MM-DD" strings compare correctly with < and >, which is the same
// property the Spending tab's `date.slice(0, 7) === month` filter relies on.
const isoDate = (t) => String(t.date || "").slice(0, 10);

// Both ends inclusive, matching how a user reads "18 August to 26 August"
// and the database's daterange(start_date, end_date, '[]') constraint.
export function isWithinRange(date, group) {
  return date >= group.start_date && date <= group.end_date;
}

// { [transaction_id]: "include" | "exclude" } for one group.
export function overrideMap(overrides = []) {
  const out = {};
  for (const o of overrides) out[o.transaction_id] = o.mode;
  return out;
}

// The membership rule:
//   in range and not excluded, OR explicitly included.
// 'include' pulls in a flight booked six weeks before departure; 'exclude'
// pushes out the rent that auto-debited while the user was away.
export function belongsToGroup(transaction, group, modes = {}) {
  const mode = modes[transaction.id];
  if (mode === "exclude") return false;
  if (mode === "include") return true;
  return isWithinRange(isoDate(transaction), group);
}

export function transactionsForGroup(transactions = [], group, overrides = []) {
  if (!group) return [];
  const modes = overrideMap(overrides);
  return transactions.filter((t) => belongsToGroup(t, group, modes));
}

// Transactions an 'include' override pulled in from outside the date range —
// the trip's pre-booked flights and hotels. Rendered apart from the day-by-day
// list, which is ordered by date and would otherwise open weeks early.
export function includedOutOfRange(transactions = [], group, overrides = []) {
  if (!group) return [];
  const modes = overrideMap(overrides);
  return transactions.filter(
    (t) => modes[t.id] === "include" && !isWithinRange(isoDate(t), group),
  );
}

// Spend is reported as a positive magnitude, matching the Overview donut.
// Pass claim-adjusted transactions so trip totals agree with every other total.
export function groupTotals(transactions = []) {
  let spend = 0;
  let income = 0;
  for (const t of transactions) {
    const amount = Number(t.amount) || 0;
    if (amount < 0) spend += -amount;
    else income += amount;
  }
  return { spend, income, net: income - spend, count: transactions.length };
}

// Every ISO date of the trip, inclusive of both ends. Built by stepping a UTC
// date so it survives month and year boundaries (28 Aug - 3 Sep) without a
// local-timezone off-by-one.
export function daysOfTrip(group) {
  if (!group?.start_date || !group?.end_date) return [];
  const out = [];
  const cursor = new Date(`${group.start_date}T00:00:00Z`);
  const end = new Date(`${group.end_date}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return [];
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

// Trip day number (1-based) for a date, or null when it falls outside —
// which is exactly the case for an 'include'-override flight.
export function dayNumber(date, group) {
  const index = daysOfTrip(group).indexOf(String(date).slice(0, 10));
  return index === -1 ? null : index + 1;
}

// { [isoDate]: spendMagnitude } across the trip. Days with no spending are
// present with 0 so the day strip can render them without a lookup guard.
export function dailyTotals(transactions = [], days = []) {
  const out = Object.fromEntries(days.map((d) => [d, 0]));
  for (const t of transactions) {
    const day = isoDate(t);
    if (!(day in out)) continue;
    const amount = Number(t.amount) || 0;
    if (amount < 0) out[day] += -amount;
  }
  return out;
}

// Spending for one day, grouped by category and sorted biggest-first — the
// Day Summary's whole job. Income is excluded: a refund received on day 3 is
// not a category of spending, and netting it into one would hide both halves.
export function categoryRowsForDay(transactions = [], day) {
  const target = String(day).slice(0, 10);
  const byCategory = {};
  for (const t of transactions) {
    if (isoDate(t) !== target) continue;
    const amount = Number(t.amount) || 0;
    if (amount >= 0) continue;
    const name = t.category || "Uncategorized";
    if (!byCategory[name]) byCategory[name] = { category: name, amount: 0, items: [] };
    byCategory[name].amount += -amount;
    byCategory[name].items.push(t);
  }
  const rows = Object.values(byCategory).sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  return rows.map((r) => ({
    ...r,
    share: total > 0 ? r.amount / total : 0,
    items: r.items.slice().sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
  }));
}

// Income received on one day (refunds, a friend settling up mid-trip). Kept
// separate from categoryRowsForDay for the reason given above.
export function incomeForDay(transactions = [], day) {
  const target = String(day).slice(0, 10);
  return transactions.filter((t) => isoDate(t) === target && Number(t.amount) > 0);
}

// Mean spend across trip days that had any. Days with zero spend are excluded
// so a rest day doesn't drag the "typical day" figure down.
export function averageDailySpend(dailyMap = {}) {
  const spending = Object.values(dailyMap).filter((v) => v > 0);
  if (spending.length === 0) return 0;
  return spending.reduce((sum, v) => sum + v, 0) / spending.length;
}

// Trip spend from the first day through `day` inclusive — the "so far" figure
// in the Day Summary header.
export function runningTotalThrough(dailyMap = {}, days = [], day) {
  let total = 0;
  for (const d of days) {
    total += dailyMap[d] || 0;
    if (d === day) break;
  }
  return total;
}

// The date a new transaction created from inside a trip should default to:
// today when the trip is happening, otherwise its first day. Logging an
// expense from a trip view almost never means "today, six months from now".
export function defaultDateForGroup(group, today = new Date()) {
  const iso = today.toISOString().slice(0, 10);
  if (!group) return iso;
  if (isWithinRange(iso, group)) return iso;
  return group.start_date;
}

// A trip's period, in the shape the shared Overview takes.
export function periodForGroup(group) {
  if (!group) return null;
  return {
    start: group.start_date,
    end: group.end_date,
    label: group.destination ? `${group.name} · ${group.destination}` : group.name,
    slug: `${group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${group.start_date}`,
  };
}
