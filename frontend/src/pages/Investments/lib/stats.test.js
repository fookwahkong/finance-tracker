import { describe, it, expect } from "vitest";
import { latestBar, dayChange, buildStatGrid } from "./stats";

const DASH = "—";
const bars = [
  { t: 1, o: 10, h: 12, l: 9, c: 11, v: 1000 },
  { t: 2, o: 11, h: 15, l: 11, c: 14, v: 2000 },
];

describe("dayChange", () => {
  it("computes abs and pct vs previous close", () => {
    const dc = dayChange(bars);
    expect(dc.abs).toBeCloseTo(3);
    expect(dc.pct).toBeCloseTo((3 / 11) * 100);
  });
  it("returns null with fewer than 2 bars", () => {
    expect(dayChange([bars[0]])).toBeNull();
  });
});

describe("latestBar", () => {
  it("returns the last bar", () => {
    expect(latestBar(bars).c).toBe(14);
  });
  it("returns null for empty", () => {
    expect(latestBar([])).toBeNull();
  });
});

describe("buildStatGrid", () => {
  it("renders missing sources as em dash but keeps all 8 rows", () => {
    const grid = buildStatGrid({ bars: [], profile: null, dividends: null });
    expect(grid).toHaveLength(8);
    expect(grid.every((r) => r.value === DASH)).toBe(true);
    expect(grid.map((r) => r.label)).toEqual([
      "Open", "High", "Low", "Volume", "Mkt. cap",
      "Dividend (yield)", "Quarterly dividend", "Ex dividend date",
    ]);
  });

  it("fills OHLCV from the latest bar", () => {
    const grid = buildStatGrid({ bars, profile: null, dividends: null });
    const byLabel = Object.fromEntries(grid.map((r) => [r.label, r.value]));
    expect(byLabel["Open"]).toContain("11");
    expect(byLabel["High"]).toContain("15");
    expect(byLabel["Low"]).toContain("11");
    expect(byLabel["Volume"]).toBe("2,000");
  });

  it("derives dividend yield from cash_amount × frequency ÷ latest close", () => {
    const grid = buildStatGrid({
      bars,
      profile: null,
      dividends: { results: [{ cash_amount: 0.7, frequency: 4, ex_dividend_date: "2026-05-10" }] },
    });
    const byLabel = Object.fromEntries(grid.map((r) => [r.label, r.value]));
    // yield = 0.7*4/14 = 20.0%
    expect(byLabel["Dividend (yield)"]).toBe("20.00%");
    expect(byLabel["Quarterly dividend"]).toContain("0.70");
    expect(byLabel["Ex dividend date"]).toBe("2026-05-10");
  });
});
