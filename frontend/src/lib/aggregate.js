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
