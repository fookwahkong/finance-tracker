import { describe, it, expect } from "vitest";
import {
  yearsInData, monthsOfYear, monthlyTotals, incomeSpendByMonth, categoryMonthlySeries,
  categoryYearStats, budgetStatus,
} from "./aggregate";

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

describe("claim-aware aggregation", () => {
  const tx = [
    { date: "2026-06-01", amount: -100, category: "Groceries" },
    { date: "2026-06-20", amount: 75, category: "Groceries" },
  ];
  const adj = [{ month: "2026-06", category: "Groceries", amount: 75 }];

  it("monthlyTotals subtracts adjustment from spending and income", () => {
    const [row] = monthlyTotals(tx, ["2026-06"], adj);
    expect(row.spending).toBe(25);
    expect(row.income).toBe(0);
  });

  it("monthlyTotals with no adjustments is unchanged", () => {
    const [row] = monthlyTotals(tx, ["2026-06"]);
    expect(row.spending).toBe(100);
    expect(row.income).toBe(75);
  });

  it("categoryMonthlySeries subtracts from the claim's category", () => {
    const series = categoryMonthlySeries(tx, 2026, "Groceries", adj);
    const june = series.find((s) => s.month === "2026-06");
    expect(june.amount).toBe(25);
  });
});