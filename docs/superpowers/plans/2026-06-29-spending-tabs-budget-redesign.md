# Spending Tabs + Budget Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Spending page into Overview / Month vs Month / Insights tabs and redesign the Budget page into a year-based month-by-month table with per-category status.

**Architecture:** `Spending.jsx` becomes a thin container that fetches all transactions + categories once and renders one of three in-page tabs. All per-month/per-year/per-category math lives in pure helpers in `lib/aggregate.js` (unit-tested). The Month vs Month tab uses lazy-loaded Recharts charts. Budget stays its own `/budget` route, redesigned in place.

**Tech Stack:** React 18, Vite 5, react-router-dom 6, axios, Recharts 2 (already a dependency), Vitest (added by this plan for unit tests).

## Global Constraints

- No backend / API changes. Reuse existing client functions: `getTransactions`, `getCategories`, `createTransaction`, `updateTransaction`, `deleteTransaction`, `getBudgets`, `upsertBudget`.
- No new top-level routes. `/spending` and `/budget` stay as in `App.jsx`.
- Recharts is imported **only** inside chart wrapper components, loaded via `React.lazy` from the Month vs Month tab (code-split; off the critical path for all other pages).
- Category fallback for null/empty category in the new helpers is the literal string `"Others"` (matches existing Budget behavior).
- Money formatting uses existing `money`/`signed` from `lib/format.js`. Colors use the existing hex values from `lib/categories.js`/`index.css`: green `#138a4a`, red `#e0533d`, teal `#138a86`.
- Status thresholds (average vs monthly budget): OVER = avg > budget; WATCH = 0.8·budget ≤ avg ≤ budget; ON TRACK = avg < 0.8·budget; a budget of 0/unset = ON TRACK.
- Match existing code style: 2-space indent, double-quoted strings, functional components with hooks.

---

## File Structure

New:
- `frontend/src/pages/Spending/Overview.jsx` — Overview tab (current Spending content minus the 6-month bars, plus month-button selector).
- `frontend/src/pages/Spending/MonthVsMonth.jsx` — Month vs Month tab.
- `frontend/src/pages/Spending/Insights.jsx` — "Soon" placeholder tab.
- `frontend/src/components/IncomeSpendBars.jsx` — Recharts grouped bar chart wrapper.
- `frontend/src/components/CategoryLine.jsx` — Recharts single-line chart wrapper.
- `frontend/src/lib/aggregate.test.js` — unit tests for new helpers.
- `frontend/vitest` config added inside `frontend/vite.config.js`.

Modified:
- `frontend/src/pages/Spending.jsx` — becomes container + tab bar.
- `frontend/src/pages/Budget.jsx` — redesigned table.
- `frontend/src/lib/aggregate.js` — new helpers.
- `frontend/src/index.css` — tab bar, month buttons, status badges, amber vars, table scroll.
- `frontend/package.json` — add `vitest` dev dep + `test` script.

---

## Task 1: Vitest setup + date helpers

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.js`
- Modify: `frontend/src/lib/aggregate.js`
- Test: `frontend/src/lib/aggregate.test.js` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `yearsInData(transactions, today = new Date()) -> number[]` — distinct years present in `transactions[].date`, plus the current year, sorted descending.
  - `monthsOfYear(year) -> string[]` — twelve `"YYYY-MM"` keys, Jan→Dec.

- [ ] **Step 1: Add Vitest dev dependency and test script**

In `frontend/package.json`, add the script and devDependency (keep existing entries):

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

```json
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.1",
    "vitest": "^2.0.5"
  }
```

Then install:

Run: `cd frontend && npm install`
Expected: completes, `node_modules/vitest` present.

- [ ] **Step 2: Configure Vitest in vite.config.js**

Replace the import line and add a `test` block. Full file:

```js
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 3: Write the failing tests**

Create `frontend/src/lib/aggregate.test.js`:

