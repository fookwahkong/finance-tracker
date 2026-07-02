import { describe, it, expect } from "vitest";
import { guidanceMessages, THRESHOLDS } from "./guidance";

const pos = (ticker, value, costBasis) => ({ ticker, value, costBasis, shares: 1 });

describe("guidanceMessages", () => {
  it("flags a holding down more than 15% from cost basis", () => {
    const enriched = [pos("AAPL", 800, 1000)];
    const totals = { value: 800, dayChangePct: 0 };
    const msgs = guidanceMessages(enriched, totals);
    expect(msgs.some((m) => m.id === "AAPL:down")).toBe(true);
  });

  it("flags a portfolio-wide daily drop over 3%", () => {
    const enriched = [pos("AAPL", 1000, 1000)];
    const totals = { value: 1000, dayChangePct: -3.5 };
    expect(guidanceMessages(enriched, totals).some((m) => m.id === "portfolio:day")).toBe(true);
  });

  it("flags concentration above 25%", () => {
    const enriched = [pos("AAPL", 30, 30), pos("MSFT", 70, 70)];
    const totals = { value: 100, dayChangePct: 0 };
    const msgs = guidanceMessages(enriched, totals);
    expect(msgs.some((m) => m.id === "MSFT:concentration")).toBe(true);
    expect(msgs.some((m) => m.id === "AAPL:concentration")).toBe(true); // 30% > 25%
  });

  it("flags a holding up more than 50%", () => {
    const enriched = [pos("NVDA", 1600, 1000)];
    const totals = { value: 1600, dayChangePct: 0 };
    expect(guidanceMessages(enriched, totals).some((m) => m.id === "NVDA:up")).toBe(true);
  });

  it("is quiet when nothing triggers", () => {
    // five equal-weight holdings (20% each), all near cost, calm day
    const enriched = ["AAPL", "MSFT", "NVDA", "GOOG", "AMZN"].map((t) => pos(t, 102, 100));
    const totals = { value: 510, dayChangePct: 0.4 };
    expect(guidanceMessages(enriched, totals)).toEqual([]);
  });

  it("skips holdings without a live value", () => {
    const enriched = [{ ticker: "AAPL", value: null, costBasis: 1000, shares: 1 }];
    const totals = { value: 0, dayChangePct: 0 };
    expect(guidanceMessages(enriched, totals)).toEqual([]);
  });

  it("respects custom thresholds", () => {
    const enriched = [pos("AAPL", 950, 1000)]; // -5%
    const totals = { value: 950, dayChangePct: 0 };
    const custom = { ...THRESHOLDS, holdingDownPct: -4 };
    expect(guidanceMessages(enriched, totals, custom).some((m) => m.id === "AAPL:down")).toBe(true);
  });
});
