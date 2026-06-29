# Spending Tabs + Budget Redesign — Design

Date: 2026-06-29
Status: Approved (pending spec review)

## Goal

Restructure the Spending page into tabs and redesign the Budget page, matching
the reference screenshots in `screenshots/` (`image1.png` Overview,
`image2.png` Month vs Month, `image.png` Budget).

Two pieces of work:

1. **Spending** becomes a tabbed page: **Overview · Month vs Month · Insights**.
2. **Budget** stays its own sidebar route but is redesigned into a year-based
   month-by-month table with per-category status.

## Decisions (resolved during brainstorming)

- Tab structure: **3 tabs** (Overview, Month vs Month, Insights). The
  transactions-by-date list stays inside Overview. **Budget remains a separate
  sidebar page** (not a tab).
- Month-vs-Month line graph: **one category at a time**, chosen via a dropdown.
  x = months Jan–Dec, y = amount spent in that category.
- Charting: **Recharts**, **lazy-loaded** on the Month vs Month route only.
  Used for both the income-vs-spend bars and the category line. Rich
  interactivity wanted (hover tooltips, crosshair, animation).
- Budget status: **average vs budget** — OVER = avg > budget, WATCH = avg
  80–100% of budget, ON TRACK = avg < 80% of budget. A legend on the tab
  explains the three states.
- Budget time range: **year selector**, columns Jan–Dec of the selected year.
- Tabs are **in-page local state** under the single `/spending` route (not
  nested routes).

## Data Flow

`Spending.jsx` becomes a thin container. On mount it fetches the data **once**:

- `getTransactions()` — all transactions (no month filter)
- `getCategories()`

It derives every view client-side from that single dataset; switching
month / year / tab does **not** refetch. This is fewer API calls than the
current page (which fires both `getTransactions(month)` and
`getTransactions()`), and keeps the new tabs off the network path entirely.

The Budget page keeps its own data load (`getBudgets()` + `getTransactions()`),
fetched once on mount, derived client-side per selected year.

Year dropdown options (everywhere): the distinct years present in the
transaction data, plus the current year, sorted descending. Default to the
current year.

## Components

### Container — `frontend/src/pages/Spending.jsx`
- Fetches transactions + categories once.
- Holds `tab` state (`"overview" | "month" | "insights"`), renders a tab bar
  styled like the screenshots.
- Passes `transactions` and `categories` down to the active tab.

### Overview — `frontend/src/pages/Spending/Overview.jsx`
Receives `transactions`, `categories`. Owns its own `month` selection and the
add/edit/delete transaction logic (moved from the current `Spending.jsx`).

- Month selection: **12 month buttons** (Jan–Dec) + a **year dropdown**.
  Selected month highlighted (per `image1.png`).
- Keeps existing content for the selected month:
  - 4 summary stats (Total Spending, Total Income, Net Cash Flow, Transactions).
  - **Spending by Category** donut + table (existing `colorFor` / `donutGradient`).
  - Toolbar: category filter, Download CSV, + New transaction (modal unchanged).
  - **Transactions by date** list with per-row edit/delete menu.
- **Removed:** the "Last 6 Months" `MonthBars` block (moves to Month vs Month).
- Empty state: when the selected month has no transactions, show
  **"No transactions in this month."** in place of the stats / donut / list.

### Month vs Month — `frontend/src/pages/Spending/MonthVsMonth.jsx`
Receives `transactions`. Owns a **year** selection (dropdown) controlling the
whole tab, and a **category** selection for the line chart.

- **Income vs Spend** grouped bar chart, 12 months Jan–Dec of the selected
  year (per `image2.png`), with a per-month net-flow label grid below.
- **Category line chart**: x = Jan–Dec, y = amount spent in the selected
  category that month. Category chosen via dropdown.
- Both charts are Recharts, **lazy-loaded** (`React.lazy` + dynamic import),
  themed with existing CSS variables (`--teal`, `--teal-3`, `--green`, `--red`).

### Insights — `frontend/src/pages/Spending/Insights.jsx`
- Placeholder card with a **"Soon"** pill. No logic.

### Charts (Recharts wrappers, lazy)
- `frontend/src/components/IncomeSpendBars.jsx` — grouped bar chart (income vs
  spend) for a 12-month series, with tooltips.
- `frontend/src/components/CategoryLine.jsx` — single-series line chart for one
  category across 12 months, with hover tooltip + animation.

