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

// Signed net flow (income - spending) for a single "YYYY-MM" month.
export function netFlow(transactions, month) {
  let net = 0;
  for (const t of transactions) {
    if (String(t.date || "").slice(0, 7) === month) net += t.amount;
  }
  return net;
}

// Traced cash for targetMonth: take the nearest anchor whose month is <=
// targetMonth, then add each later month's net flow up to and including
// targetMonth. Returns null when no anchor applies (cash is unknown).
export function cashForMonth(anchors, transactions, targetMonth) {
  const applicable = anchors
    .filter((a) => a.month <= targetMonth)
    .sort((a, b) => (a.month < b.month ? 1 : -1));
  if (applicable.length === 0) return null;
  const anchor = applicable[0];
  let cash = anchor.cash;
  let cursor = anchor.month;
  while (cursor < targetMonth) {
    cursor = nextMonth(cursor);
    cash += netFlow(transactions, cursor);
  }
  return cash;
}
