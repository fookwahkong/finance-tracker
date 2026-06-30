// Six "YYYY-MM" strings ending with the current month, oldest first.
export function lastSixMonths(today = new Date()) {
  const out = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// Sum settled-claim adjustments for a month. When `category` is given, the
// spending side is limited to that category; the income side is always the
// full month total (income is category-agnostic).
export function applyAdjustmentsToMonth(month, category, adjustments = []) {
  let spendingDelta = 0;
  let incomeDelta = 0;
  for (const a of adjustments) {
    if (a.month !== month) continue;
    incomeDelta += a.amount;
    if (category == null || a.category === category) spendingDelta += a.amount;
  }
  return { spendingDelta, incomeDelta };
}

// Spending (positive) and income totals per month for the given month keys.
export function monthlyTotals(transactions, months, adjustments = []) {
  const acc = Object.fromEntries(months.map((m) => [m, { spending: 0, income: 0 }]));
  for (const t of transactions) {
    const key = String(t.date || "").slice(0, 7);
    if (!acc[key]) continue;
    if (t.amount < 0) acc[key].spending += -t.amount;
    else acc[key].income += t.amount;
  }
  return months.map((month) => {
    const { spendingDelta, incomeDelta } = applyAdjustmentsToMonth(month, null, adjustments);
    return {
      month,
      spending: acc[month].spending - spendingDelta,
      income: acc[month].income - incomeDelta,
    };
  });
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

// 12-entry income/spending/net series for a calendar year (Jan first).
export function incomeSpendByMonth(transactions, year) {
  return monthlyTotals(transactions, monthsOfYear(year)).map((r) => ({
    ...r,
    net: r.income - r.spending,
  }));
}

// 12-entry expense-spend series (positive amounts) for one category across a
// year. Transactions with no category are bucketed under "Others".
export function categoryMonthlySeries(transactions, year, category, adjustments = []) {
  const months = monthsOfYear(year);
  const acc = Object.fromEntries(months.map((m) => [m, 0]));
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const key = String(t.date || "").slice(0, 7);
    if (!(key in acc)) continue;
    if ((t.category || "Others") !== category) continue;
    acc[key] += -t.amount;
  }
  return months.map((m) => {
    const { spendingDelta } = applyAdjustmentsToMonth(m, category, adjustments);
    return { month: m, amount: acc[m] - spendingDelta };
  });
}

// Per-category stats for a year's Budget row: the 12 monthly spend amounts and
// the average over months that had any spend (0 when none).
export function categoryYearStats(transactions, year, category) {
  const series = categoryMonthlySeries(transactions, year, category);
  const withSpend = series.filter((s) => s.amount > 0);
  const average = withSpend.length
    ? withSpend.reduce((s, x) => s + x.amount, 0) / withSpend.length
    : 0;
  return { months: series.map((s) => s.amount), average };
}

// Budget status from average monthly spend vs the monthly budget.
// over: avg > budget; watch: 80%..100% of budget; on: otherwise (incl. unset).
export function budgetStatus(avgSpend, budget) {
  if (!budget || budget <= 0) return "on";
  if (avgSpend > budget) return "over";
  if (avgSpend >= 0.8 * budget) return "watch";
  return "on";
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
