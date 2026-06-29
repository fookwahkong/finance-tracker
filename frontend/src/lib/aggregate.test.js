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
