import { describe, it, expect } from "vitest";
import { barsFromAggregates, sliceRange } from "./chart";

const ms = (d) => new Date(d).getTime();

describe("barsFromAggregates", () => {
  it("maps results to bars sorted ascending by t", () => {
    const agg = { results: [
      { t: ms("2026-06-02"), o: 2, h: 3, l: 1, c: 2.5, v: 10 },
      { t: ms("2026-06-01"), o: 1, h: 2, l: 0.5, c: 1.5, v: 20 },
    ]};
    const bars = barsFromAggregates(agg);
    expect(bars.map((b) => b.c)).toEqual([1.5, 2.5]);
  });

  it("returns [] when results missing", () => {
    expect(barsFromAggregates({})).toEqual([]);
    expect(barsFromAggregates(null)).toEqual([]);
  });
});

describe("sliceRange", () => {
  // 400 daily bars ending 2026-06-30
  const today = new Date("2026-06-30");
  const bars = Array.from({ length: 400 }, (_, i) => {
    const d = new Date("2026-06-30");
    d.setDate(d.getDate() - (399 - i));
    return { t: d.getTime(), o: 1, h: 1, l: 1, c: i, v: 1 };
  });

  it("MAX returns all bars", () => {
    expect(sliceRange(bars, "MAX", today)).toHaveLength(400);
  });

  it("1M keeps roughly the last 30 calendar days", () => {
    const out = sliceRange(bars, "1M", today);
    expect(out.length).toBeGreaterThanOrEqual(29);
    expect(out.length).toBeLessThanOrEqual(32);
    expect(out[out.length - 1].t).toBe(bars[399].t);
  });

  it("YTD keeps only bars on/after Jan 1 of today's year", () => {
    const out = sliceRange(bars, "YTD", today);
    const jan1 = new Date("2026-01-01").getTime();
    expect(out.every((b) => b.t >= jan1)).toBe(true);
    expect(out[0].t).toBeGreaterThanOrEqual(jan1);
  });

  it("1Y keeps roughly the last 365 days", () => {
    const out = sliceRange(bars, "1Y", today);
    expect(out.length).toBeGreaterThanOrEqual(364);
    expect(out.length).toBeLessThanOrEqual(366);
  });
});
