import { budgetStatus } from "../../../lib/aggregate";

function ymKey(date) {
  return String(date).slice(0, 7);
}

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function prevMonth(year, month) {
  return month === 0 ? [year - 1, 11] : [year, month - 1];
}

// This/last calendar month's per-category spend, ranked by absolute dollar
// change. A category with no prior-month spend is flagged isNew instead of
// a percentage (avoids dividing by zero).
export function categoryDeltas(transactions, today = new Date()) {
  const thisMonth = monthKey(today.getFullYear(), today.getMonth());
  const [py, pm] = prevMonth(today.getFullYear(), today.getMonth());
  const lastMonth = monthKey(py, pm);

  const spendByCategory = (month) => {
    const acc = {};
    for (const t of transactions) {
      if (t.amount >= 0 || ymKey(t.date) !== month) continue;
      const cat = t.category || "Uncategorized";
      acc[cat] = (acc[cat] || 0) + -t.amount;
    }
    return acc;
  };

  const current = spendByCategory(thisMonth);
  const previous = spendByCategory(lastMonth);
  const categories = new Set([...Object.keys(current), ...Object.keys(previous)]);

  const rows = [...categories].map((category) => {
    const cur = current[category] || 0;
    const prev = previous[category] || 0;
    const isNew = prev === 0;
    return {
      category,
      current: cur,
      previous: prev,
      deltaAmount: cur - prev,
      deltaPct: isNew ? null : ((cur - prev) / prev) * 100,
      isNew,
    };
  });

  return rows
    .sort((a, b) => Math.abs(b.deltaAmount) - Math.abs(a.deltaAmount))
    .slice(0, 5);
}

// Cumulative spend from day 1 through today's day-of-month, vs the average
// of the same window across the trailing `lookbackMonths` completed months
// (a month only counts if it had at least that many days).
export function spendingPace(transactions, today = new Date(), lookbackMonths = 3) {
  const day = today.getDate();

  const cumulativeThroughDay = (year, month) => {
    const month0 = monthKey(year, month);
    return transactions
      .filter((t) => t.amount < 0 && ymKey(t.date) === month0 && Number(t.date.slice(8, 10)) <= day)
      .reduce((s, t) => s - t.amount, 0);
  };

  const currentCumulative = cumulativeThroughDay(today.getFullYear(), today.getMonth());

  const historical = [];
  let [y, m] = [today.getFullYear(), today.getMonth()];
  for (let i = 0; i < lookbackMonths; i++) {
    [y, m] = prevMonth(y, m);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    if (daysInMonth < day) continue;
    historical.push(cumulativeThroughDay(y, m));
  }

  if (historical.length === 0) return null;

  const avgHistoricalCumulative = historical.reduce((s, v) => s + v, 0) / historical.length;
  return {
    currentCumulative,
    avgHistoricalCumulative,
    paceRatio: avgHistoricalCumulative === 0 ? null : currentCumulative / avgHistoricalCumulative,
  };
}

// The single largest expense this month, or null if there are none.
export function biggestTransaction(transactions, today = new Date()) {
  const thisMonth = monthKey(today.getFullYear(), today.getMonth());
  const expenses = transactions.filter((t) => t.amount < 0 && ymKey(t.date) === thisMonth);
  if (expenses.length === 0) return null;
  const biggest = expenses.reduce((a, b) => (b.amount < a.amount ? b : a));
  return { item: biggest.item, category: biggest.category, amount: biggest.amount, date: biggest.date };
}

// Budgeted categories ranked by percent of budget consumed this month
// (actual spend so far, not the yearly average), top `limit`.
export function budgetsClosestToTipping(transactions, budgets, today = new Date(), limit = 3) {
  const thisMonth = monthKey(today.getFullYear(), today.getMonth());
  const spendByCategory = {};
  for (const t of transactions) {
    if (t.amount >= 0 || ymKey(t.date) !== thisMonth) continue;
    const cat = t.category || "Uncategorized";
    spendByCategory[cat] = (spendByCategory[cat] || 0) + -t.amount;
  }

  const rows = budgets
    .filter((b) => b.amount > 0)
    .map((b) => {
      const spend = spendByCategory[b.category] || 0;
      return {
        category: b.category,
        spend,
        budget: b.amount,
        status: budgetStatus(spend, b.amount),
        pctUsed: (spend / b.amount) * 100,
      };
    });

  return rows.sort((a, b) => b.pctUsed - a.pctUsed).slice(0, limit);
}

// Sum of actual transactions matching each declared bill subscription
// (case-insensitive item match), this month vs 3 months ago.
export function subscriptionCreep(transactions, subscriptions, today = new Date()) {
  const bills = subscriptions.filter((s) => s.type === "bill");
  if (bills.length === 0) return null;

  const thisMonth = monthKey(today.getFullYear(), today.getMonth());
  const [py, pm] = (() => {
    let [y, m] = [today.getFullYear(), today.getMonth()];
    for (let i = 0; i < 3; i++) [y, m] = prevMonth(y, m);
    return [y, m];
  })();
  const threeMonthsAgoKey = monthKey(py, pm);

  const sumFor = (item, month) =>
    transactions
      .filter((t) => t.amount < 0 && ymKey(t.date) === month && (t.item || "").toLowerCase() === item.toLowerCase())
      .reduce((s, t) => s - t.amount, 0);

  const items = bills.map((b) => ({
    item: b.item,
    current: sumFor(b.item, thisMonth),
    threeMonthsAgo: sumFor(b.item, threeMonthsAgoKey),
  }));

  const current = items.reduce((s, i) => s + i.current, 0);
  const threeMonthsAgo = items.reduce((s, i) => s + i.threeMonthsAgo, 0);

  return {
    current,
    threeMonthsAgo,
    deltaAmount: current - threeMonthsAgo,
    deltaPct: threeMonthsAgo === 0 ? null : ((current - threeMonthsAgo) / threeMonthsAgo) * 100,
    items,
  };
}

// Spend-per-day averages for weekday vs weekend expenses this month,
// counting only calendar days that have elapsed so far.
export function weekdayWeekendSplit(transactions, today = new Date()) {
  const thisMonth = monthKey(today.getFullYear(), today.getMonth());
  const day = today.getDate();

  let weekdayDays = 0;
  let weekendDays = 0;
  for (let d = 1; d <= day; d++) {
    const dow = new Date(today.getFullYear(), today.getMonth(), d).getDay();
    if (dow === 0 || dow === 6) weekendDays += 1;
    else weekdayDays += 1;
  }

  let weekdayTotal = 0;
  let weekendTotal = 0;
  for (const t of transactions) {
    if (t.amount >= 0 || ymKey(t.date) !== thisMonth) continue;
    const d = Number(t.date.slice(8, 10));
    if (d > day) continue;
    const dow = new Date(today.getFullYear(), today.getMonth(), d).getDay();
    if (dow === 0 || dow === 6) weekendTotal += -t.amount;
    else weekdayTotal += -t.amount;
  }

  return {
    weekdayTotal,
    weekendTotal,
    weekdayAvgPerDay: weekdayDays ? weekdayTotal / weekdayDays : 0,
    weekendAvgPerDay: weekendDays ? weekendTotal / weekendDays : 0,
  };
}
