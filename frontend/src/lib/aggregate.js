// Six "YYYY-MM" strings ending with the current month, oldest first.
export function lastSixMonths(today = new Date()) {
  const out = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// Spending (positive) and income totals per month for the given month keys.
export function monthlyTotals(transactions, months) {
  const acc = Object.fromEntries(months.map((m) => [m, { spending: 0, income: 0 }]));
  for (const t of transactions) {
    const key = String(t.date || "").slice(0, 7);
    if (!acc[key]) continue;
    if (t.amount < 0) acc[key].spending += -t.amount;
    else acc[key].income += t.amount;
  }
  return months.map((month) => ({ month, ...acc[month] }));
}

// The "YYYY-MM" key one month after the given key.
function nextMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1); // m is 1-based here, so this lands on the next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Map of "YYYY-MM" -> signed net flow (income - spending) for that month,
// built in a single pass so the trace can look up many months in O(1) each
// (cheap even with years of transactions). Memoize this on the transaction
// list and reuse it across month selections.
export function netFlowMap(transactions) {
  const map = {};
  for (const t of transactions) {
    const key = String(t.date || "").slice(0, 7);
    if (!key) continue;
    map[key] = (map[key] || 0) + Number(t.amount);
  }
  return map;
}

// Distinct calendar years present in transaction dates, plus the current
// year, sorted descending. Used to populate year dropdowns.
export function yearsInData(transactions, today = new Date()) {
  const set = new Set([today.getFullYear()]);
  for (const t of transactions) {
    const y = Number(String(t.date || "").slice(0, 4));
    if (y) set.add(y);
  }
  return [...set].sort((a, b) => b - a);
}

// Twelve "YYYY-MM" keys for a calendar year, January first.
export function monthsOfYear(year) {
  return Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
  );
}

// Traced cash for targetMonth: take the nearest anchor whose month is <=
// targetMonth, then add each later month's net flow (from a precomputed
// netFlowMap) up to and including targetMonth. Returns null when no anchor
// applies (cash is unknown).
export function cashForMonth(anchors, flowMap, targetMonth) {
  const applicable = anchors
    .filter((a) => a.month <= targetMonth)
    .sort((a, b) => (a.month < b.month ? 1 : -1));
  if (applicable.length === 0) return null;
  const anchor = applicable[0];
  let cash = Number(anchor.cash);
  let cursor = anchor.month;
  while (cursor < targetMonth) {
    cursor = nextMonth(cursor);
    cash += flowMap[cursor] || 0;
  }
  return cash;
}