These two are the only modules that import `recharts`; they are imported via
`React.lazy` from `MonthVsMonth.jsx` so Recharts is code-split into its own
chunk and downloaded only when the tab is opened.

### Budget — `frontend/src/pages/Budget.jsx` (redesigned)
Receives nothing new; redesigned in place.

- **Year dropdown** controlling the table.
- Top stat row: **ON TRACK / WATCH / OVER** counts across categories, plus a
  small **legend** explaining each status.
- Table: one row per category in `CATEGORIES`; columns:
  - Jan–Dec spend for the selected year (per-month expense total for that
    category).
  - **Average** — mean monthly spend over the months in that year that have
    data (months with no transactions for the category are excluded from the
    average denominator).
  - **Budget /mo** — editable input per row, saved via existing `upsertBudget`
    (unchanged save flow / drafts pattern).
  - **Status** — derived from average vs budget (see below).

## Aggregation helpers — extend `frontend/src/lib/aggregate.js`

New pure functions (unit-testable, no React):

- `yearsInData(transactions)` → sorted-desc distinct years present, plus the
  current year.
- `monthsOfYear(year)` → twelve `"YYYY-MM"` keys for the year.
- `incomeSpendByMonth(transactions, year)` → 12-entry array
  `{ month, income, spending, net }` (reuses `monthlyTotals` logic over the
  year's months).
- `categoryMonthlySeries(transactions, year, category)` → 12-entry array
  `{ month, amount }` of expense spend for that category.
- `budgetStatus(avgSpend, budget)` → `"on" | "watch" | "over"`:
  - `over` when `budget > 0 && avgSpend > budget`
  - `watch` when `budget > 0 && avgSpend >= 0.8 * budget` (and not over)
  - `on` otherwise (including when avg < 80% of budget; a `0` budget is
    treated as `on`/unset — see Edge Cases)
- `categoryYearStats(transactions, year, category)` → `{ months: [...12],
  average }` used to build each Budget row.

## Status Thresholds & Legend

| Status   | Rule                         | Color        |
|----------|------------------------------|--------------|
| ON TRACK | avg < 80% of budget          | `--green`    |
| WATCH    | 80% ≤ avg ≤ 100% of budget   | `--amber` (new) |
| OVER     | avg > budget                 | `--red`      |

`index.css` has no amber/warning color today (only `--teal`, `--green`,
`--red`). Add `--amber` (plus `--amber-soft` for badge backgrounds, matching the
existing `--green-soft` / `--red-soft` pattern) for the WATCH state.

Legend rendered on the Budget tab restating these rules in one line each.

## Edge Cases

- **No transactions at all:** Overview shows the empty-month message for any
  selected month; Month vs Month shows empty/zeroed charts; Budget shows zero
  spend with all categories ON TRACK (or "no data" average `—`).
- **Month with no data:** Overview shows "No transactions in this month.";
  Month-vs-Month bars/line show 0 for that month; Budget average excludes it.
- **Budget unset (0) for a category:** status is ON TRACK (nothing to exceed);
  average column still shows actual spend; progress/percent treated as 0.
- **Year with no data:** year still selectable only if present in data or the
  current year; charts/table render zeros.

## Testing

- Unit-test the new `aggregate.js` helpers (`incomeSpendByMonth`,
  `categoryMonthlySeries`, `budgetStatus`, `categoryYearStats`,
  `yearsInData`) with representative fixtures, including the edge cases above.
- Manual/visual check against the three screenshots for layout parity.

## Files

New:
- `frontend/src/pages/Spending/Overview.jsx`
- `frontend/src/pages/Spending/MonthVsMonth.jsx`
- `frontend/src/pages/Spending/Insights.jsx`
- `frontend/src/components/IncomeSpendBars.jsx`
- `frontend/src/components/CategoryLine.jsx`

Changed:
- `frontend/src/pages/Spending.jsx` (→ container + tab bar; existing logic moves
  into `Overview.jsx`)
- `frontend/src/pages/Budget.jsx` (redesigned table)
- `frontend/src/lib/aggregate.js` (new helpers)
- `frontend/src/index.css` (add `--amber` / `--amber-soft`, tab-bar + status
  badge styles)
- `frontend/package.json` (add `recharts`)

Unchanged: routing in `App.jsx` (still single `/spending` and `/budget`
routes), sidebar, API client.

## Out of Scope

- No backend / API changes.
- No new "transfers to make" panel from `image1.png` (not requested).
- Insights content beyond the "Soon" placeholder.