```js
import { describe, it, expect } from "vitest";
import { yearsInData, monthsOfYear } from "./aggregate";

describe("monthsOfYear", () => {
  it("returns 12 padded YYYY-MM keys Jan..Dec", () => {
    expect(monthsOfYear(2026)).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
      "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
    ]);
  });
});

describe("yearsInData", () => {
  const today = new Date(2026, 5, 29); // 2026-06-29

  it("includes the current year even with no transactions", () => {
    expect(yearsInData([], today)).toEqual([2026]);
  });

  it("returns distinct years from data plus current year, descending", () => {
    const tx = [
      { date: "2024-03-01", amount: -10 },
      { date: "2024-11-02", amount: -10 },
      { date: "2025-01-15", amount: -10 },
    ];
    expect(yearsInData(tx, today)).toEqual([2026, 2025, 2024]);
  });

  it("ignores rows with missing/blank dates", () => {
    const tx = [{ date: "", amount: -10 }, { amount: -10 }, { date: "2023-05-01", amount: -10 }];
    expect(yearsInData(tx, today)).toEqual([2026, 2023]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — `yearsInData`/`monthsOfYear` are not exported.

- [ ] **Step 5: Implement the helpers**

Append to `frontend/src/lib/aggregate.js`:

```js
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/src/lib/aggregate.js frontend/src/lib/aggregate.test.js
git commit -m "test: add vitest + year/month aggregate helpers"
```

---

## Task 2: Chart-series helpers

**Files:**
- Modify: `frontend/src/lib/aggregate.js`
- Test: `frontend/src/lib/aggregate.test.js`

**Interfaces:**
- Consumes: `monthsOfYear` (Task 1), existing `monthlyTotals`.
- Produces:
  - `incomeSpendByMonth(transactions, year) -> {month, spending, income, net}[]` — 12 entries Jan→Dec for the year.
  - `categoryMonthlySeries(transactions, year, category) -> {month, amount}[]` — 12 entries of expense spend (positive numbers) for one category; null category falls back to `"Others"`.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/lib/aggregate.test.js`:

```js
import { incomeSpendByMonth, categoryMonthlySeries } from "./aggregate";

describe("incomeSpendByMonth", () => {
  const tx = [
    { date: "2025-01-10", amount: 1000 },   // income Jan
    { date: "2025-01-12", amount: -400 },    // spend Jan
    { date: "2025-03-05", amount: -250 },    // spend Mar
    { date: "2024-12-31", amount: -999 },    // other year, ignored
  ];

  it("returns 12 entries with income/spending/net per month", () => {
    const rows = incomeSpendByMonth(tx, 2025);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({ month: "2025-01", spending: 400, income: 1000, net: 600 });
    expect(rows[2]).toEqual({ month: "2025-03", spending: 250, income: 0, net: -250 });
    expect(rows[1]).toEqual({ month: "2025-02", spending: 0, income: 0, net: 0 });
  });
});

describe("categoryMonthlySeries", () => {
  const tx = [
    { date: "2025-01-10", amount: -60, category: "Groceries" },
    { date: "2025-01-22", amount: -40, category: "Groceries" },
    { date: "2025-02-03", amount: -30, category: "Groceries" },
    { date: "2025-02-03", amount: -99, category: "Transport" },
    { date: "2025-04-01", amount: 500, category: "Groceries" }, // income ignored
    { date: "2025-05-01", amount: -25, category: null },          // -> Others
  ];

  it("sums only expenses for the requested category, 12 entries", () => {
    const series = categoryMonthlySeries(tx, 2025, "Groceries");
    expect(series).toHaveLength(12);
    expect(series[0]).toEqual({ month: "2025-01", amount: 100 });
    expect(series[1]).toEqual({ month: "2025-02", amount: 30 });
    expect(series[3]).toEqual({ month: "2025-04", amount: 0 }); // income excluded
  });

  it("routes null category to Others", () => {
    const series = categoryMonthlySeries(tx, 2025, "Others");
    expect(series[4]).toEqual({ month: "2025-05", amount: 25 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — `incomeSpendByMonth`/`categoryMonthlySeries` not exported.

- [ ] **Step 3: Implement the helpers**

Append to `frontend/src/lib/aggregate.js`:

```js
// 12-entry income/spending/net series for a calendar year (Jan first).
export function incomeSpendByMonth(transactions, year) {
  return monthlyTotals(transactions, monthsOfYear(year)).map((r) => ({
    ...r,
    net: r.income - r.spending,
  }));
}

