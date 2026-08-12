import { describe, it, expect } from "vitest";
import {
  categoryDeltas,
  spendingPace,
  biggestTransaction,
  budgetsClosestToTipping,
  subscriptionCreep,
  weekdayWeekendSplit,
} from "./insights";

describe("categoryDeltas", () => {
  const today = new Date(2026, 7, 15); // August 15, 2026

  it("ranks categories by absolute dollar change, flags new categories", () => {
    const transactions = [
      { date: "2026-08-02", amount: -50, category: "Food" },
      { date: "2026-08-10", amount: -30, category: "Food" },
      { date: "2026-08-05", amount: -40, category: "Transport" },
      { date: "2026-08-06", amount: -10, category: "Shopping" },
      { date: "2026-07-02", amount: -50, category: "Food" },
      { date: "2026-07-03", amount: -100, category: "Shopping" },
    ];

    expect(categoryDeltas(transactions, today)).toEqual([
      { category: "Shopping", current: 10, previous: 100, deltaAmount: -90, deltaPct: -90, isNew: false },
      { category: "Transport", current: 40, previous: 0, deltaAmount: 40, deltaPct: null, isNew: true },
      { category: "Food", current: 80, previous: 50, deltaAmount: 30, deltaPct: 60, isNew: false },
    ]);
  });

  it("limits results to the top 5 by absolute dollar change", () => {
    const cats = ["A", "B", "C", "D", "E", "F"];
    const transactions = cats.map((c, i) => ({
      date: "2026-08-05", amount: -(i + 1) * 10, category: c,
    }));
    expect(categoryDeltas(transactions, today)).toHaveLength(5);
  });

  it("buckets missing category under Uncategorized", () => {
    const transactions = [{ date: "2026-08-05", amount: -20, category: null }];
    expect(categoryDeltas(transactions, today)[0].category).toBe("Uncategorized");
  });
});

describe("spendingPace", () => {
  it("compares this month's cumulative spend to the trailing average through the same day", () => {
    const today = new Date(2026, 7, 15); // August 15
    const transactions = [
      { date: "2026-08-01", amount: -20 },
      { date: "2026-08-10", amount: -30 },
      { date: "2026-08-20", amount: -100 }, // after today, excluded
      { date: "2026-07-05", amount: -10 },
      { date: "2026-07-14", amount: -20 },
      { date: "2026-06-15", amount: -60 },
      { date: "2026-05-01", amount: -15 },
    ];
    const result = spendingPace(transactions, today, 3);
    expect(result.currentCumulative).toBe(50);
    expect(result.avgHistoricalCumulative).toBe(35);
    expect(result.paceRatio).toBeCloseTo(50 / 35, 5);
  });

  it("excludes lookback months shorter than today's day-of-month", () => {
    const today = new Date(2026, 2, 30); // March 30 (Feb 2026 has only 28 days)
    const transactions = [
      { date: "2026-02-15", amount: -1000 },
      { date: "2026-01-30", amount: -20 },
      { date: "2025-12-30", amount: -40 },
      { date: "2026-03-30", amount: -10 },
    ];
    expect(spendingPace(transactions, today, 3).avgHistoricalCumulative).toBe(30);
  });

  it("returns null when no lookback month has at least today's day-of-month", () => {
    const today = new Date(2026, 2, 30); // March 30; Feb 2026 has only 28 days
    const transactions = [{ date: "2026-03-30", amount: -20 }];
    expect(spendingPace(transactions, today, 1)).toBeNull();
  });
});

describe("biggestTransaction", () => {
  const today = new Date(2026, 7, 15);

  it("returns the largest expense this month", () => {
    const transactions = [
      { date: "2026-08-02", amount: -50, item: "Groceries", category: "Food" },
      { date: "2026-08-06", amount: -200, item: "New Shoes", category: "Shopping" },
      { date: "2026-08-07", amount: 1000, item: "Salary", category: "Income" },
      { date: "2026-07-01", amount: -500, item: "Old month", category: "Shopping" },
    ];
    expect(biggestTransaction(transactions, today)).toEqual({
      item: "New Shoes", category: "Shopping", amount: -200, date: "2026-08-06",
    });
  });

  it("returns null when there are no expenses this month", () => {
    expect(biggestTransaction([{ date: "2026-08-01", amount: 100, item: "Salary" }], today)).toBeNull();
  });
});

describe("budgetsClosestToTipping", () => {
  const today = new Date(2026, 7, 15);
  const budgets = [
    { category: "Food", amount: 100 },
    { category: "Transport", amount: 50 },
  ];

  it("ranks budgeted categories by percent of budget consumed, top N", () => {
    const transactions = [
      { date: "2026-08-05", amount: -90, category: "Food" },
      { date: "2026-08-06", amount: -60, category: "Transport" },
      { date: "2026-08-07", amount: -20, category: "Entertainment" }, // no budget, excluded
    ];
    expect(budgetsClosestToTipping(transactions, budgets, today, 3)).toEqual([
      { category: "Transport", spend: 60, budget: 50, status: "over", pctUsed: 120 },
      { category: "Food", spend: 90, budget: 100, status: "watch", pctUsed: 90 },
    ]);
  });
});

describe("subscriptionCreep", () => {
  const today = new Date(2026, 7, 15); // August 15 -> 3 months ago = May

  it("sums matched bill transactions this month vs 3 months ago", () => {
    const subscriptions = [
      { type: "bill", item: "Netflix", amount: 15 },
      { type: "bill", item: "Spotify", amount: 10 },
      { type: "income", item: "Payroll", amount: 3000 },
    ];
    const transactions = [
      { date: "2026-08-01", amount: -18, item: "NETFLIX" },
      { date: "2026-08-01", amount: -10, item: "Spotify" },
      { date: "2026-05-01", amount: -15, item: "Netflix" },
      { date: "2026-05-01", amount: -10, item: "spotify" },
    ];
    const result = subscriptionCreep(transactions, subscriptions, today);
    expect(result.current).toBe(28);
    expect(result.threeMonthsAgo).toBe(25);
    expect(result.deltaAmount).toBe(3);
    expect(result.deltaPct).toBeCloseTo(12, 5);
  });

  it("returns null when there are no declared bill subscriptions", () => {
    expect(subscriptionCreep([], [{ type: "income", item: "Payroll", amount: 3000 }], today)).toBeNull();
  });
});

describe("weekdayWeekendSplit", () => {
  it("returns spend-per-day averages for weekday vs weekend, elapsed days only", () => {
    const today = new Date(2026, 0, 6); // Jan 6, 2026 (Tue) -> Jan 1-6 elapsed
    // Jan 1 Thu, 2 Fri, 3 Sat, 4 Sun, 5 Mon, 6 Tue -> weekday x4, weekend x2
    const transactions = [
      { date: "2026-01-01", amount: -10 },
      { date: "2026-01-02", amount: -10 },
      { date: "2026-01-03", amount: -25 },
      { date: "2026-01-04", amount: -15 },
      { date: "2026-01-05", amount: -10 },
      { date: "2026-01-06", amount: -10 },
    ];
    expect(weekdayWeekendSplit(transactions, today)).toEqual({
      weekdayTotal: 40,
      weekendTotal: 40,
      weekdayAvgPerDay: 10,
      weekendAvgPerDay: 20,
    });
  });
});
