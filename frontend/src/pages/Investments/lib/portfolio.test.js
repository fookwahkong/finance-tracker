import { describe, it, expect } from "vitest";
import { buildPositions, enrichPositions, portfolioTotals, allocations } from "./portfolio";

const tx = (ticker, type, quantity, price, date) => ({
  ticker, type, quantity, price_per_share: price, purchase_date: date,
});

describe("buildPositions", () => {
  it("aggregates buys into shares and cost basis", () => {
    const p = buildPositions([
      tx("AAPL", "BUY", 10, 100, "2026-01-01"),
      tx("AAPL", "BUY", 10, 200, "2026-02-01"),
    ]);
    expect(p).toEqual([{ ticker: "AAPL", shares: 20, costBasis: 3000, avgCost: 150 }]);
  });

  it("sells reduce cost basis at average cost", () => {
    const p = buildPositions([
      tx("AAPL", "BUY", 10, 100, "2026-01-01"),
      tx("AAPL", "BUY", 10, 200, "2026-02-01"),
      tx("AAPL", "SELL", 5, 300, "2026-03-01"),
    ]);
    // avg cost 150 -> sell 5 removes 750 of basis
    expect(p[0].shares).toBe(15);
    expect(p[0].costBasis).toBe(2250);
    expect(p[0].avgCost).toBe(150);
  });

  it("drops fully sold positions", () => {
    const p = buildPositions([
      tx("AAPL", "BUY", 10, 100, "2026-01-01"),
      tx("AAPL", "SELL", 10, 120, "2026-02-01"),
      tx("MSFT", "BUY", 1, 400, "2026-02-01"),
    ]);
    expect(p.map((x) => x.ticker)).toEqual(["MSFT"]);
  });

  it("applies transactions in date order regardless of input order", () => {
    const p = buildPositions([
      tx("AAPL", "SELL", 5, 120, "2026-02-01"),
      tx("AAPL", "BUY", 10, 100, "2026-01-01"),
    ]);
    expect(p[0].shares).toBe(5);
    expect(p[0].costBasis).toBe(500);
  });
});

describe("enrichPositions", () => {
  const pos = [{ ticker: "AAPL", shares: 10, costBasis: 1000, avgCost: 100 }];

  it("computes value, day change, and total return from the quote", () => {
    const [p] = enrichPositions(pos, { AAPL: { c: 150, pc: 140 } });
    expect(p.value).toBe(1500);
    expect(p.dayChange).toBe(100); // (150-140)*10
    expect(p.totalReturn).toBe(500);
  });

  it("returns nulls when the quote is missing", () => {
    const [p] = enrichPositions(pos, {});
    expect(p.price).toBeNull();
    expect(p.value).toBeNull();
    expect(p.dayChange).toBeNull();
    expect(p.totalReturn).toBeNull();
  });
});

describe("portfolioTotals", () => {
  it("sums enriched positions and derives percentages", () => {
    const enriched = enrichPositions(
      [
        { ticker: "AAPL", shares: 10, costBasis: 1000, avgCost: 100 },
        { ticker: "MSFT", shares: 2, costBasis: 700, avgCost: 350 },
      ],
      { AAPL: { c: 150, pc: 140 }, MSFT: { c: 400, pc: 410 } }
    );
    const t = portfolioTotals(enriched);
    expect(t.value).toBe(2300);       // 1500 + 800
    expect(t.costBasis).toBe(1700);
    expect(t.dayChange).toBe(80);     // +100 - 20
    expect(t.totalReturn).toBe(600);
    expect(t.totalReturnPct).toBeCloseTo(35.29, 1);
    expect(t.dayChangePct).toBeCloseTo((80 / 2220) * 100, 2);
    expect(t.complete).toBe(true);
  });

  it("marks totals incomplete when a quote is missing", () => {
    const enriched = enrichPositions(
      [{ ticker: "AAPL", shares: 10, costBasis: 1000, avgCost: 100 }],
      {}
    );
    expect(portfolioTotals(enriched).complete).toBe(false);
  });
});

describe("allocations", () => {
  it("returns percentage of portfolio per holding, largest first", () => {
    const enriched = enrichPositions(
      [
        { ticker: "AAPL", shares: 1, costBasis: 100, avgCost: 100 },
        { ticker: "MSFT", shares: 3, costBasis: 900, avgCost: 300 },
      ],
      { AAPL: { c: 100, pc: 100 }, MSFT: { c: 300, pc: 300 } }
    );
    const a = allocations(enriched);
    expect(a[0]).toEqual({ ticker: "MSFT", value: 900, pct: 90 });
    expect(a[1]).toEqual({ ticker: "AAPL", value: 100, pct: 10 });
  });
});