// 12-entry expense-spend series (positive amounts) for one category across a
// year. Transactions with no category are bucketed under "Others".
export function categoryMonthlySeries(transactions, year, category) {
  const months = monthsOfYear(year);
  const acc = Object.fromEntries(months.map((m) => [m, 0]));
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const key = String(t.date || "").slice(0, 7);
    if (!(key in acc)) continue;
    if ((t.category || "Others") !== category) continue;
    acc[key] += -t.amount;
  }
  return months.map((m) => ({ month: m, amount: acc[m] }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS (all tests, including Task 1).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/aggregate.js frontend/src/lib/aggregate.test.js
git commit -m "feat: add income/spend and category monthly series helpers"
```

---

## Task 3: Budget helpers

**Files:**
- Modify: `frontend/src/lib/aggregate.js`
- Test: `frontend/src/lib/aggregate.test.js`

**Interfaces:**
- Consumes: `categoryMonthlySeries` (Task 2).
- Produces:
  - `categoryYearStats(transactions, year, category) -> {months: number[], average: number}` — `months` is the 12 amounts; `average` is the mean over months with spend > 0 (0 when none).
  - `budgetStatus(avgSpend, budget) -> "on" | "watch" | "over"`.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/lib/aggregate.test.js`:

```js
import { categoryYearStats, budgetStatus } from "./aggregate";

describe("categoryYearStats", () => {
  const tx = [
    { date: "2025-01-10", amount: -100, category: "Groceries" },
    { date: "2025-02-10", amount: -300, category: "Groceries" },
  ];

  it("returns 12 month amounts and averages over months with spend", () => {
    const { months, average } = categoryYearStats(tx, 2025, "Groceries");
    expect(months).toHaveLength(12);
    expect(months[0]).toBe(100);
    expect(months[1]).toBe(300);
    expect(average).toBe(200); // (100+300)/2, zero months excluded
  });

  it("averages to 0 when there is no spend", () => {
    expect(categoryYearStats(tx, 2025, "Travel").average).toBe(0);
  });
});

describe("budgetStatus", () => {
  it("is on track when avg < 80% of budget", () => {
    expect(budgetStatus(700, 1000)).toBe("on");
  });
  it("is watch when avg is 80%..100% of budget", () => {
    expect(budgetStatus(800, 1000)).toBe("watch");
    expect(budgetStatus(1000, 1000)).toBe("watch");
  });
  it("is over when avg exceeds budget", () => {
    expect(budgetStatus(1001, 1000)).toBe("over");
  });
  it("is on track when budget is unset/zero", () => {
    expect(budgetStatus(500, 0)).toBe("on");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — `categoryYearStats`/`budgetStatus` not exported.

- [ ] **Step 3: Implement the helpers**

Append to `frontend/src/lib/aggregate.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/aggregate.js frontend/src/lib/aggregate.test.js
git commit -m "feat: add budget year-stats and status helpers"
```

---

## Task 4: Spending container, tab bar, Overview + Insights tabs

**Files:**
- Modify: `frontend/src/pages/Spending.jsx`
- Create: `frontend/src/pages/Spending/Overview.jsx`
- Create: `frontend/src/pages/Spending/Insights.jsx`
- Create: `frontend/src/pages/Spending/MonthVsMonth.jsx` (placeholder; filled in Task 5)
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `yearsInData` (Task 1); existing client + format/category helpers.
- Produces:
  - `Spending` (default) — fetches `transactions` + `categories` once, renders tab bar + active tab, passes `transactions`, `categories`, `onChanged` to Overview.
  - `Overview({ transactions, categories, onChanged })` (default).
  - `Insights()` (default).
  - `MonthVsMonth({ transactions })` (default; placeholder this task).

- [ ] **Step 1: Add tab-bar and month-button styles**

Append to `frontend/src/index.css`:

```css
/* Spending tab bar */
.tabbar { display: flex; gap: 4px; border-bottom: 1px solid var(--line, #e6e6e6); margin-bottom: 18px; }
.tab { appearance: none; border: none; background: transparent; padding: 10px 14px; font-size: 14px; font-weight: 600; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; }
.tab:hover { color: var(--ink); }
.tab.is-active { color: var(--teal-ink); border-bottom-color: var(--teal); }

/* Month selector buttons */
.month-btns { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.month-btn { appearance: none; border: 1px solid var(--line, #e6e6e6); background: #fff; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer; }
.month-btn:hover { background: var(--teal-soft); }
.month-btn.is-active { background: var(--teal); border-color: var(--teal); color: #fff; }
```

- [ ] **Step 2: Create the Insights placeholder**

Create `frontend/src/pages/Spending/Insights.jsx`:

```jsx
export default function Insights() {
  return (
    <section className="card">
      <div className="card-head">
        <div className="card-title">Insights</div>
        <span className="pill" style={{ marginLeft: "auto" }}>Soon</span>
      </div>
      <div className="empty">Insights are coming soon.</div>
    </section>
  );
}
```

- [ ] **Step 3: Create the MonthVsMonth placeholder**

Create `frontend/src/pages/Spending/MonthVsMonth.jsx` (replaced in Task 5; placeholder keeps the container runnable):

```jsx
export default function MonthVsMonth({ transactions }) {
  return (
    <section className="card">
      <div className="card-head"><div className="card-title">Month vs Month</div></div>
      <div className="empty">Coming in the next step ({transactions.length} transactions loaded).</div>
    </section>
  );
}
```

- [ ] **Step 4: Create the Overview tab**

Create `frontend/src/pages/Spending/Overview.jsx`. This is the current Spending content, minus the 6-month bars, with a month-button selector and the empty-month message. It receives all transactions and filters by the selected month client-side; mutations call the API then `onChanged()` to refresh the shared dataset.

```jsx
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  createTransaction, updateTransaction, deleteTransaction,
} from "../../api/client";
import { money, signed, currentMonth, monthLabel, colorFor, donutGradient } from "../../lib/format";
import { emojiFor } from "../../lib/categories";
import { yearsInData } from "../../lib/aggregate";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "paynow", label: "PayNow" },
  { value: "paylah", label: "PayLah" },
  { value: "card", label: "Card" },
  { value: "giro", label: "GIRO" },
];
const METHOD_LABELS = Object.fromEntries(METHODS.map((m) => [m.value, m.label]));
const methodLabel = (s) => METHOD_LABELS[s] || s;

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  item: "",
  amount: "",
  category: "",
  source: "cash",
};

export default function Overview({ transactions, categories, onChanged }) {
  const [year, setYear] = useState(currentMonth().slice(0, 4));
  const [monthNum, setMonthNum] = useState(currentMonth().slice(5, 7));
  const month = `${year}-${monthNum}`;

  const [catFilter, setCatFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [menuFor, setMenuFor] = useState(null);

  const years = useMemo(() => yearsInData(transactions), [transactions]);

  // Transactions for the selected month (backend returns date-desc overall).
  const monthTx = useMemo(
    () => transactions.filter((t) => String(t.date || "").slice(0, 7) === month),
    [transactions, month],
  );

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuFor]);

  const filtered = useMemo(() => (
    catFilter === "all"
      ? monthTx
      : monthTx.filter((t) => (t.category || "Uncategorized") === catFilter)
  ), [monthTx, catFilter]);

  const totalSpend = filtered.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const totalIncome = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalSpend;
  const avg = filtered.length
    ? filtered.reduce((s, t) => s + Math.abs(t.amount), 0) / filtered.length
    : 0;

  const catRows = useMemo(() => {
    const by = {};
    monthTx.filter((t) => t.amount < 0).forEach((t) => {
      const name = t.category || "Uncategorized";
      by[name] = (by[name] || 0) + (-t.amount);
    });
    const sorted = Object.entries(by).sort((a, b) => b[1] - a[1]);
    return sorted.map(([name, value], i) => ({ name, value, color: colorFor(i) }));
  }, [monthTx]);
  const breakdownSpend = catRows.reduce((s, c) => s + c.value, 0);

  const groups = useMemo(() => {
    const order = [];
    const map = {};
    filtered.forEach((t) => {
      if (!map[t.date]) { map[t.date] = []; order.push(t.date); }
      map[t.date].push(t);
    });
    return order.map((date) => ({ date, items: map[date] }));
  }, [filtered]);

  function resetForm() {
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setAdding(false);
    setEditingId(null);
    setSubmitError("");
  }
  function openAdd() {
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
    setSubmitError("");
    setAdding(true);
  }
  function closeTransactionModal() {
    if (saving) return;
    resetForm();
  }
  function startEdit(t) {
    setForm({
      date: String(t.date || "").slice(0, 10),
      item: t.item || "",
      amount: t.amount == null ? "" : String(t.amount),
      category: t.category || "",
      source: t.source || "cash",
    });
    setEditingId(t.id);
    setSubmitError("");
    setAdding(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSubmitError("");
    try {
      const payload = {
        date: form.date,
        item: form.item,
        amount: Number(form.amount),
        category: form.category || null,
        source: form.source || null,
      };
      if (editingId !== null) {
        await updateTransaction(editingId, payload);
      } else {
        await createTransaction(payload);
      }
      resetForm();
      onChanged();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setSubmitError(typeof detail === "string" ? detail : "Unable to save transaction. Check the API connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (window.confirm("Delete this transaction?")) {
      await deleteTransaction(id);
      onChanged();
    }
  }

  function downloadCsv() {
    const head = ["date", "item", "category", "amount", "source"];
    const rows = filtered.map((t) =>
      [t.date, t.item, t.category || "", t.amount, t.source || ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([[head.join(","), ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spending-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Month selector */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div className="month-btns">
          {MONTH_ABBR.map((m, i) => {
            const mm = String(i + 1).padStart(2, "0");
            return (
              <button
                key={mm}
                type="button"
                className={`month-btn${mm === monthNum ? " is-active" : ""}`}
                onClick={() => setMonthNum(mm)}
              >
                {m}
              </button>
            );
          })}
          <select
            className="select"
            style={{ width: "auto", marginLeft: 8 }}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <span className="field-label">Category</span>
            <select className="select" style={{ width: "auto" }} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              <option value="Uncategorized">Uncategorized</option>
            </select>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={downloadCsv}>⤓ Download CSV</button>
            <button type="button" className="btn btn-primary" onClick={openAdd}>+ New transaction</button>
          </div>
        </div>
      </div>

      {adding && createPortal(
        <div className="modal-backdrop" role="presentation" onMouseDown={closeTransactionModal}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div id="transaction-modal-title" className="modal-title">
                  {editingId ? "Edit transaction" : "New transaction"}
                </div>
                <div className="modal-sub">
                  {editingId ? "Update the transaction details and save your changes." : "Enter the transaction details and save it."}
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={closeTransactionModal} disabled={saving}>x</button>
            </div>
            <form onSubmit={handleSubmit}>
              {submitError && <div className="form-error" role="alert">{submitError}</div>}
              <div className="form-grid modal-form-grid">
                <div className="field">
                  <label className="field-label">Date</label>
                  <input className="input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">Item</label>
                  <input className="input" type="text" required placeholder="Coffee, Salary..." value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">Amount</label>
                  <input className="input" type="number" step="0.01" required placeholder="-50 or +1000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">Category</label>
                  <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">None</option>
                    {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Method</label>
                  <select className="select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                    {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeTransactionModal} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save changes" : "Save transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {monthTx.length === 0 ? (
        <section className="card">
          <div className="empty">No transactions in this month.</div>
        </section>
      ) : (
        <>
          {/* Summary */}
          <div className="grid-4">
            <div className="stat">
              <div className="stat-label">Total Spending</div>
              <div className="stat-value neg">{money(totalSpend)}</div>
              <div className="stat-note">{monthLabel(month)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Total Income</div>
              <div className="stat-value pos">{money(totalIncome)}</div>
              <div className="stat-note">{monthLabel(month)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Net Cash Flow</div>
              <div className="stat-value">{signed(net)}</div>
              <div className="stat-note">Income − spending</div>
            </div>
            <div className="stat accent">
              <div className="stat-label">Transactions</div>
              <div className="stat-value">{filtered.length}</div>
              <div className="stat-note">Avg {money(avg)} each</div>
            </div>
          </div>

          {/* Spending by category */}
          <section className="card">
            <div className="card-head"><div className="card-title">Spending by Category</div></div>
            {catRows.length === 0 ? (
              <div className="empty">No spending for this selection.</div>
            ) : (
              <div className="grid-cols">
                <table className="tbl">
                  <thead>
                    <tr><th>Category</th><th className="num">Spent</th><th className="num">Share</th></tr>
                  </thead>
                  <tbody>
                    {catRows.map((c) => {
                      const active = catFilter === c.name;
                      const toggle = () => setCatFilter(active ? "all" : c.name);
                      return (
                        <tr key={c.name} className={`cat-row${active ? " is-active" : ""}`} role="button" tabIndex={0} aria-pressed={active} onClick={toggle}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
                          <td>
                            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span className="legend-dot" style={{ width: 10, height: 10, background: c.color }} />
                              <b style={{ fontWeight: 600 }}>{c.name}</b>
                            </span>
                          </td>
                          <td className="num" style={{ fontWeight: 700 }}>{money(c.value)}</td>
                          <td className="num" style={{ color: "var(--muted)" }}>{breakdownSpend ? Math.round((c.value / breakdownSpend) * 100) : 0}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="donut" style={{ width: 200, height: 200 }}>
                    <div className="donut-ring" style={{ width: 200, height: 200, background: donutGradient(catRows) }} />
                    <div className="donut-hole" style={{ inset: 38 }}>
                      <div style={{ fontSize: 12, color: "var(--muted-2)" }}>Total spending</div>
                      <div style={{ fontSize: 26, fontWeight: 800 }}>{money(breakdownSpend).replace(/\.\d+$/, "")}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Transactions by date */}
          <section className="card">
            <div className="card-head">
              <div className="card-title">Transactions by Date</div>
              <span className="pill" style={{ marginLeft: "auto" }}>{monthLabel(month)} · {catFilter === "all" ? "All categories" : catFilter}</span>
            </div>
            {groups.length === 0 ? (
              <div className="empty">No transactions. Add one with “+ New transaction”.</div>
            ) : (
              groups.map((g) => (
                <div key={g.date}>
                  <div className="date-label">{g.date}</div>
                  {g.items.map((t) => {
                    const income = t.amount > 0;
                    return (
                      <div className="row" key={t.id}>
                        <div className="row-ico" style={{ background: income ? "var(--green-soft)" : "var(--teal-soft)" }}>
                          {emojiFor(t.category)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="row-name">{t.item}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                            {t.category && <span className="chip">{t.category}</span>}
                            {t.source && <span className="row-sub">· {methodLabel(t.source)}</span>}
                          </div>
                        </div>
                        <div className="row-name" style={{ width: 110, textAlign: "right", color: income ? "var(--green)" : "var(--ink)" }}>
                          {signed(t.amount)}
                        </div>
                        <div className="dd" style={{ flex: "none" }}>
                          <button className="btn btn-ghost btn-icon" aria-label="Transaction actions" onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === t.id ? null : t.id); }}>⋯</button>
                          {menuFor === t.id && (
                            <div className="dd-menu" style={{ top: 38, minWidth: 140 }}>
                              <div className="dd-item" onClick={(e) => { e.stopPropagation(); setMenuFor(null); startEdit(t); }}>✎ Edit</div>
                              <div className="dd-item" onClick={(e) => { e.stopPropagation(); setMenuFor(null); handleDelete(t.id); }}>✕ Delete</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 5: Rewrite Spending.jsx as the container**

Replace the entire contents of `frontend/src/pages/Spending.jsx`:

```jsx
import { useCallback, useEffect, useState } from "react";
import { getTransactions, getCategories } from "../api/client";
import Overview from "./Spending/Overview";
import MonthVsMonth from "./Spending/MonthVsMonth";
import Insights from "./Spending/Insights";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "month", label: "Month vs Month" },
  { id: "insights", label: "Insights" },
];

export default function Spending() {
  const [tab, setTab] = useState("overview");
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);

  const reload = useCallback(() => {
    getTransactions().then(setTransactions).catch(() => setTransactions([]));
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);

  return (
    <>
      <div className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Overview transactions={transactions} categories={categories} onChanged={reload} />
      )}
      {tab === "month" && <MonthVsMonth transactions={transactions} />}
      {tab === "insights" && <Insights />}
    </>
  );
}
```

- [ ] **Step 6: Verify build and lint-clean compile**

Run: `cd frontend && npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 7: Manual verification**

Run: `cd frontend && npm run dev`, open `http://localhost:5173/spending`.
Expected: Three tabs visible. Overview shows month buttons + year dropdown; selecting a month with data shows stats/donut/list (same as before); selecting a month with no data shows "No transactions in this month."; + New transaction / edit / delete still work and refresh the list. Insights shows the "Soon" pill. Month vs Month shows the placeholder.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/Spending.jsx frontend/src/pages/Spending/ frontend/src/index.css
git commit -m "feat(spending): tabbed page with Overview + Insights"
```

---

## Task 5: Month vs Month tab with lazy Recharts charts

**Files:**
- Create: `frontend/src/components/IncomeSpendBars.jsx`
- Create: `frontend/src/components/CategoryLine.jsx`
- Modify: `frontend/src/pages/Spending/MonthVsMonth.jsx`

**Interfaces:**
- Consumes: `yearsInData`, `incomeSpendByMonth`, `categoryMonthlySeries` (Tasks 1–2); `CATEGORIES`; `money`/`signed`.
- Produces:
  - `IncomeSpendBars({ data })` (default) — `data` is `incomeSpendByMonth` output.
  - `CategoryLine({ data })` (default) — `data` is `categoryMonthlySeries` output.

- [ ] **Step 1: Create the income-vs-spend bar chart**

Create `frontend/src/components/IncomeSpendBars.jsx`:

```jsx
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { money } from "../lib/format";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function IncomeSpendBars({ data }) {
  const chartData = data.map((d, i) => ({
    name: MONTH_ABBR[i],
    Income: d.income,
    Spent: d.spending,
  }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => money(v).replace(/\.\d+$/, "")} />
        <Tooltip formatter={(v) => money(v)} />
        <Legend />
        <Bar dataKey="Income" fill="#138a4a" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Spent" fill="#e0533d" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Create the category line chart**

Create `frontend/src/components/CategoryLine.jsx`:

```jsx
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { money } from "../lib/format";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function CategoryLine({ data }) {
  const chartData = data.map((d, i) => ({ name: MONTH_ABBR[i], amount: d.amount }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => money(v).replace(/\.\d+$/, "")} />
        <Tooltip formatter={(v) => money(v)} />
        <Line type="monotone" dataKey="amount" stroke="#138a86" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Implement the Month vs Month tab**

Replace the entire contents of `frontend/src/pages/Spending/MonthVsMonth.jsx`:

```jsx
import { lazy, Suspense, useMemo, useState } from "react";
import { yearsInData, incomeSpendByMonth, categoryMonthlySeries } from "../../lib/aggregate";
import { CATEGORIES } from "../../lib/categories";
import { signed } from "../../lib/format";

const IncomeSpendBars = lazy(() => import("../../components/IncomeSpendBars"));
const CategoryLine = lazy(() => import("../../components/CategoryLine"));

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MonthVsMonth({ transactions }) {
  const years = useMemo(() => yearsInData(transactions), [transactions]);
  const [year, setYear] = useState(String(years[0]));
  const [category, setCategory] = useState(CATEGORIES[0]);

  const barData = useMemo(() => incomeSpendByMonth(transactions, Number(year)), [transactions, year]);
  const lineData = useMemo(
    () => categoryMonthlySeries(transactions, Number(year), category),
    [transactions, year, category],
  );

  return (
    <>
      <div className="card" style={{ padding: "16px 20px" }}>
        <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <span className="field-label">Year</span>
          <select className="select" style={{ width: "auto" }} value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </div>
      </div>

      <section className="card">
        <div className="card-head"><div className="card-title">Income vs Spend</div></div>
        <Suspense fallback={<div className="empty">Loading chart…</div>}>
          <IncomeSpendBars data={barData} />
        </Suspense>
        <div className="grid-4" style={{ marginTop: 16 }}>
          {barData.map((d, i) => (
            <div className="stat" key={d.month}>
              <div className="stat-label">{MONTH_ABBR[i]}</div>
              <div className="stat-value" style={{ fontSize: 18, color: d.net >= 0 ? "var(--green)" : "var(--red)" }}>
                {signed(d.net)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title">Spending by Category</div>
          <select className="select" style={{ width: "auto", marginLeft: "auto" }} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <Suspense fallback={<div className="empty">Loading chart…</div>}>
          <CategoryLine data={lineData} />
        </Suspense>
      </section>
    </>
  );
}
```

- [ ] **Step 4: Verify build (and that Recharts splits into its own chunk)**

Run: `cd frontend && npm run build`
Expected: build succeeds; output lists a separate chunk for the chart components (Recharts is not in the main entry chunk).

- [ ] **Step 5: Manual verification**

Run: `cd frontend && npm run dev`, open the Month vs Month tab.
Expected: Year dropdown switches data; income vs spend bars render with hover tooltips and per-month net cards below; the category dropdown swaps the single line; hovering the line shows a value tooltip; switching tabs back and forth keeps working.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/IncomeSpendBars.jsx frontend/src/components/CategoryLine.jsx frontend/src/pages/Spending/MonthVsMonth.jsx
git commit -m "feat(spending): Month vs Month tab with lazy recharts"
```

---

## Task 6: Budget redesign

**Files:**
- Modify: `frontend/src/pages/Budget.jsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `yearsInData`, `categoryYearStats`, `budgetStatus` (Tasks 1, 3); `CATEGORIES`, `emojiFor`; `money`; existing `getBudgets`, `upsertBudget`, `getTransactions`.
- Produces: redesigned `Budget` (default).

- [ ] **Step 1: Add amber vars, status-badge and table-scroll styles**

In `frontend/src/index.css`, add the amber vars next to the existing `--red`/`--green` declarations (inside the same `:root` block):

```css
  --amber: #c98a1b;
  --amber-soft: #fbf1dd;
```

Then append:

```css
/* Budget status badges */
.status-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.status-on { background: var(--green-soft); color: var(--green); }
.status-watch { background: var(--amber-soft); color: var(--amber); }
.status-over { background: var(--red-soft); color: var(--red); }

/* Wide budget table */
.table-scroll { overflow-x: auto; }
.budget-tbl { width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap; }
.budget-tbl th, .budget-tbl td { padding: 8px 10px; text-align: right; border-bottom: 1px solid var(--line, #eee); }
.budget-tbl th:first-child, .budget-tbl td:first-child { text-align: left; position: sticky; left: 0; background: #fff; }
.budget-tbl .over-cell { color: var(--red); font-weight: 700; }
```

- [ ] **Step 2: Rewrite Budget.jsx**

Replace the entire contents of `frontend/src/pages/Budget.jsx`:

```jsx
import { useEffect, useMemo, useState } from "react";
import { getBudgets, upsertBudget, getTransactions } from "../api/client";
import { CATEGORIES, emojiFor } from "../lib/categories";
import { money } from "../lib/format";
import { yearsInData, categoryYearStats, budgetStatus } from "../lib/aggregate";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATUS_META = {
  on: { label: "On track", cls: "status-on" },
  watch: { label: "Watch", cls: "status-watch" },
  over: { label: "Over", cls: "status-over" },
};

export default function Budget() {
  const [budgets, setBudgets] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingCat, setSavingCat] = useState(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    getBudgets()
      .then((rows) => setBudgets(Object.fromEntries(rows.map((b) => [b.category, b.amount]))))
      .catch(() => setBudgets({}));
  }, []);
  useEffect(() => {
    getTransactions().then(setTransactions).catch(() => setTransactions([]));
  }, []);

  const years = useMemo(() => yearsInData(transactions), [transactions]);

  const rows = useMemo(() => CATEGORIES.map((cat) => {
    const { months, average } = categoryYearStats(transactions, Number(year), cat);
    const budget = budgets[cat] || 0;
    return { cat, months, average, budget, status: budgetStatus(average, budget) };
  }), [transactions, year, budgets]);

  const counts = useMemo(
    () => rows.reduce((acc, r) => { acc[r.status] += 1; return acc; }, { on: 0, watch: 0, over: 0 }),
    [rows],
  );

  async function save(category) {
    const raw = drafts[category];
    const amount = Number(raw);
    if (raw === undefined || Number.isNaN(amount) || amount < 0) return;
    setSavingCat(category);
    try {
      await upsertBudget(category, amount);
      setBudgets((b) => ({ ...b, [category]: amount }));
      setDrafts((d) => { const next = { ...d }; delete next[category]; return next; });
    } finally {
      setSavingCat(null);
    }
  }

  return (
    <>
      <div className="grid-4">
        <div className="stat">
          <div className="stat-label">On track</div>
          <div className="stat-value pos">{counts.on}</div>
          <div className="stat-note">avg under 80% of budget</div>
        </div>
        <div className="stat">
          <div className="stat-label">Watch</div>
          <div className="stat-value" style={{ color: "var(--amber)" }}>{counts.watch}</div>
          <div className="stat-note">avg 80–100% of budget</div>
        </div>
        <div className="stat">
          <div className="stat-label">Over</div>
          <div className="stat-value neg">{counts.over}</div>
          <div className="stat-note">avg above budget</div>
        </div>
        <div className="stat accent">
          <div className="stat-label">Year</div>
          <div style={{ marginTop: 6 }}>
            <select className="select" style={{ width: "auto" }} value={year} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "12px 20px", display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <span className="status-badge status-on">On track</span><span className="row-sub">avg &lt; 80% of budget</span>
        <span className="status-badge status-watch">Watch</span><span className="row-sub">avg 80–100% of budget</span>
        <span className="status-badge status-over">Over</span><span className="row-sub">avg &gt; budget</span>
      </div>

      <section className="card">
        <div className="card-head"><div className="card-title">Budget by Category — {year}</div></div>
        <div className="table-scroll">
          <table className="budget-tbl">
            <thead>
              <tr>
                <th>Category</th>
                {MONTH_ABBR.map((m) => <th key={m}>{m}</th>)}
                <th>Average</th>
                <th>Budget /mo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const draft = drafts[r.cat];
                const value = draft !== undefined ? draft : (r.budget ? String(r.budget) : "");
                const meta = STATUS_META[r.status];
                return (
                  <tr key={r.cat}>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{emojiFor(r.cat)} <b style={{ fontWeight: 600 }}>{r.cat}</b></span></td>
                    {r.months.map((amt, i) => (
                      <td key={i} className={r.budget > 0 && amt > r.budget ? "over-cell" : undefined}>
                        {amt ? money(amt).replace(/\.\d+$/, "") : "—"}
                      </td>
                    ))}
                    <td style={{ fontWeight: 700 }}>{r.average ? money(r.average).replace(/\.\d+$/, "") : "—"}</td>
                    <td>
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <input
                          className="input"
                          type="number"
                          step="1"
                          min="0"
                          placeholder="0"
                          style={{ width: 90 }}
                          value={value}
                          onChange={(e) => setDrafts((d) => ({ ...d, [r.cat]: e.target.value }))}
                        />
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => save(r.cat)} disabled={savingCat === r.cat || draft === undefined}>
                          {savingCat === r.cat ? "…" : "Save"}
                        </button>
                      </span>
                    </td>
                    <td><span className={`status-badge ${meta.cls}`}>{meta.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification**

Run: `cd frontend && npm run dev`, open `http://localhost:5173/budget`.
Expected: On track / Watch / Over counts at top + a legend row; year dropdown switches the table; each category row shows Jan–Dec spend (— for empty months), Average, an editable Budget /mo box that still saves, and a Status badge whose color follows average vs budget; cells over budget are red; the table scrolls horizontally on narrow screens.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Budget.jsx frontend/src/index.css
git commit -m "feat(budget): year-based month-by-month table with status"
```

---

## Self-Review Notes

- **Spec coverage:** Overview tab w/ month buttons + year dropdown + empty-month message (Task 4); 6-month bars removed (Task 4); Month vs Month income-vs-spend bars + net labels + single-category line w/ dropdown, lazy Recharts (Tasks 2, 5); Insights "Soon" (Task 4); Budget year selector + ON TRACK/WATCH/OVER counts + legend + month table + average + editable budget + status via average-vs-budget (Tasks 3, 6). Data fetched once in container (Task 4). All covered.
- **Placeholders:** none — all code is complete; the Task 4 MonthVsMonth placeholder is intentional and fully replaced in Task 5.
- **Type consistency:** helper names/signatures (`yearsInData`, `monthsOfYear`, `incomeSpendByMonth`, `categoryMonthlySeries`, `categoryYearStats`, `budgetStatus`) are used identically across producing and consuming tasks; chart components consume the exact helper output shapes.
