import { describe, it, expect } from "vitest";
import { rsi, range52w, peFlag, pegFlag } from "./indicators";

describe("rsi", () => {
  it("returns null with insufficient data", () => {
    expect(rsi([1, 2, 3])).toBeNull();
  });

  it("returns 100 when there are no losses", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(closes)).toBe(100);
  });

  it("returns ~50 for perfectly alternating equal moves", () => {
    const closes = [100];
    for (let i = 0; i < 30; i++) closes.push(closes[closes.length - 1] + (i % 2 === 0 ? 1 : -1));
    const v = rsi(closes);
    expect(v).toBeGreaterThan(45);
    expect(v).toBeLessThan(55);
  });

  it("is low in a steady downtrend", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 200 - i);
    expect(rsi(closes)).toBeLessThan(10);
  });
});

describe("range52w", () => {
  it("positions the last close within the trailing window", () => {
    const bars = [
      ...Array.from({ length: 100 }, () => ({ c: 100 })),
      { c: 50 }, { c: 150 }, { c: 125 },
    ];
    const r = range52w(bars);
    expect(r.low).toBe(50);
    expect(r.high).toBe(150);
    expect(r.position).toBeCloseTo(0.75);
  });

  it("only considers the last 252 bars", () => {
    const bars = [
      { c: 1 }, // older than the 252-bar window
      ...Array.from({ length: 252 }, () => ({ c: 100 })),
    ];
    expect(range52w(bars).low).toBe(100);
  });

  it("returns null for empty input", () => {
    expect(range52w([])).toBeNull();
  });
});

describe("peFlag", () => {
  const r = (pe) => ({ priceToEarningsRatio: pe });

  it("flags when current P/E is 25% above its 5y average", () => {
    // newest first: current 40, avg of all five = 28 -> 40 > 35 -> flagged
    const out = peFlag([r(40), r(30), r(25), r(25), r(20)]);
    expect(out.current).toBe(40);
    expect(out.avg).toBeCloseTo(28);
    expect(out.flagged).toBe(true);
  });

  it("does not flag a P/E near its average", () => {
    const out = peFlag([r(26), r(28), r(25), r(27), r(24)]);
    expect(out.flagged).toBe(false);
  });

  it("returns null when ratios are missing", () => {
    expect(peFlag([])).toBeNull();
    expect(peFlag(null)).toBeNull();
  });

  it("accepts the legacy field name", () => {
    const out = peFlag([{ priceEarningsRatio: 30 }, { priceEarningsRatio: 30 }]);
    expect(out.current).toBe(30);
  });
});

describe("pegFlag", () => {
  it("marks PEG under 1 as ideal", () => {
    const out = pegFlag([{ priceToEarningsGrowthRatio: 0.8 }]);
    expect(out).toEqual({ value: 0.8, ideal: true });
  });

  it("marks PEG over 1 as not ideal", () => {
    expect(pegFlag([{ priceToEarningsGrowthRatio: 2.1 }]).ideal).toBe(false);
  });

  it("returns null when absent", () => {
    expect(pegFlag([{}])).toBeNull();
    expect(pegFlag([])).toBeNull();
  });
});
